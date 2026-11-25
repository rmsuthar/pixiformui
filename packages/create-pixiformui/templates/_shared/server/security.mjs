// Sessions, CSRF tokens, proof-of-work, rate limits and idempotency for the starter server.
// Framework-neutral: everything takes a plain `headers` object (lower-case names).
// The in-memory store keeps the starter dependency-free; use Redis or your database when you run
// more than one server process. It lives on globalThis so dev reloads and bundlers that load this
// file more than once (e.g. one copy per Next.js route) share it.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { checkPow, parsePowToken } from './lib/pow.mjs';

const SESSION_TTL = 30 * 60_000;
const MAX_SESSIONS = 50_000;
/** Leading zero bits for the proof-of-work (each +1 doubles the work; 0 turns it off). */
export const POW_DIFFICULTY = Math.max(0, Math.min(26, Number(process.env.POW_DIFFICULTY ?? 18) || 0));
/** Minimum time between loading the form and submitting it. */
export const MIN_FILL_MS = Math.max(0, Number(process.env.MIN_FILL_MS ?? 2000) || 0);

export const store = (globalThis.__pixiformStarter ??= { sessions: new Map(), users: new Map(), hits: new Map() });

const token = (n = 24) => randomBytes(n).toString('base64url');
export const newPow = () => ({ challenge: token(18), difficulty: POW_DIFFICULTY });
export const newChallenge = () => token(16);

function cookie(headers, name) {
  for (const part of String(headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

/**
 * The caller's session. With `create`, makes one when missing and returns the Set-Cookie value
 * to send: `{ session, setCookie }`.
 */
export function getSession(headers, { create = false, secure = false } = {}) {
  const now = Date.now();
  const sid = cookie(headers, 'pf_sid');
  let s = sid ? store.sessions.get(sid) : undefined;
  if (s && now - s.seen > SESSION_TTL) {
    store.sessions.delete(sid);
    s = undefined;
  }
  let setCookie;
  if (!s && create) {
    if (store.sessions.size >= MAX_SESSIONS) for (const [k, v] of store.sessions) if (now - v.seen > SESSION_TTL) store.sessions.delete(k);
    const id = token(32);
    s = { id, csrf: token(), challenge: newChallenge(), pow: newPow(), issuedAt: now, seen: now, idem: new Map() };
    store.sessions.set(id, s);
    setCookie = `pf_sid=${id}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${SESSION_TTL / 1000}`;
  }
  if (s) s.seen = now;
  return { session: s ?? null, setCookie };
}

export function csrfOk(headers, s) {
  const sent = Buffer.from(String(headers['x-csrf-token'] ?? ''));
  const want = Buffer.from(s.csrf);
  return sent.length === want.length && timingSafeEqual(sent, want);
}

/** Same-origin check: the Origin header (or Sec-Fetch-Site when a browser sends `Origin: null`). */
export function sameOrigin(headers, secure) {
  const origin = headers.origin;
  const site = headers['sec-fetch-site'];
  if (!origin) return site === 'same-origin' || !site;
  if (origin === 'null') return site === 'same-origin';
  return origin === `${secure ? 'https' : 'http'}://${headers.host}`;
}

/** Checks the X-Form-Proof header against the session's challenge (one hash). */
export function proofOk(headers, s) {
  if (POW_DIFFICULTY === 0) return true;
  const p = parsePowToken(headers['x-form-proof']);
  return !!p && p.challenge === s.pow.challenge && checkPow(s.pow, p.nonce);
}

/** Fixed-window rate limit: true while `key` is under `limit` hits per `windowMs`. */
export function underLimit(key, limit, windowMs) {
  const now = Date.now();
  let h = store.hits.get(key);
  if (!h || now - h.start > windowMs) {
    if (store.hits.size > 100_000) store.hits.clear();
    h = { start: now, count: 0 };
    store.hits.set(key, h);
  }
  return ++h.count <= limit;
}

/**
 * Idempotency keys: a retry of the same request (lost response, double click) gets the original
 * reply instead of being processed twice. Encrypted values differ on every attempt, so they're
 * normalised before hashing.
 */
export function idempotency(headers, s, body) {
  const key = headers['idempotency-key'];
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return { key: null };
  const normal = JSON.stringify(body, (_k, v) => (typeof v === 'string' && v.startsWith('pfe1.') ? 'pfe1' : v));
  const hash = createHash('sha256').update(normal).digest('base64url');
  const prev = s.idem.get(key);
  if (!prev) {
    if (s.idem.size > 100) s.idem.delete(s.idem.keys().next().value);
    s.idem.set(key, { hash, done: false });
    return { key, entry: s.idem.get(key) };
  }
  if (prev.hash !== hash) return { key, conflict: 422 };
  if (!prev.done) return { key, conflict: 409 };
  return { key, replay: prev };
}
