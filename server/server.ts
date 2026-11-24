/**
 * PixiForm local server (no framework, no runtime dependencies).
 *
 *   npm run dev    -> Vite dev middleware + API on http://localhost:8787
 *   npm run serve  -> production build + static server + API
 *
 * Security controls:
 *  - Binds to 127.0.0.1 only; Host header allow-list (DNS-rebinding defence)
 *  - Strict CSP and hardening headers on every response
 *  - HttpOnly + SameSite=Strict session cookie, HMAC-bound CSRF token
 *  - Origin / Sec-Fetch-Site checks on state-changing requests
 *  - JSON-only, 16 KB body cap, strict schema (unknown fields rejected)
 *  - Shared validation rules (same file the browser uses)
 *  - Per-IP rate limits with exponential lockout
 *  - Passwords arrive PFE1-encrypted (ECDH P-256 + HKDF + AES-256-GCM), bound to a
 *    single-use session challenge and the field name; plaintext fields are refused
 *  - Peppered scrypt (N=2^17) hashing; plaintext bytes zeroed; never logged or echoed
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OTP_LENGTH, otpRules, registrationRules, validatePartial, validatePayload, validateValue } from '../shared/rules.ts';
import { b64u, verifyAuthentication, verifyRegistration, type StoredCredential } from './webauthn.ts';
import { REGISTRATION_DRAFT_RULES } from '../shared/agent.ts';
import { loadKeyRing, openEnvelope } from './pfe.ts';

const PROD = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8787);
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const SECRET = process.env.SESSION_SECRET ? Buffer.from(process.env.SESSION_SECRET) : randomBytes(32);
const MAX_BODY = 16 * 1024;
const SESSION_TTL = 30 * 60_000;
const MAX_SESSIONS = 10_000;
const COOKIE = 'pf_sid';
const ALLOWED_HOSTS = new Set([
  `localhost:${PORT}`,
  `127.0.0.1:${PORT}`,
  `[::1]:${PORT}`,
  // e.g. EXTRA_ALLOWED_HOSTS=abc123.trycloudflare.com,192.168.1.20:8787 (for device testing)
  ...(process.env.EXTRA_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
]);
const KEY_DIR = join(ROOT, '.keys');

// ------------------------------------------------------------------ secret-field encryption keys
const pfe = loadKeyRing({
  currentFile: process.env.PFE_KEY_FILE ?? join(KEY_DIR, 'pfe-current.pem'),
  retiredFiles: (process.env.PFE_RETIRED_KEY_FILES ?? '').split(',').filter(Boolean),
  allowGenerate: process.env.PFE_REQUIRE_KEY !== '1',
});
if (PROD && !process.env.PFE_KEY_FILE) console.warn('[pfe] using a local generated key; set PFE_KEY_FILE in production');

/** Server-side pepper: an HMAC key mixed into every password before hashing. */
const PEPPER = loadPepper();
function loadPepper(): Buffer {
  if (process.env.PASSWORD_PEPPER) return Buffer.from(process.env.PASSWORD_PEPPER, 'base64');
  const f = join(KEY_DIR, 'pepper');
  if (!existsSync(f)) {
    mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(f, randomBytes(32).toString('base64'), { mode: 0o600 });
  }
  return Buffer.from(readFileSync(f, 'utf8').trim(), 'base64');
}

/**
 * Bearer token for machine clients (e.g. the MCP server) that create registration
 * drafts. Set AGENT_API_TOKEN in production; locally it's generated in .keys/agent-token.
 */
const AGENT_TOKEN = loadAgentToken();
function loadAgentToken(): string {
  if (process.env.AGENT_API_TOKEN) return process.env.AGENT_API_TOKEN;
  const f = join(KEY_DIR, 'agent-token');
  if (!existsSync(f)) {
    mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(f, randomBytes(32).toString('base64url'), { mode: 0o600 });
  }
  return readFileSync(f, 'utf8').trim();
}

