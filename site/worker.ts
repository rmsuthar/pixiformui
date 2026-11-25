/**
 * Cloudflare Worker for pixiformui.lets.gen.in. Static files are served by the assets binding
 * without running this code; only /api/* reaches it (`run_worker_first` in wrangler.jsonc).
 *
 *   GET  /api/waitlist/session  → { pow: { challenge, difficulty } }   (no cookies, no state)
 *   POST /api/waitlist          → { ok, message?, fieldErrors? }        (the Pro & Cloud waitlist)
 *
 * Abuse protection without sessions: the proof-of-work challenge is signed (HMAC) and carries its
 * issue time, so the Worker can check it, enforce a minimum fill time, and refuse reuse (KV, TTL).
 * Sign-ups live in KV under `wl:<sha256(email)>`, with the record also in the key's metadata so
 * `npm run waitlist` can export everything with one list call.
 */
import { checkPow, parsePowToken } from '../shared/pow.ts';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
}
export interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  WAITLIST: KVNamespace;
  WAITLIST_SECRET: string;
  /** Overrides for tests / tuning. */
  POW_DIFFICULTY?: string;
  MIN_FILL_MS?: string;
  RATE_LIMIT?: string;
}

const MAX_BODY = 8 * 1024;
const CHALLENGE_TTL_S = 15 * 60;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/;
const TEAM_SIZES = ['1', '2-10', '11-50', '51-200', '201+'];
const INTERESTS = { interest_cloud: 'cloud', interest_card: 'card-field', interest_pro: 'pro-controls', interest_enterprise: 'enterprise' } as const;
const TEXT_FIELDS = { name: 80, company: 120, message: 1000, source: 64 } as const;
const ALLOWED = new Set(['email', 'teamSize', 'consent', ...Object.keys(INTERESTS), ...Object.keys(TEXT_FIELDS)]);

const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmac(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data as BufferSource));
}
async function sha256(s: string): Promise<string> {
  return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
}
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.reduce((d, x, i) => d | (x ^ b[i]), 0) === 0;

/** Challenge = base64url(issued-at seconds [6 bytes] ‖ random [6] ‖ HMAC [12]): 32 characters. */
export async function newChallenge(secret: string, nowMs = Date.now()): Promise<string> {
  const head = new Uint8Array(12);
  const ts = Math.floor(nowMs / 1000);
  for (let i = 0; i < 6; i++) head[i] = Math.floor(ts / 256 ** (5 - i)) & 0xff;
  crypto.getRandomValues(head.subarray(6));
  const mac = (await hmac(secret, head)).subarray(0, 12);
  const out = new Uint8Array(24);
  out.set(head);
  out.set(mac, 12);
  return b64u(out);
}

/** Issue time (ms) of a genuine challenge, or null. */
export async function challengeTime(secret: string, challenge: string): Promise<number | null> {
  let bytes: Uint8Array;
  try {
    bytes = unb64u(challenge);
  } catch {
    return null;
  }
  if (bytes.length !== 24) return null;
  const head = bytes.subarray(0, 12);
  if (!equal((await hmac(secret, head)).subarray(0, 12), bytes.subarray(12))) return null;
  let ts = 0;
  for (let i = 0; i < 6; i++) ts = ts * 256 + head[i];
  return ts * 1000;
}

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin');
  const site = req.headers.get('Sec-Fetch-Site');
  if (!origin || origin === 'null') return site === 'same-origin';
  return origin === new URL(req.url).origin;
}

async function underLimit(env: Env, req: Request, limit: number): Promise<boolean> {
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  const key = `rl:${await sha256(`${env.WAITLIST_SECRET}:${ip}`)}:${Math.floor(Date.now() / 3_600_000)}`;
  const n = Number((await env.WAITLIST.get(key)) ?? 0) + 1;
  await env.WAITLIST.put(key, String(n), { expirationTtl: 3700 });
  return n <= limit;
}

async function session(env: Env): Promise<Response> {
  const difficulty = Math.max(0, Math.min(24, Number(env.POW_DIFFICULTY ?? 18)));
  return json(200, { pow: { challenge: await newChallenge(env.WAITLIST_SECRET), difficulty } });
}

