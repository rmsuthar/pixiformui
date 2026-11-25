// Sessions, CSRF tokens, encryption challenges, proof-of-work and idempotency for the starter server.
// In-memory stores keep the starter dependency-free; use Redis or your database when you run more
// than one server process.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { checkPow, parsePowToken } from './lib/pow.mjs';

const SESSION_TTL = 30 * 60_000;
const MAX_SESSIONS = 50_000;
/** Leading zero bits for the proof-of-work (each +1 doubles the work; 0 turns it off). */
export const POW_DIFFICULTY = Math.max(0, Math.min(26, Number(process.env.POW_DIFFICULTY ?? 18) || 0));
/** Minimum time between loading the form and submitting it. */
export const MIN_FILL_MS = Math.max(0, Number(process.env.MIN_FILL_MS ?? 2000) || 0);

const token = (n = 24) => randomBytes(n).toString('base64url');
const sessions = new Map();

export const newPow = () => ({ challenge: token(18), difficulty: POW_DIFFICULTY });

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/** The caller's session, creating one (and setting its cookie) when `create` is true. */
export function getSession(req, res, { create = false, secure = false } = {}) {
  const now = Date.now();
  const sid = cookies(req).pf_sid;
  let s = sid && sessions.get(sid);
  if (s && now - s.seen > SESSION_TTL) {
    sessions.delete(sid);
    s = undefined;
  }
  if (!s && create) {
    if (sessions.size >= MAX_SESSIONS) for (const [k, v] of sessions) if (now - v.seen > SESSION_TTL) sessions.delete(k);
    const id = token(32);
    s = { id, csrf: token(), challenge: token(16), pow: newPow(), issuedAt: now, seen: now, idem: new Map() };
    sessions.set(id, s);
    res.setHeader('Set-Cookie', `pf_sid=${id}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${SESSION_TTL / 1000}`);
  }
  if (s) s.seen = now;
  return s ?? null;
}

export function csrfOk(req, s) {
  const sent = Buffer.from(String(req.headers['x-csrf-token'] ?? ''));
  const want = Buffer.from(s.csrf);
  return sent.length === want.length && timingSafeEqual(sent, want);
}

/** Same-origin check: the Origin header (or Sec-Fetch-Site when a browser sends `Origin: null`). */
export function sameOrigin(req, secure) {
  const origin = req.headers.origin;
  if (!origin) return req.headers['sec-fetch-site'] === 'same-origin' || !req.headers['sec-fetch-site'];
  if (origin === 'null') return req.headers['sec-fetch-site'] === 'same-origin';
  return origin === `${secure ? 'https' : 'http'}://${req.headers.host}`;
}

/** Checks the X-Form-Proof header against the session's challenge (one hash). */
export function proofOk(req, s) {
  if (POW_DIFFICULTY === 0) return true;
  const p = parsePowToken(req.headers['x-form-proof']);
  return !!p && p.challenge === s.pow.challenge && checkPow(s.pow, p.nonce);
}

/** Simple fixed-window rate limiter per key. */
export function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || now - h.start > windowMs) {
      if (hits.size > 100_000) hits.clear();
      h = { start: now, count: 0 };
      hits.set(key, h);
    }
    return ++h.count <= limit;
  };
}

/**
 * Idempotency keys: a retry of the same request (lost response, double click) gets the original
 * reply instead of being processed twice. Encrypted values differ on every attempt, so they're
 * normalised before hashing.
 */
export function idempotency(req, s, body) {
  const key = req.headers['idempotency-key'];
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
