/**
 * Proof-of-work ("form proof"): the server issues a random challenge and a difficulty; the
 * browser finds a nonce such that SHA-256(`${challenge}:${nonce}`) starts with `difficulty`
 * zero bits. Cheap to verify (one hash), costly to produce in bulk: invisible for a person
 * filling a form, expensive for a bot sending thousands of submissions.
 *
 * Shared by the browser (solving, pure-JS SHA-256: synchronous and fast for tiny inputs, no
 * workers or WebAssembly, so it works under a strict CSP) and the server (verifying).
 */

export interface PowChallenge {
  /** Random, single-use value from the server (base64url). */
  challenge: string;
  /** Required leading zero bits (each +1 doubles the average work). */
  difficulty: number;
}

// ------------------------------------------------------------------ SHA-256 (FIPS 180-4)
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W = new Uint32Array(64);
const ror = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 of ASCII/UTF-8 bytes; returns the 8 state words (big-endian digest). */
export function sha256Words(data: Uint8Array): Uint32Array {
  const len = data.length;
  const blocks = ((len + 9 + 63) >> 6) << 6;
  const msg = new Uint8Array(blocks);
  msg.set(data);
  msg[len] = 0x80;
  const bits = len * 8;
  msg[blocks - 4] = bits >>> 24;
  msg[blocks - 3] = bits >>> 16;
  msg[blocks - 2] = bits >>> 8;
  msg[blocks - 1] = bits;
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  for (let off = 0; off < blocks; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = (msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = ror(W[i - 15], 7) ^ ror(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = ror(W[i - 2], 17) ^ ror(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return h;
}

/** Number of leading zero bits in a digest given as 32-bit words. */
export function leadingZeroBits(words: Uint32Array | number[]): number {
  let n = 0;
  for (const w of words) {
    if (w === 0) {
      n += 32;
      continue;
    }
    return n + Math.clz32(w);
  }
  return n;
}

const enc = new TextEncoder();
const input = (challenge: string, nonce: number) => enc.encode(`${challenge}:${nonce}`);

/** True if `nonce` solves the challenge. */
export function checkPow(c: PowChallenge, nonce: number): boolean {
  return Number.isSafeInteger(nonce) && nonce >= 0 && leadingZeroBits(sha256Words(input(c.challenge, nonce))) >= c.difficulty;
}

/**
 * Searches nonces [from, from + count). Returns the solution or null. Call it in slices
 * (e.g. 20 000 at a time) to keep the page responsive.
 */
export function searchPow(c: PowChallenge, from: number, count: number): number | null {
  for (let nonce = from; nonce < from + count; nonce++) {
    if (leadingZeroBits(sha256Words(input(c.challenge, nonce))) >= c.difficulty) return nonce;
  }
  return null;
}

/** Header value sent with a submission: `${challenge}:${nonce}`. */
export const powToken = (c: PowChallenge, nonce: number) => `${c.challenge}:${nonce}`;

/** Parses a header value; returns null if malformed. */
export function parsePowToken(token: unknown): { challenge: string; nonce: number } | null {
  if (typeof token !== 'string' || token.length > 200) return null;
  const m = /^([A-Za-z0-9_-]{16,64}):(\d{1,15})$/.exec(token);
  return m ? { challenge: m[1], nonce: Number(m[2]) } : null;
}
