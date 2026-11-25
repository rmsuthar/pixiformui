// Starter server for {{name}}: one process for the app and its API.
//   npm run dev     → Vite (hot reload) + API on http://localhost:5173
//   npm run build && npm start  → built app + API (set HTTPS=1 behind a TLS proxy)
//
// What it does for every sign-up: same-origin + CSRF checks, rate limit, minimum fill time,
// proof-of-work check, idempotency (retries processed once), decrypting the password fields
// (PFE1), and validation with the same rules as the browser (shared/fields.js).
import { createServer } from 'node:http';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fields, MIN_PASSWORD } from '../shared/fields.js';
import { loadKeyRing, openEnvelope } from './lib/pfe.mjs';
import { csrfOk, getSession, idempotency, MIN_FILL_MS, newPow, proofOk, rateLimiter, sameOrigin } from './security.mjs';
import { validate } from './validate.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.PORT ?? (DEV ? 5173 : 3000));
const SECURE = process.env.HTTPS === '1';
const MAX_BODY = 16 * 1024;

// Encryption key for password fields. Created on first run in .keys/ (keep it out of git; in
// production load it from your secrets manager and set PFE_KEY_FILE).
const pfe = loadKeyRing({ currentFile: process.env.PFE_KEY_FILE ?? join(root, '.keys', 'pfe-current.pem'), allowGenerate: true });

const users = new Map(); // demo store: email → { name, hash }. Use your database.
const signupLimit = rateLimiter(10, 60_000);

// ------------------------------------------------------------------ helpers
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  ...(DEV ? {} : { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" }),
  ...(SECURE ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
};

function json(res, status, body, extra = {}) {
  res.writeHead(status, { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large.'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const ip = (req) => req.socket.remoteAddress ?? 'unknown';

// ------------------------------------------------------------------ API
function session(req, res) {
  const s = getSession(req, res, { create: true, secure: SECURE });
  json(res, 200, {
    csrfToken: s.csrf,
    encryption: { alg: 'PFE1', kid: pfe.current.kid, spki: pfe.current.spki, challenge: s.challenge },
    ...(s.pow.difficulty ? { pow: s.pow } : {}),
  });
}

async function signup(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' }, { Allow: 'POST' });
  if (!sameOrigin(req, SECURE)) return json(res, 403, { ok: false, message: 'Cross-site request refused.' });
  if (!String(req.headers['content-type']).startsWith('application/json')) return json(res, 415, { ok: false, message: 'Send JSON.' });
  const s = getSession(req, res);
  if (!s || !csrfOk(req, s)) return json(res, 403, { ok: false, message: 'Your session expired. Please try again.' });
  if (!signupLimit(ip(req))) return json(res, 429, { ok: false, message: 'Too many attempts. Please wait a minute.' }, { 'Retry-After': '60' });

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return json(res, err.status ?? 400, { ok: false, message: err.message });
  }

  // Every reply carries the next single-use challenges.
  const reply = (status, payload, extra) => json(res, status, { ...payload, challenge: s.challenge, ...(s.pow.difficulty ? { pow: s.pow } : {}) }, extra);

  const idem = idempotency(req, s, body);
  if (idem.replay) return json(res, idem.replay.status, idem.replay.body, { 'Idempotency-Replayed': 'true' });
  if (idem.conflict === 409) return reply(409, { ok: false, message: 'Your previous submission is still being processed.' }, { 'Idempotency-Status': 'in-progress' });
  if (idem.conflict === 422) return reply(422, { ok: false, message: 'This request was already used for different data.' });
  const finish = (status, payload, extra) => {
    if (idem.entry) {
      if (status >= 500) s.idem.delete(idem.key); // let a retry try again
      else Object.assign(idem.entry, { done: true, status, body: { ...payload, challenge: s.challenge, pow: s.pow } });
    }
    return reply(status, payload, extra);
  };

  if (Date.now() - s.issuedAt < MIN_FILL_MS) return finish(400, { ok: false, message: 'That was quick! Please check the form and try again.' });
  if (!proofOk(req, s)) return finish(400, { ok: false, message: 'Security check failed. Please try again.' });
  s.pow = newPow(); // the proof is single use

  const { data, errors } = validate(fields, body);

  // Decrypt the passwords (bound to this session's single-use challenge and the field name).
  const challenge = s.challenge;
  s.challenge = randomBytes(16).toString('base64url');
  const secrets = {};
  try {
    for (const name of ['password', 'confirmPassword']) {
      if (typeof data[name] === 'string') secrets[name] = openEnvelope(data[name], pfe.byKid, `${challenge}|${name}`);
    }
  } catch {
    Object.values(secrets).forEach((b) => b.fill(0));
    return finish(400, { ok: false, message: 'Your session changed. Please re-enter your password.' });
  }
  try {
    const pw = secrets.password;
    const confirm = secrets.confirmPassword;
    if (pw && [...pw.toString('utf8')].length < MIN_PASSWORD) errors.password ??= `Use at least ${MIN_PASSWORD} characters.`;
    if (pw && confirm && (pw.length !== confirm.length || !timingSafeEqual(pw, confirm))) errors.confirmPassword ??= 'The passwords don’t match.';
    if (data.email && users.has(data.email)) errors.email ??= 'An account with this email already exists.';
    if (Object.keys(errors).length) return finish(422, { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: errors });

    const salt = randomBytes(16);
    users.set(data.email, { name: data.fullName, hash: `${salt.toString('base64url')}:${scryptSync(pw, salt, 32).toString('base64url')}`, at: Date.now() });
    // Log what you'd store, never the password.
    console.log('[signup]', { ...data, password: undefined, confirmPassword: undefined });
    return finish(201, { ok: true, message: `Welcome, ${data.fullName}! Your account was created.` });
  } finally {
    Object.values(secrets).forEach((b) => b.fill(0));
  }
}

// ------------------------------------------------------------------ static files (production)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.map': 'application/json', '.woff2': 'font/woff2' };
const dist = join(root, 'dist');

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let file = normalize(join(dist, decodeURIComponent(url.pathname)));
  if (!file.startsWith(dist)) return json(res, 400, { message: 'Bad path.' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  if (!existsSync(file)) return json(res, 503, { message: 'Run `npm run build` first.' });
  const immutable = file.includes(`${join(dist, 'assets')}`);
  res.writeHead(200, { ...HEADERS, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  createReadStream(file).pipe(res);
}

// ------------------------------------------------------------------ start
const vite = DEV ? await (await import('vite')).createServer({ root, server: { middlewareMode: true }, appType: 'spa' }) : null;

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/api/session') return session(req, res);
    if (path === '/api/signup') return await signup(req, res);
    if (path.startsWith('/api/')) return json(res, 404, { message: 'Not found.' });
    if (vite) return vite.middlewares(req, res);
    serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { ok: false, message: 'Something went wrong.' });
  }
});
server.listen(PORT, () => console.log(`\n  {{name}} running at http://localhost:${PORT}${DEV ? ' (dev)' : ''}\n`));