// Drafts: non-secret registration details prepared by an agent, completed by the person.
const DRAFT_TTL = 30 * 60_000;
const MAX_DRAFTS = 1_000;
const drafts = new Map<string, { data: Record<string, unknown>; expires: number }>();
function purgeDrafts(): void {
  const now = Date.now();
  for (const [id, d] of drafts) if (d.expires < now) drafts.delete(id);
}

/** Fields whose rule type is 'secret' must arrive encrypted. */
const SECRET_FIELDS = Object.entries(registrationRules)
  .filter(([, r]) => r.type === 'secret')
  .map(([name]) => name);

// ------------------------------------------------------------------ headers
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  PROD ? "style-src 'self'" : "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  PROD ? "connect-src 'self'" : `connect-src 'self' ws://localhost:${PORT} ws://127.0.0.1:${PORT}`,
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders(res: ServerResponse): void {
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  res.removeHeader('X-Powered-By');
}

function json(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(data);
}

// ------------------------------------------------------------------ sessions + CSRF
interface Session {
  lastSeen: number;
  /** Single-use value bound into encrypted envelopes (replay protection). */
  challenge: string;
  /** Pending one-time code: only a keyed hash is stored, never the code. */
  otp?: { hash: Buffer; expires: number; attempts: number };
  verified?: boolean;
  /** Pending passkey ceremony (single use). */
  passkey?: { challenge: string; type: 'register' | 'login'; username?: string; userId?: string; expires: number };
  /** Signed-in username (set by passkey sign-in or passkey registration). */
  user?: string;
}

// ------------------------------------------------------------------ passkeys (demo store)
const PASSKEY_TTL = 5 * 60_000;
const passkeys = new Map<string, StoredCredential>(); // credential ID → credential
const passkeyUsers = new Map<string, string>(); // username → WebAuthn user handle (random, base64url)

// ------------------------------------------------------------------ one-time codes
const OTP_TTL = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_DEV_LOG = !PROD || process.env.OTP_DEV_LOG === '1';
const otpHash = (sid: string, code: string) => createHmac('sha256', SECRET).update(`otp:${sid}:${code}`).digest();
const sessions = new Map<string, Session>();

function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function getSession(req: IncomingMessage): { sid: string; session: Session } | null {
  const sid = parseCookies(req)[COOKIE];
  if (!sid || !/^[A-Za-z0-9_-]{43}$/.test(sid)) return null;
  const s = sessions.get(sid);
  if (!s || Date.now() - s.lastSeen > SESSION_TTL) {
    sessions.delete(sid);
    return null;
  }
  s.lastSeen = Date.now();
  return { sid, session: s };
}

const newChallenge = () => randomBytes(24).toString('base64url');