async function join(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' }, { Allow: 'POST' });
  if (!sameOrigin(req)) return json(403, { ok: false, message: 'Cross-site request refused.' });
  if (!(req.headers.get('Content-Type') ?? '').startsWith('application/json')) return json(415, { ok: false, message: 'Send JSON.' });
  if (!(await underLimit(env, req, Number(env.RATE_LIMIT ?? 10)))) return json(429, { ok: false, message: 'Too many attempts. Please try again later.' }, { 'Retry-After': '3600' });

  // Proof-of-work on a genuine, fresh, unused challenge.
  const difficulty = Math.max(0, Math.min(24, Number(env.POW_DIFFICULTY ?? 18)));
  const proof = parsePowToken(req.headers.get('X-Form-Proof'));
  const issued = proof ? await challengeTime(env.WAITLIST_SECRET, proof.challenge) : null;
  const age = issued === null ? -1 : Date.now() - issued;
  if (!proof || issued === null || age > CHALLENGE_TTL_S * 1000 || age < -60_000 || !checkPow({ challenge: proof.challenge, difficulty }, proof.nonce)) {
    return json(400, { ok: false, message: 'Security check failed. Please reload the page and try again.' });
  }
  if (age < Number(env.MIN_FILL_MS ?? 3000)) return json(400, { ok: false, message: 'That was quick! Please check the form and try again.' });
  const usedKey = `used:${proof.challenge}`;
  if (await env.WAITLIST.get(usedKey)) return json(400, { ok: false, message: 'This form was already sent. Please reload the page.' });

  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { ok: false, message: 'Request too large.' });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { ok: false, message: 'Invalid JSON.' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, message: 'Invalid request.' });
  const unknown = Object.keys(body).filter((k) => !ALLOWED.has(k));
  if (unknown.length) return json(400, { ok: false, message: `Unexpected field: ${unknown[0].slice(0, 40)}` });

  const fieldErrors: Record<string, string> = {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) fieldErrors.email = 'Enter a valid email address.';
  if (body.consent !== true) fieldErrors.consent = 'Please agree so we can email you.';
  const teamSize = body.teamSize ?? null;
  if (teamSize !== null && !TEAM_SIZES.includes(String(teamSize))) fieldErrors.teamSize = 'Choose a team size.';
  const textValues: Record<string, string> = {};
  for (const [k, max] of Object.entries(TEXT_FIELDS)) {
    const v = body[k] ?? '';
    if (typeof v !== 'string') fieldErrors[k] = 'Invalid value.';
    else if (v.length > max) fieldErrors[k] = `Use at most ${max} characters.`;
    else textValues[k] = v.trim();
  }
  for (const k of Object.keys(INTERESTS)) if (body[k] !== undefined && typeof body[k] !== 'boolean') fieldErrors[k] = 'Invalid value.';
  if (Object.keys(fieldErrors).length) return json(422, { ok: false, message: 'Please fix the highlighted fields.', fieldErrors });

  await env.WAITLIST.put(usedKey, '1', { expirationTtl: CHALLENGE_TTL_S + 60 });
  const key = `wl:${await sha256(email)}`;
  const previous = await env.WAITLIST.get(key);
  const now = new Date().toISOString();
  const record = {
    email,
    ...textValues,
    teamSize,
    interests: Object.entries(INTERESTS).filter(([k]) => body[k] === true).map(([, v]) => v),
    createdAt: previous ? (JSON.parse(previous).createdAt ?? now) : now,
    updatedAt: now,
  };
  // Metadata is capped at 1 KB: keep the record minus the long message there, the full record as the value.
  await env.WAITLIST.put(key, JSON.stringify(record), { metadata: { ...record, message: (textValues.message ?? '').slice(0, 300) } });
  return json(200, {
    ok: true,
    message: previous ? 'You’re already on the list: we’ve updated your details.' : 'You’re on the list! We’ll email you when early access opens.',
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/api/') && (env.WAITLIST_SECRET ?? '').length < 16) {
      console.error('WAITLIST_SECRET is not set');
      return json(503, { ok: false, message: 'The waitlist is temporarily unavailable.' });
    }
    try {
      if (path === '/api/waitlist/session') return await session(env);
      if (path === '/api/waitlist') return await join(req, env);
      if (path.startsWith('/api/')) return json(404, { message: 'Not found.' });
    } catch (err) {
      console.error('waitlist error', err);
      return json(500, { ok: false, message: 'Something went wrong. Please try again.' });
    }
    return env.ASSETS.fetch(req);
  },
};
