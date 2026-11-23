/**
 * PFE1: PixiForm Encrypted secret envelope.
 *
 * Hybrid public-key encryption (same construction as ECIES / HPKE base mode),
 * built only from primitives every major server language ships with:
 *
 *   ECDH P-256  ->  HKDF-SHA256  ->  AES-256-GCM
 *
 *   epk, esk  = fresh P-256 key pair per secret
 *   shared    = ECDH(esk, serverPublicKey)                (32-byte X coordinate)
 *   key       = HKDF-SHA256(ikm = shared, salt = epk(65-byte raw), info = INFO, L = 32)
 *   header    = "pfe1." kid "." b64u(epk) "." b64u(iv)
 *   aad       = UTF-8(header + "|" + context)            context = challenge "|" field
 *   envelope  = header "." b64u(AES-256-GCM(key, iv, plaintext, aad))   (ciphertext || 16-byte tag)
 *
 * Binding the session challenge and field name in the AAD means an envelope
 * can't be replayed, or moved to another field, without failing authentication.
 * See docs/ENCRYPTION.md for the full spec and decryptors in other languages.
 *
 * This file has no runtime imports, so it runs in browsers and in Node (tests).
 */
import type { Secret } from './Secret';

export const PFE_VERSION = 'pfe1';
export const PFE_INFO = 'pixiform/pfe1/aes-256-gcm';

/** Public key info served by the backend (GET /api/session -> encryption). */
export interface EncryptionKey {
  alg: 'PFE1';
  /** Key id: first 16 chars of base64url(SHA-256(SPKI DER)). */
  kid: string;
  /** Server public key, SPKI DER, base64url. */
  spki: string;
  /** Single-use challenge issued by the server for this session. */
  challenge: string;
}

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto unavailable: serve the page over HTTPS or localhost.');
  return s;
};

const keyCache = new Map<string, Promise<CryptoKey>>();

function importServerKey(spki: string): Promise<CryptoKey> {
  let k = keyCache.get(spki);
  if (!k) {
    k = subtle().importKey('spki', b64uDecode(spki), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    keyCache.set(spki, k);
  }
  return k;
}

/** Encrypts raw bytes for the server. `field` is bound into the AAD. */
export async function sealBytes(plaintext: Uint8Array<ArrayBuffer>, key: EncryptionKey, field: string): Promise<string> {
  if (key.alg !== 'PFE1') throw new Error(`Unsupported algorithm ${key.alg}`);
  if (!/^[A-Za-z0-9_-]{16}$/.test(key.kid)) throw new Error('Bad key id');
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key.challenge)) throw new Error('Bad challenge');
  const s = subtle();
  const serverKey = await importServerKey(key.spki);
  const eph = (await s.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])) as CryptoKeyPair;
  const epk = new Uint8Array(await s.exportKey('raw', eph.publicKey)); // 65 bytes, uncompressed
  const shared = await s.deriveBits({ name: 'ECDH', public: serverKey }, eph.privateKey, 256);
  const hkdfKey = await s.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const aesKey = await s.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: epk, info: new TextEncoder().encode(PFE_INFO) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  new Uint8Array(shared).fill(0);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const header = `${PFE_VERSION}.${key.kid}.${b64uEncode(epk)}.${b64uEncode(iv)}`;
  const aad = new TextEncoder().encode(`${header}|${key.challenge}|${field}`);
  const ct = new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, aesKey, plaintext));
  return `${header}.${b64uEncode(ct)}`;
}

/**
 * Encrypts a Secret without ever turning it into a JS string: the code points
 * are UTF-8 encoded straight from the wipeable buffer, and the bytes are
 * zeroed as soon as encryption finishes.
 */
export async function sealSecret(secret: Secret, key: EncryptionKey, field: string): Promise<string> {
  const bytes = secret.toUtf8();
  try {
    return await sealBytes(bytes, key, field);
  } finally {
    bytes.fill(0);
  }
}

export function b64uEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