function createSession(res: ServerResponse): { sid: string; session: Session } {
  if (sessions.size >= MAX_SESSIONS) {
    const now = Date.now();
    for (const [k, v] of sessions) if (now - v.lastSeen > SESSION_TTL) sessions.delete(k);
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
  }
  const sid = randomBytes(32).toString('base64url');
  const session: Session = { lastSeen: Date.now(), challenge: newChallenge() };
  sessions.set(sid, session);
  const secure = PROD && process.env.HTTPS === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}${secure}`);
  return { sid, session };
}

const csrfFor = (sid: string) => createHmac('sha256', SECRET).update(`csrf:${sid}`).digest('base64url');

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ------------------------------------------------------------------ rate limiting
interface Bucket {
  hits: number[];
  lockedUntil: number;
  lockouts: number;
}
const buckets = new Map<string, Bucket>();

/**
 * Test runs open the demo many times from one IP; RATE_LIMIT_SCALE (e.g. 50) raises every limit
 * for that. It is ignored in production so it can't weaken a real deployment by accident.
 */
const RATE_SCALE = PROD ? 1 : Math.max(1, Math.min(1000, Number(process.env.RATE_LIMIT_SCALE ?? 1) || 1));

function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  max *= RATE_SCALE;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size > 50_000) buckets.clear();
    b = { hits: [], lockedUntil: 0, lockouts: 0 };
    buckets.set(key, b);
  }
  if (now < b.lockedUntil) return { ok: false, retryAfter: Math.ceil((b.lockedUntil - now) / 1000) };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= max) {
    const lock = Math.min(60_000 * 2 ** b.lockouts, 30 * 60_000);
    b.lockouts++;
    b.lockedUntil = now + lock;
    b.hits = [];
    return { ok: false, retryAfter: Math.ceil(lock / 1000) };
  }
  b.hits.push(now);
  return { ok: true, retryAfter: 0 };
}

const clientIp = (req: IncomingMessage) => req.socket.remoteAddress ?? 'unknown';

/**
 * Common checks for state-changing JSON endpoints: POST, same origin, JSON
 * content type, valid session + CSRF token. Responds and returns null on failure.
 */
function guardStateChange(req: IncomingMessage, res: ServerResponse): { sid: string; session: Session } | null {
  if (req.method !== 'POST') {
    json(res, 405, { ok: false, message: 'Method not allowed.' }, { Allow: 'POST' });
    return null;
  }
  if (!sameOrigin(req)) {
    json(res, 403, { ok: false, message: 'Cross-origin request blocked.' });
    return null;
  }
  if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    json(res, 415, { ok: false, message: 'Content-Type must be application/json.' });
    return null;
  }
  const current = getSession(req);
  const token = req.headers['x-csrf-token'];
  if (!current || typeof token !== 'string' || !safeEqual(token, csrfFor(current.sid))) {
    json(res, 403, { ok: false, message: 'Your session expired. Please reload the page.' });
    return null;
  }
  return current;
}

// ------------------------------------------------------------------ users (demo store)
interface User {
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}
const users = new Map<string, User>();

// OWASP: scrypt N=2^17, r=8, p=1. The pepper (HMAC key kept outside the DB) means a
// stolen database alone is not enough to brute-force hashes.
const SCRYPT = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

function scryptAsync(input: Buffer, salt: Buffer, params: typeof SCRYPT): Promise<Buffer> {
  return new Promise((ok, fail) => scrypt(input, salt, 64, params, (err, key) => (err ? fail(err) : ok(key))));
}

/** Hashes password bytes. Does not keep any copy of the plaintext. */
export async function hashPassword(password: Buffer): Promise<string> {
  const salt = randomBytes(16);
  const peppered = createHmac('sha256', PEPPER).update(password).digest();
  try {
    const key = await scryptAsync(peppered, salt, SCRYPT);
    return `scrypt$v1$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
  } finally {
    peppered.fill(0);
  }
}

/** Constant-time verification for a login endpoint. */
export async function verifyPassword(password: Buffer, stored: string): Promise<boolean> {
  const [alg, v, n, r, p, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || v !== 'v1') return false;
  const peppered = createHmac('sha256', PEPPER).update(password).digest();
  try {
    const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem };
    const key = await scryptAsync(peppered, Buffer.from(saltB64, 'base64'), params);
    const expected = Buffer.from(hashB64, 'base64');
    return key.length === expected.length && timingSafeEqual(key, expected);
  } finally {
    peppered.fill(0);
  }
}

// ------------------------------------------------------------------ request helpers
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > MAX_BODY) return fail(Object.assign(new Error('too large'), { status: 413 }));
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

function sameOrigin(req: IncomingMessage): boolean {
  const host = req.headers.host ?? '';
  const origin = req.headers.origin;
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin') return false;
  // Pages with `Referrer-Policy: no-referrer` make Safari and Firefox send `Origin: null` on
  // same-origin POSTs. Sec-Fetch-Site can't be forged by scripts, and cross-origin sources that
  // send a null origin (sandboxed iframes, file://) are labelled 'cross-site', so this is safe.
  if (origin === 'null' && site === 'same-origin') return true;
  if (!origin) return false;
  return origin === `http://${host}` || origin === `https://${host}`;
}

