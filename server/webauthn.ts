/**
 * Minimal WebAuthn (passkey) verification for the reference server: Node's crypto only.
 *
 * Registration: checks clientDataJSON (type, challenge, origin), the authenticator data
 * (RP ID hash, user-presence flag, attested credential) and stores the credential's public
 * key. Attestation statements aren't verified: the server requests attestation 'none', so
 * the authenticator's make isn't trusted, only the key it creates.
 * Authentication: checks clientDataJSON, the RP ID hash and user presence, verifies the
 * signature over authenticatorData ‖ SHA-256(clientDataJSON), and rejects signature counters
 * that go backwards (a cloned authenticator).
 */
import { createHash, createPublicKey, timingSafeEqual, verify, type KeyObject } from 'node:crypto';

// ------------------------------------------------------------------ base64url
export const b64u = (b: Uint8Array | Buffer): string => Buffer.from(b).toString('base64url');
export const fromB64u = (s: unknown): Buffer => {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s) || s.length > 16_384) throw new Error('bad base64url');
  return Buffer.from(s, 'base64url');
};
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest();

// ------------------------------------------------------------------ CBOR (the subset WebAuthn uses)
type CborValue = number | bigint | string | Buffer | boolean | null | undefined | CborValue[] | Map<CborValue, CborValue>;

/** Decodes one CBOR item starting at `offset`; returns the value and the offset after it. */
export function decodeCbor(buf: Buffer, offset = 0, depth = 0): { value: CborValue; end: number } {
  if (depth > 16) throw new Error('CBOR too deep');
  if (offset >= buf.length) throw new Error('CBOR truncated');
  const first = buf[offset];
  const major = first >> 5;
  const info = first & 31;
  let pos = offset + 1;
  const readLength = (): number => {
    if (info < 24) return info;
    const size = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : 0;
    if (!size || pos + size > buf.length) throw new Error('CBOR length unsupported');
    let n = 0;
    for (let i = 0; i < size; i++) n = n * 256 + buf[pos + i];
    pos += size;
    if (n > 1_000_000) throw new Error('CBOR length too large');
    return n;
  };
  switch (major) {
    case 0:
      return { value: readLength(), end: pos };
    case 1:
      return { value: -1 - readLength(), end: pos };
    case 2: {
      const n = readLength();
      if (pos + n > buf.length) throw new Error('CBOR truncated');
      return { value: buf.subarray(pos, pos + n), end: pos + n };
    }
    case 3: {
      const n = readLength();
      if (pos + n > buf.length) throw new Error('CBOR truncated');
      return { value: buf.toString('utf8', pos, pos + n), end: pos + n };
    }
    case 4: {
      const n = readLength();
      const arr: CborValue[] = [];
      for (let i = 0; i < n; i++) {
        const r = decodeCbor(buf, pos, depth + 1);
        arr.push(r.value);
        pos = r.end;
      }
      return { value: arr, end: pos };
    }
    case 5: {
      const n = readLength();
      const map = new Map<CborValue, CborValue>();
      for (let i = 0; i < n; i++) {
        const k = decodeCbor(buf, pos, depth + 1);
        const v = decodeCbor(buf, k.end, depth + 1);
        map.set(k.value, v.value);
        pos = v.end;
      }
      return { value: map, end: pos };
    }
    case 7:
      if (info === 20) return { value: false, end: pos };
      if (info === 21) return { value: true, end: pos };
      if (info === 22) return { value: null, end: pos };
      if (info === 23) return { value: undefined, end: pos };
      throw new Error('CBOR simple/float values are not used by WebAuthn');
    default:
      throw new Error(`CBOR major type ${major} not supported`);
  }
}

// ------------------------------------------------------------------ COSE keys
/** Converts a COSE public key (ES256 / RS256) into a Node KeyObject. */
export function coseToKey(cose: Map<CborValue, CborValue>): { key: KeyObject; alg: number } {
  const kty = cose.get(1);
  const alg = Number(cose.get(3));
  if (kty === 2 && alg === -7) {
    if (cose.get(-1) !== 1) throw new Error('only P-256 is supported');
    const x = cose.get(-2);
    const y = cose.get(-3);
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y) || x.length !== 32 || y.length !== 32) throw new Error('bad EC key');
    return { key: createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y) }, format: 'jwk' }), alg };
  }
  if (kty === 3 && alg === -257) {
    const n = cose.get(-1);
    const e = cose.get(-2);
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e) || n.length < 256) throw new Error('bad RSA key');
    return { key: createPublicKey({ key: { kty: 'RSA', n: b64u(n), e: b64u(e) }, format: 'jwk' }), alg };
  }
  throw new Error(`unsupported COSE key (kty ${String(kty)}, alg ${alg})`);
}

// ------------------------------------------------------------------ authenticator data
export interface AuthData {
  rpIdHash: Buffer;
  userPresent: boolean;
  userVerified: boolean;
  signCount: number;
  credentialId?: Buffer;
  publicKey?: Map<CborValue, CborValue>;
}

