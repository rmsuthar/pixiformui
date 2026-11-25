// The API, framework-neutral: each handler takes a plain request and returns a plain response.
//   request:  { method, headers (lower-case names), text: () => Promise<string>, ip }
//   response: { status, headers, body (JSON string) }
// server/server.mjs adapts it to Node's http server; a Next.js template adapts it to route handlers.
//
// For every sign-up: same-origin + CSRF checks, rate limit, minimum fill time, proof-of-work,
// idempotency (retries processed once), decrypting the password fields (PFE1), and validation with
// the same rules as the browser (shared/fields.js, including showIf).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { fields, MIN_PASSWORD } from '../shared/fields.js';
import { loadKeyRing, openEnvelope } from './lib/pfe.mjs';
import { csrfOk, getSession, idempotency, MIN_FILL_MS, newChallenge, newPow, proofOk, sameOrigin, store, underLimit } from './security.mjs';
import { validate } from './validate.mjs';

const MAX_BODY = 16 * 1024;
/** Set HTTPS=1 in production (behind TLS): secure cookies. */
export const SECURE = process.env.HTTPS === '1';

// Encryption key for password fields. Created on first run in .keys/ (keep it out of git; in
// production load it from your secrets manager and set PFE_KEY_FILE).
let keys;
const pfe = () => (keys ??= loadKeyRing({ currentFile: process.env.PFE_KEY_FILE ?? join(process.cwd(), '.keys', 'pfe-current.pem'), allowGenerate: true }));

const json = (status, body, headers = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  body: JSON.stringify(body),
});

/** GET /api/session: CSRF token, encryption key + single-use challenge, proof-of-work challenge. */
export function handleSession(req) {
  const { session: s, setCookie } = getSession(req.headers, { create: true, secure: SECURE });
  const k = pfe().current;
  return json(
    200,
    { csrfToken: s.csrf, encryption: { alg: 'PFE1', kid: k.kid, spki: k.spki, challenge: s.challenge }, ...(s.pow.difficulty ? { pow: s.pow } : {}) },
    setCookie ? { 'Set-Cookie': setCookie } : {},
  );
}

/** POST /api/signup */
export async function handleSignup(req) {
  const h = req.headers;
  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' }, { Allow: 'POST' });
  if (!sameOrigin(h, SECURE)) return json(403, { ok: false, message: 'Cross-site request refused.' });
  if (!String(h['content-type'] ?? '').startsWith('application/json')) return json(415, { ok: false, message: 'Send JSON.' });
  const { session: s } = getSession(h);
  if (!s || !csrfOk(h, s)) return json(403, { ok: false, message: 'Your session expired. Please try again.' });
  if (!underLimit(`signup:${req.ip}`, 10, 60_000)) return json(429, { ok: false, message: 'Too many attempts. Please wait a minute.' }, { 'Retry-After': '60' });

  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { ok: false, message: 'Request too large.' });
  let body;
  try {
    body = JSON.parse(text || '{}');
  } catch {
    return json(400, { ok: false, message: 'Invalid JSON.' });
  }

  // Every reply carries the next single-use challenges.
  const reply = (status, payload, extra) => json(status, { ...payload, challenge: s.challenge, ...(s.pow.difficulty ? { pow: s.pow } : {}) }, extra);
  const idem = idempotency(h, s, body);
  if (idem.replay) return json(idem.replay.status, idem.replay.body, { 'Idempotency-Replayed': 'true' });
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
  if (!proofOk(h, s)) return finish(400, { ok: false, message: 'Security check failed. Please try again.' });
  s.pow = newPow(); // the proof is single use

  const { data, errors } = validate(fields, body);

  // Decrypt the passwords (bound to this session's single-use challenge and the field name).
  const challenge = s.challenge;
  s.challenge = newChallenge();
  const secrets = {};
  try {
    for (const name of ['password', 'confirmPassword']) {
      if (typeof data[name] === 'string') secrets[name] = openEnvelope(data[name], pfe().byKid, `${challenge}|${name}`);
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
    if (data.email && store.users.has(data.email)) errors.email ??= 'An account with this email already exists.';
    if (Object.keys(errors).length) return finish(422, { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: errors });

    const salt = randomBytes(16);
    store.users.set(data.email, { name: data.fullName, hash: `${salt.toString('base64url')}:${scryptSync(pw, salt, 32).toString('base64url')}`, at: Date.now() });
    // Log what you'd store, never the password.
    console.log('[signup]', { ...data, password: undefined, confirmPassword: undefined });
    return finish(201, { ok: true, message: `Welcome, ${data.fullName}! Your account was created.` });
  } finally {
    Object.values(secrets).forEach((b) => b.fill(0));
  }
}