// ------------------------------------------------------------------ API
async function handleApi(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const ip = clientIp(req);
  const global = rateLimit(`global:${ip}`, 120, 60_000);
  if (!global.ok) return json(res, 429, { ok: false, message: 'Too many requests.' }, { 'Retry-After': String(global.retryAfter) });

  if (path === '/api/session' && req.method === 'GET') {
    const { sid, session } = getSession(req) ?? createSession(res);
    return json(res, 200, {
      csrfToken: csrfFor(sid),
      encryption: { alg: 'PFE1', kid: pfe.current.kid, spki: pfe.current.spki, challenge: session.challenge },
    });
  }

  if (path === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true });

  if (path === '/api/otp/send' || path === '/api/otp/verify') {
    const current = guardStateChange(req, res);
    if (!current) return;
    const { sid, session } = current;

    if (path === '/api/otp/send') {
      const limit = rateLimit(`otp-send:${ip}`, 3, 60_000);
      if (!limit.ok) return json(res, 429, { ok: false, message: `Please wait ${limit.retryAfter}s before requesting another code.` }, { 'Retry-After': String(limit.retryAfter) });
      const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0'); // CSPRNG, uniform
      session.otp = { hash: otpHash(sid, code), expires: Date.now() + OTP_TTL, attempts: 0 };
      session.verified = false;
      // Integrate your SMS/email provider here. Dev mode prints the code instead.
      if (OTP_DEV_LOG) console.log(`[otp:dev] verification code ${code} (valid 5 min)`);
      return json(res, 200, {
        ok: true,
        message: OTP_DEV_LOG ? 'Code sent. In dev mode it is printed in the server console.' : 'Code sent.',
        expiresIn: OTP_TTL / 1000,
      });
    }

    const limit = rateLimit(`otp-verify:${ip}`, 10, 60_000);
    if (!limit.ok) return json(res, 429, { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` }, { 'Retry-After': String(limit.retryAfter) });
    let payload: unknown;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { ok: false, message: 'Malformed JSON.' });
    }
    const result = validatePayload(otpRules, payload);
    if (!result.ok) return json(res, 422, { ok: false, message: 'Please check the code.', fieldErrors: result.errors });
    const otp = session.otp;
    if (!otp || Date.now() > otp.expires) {
      session.otp = undefined;
      return json(res, 400, { ok: false, message: 'The code expired. Request a new one.', fieldErrors: { code: 'Code expired. Request a new one.' } });
    }
    otp.attempts++;
    const ok = timingSafeEqual(otpHash(sid, String(result.data.code)), otp.hash);
    if (!ok) {
      const left = OTP_MAX_ATTEMPTS - otp.attempts;
      if (left <= 0) session.otp = undefined; // burn the code after too many guesses
      return json(res, 400, {
        ok: false,
        message: left > 0 ? 'Incorrect code.' : 'Too many incorrect attempts. Request a new code.',
        fieldErrors: { code: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Request a new code.' },
      });
    }
    session.otp = undefined; // single use
    session.verified = true;
    return json(res, 200, { ok: true, message: 'Verified! Your phone number is confirmed.' });
  }

  // ---- drafts (agent → person handoff)
  if (path === '/api/drafts') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' }, { Allow: 'POST' });
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ') || !safeEqual(auth.slice(7), AGENT_TOKEN)) {
      return json(res, 401, { ok: false, message: 'Unauthorized.' }, { 'WWW-Authenticate': 'Bearer' });
    }
    if (req.headers.origin) return json(res, 403, { ok: false, message: 'Not a browser endpoint.' });
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return json(res, 415, { ok: false, message: 'Content-Type must be application/json.' });
    }
    const limit = rateLimit(`drafts:${ip}`, 30, 60_000);
    if (!limit.ok) return json(res, 429, { ok: false, message: 'Too many drafts.' }, { 'Retry-After': String(limit.retryAfter) });
    let payload: unknown;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { ok: false, message: 'Malformed JSON.' });
    }
    const result = validatePartial(REGISTRATION_DRAFT_RULES, payload);
    if (!result.ok) return json(res, 422, { ok: false, message: 'Some details are invalid.', fieldErrors: result.errors });
    purgeDrafts();
    if (drafts.size >= MAX_DRAFTS) return json(res, 503, { ok: false, message: 'Too many open drafts. Try again later.' });
    const id = randomBytes(16).toString('base64url'); // 128-bit, unguessable
    const expires = Date.now() + DRAFT_TTL;
    drafts.set(id, { data: result.data, expires });
    return json(res, 201, { ok: true, id, expiresAt: new Date(expires).toISOString() });
  }

  if (path === '/api/drafts/claim') {
    const current = guardStateChange(req, res);
    if (!current) return;
    const limit = rateLimit(`draft-claim:${ip}`, 20, 60_000);
    if (!limit.ok) return json(res, 429, { ok: false, message: 'Too many requests.' }, { 'Retry-After': String(limit.retryAfter) });
    let id: unknown;
    try {
      id = (JSON.parse(await readBody(req)) as { id?: unknown })?.id;
    } catch {
      return json(res, 400, { ok: false, message: 'Malformed JSON.' });
    }
    const draft = typeof id === 'string' && /^[A-Za-z0-9_-]{22}$/.test(id) ? drafts.get(id) : undefined;
    if (draft) drafts.delete(id as string); // single use
    if (!draft || draft.expires < Date.now()) return json(res, 404, { ok: false, message: 'This link has expired or was already used.' });
    return json(res, 200, { ok: true, values: draft.data });
  }

  // ---- passkeys (WebAuthn)
  if (path.startsWith('/api/passkey/')) {
    const current = guardStateChange(req, res);
    if (!current) return;
    // Issuing a challenge is cheap (and the demo asks for one on every load for passkey suggestions);
    // verifying is what an attacker would hammer, so it gets the strict limit.
    const isVerify = path.endsWith('/verify');
    const limit = rateLimit(`passkey-${isVerify ? 'verify' : 'options'}:${ip}`, isVerify ? 20 : 60, 60_000);
    if (!limit.ok) return json(res, 429, { ok: false, message: 'Too many attempts. Try again shortly.' }, { 'Retry-After': String(limit.retryAfter) });
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(await readBody(req));
      body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return json(res, 400, { ok: false, message: 'Malformed JSON.' });
    }
    const { session } = current;
    const host = (req.headers.host ?? '').toLowerCase();
    const rpId = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    const headerOrigin = req.headers.origin;
    const origin = headerOrigin && headerOrigin !== 'null' ? headerOrigin : `${PROD && process.env.HTTPS === '1' ? 'https' : 'http'}://${host}`;
    const newChallenge32 = () => b64u(randomBytes(32));
    const takePending = (type: 'register' | 'login') => {
      const p = session.passkey;
      session.passkey = undefined; // single use, whatever the outcome
      return p && p.type === type && p.expires > Date.now() ? p : null;
    };

    if (path === '/api/passkey/register/options') {
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const err = validateValue({ ...registrationRules.username, required: true }, username);
      if (err) return json(res, 422, { ok: false, message: err, fieldErrors: { username: err } });
      const takenByPassword = [...users.values()].some((u) => u.username === username);
      const ownedHere = session.user === username;
      if ((takenByPassword || passkeyUsers.has(username)) && !ownedHere) {
        return json(res, 409, { ok: false, message: 'That username is taken. Sign in to add a passkey to it.', fieldErrors: { username: 'This username is taken.' } });
      }
      const userId = passkeyUsers.get(username) ?? b64u(randomBytes(16));
      const challenge = newChallenge32();
      session.passkey = { challenge, type: 'register', username, userId, expires: Date.now() + PASSKEY_TTL };
      return json(res, 200, {
        ok: true,
        options: {
          challenge,
          rp: { id: rpId, name: 'PixiFormUI demo' },
          user: { id: userId, name: username, displayName: username },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          timeout: PASSKEY_TTL,
          attestation: 'none',
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          excludeCredentials: [...passkeys.values()].filter((c) => c.username === username).map((c) => ({ type: 'public-key', id: c.id, transports: c.transports })),
        },
      });
    }

    if (path === '/api/passkey/register/verify') {
      const pending = takePending('register');
      if (!pending?.username || !pending.userId) return json(res, 400, { ok: false, message: 'The passkey request expired. Please try again.' });
      try {
        const cred = verifyRegistration(body.credential, { challenge: pending.challenge, origin, rpId, requireUserVerification: true }, pending.username);
        if (passkeys.has(cred.id)) return json(res, 409, { ok: false, message: 'This passkey is already registered.' });
        passkeys.set(cred.id, cred);
        passkeyUsers.set(pending.username, pending.userId);
        session.user = pending.username;
        console.log(`[passkey] registered for ${pending.username} (${passkeys.size} total)`);
        return json(res, 201, { ok: true, message: `Passkey created. You're signed in as ${pending.username}.`, username: pending.username });
      } catch (e) {
        return json(res, 400, { ok: false, message: `Passkey could not be verified (${(e as Error).message}).` });
      }
    }

    if (path === '/api/passkey/login/options') {
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const challenge = newChallenge32();
      session.passkey = { challenge, type: 'login', username: username || undefined, expires: Date.now() + PASSKEY_TTL };
      // Unknown usernames get an empty list too, so the response doesn't reveal which accounts exist.
      const allow = username ? [...passkeys.values()].filter((c) => c.username === username).map((c) => ({ type: 'public-key', id: c.id, transports: c.transports })) : [];
      return json(res, 200, { ok: true, options: { challenge, rpId, timeout: PASSKEY_TTL, userVerification: 'required', allowCredentials: allow } });
    }

    if (path === '/api/passkey/login/verify') {
      const pending = takePending('login');
      if (!pending) return json(res, 400, { ok: false, message: 'The sign-in request expired. Please try again.' });
      const id = (body.credential as { id?: unknown } | undefined)?.id;
      const stored = typeof id === 'string' ? passkeys.get(id) : undefined;
      if (!stored || (pending.username && pending.username !== stored.username)) {
        return json(res, 400, { ok: false, message: 'This passkey is not registered here.' });
      }
      try {
        stored.signCount = verifyAuthentication(body.credential, stored, { challenge: pending.challenge, origin, rpId, requireUserVerification: true });
        session.user = stored.username;
        return json(res, 200, { ok: true, message: `Signed in as ${stored.username} with a passkey.`, username: stored.username });
      } catch (e) {
        return json(res, 400, { ok: false, message: `Passkey sign-in failed (${(e as Error).message}).` });
      }
    }
    return json(res, 404, { ok: false, message: 'Not found.' });
  }

  if (path === '/api/register') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' }, { Allow: 'POST' });
    if (!sameOrigin(req)) return json(res, 403, { ok: false, message: 'Cross-origin request blocked.' });
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return json(res, 415, { ok: false, message: 'Content-Type must be application/json.' });
    }
    const current = getSession(req);
    const token = req.headers['x-csrf-token'];
    if (!current || typeof token !== 'string' || !safeEqual(token, csrfFor(current.sid))) {
      return json(res, 403, { ok: false, message: 'Your session expired. Please reload the page.' });
    }
    // The challenge is single-use: consume it now and hand the browser a fresh one
    // with every response, so a captured request can never be replayed.
    const challenge = current.session.challenge;
    current.session.challenge = newChallenge();
    const reply = (status: number, body: Record<string, unknown>, extra?: Record<string, string>) =>
      json(res, status, { ...body, challenge: current.session.challenge }, extra);
    const limit = rateLimit(`register:${ip}`, 5, 60_000);
    if (!limit.ok) {
      return reply(429, { ok: false, message: `Too many attempts. Try again in ${limit.retryAfter}s.` }, { 'Retry-After': String(limit.retryAfter) });
    }

    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(await readBody(req));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
      payload = { ...(parsed as Record<string, unknown>) };
    } catch (e) {
      const status = (e as { status?: number }).status ?? 400;
      return reply(status, { ok: false, message: status === 413 ? 'Request too large.' : 'Malformed JSON.' });
    }

    // Decrypt secret fields. Plaintext (non-envelope) values are refused.
    const secrets = new Map<string, Buffer>();
    try {
      const decryptErrors: Record<string, string> = {};
      for (const field of SECRET_FIELDS) {
        const v = payload[field];
        if (v === undefined || v === null || v === '') continue; // the 'required' rule reports it
        try {
          const bytes = openEnvelope(v, pfe.byKid, `${challenge}|${field}`);
          secrets.set(field, bytes);
          payload[field] = bytes.toString('utf8'); // needed for the shared text rules
        } catch {
          decryptErrors[field] = 'This field could not be read securely. Please type it again.';
        }
      }
      if (Object.keys(decryptErrors).length) {
        return reply(400, { ok: false, message: 'Secure fields could not be verified. Please retype your password.', fieldErrors: decryptErrors });
      }
      return await finishRegistration(payload, secrets, reply);
    } finally {
      for (const b of secrets.values()) b.fill(0);
      for (const f of SECRET_FIELDS) delete payload[f];
    }
  }

  return json(res, 404, { ok: false, message: 'Not found.' });
}

