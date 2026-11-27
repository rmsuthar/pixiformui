/**
 * PFE1 server side for Node.js (built-in `node:crypto` only).
 * Spec: docs/ENCRYPTION.md. Other languages: server/decrypt/*.
 */
import { createDecipheriv, createHash, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, type KeyObject, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const PFE_INFO = 'pixiform/pfe1/aes-256-gcm';
/** DER prefix that turns a raw 65-byte P-256 point into an SPKI public key. */
const P256_SPKI_PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');
const ENVELOPE = /^pfe1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{87})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,1400})$/;

export interface PfeKey {
  kid: string;
  spki: string; // base64url DER
  privateKey: KeyObject;
}

export class PfeError extends Error {}

/** Loads an EC P-256 private key (PKCS#8 PEM). */
export function loadKey(pem: string): PfeKey {
  const privateKey = createPrivateKey({ key: pem, format: 'pem' });
  const d = privateKey.asymmetricKeyDetails;
  if (privateKey.asymmetricKeyType !== 'ec' || d?.namedCurve !== 'prime256v1') throw new PfeError('PFE key must be EC P-256');
  const spkiDer = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  const kid = createHash('sha256').update(spkiDer).digest('base64url').slice(0, 16);
  return { kid, spki: spkiDer.toString('base64url'), privateKey };
}

/**
 * Key ring: the current key (used by browsers) plus retired keys that can
 * still decrypt during rotation. Dev mode creates `.keys/pfe-current.pem`.
 */
export function loadKeyRing(opts: { currentFile: string; retiredFiles?: string[]; allowGenerate: boolean }): {
  current: PfeKey;
  byKid: Map<string, PfeKey>;
} {
  if (!existsSync(opts.currentFile)) {
    if (!opts.allowGenerate) throw new PfeError(`Missing PFE private key: ${opts.currentFile}`);
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    mkdirSync(dirname(opts.currentFile), { recursive: true, mode: 0o700 });
    try {
      // 'wx': never overwrite a key another process created in the meantime.
      writeFileSync(opts.currentFile, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600, flag: 'wx' });
      chmodSync(opts.currentFile, 0o600);
      console.log(`[pfe] generated new key ${opts.currentFile}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
  }
  const current = loadKey(readFileSync(opts.currentFile, 'utf8'));
  const byKid = new Map([[current.kid, current]]);
  for (const f of opts.retiredFiles ?? []) {
    const k = loadKey(readFileSync(f, 'utf8'));
    byKid.set(k.kid, k);
  }
  return { current, byKid };
}

/**
 * Decrypts an envelope. `context` must be exactly what the browser bound:
 * `${challenge}|${field}`. Returns the plaintext bytes; the caller must
 * `fill(0)` them when done.
 */
export function openEnvelope(envelope: unknown, keys: Map<string, PfeKey>, context: string): Buffer {
  if (typeof envelope !== 'string') throw new PfeError('Envelope must be a string');
  const m = ENVELOPE.exec(envelope);
  if (!m) throw new PfeError('Malformed envelope');
  const [, kid, epkB64, ivB64, ctB64] = m;
  const key = keys.get(kid);
  if (!key) throw new PfeError('Unknown key id');

  const epk = Buffer.from(epkB64, 'base64url');
  const iv = Buffer.from(ivB64, 'base64url');
  const ct = Buffer.from(ctB64, 'base64url');
  if (epk.length !== 65 || epk[0] !== 0x04 || iv.length !== 12 || ct.length < 17) throw new PfeError('Malformed envelope');

  let shared: Buffer;
  try {
    // OpenSSL rejects points that are not on the curve (invalid-curve attacks).
    const peer = createPublicKey({ key: Buffer.concat([P256_SPKI_PREFIX, epk]), format: 'der', type: 'spki' });
    shared = diffieHellman({ privateKey: key.privateKey, publicKey: peer });
  } catch {
    throw new PfeError('Invalid ephemeral key');
  }
  const aesKey = Buffer.from(hkdfSync('sha256', shared, epk, PFE_INFO, 32));
  shared.fill(0);

  const header = `pfe1.${kid}.${epkB64}.${ivB64}`;
  try {
    const d = createDecipheriv('aes-256-gcm', aesKey, iv, { authTagLength: 16 });
    d.setAAD(Buffer.from(`${header}|${context}`, 'utf8'));
    d.setAuthTag(ct.subarray(ct.length - 16));
    return Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  } catch {
    throw new PfeError('Decryption failed');
  } finally {
    aesKey.fill(0);
  }
}

// ------------------------------------------------------------------ files (PFF1)
/** What a file's sealed key contains. */
export interface PffManifest {
  name: string;
  type: string;
  size: number;
}

const PFF_MAGIC = Buffer.from('PFF1');

/**
 * Opens an encrypted file from pixiformui/file: `key` is the PFE1 envelope submitted for the
 * file (context `${challenge}|${field}[${index}]`), `blob` the uploaded bytes. Checks the blob's
 * SHA-256 against the sealed manifest, so a different upload can't be swapped in.
 */
export function openFile(key: unknown, blob: Buffer, keys: Map<string, PfeKey>, context: string): { manifest: PffManifest; data: Buffer } {
  const raw = openEnvelope(key, keys, context);
  let m: { v?: number; k?: string; name?: unknown; type?: unknown; size?: unknown; sha256?: string };
  try {
    m = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new PfeError('Malformed file key');
  } finally {
    raw.fill(0);
  }
  if (m.v !== 1 || typeof m.k !== 'string' || typeof m.sha256 !== 'string') throw new PfeError('Malformed file key');
  if (blob.length < 4 + 12 + 16 || !blob.subarray(0, 4).equals(PFF_MAGIC)) throw new PfeError('Not a PFF1 file');
  const digest = createHash('sha256').update(blob).digest();
  const expected = Buffer.from(m.sha256, 'base64url');
  if (expected.length !== digest.length || !timingSafeEqual(expected, digest)) throw new PfeError('File does not match its key');
  const fileKey = Buffer.from(m.k, 'base64url');
  if (fileKey.length !== 32) throw new PfeError('Malformed file key');
  try {
    const d = createDecipheriv('aes-256-gcm', fileKey, blob.subarray(4, 16), { authTagLength: 16 });
    d.setAAD(Buffer.from('pff1'));
    d.setAuthTag(blob.subarray(blob.length - 16));
    const data = Buffer.concat([d.update(blob.subarray(16, blob.length - 16)), d.final()]);
    return { manifest: { name: String(m.name ?? 'file').slice(0, 255), type: String(m.type ?? 'application/octet-stream').slice(0, 255), size: Number(m.size) || data.length }, data };
  } catch {
    throw new PfeError('File decryption failed');
  } finally {
    fileKey.fill(0);
  }
}
