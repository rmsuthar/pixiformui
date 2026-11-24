/** Server-side passkey verification (server/webauthn.ts).  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { decodeCbor, verifyAuthentication, type StoredCredential } from '../server/webauthn.ts';

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest();
const rpId = 'example.com';
const origin = 'https://example.com';
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const stored: StoredCredential = {
  id: 'Y3JlZC1pZA',
  publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'),
  alg: -7,
  signCount: 5,
  username: 'ada',
  transports: [],
};

/** Builds a signed assertion like an authenticator would. */
function assertion(o: { challenge?: string; origin?: string; rp?: string; flags?: number; count?: number; tamper?: boolean } = {}) {
  const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: o.challenge ?? 'chal-123', origin: o.origin ?? origin }));
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(o.count ?? 6);
  const authData = Buffer.concat([sha256(o.rp ?? rpId), Buffer.from([o.flags ?? 0x05]), counter]);
  const sig = sign('sha256', Buffer.concat([authData, sha256(clientData)]), { key: privateKey, dsaEncoding: 'der' });
  if (o.tamper) sig[sig.length - 1] ^= 1;
  return {
    id: stored.id,
    type: 'public-key',
    response: { clientDataJSON: clientData.toString('base64url'), authenticatorData: authData.toString('base64url'), signature: sig.toString('base64url') },
  };
}
const expect = { challenge: 'chal-123', origin, rpId, requireUserVerification: true };

test('a correctly signed passkey assertion verifies and returns the new counter', () => {
  assert.equal(verifyAuthentication(assertion(), stored, expect), 6);
});

test('tampering, wrong challenge/origin/RP, missing UV and counter rollback are rejected', () => {
  assert.throws(() => verifyAuthentication(assertion({ tamper: true }), stored, expect), /bad signature/);
  assert.throws(() => verifyAuthentication(assertion({ challenge: 'other' }), stored, expect), /challenge/);
  assert.throws(() => verifyAuthentication(assertion({ origin: 'https://evil.example' }), stored, expect), /origin/);
  assert.throws(() => verifyAuthentication(assertion({ rp: 'evil.example' }), stored, expect), /RP ID/);
  assert.throws(() => verifyAuthentication(assertion({ flags: 0x01 }), stored, expect), /verification/);
  assert.throws(() => verifyAuthentication(assertion({ count: 5 }), stored, expect), /counter/);
});

test('CBOR decoder handles WebAuthn shapes and rejects truncated input', () => {
  // {1: 2, 3: -7, -1: h'0102'}  (a tiny COSE-like map)
  const buf = Buffer.from([0xa3, 0x01, 0x02, 0x03, 0x26, 0x20, 0x42, 0x01, 0x02]);
  const { value, end } = decodeCbor(buf);
  assert.ok(value instanceof Map);
  assert.equal(value.get(1), 2);
  assert.equal(value.get(3), -7);
  assert.deepEqual(value.get(-1), Buffer.from([1, 2]));
  assert.equal(end, buf.length);
  assert.throws(() => decodeCbor(Buffer.from([0x42, 0x01])), /truncated/);
});
