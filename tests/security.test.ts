/**
 * Unit tests for the security core. Uses only Node's built-in test runner.
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { sanitizeInput } from '../src/lib/security/sanitize.ts';
import { SecureBuffer, toCodePoints } from '../src/lib/security/SecureBuffer.ts';
import { Secret } from '../src/lib/security/Secret.ts';
import { RateLimiter } from '../src/lib/security/RateLimiter.ts';
import { sealBytes, sealSecret } from '../src/lib/security/envelope.ts';
import { checkPassword, registrationRules as R, validatePayload, validateValue } from '../shared/rules.ts';
import { loadKey, openEnvelope } from '../server/pfe.ts';

test('sanitize: strips control, bidi-override and zero-width characters', () => {
  assert.equal(sanitizeInput('a\u0000b‮c​d﻿e'), 'abcde');
});

test('sanitize: single-line converts newlines and tabs to spaces', () => {
  assert.equal(sanitizeInput('a\r\nb\tc'), 'a b c');
  assert.equal(sanitizeInput('a\r\nb', { multiline: true }), 'a\nb');
});

test('sanitize: allow-list, NFC normalisation and code-point length cap', () => {
  assert.equal(sanitizeInput('a1b2c3', { allow: /[0-9]/ }), '123');
  assert.equal(sanitizeInput('é'), 'é');
  assert.equal(sanitizeInput('🔐🔐🔐', { maxCodePoints: 2 }), '🔐🔐');
});

test('SecureBuffer: insert, delete, toString and wipe', () => {
  const b = new SecureBuffer(2);
  b.insert(0, toCodePoints('hello'));
  b.insert(5, toCodePoints(' world')); // forces growth
  b.delete(0, 6);
  assert.equal(b.toString(), 'world');
  b.wipe();
  assert.equal(b.length, 0);
  assert.equal(b.toString(), '');
});

test('SecureBuffer: UTF-8 export matches TextEncoder without creating strings', () => {
  const text = 'pässwörd-🔐-密码';
  const b = new SecureBuffer();
  b.set(toCodePoints(text));
  assert.deepEqual(b.toUtf8(), new TextEncoder().encode(text));
});

test('Secret: never serialises its value; equals is content-based', () => {
  const a = new SecureBuffer();
  const b = new SecureBuffer();
  a.set(toCodePoints('s3cret'));
  b.set(toCodePoints('s3cret'));
  const s = new Secret(a);
  assert.equal(JSON.stringify({ s }), '{"s":"[Secret]"}');
  assert.equal(`${s}`, '[Secret]');
  assert.ok(s.equals(new Secret(b)));
  b.set(toCodePoints('s3creT'));
  assert.ok(!s.equals(new Secret(b)));
  assert.equal(s.use((p) => p.length), 6);
});

test('RateLimiter: locks out after maxAttempts with exponential backoff', () => {
  const rl = new RateLimiter({ maxAttempts: 2, windowMs: 1000, lockoutMs: 100 });
  assert.ok(rl.attempt(0).allowed);
  assert.ok(rl.attempt(1).allowed);
  const third = rl.attempt(2);
  assert.ok(!third.allowed);
  assert.equal(third.retryInMs, 100);
  assert.ok(rl.attempt(150).allowed); // lock expired
  rl.attempt(151);
  assert.equal(rl.attempt(152).retryInMs, 200); // second lockout doubles
});

test('rules: password policy', () => {
  const p = R.password.password;
  assert.match(checkPassword('short', p)!, /at least 12/);
  assert.match(checkPassword('alllowercase', p)!, /Mix at least/);
  assert.match(checkPassword('Aaaa1111!!!!', p)!, /repeating/);
  assert.match(checkPassword('Ada-Lovelace-99', p, { fullName: 'Ada Lovelace' })!, /must not contain/);
  assert.equal(checkPassword('Tr0ub4dor&Horse!', p), null);
});

test('rules: field rules and strict payload validation', () => {
  assert.equal(validateValue(R.email, 'a@b.co'), null);
  assert.ok(validateValue(R.email, 'not-an-email'));
  assert.ok(validateValue(R.country, 'XX'));
  const r = validatePayload(R, JSON.parse('{"__proto__":{"admin":true},"isAdmin":true}'));
  assert.equal(r.ok, false);
  assert.equal(r.errors.isAdmin, 'Unexpected field.');
  assert.equal(r.errors.__proto__, 'Unexpected field.');
  assert.equal(({} as Record<string, unknown>).admin, undefined); // no prototype pollution
});

test('PFE1: browser envelope decrypts on the server; context is enforced', async () => {
  const pem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const key = loadKey(pem);
  const keys = new Map([[key.kid, key]]);
  const ek = { alg: 'PFE1' as const, kid: key.kid, spki: key.spki, challenge: 'challenge-0123456789' };

  const buf = new SecureBuffer();
  buf.set(toCodePoints('Tr0ub4dor&Horse!'));
  const env = await sealSecret(new Secret(buf), ek, 'password');
  assert.match(env, /^pfe1\./);
  assert.equal(openEnvelope(env, keys, 'challenge-0123456789|password').toString(), 'Tr0ub4dor&Horse!');
  assert.throws(() => openEnvelope(env, keys, 'challenge-0123456789|confirmPassword'));
  assert.throws(() => openEnvelope(env, keys, 'another-challenge-000|password'));

  const a = await sealBytes(new TextEncoder().encode('same'), ek, 'password');
  const b = await sealBytes(new TextEncoder().encode('same'), ek, 'password');
  assert.notEqual(a, b); // fresh ephemeral key + IV every time
});