type Reply = (status: number, body: Record<string, unknown>, extra?: Record<string, string>) => void;

async function finishRegistration(payload: Record<string, unknown>, secrets: Map<string, Buffer>, reply: Reply): Promise<void> {
  const result = validatePayload(registrationRules, payload);
  if (!result.ok) return reply(422, { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: result.errors });

  const d = result.data as Record<string, string | number | boolean>;
  const email = String(d.email).toLowerCase();
  const username = String(d.username);
  if (users.has(email) || [...users.values()].some((u) => u.username === username)) {
    return reply(409, {
      ok: false,
      message: 'That account already exists.',
      fieldErrors: users.has(email) ? { email: 'This email is already registered.' } : { username: 'This username is taken.' },
    });
  }

  const passwordHash = await hashPassword(secrets.get('password')!);
  users.set(email, { username, email, passwordHash, createdAt: new Date().toISOString() });
  console.log(`[register] new account username=${username} (total ${users.size})`);
  return reply(201, { ok: true, message: `Welcome, ${username}! Your account was created.` });
}

// ------------------------------------------------------------------ static files (production)
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

async function serveStatic(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { message: 'Method not allowed.' });
  let rel: string;
  try {
    rel = decodeURIComponent(path);
  } catch {
    return json(res, 400, { message: 'Bad path.' });
  }
  if (rel.includes('\0')) return json(res, 400, { message: 'Bad path.' });
  let file = normalize(join(DIST, rel));
  if (file !== DIST && !file.startsWith(DIST + sep)) return json(res, 403, { message: 'Forbidden.' });
  try {
    const st = await stat(file);
    if (st.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html'); // SPA fallback
  }
  const ext = extname(file);
  const type = MIME[ext];
  if (!type) return json(res, 404, { message: 'Not found.' });
  const body = await readFile(file);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': body.length,
    'Cache-Control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

// ------------------------------------------------------------------ boot
type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
let viteMiddleware: Middleware | null = null;

const server = createServer(async (req, res) => {
  const started = Date.now();
  securityHeaders(res);
  res.on('finish', () => {
    if (req.url?.startsWith('/api/')) console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`);
  });
  try {
    if (!ALLOWED_HOSTS.has((req.headers.host ?? '').toLowerCase())) return json(res, 421, { message: 'Unknown host.' });
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname);
    if (viteMiddleware) return viteMiddleware(req, res, () => json(res, 404, { message: 'Not found.' }));
    return await serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error('[error]', (err as Error).message);
    if (!res.headersSent) json(res, 500, { ok: false, message: 'Internal error.' });
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.keepAliveTimeout = 5_000;

if (!PROD) {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    root: ROOT,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server } },
  });
  viteMiddleware = vite.middlewares as unknown as Middleware;
}

server.listen(PORT, HOST, () => {
  console.log(`PixiForm ${PROD ? 'production' : 'dev'} server -> http://localhost:${PORT}`);
});