export function parseAuthData(data: Buffer): AuthData {
  if (data.length < 37) throw new Error('authenticator data too short');
  const flags = data[32];
  const out: AuthData = {
    rpIdHash: data.subarray(0, 32),
    userPresent: !!(flags & 0x01),
    userVerified: !!(flags & 0x04),
    signCount: data.readUInt32BE(33),
  };
  if (flags & 0x40) {
    let pos = 37 + 16; // AAGUID
    const len = data.readUInt16BE(pos);
    pos += 2;
    out.credentialId = data.subarray(pos, pos + len);
    pos += len;
    const key = decodeCbor(data, pos).value;
    if (!(key instanceof Map)) throw new Error('bad credential public key');
    out.publicKey = key;
  }
  return out;
}

// ------------------------------------------------------------------ verification
export interface StoredCredential {
  id: string; // base64url credential ID
  publicKey: string; // SPKI DER, base64url
  alg: number;
  signCount: number;
  username: string;
  transports: string[];
}

interface Expect {
  challenge: string; // base64url
  origin: string;
  rpId: string;
  requireUserVerification?: boolean;
}

function checkClientData(clientDataJSON: Buffer, type: 'webauthn.create' | 'webauthn.get', exp: Expect): void {
  let cd: { type?: string; challenge?: string; origin?: string; crossOrigin?: boolean };
  try {
    cd = JSON.parse(clientDataJSON.toString('utf8'));
  } catch {
    throw new Error('clientDataJSON is not JSON');
  }
  if (cd.type !== type) throw new Error('wrong ceremony type');
  const got = Buffer.from(String(cd.challenge ?? ''));
  const want = Buffer.from(exp.challenge);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new Error('challenge mismatch');
  if (cd.origin !== exp.origin) throw new Error('origin mismatch');
  if (cd.crossOrigin) throw new Error('cross-origin ceremony not allowed');
}

function checkAuthData(auth: AuthData, exp: Expect): void {
  if (!timingSafeEqual(auth.rpIdHash, sha256(exp.rpId))) throw new Error('RP ID mismatch');
  if (!auth.userPresent) throw new Error('user presence required');
  if (exp.requireUserVerification && !auth.userVerified) throw new Error('user verification required');
}

/** Verifies navigator.credentials.create() output; returns the credential to store. */
export function verifyRegistration(credential: unknown, exp: Expect, username: string): StoredCredential {
  const c = credential as { id?: unknown; type?: unknown; response?: { clientDataJSON?: unknown; attestationObject?: unknown; transports?: unknown } };
  if (c?.type !== 'public-key' || !c.response) throw new Error('not a public-key credential');
  checkClientData(fromB64u(c.response.clientDataJSON), 'webauthn.create', exp);
  const att = decodeCbor(fromB64u(c.response.attestationObject)).value;
  if (!(att instanceof Map) || !Buffer.isBuffer(att.get('authData'))) throw new Error('bad attestation object');
  const auth = parseAuthData(att.get('authData') as Buffer);
  checkAuthData(auth, exp);
  if (!auth.credentialId || !auth.publicKey) throw new Error('no attested credential');
  if (b64u(auth.credentialId) !== c.id) throw new Error('credential ID mismatch');
  const { key, alg } = coseToKey(auth.publicKey);
  const transports = Array.isArray(c.response.transports) ? c.response.transports.filter((t): t is string => typeof t === 'string').slice(0, 6) : [];
  return {
    id: b64u(auth.credentialId),
    publicKey: b64u(key.export({ type: 'spki', format: 'der' })),
    alg,
    signCount: auth.signCount,
    username,
    transports,
  };
}

/** Verifies navigator.credentials.get() output against a stored credential; returns the new sign count. */
export function verifyAuthentication(credential: unknown, stored: StoredCredential, exp: Expect): number {
  const c = credential as { id?: unknown; type?: unknown; response?: { clientDataJSON?: unknown; authenticatorData?: unknown; signature?: unknown } };
  if (c?.type !== 'public-key' || !c.response || c.id !== stored.id) throw new Error('unknown credential');
  const clientDataJSON = fromB64u(c.response.clientDataJSON);
  checkClientData(clientDataJSON, 'webauthn.get', exp);
  const authData = fromB64u(c.response.authenticatorData);
  const auth = parseAuthData(authData);
  checkAuthData(auth, exp);
  const key = createPublicKey({ key: fromB64u(stored.publicKey), format: 'der', type: 'spki' });
  const signed = Buffer.concat([authData, sha256(clientDataJSON)]);
  const signature = fromB64u(c.response.signature);
  const ok =
    stored.alg === -7
      ? verify('sha256', signed, { key, dsaEncoding: 'der' }, signature)
      : verify('sha256', signed, key, signature); // RS256: RSASSA-PKCS1-v1_5
  if (!ok) throw new Error('bad signature');
  // Counters must increase, unless the authenticator doesn't use them (both zero).
  if ((auth.signCount !== 0 || stored.signCount !== 0) && auth.signCount <= stored.signCount) {
    throw new Error('signature counter did not increase (possible cloned authenticator)');
  }
  return auth.signCount;
}
