/** Proof-of-work (shared/pow.ts).  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { checkPow, leadingZeroBits, parsePowToken, powToken, searchPow, sha256Words } from '../shared/pow.ts';

const hex = (w: Uint32Array) => Array.from(w, (x) => (x >>> 0).toString(16).padStart(8, '0')).join('');

test('pure-JS SHA-256 matches Node crypto (empty, short, block boundaries, random)', () => {
  const inputs = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(119), 'héllo wörld ✓'];
  for (let i = 0; i < 50; i++) inputs.push(randomBytes(1 + (i % 140)).toString('base64url'));
  for (const s of inputs) {
    const bytes = new TextEncoder().encode(s);
    assert.equal(hex(sha256Words(bytes)), createHash('sha256').update(bytes).digest('hex'), JSON.stringify(s));
  }
});

test('leading zero bits', () => {
  assert.equal(leadingZeroBits([0x00000000, 0x0fffffff]), 36);
  assert.equal(leadingZeroBits([0x80000000]), 0);
  assert.equal(leadingZeroBits([0x00010000]), 15);
});

test('solve and verify a challenge; tokens round-trip; wrong nonces fail', () => {
  const c = { challenge: randomBytes(16).toString('base64url'), difficulty: 12 };
  const nonce = searchPow(c, 0, 1_000_000);
  assert.notEqual(nonce, null);
  assert.ok(checkPow(c, nonce!));
  assert.deepEqual(parsePowToken(powToken(c, nonce!)), { challenge: c.challenge, nonce });
  assert.equal(parsePowToken('nope'), null);
  assert.equal(parsePowToken(`${c.challenge}:-1`), null);
  assert.ok(!checkPow({ ...c, difficulty: 40 }, nonce!));
});
