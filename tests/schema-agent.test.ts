/** JSON Schema generation, partial validation and agent field rules.  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesToJsonSchema, publicRules } from '../shared/jsonSchema.ts';
import { registrationRules as R, validatePartial } from '../shared/rules.ts';
import { REGISTRATION_DRAFT_RULES, registrationDraftSchema } from '../shared/agent.ts';

test('rulesToJsonSchema maps types, limits and enums; secrets excluded by default', () => {
  const s = rulesToJsonSchema(R) as any;
  assert.equal(s.type, 'object');
  assert.equal(s.additionalProperties, false);
  assert.equal(s.properties.password, undefined);
  assert.equal(s.properties.confirmPassword, undefined); // matches a secret
  assert.deepEqual(s.properties.country.enum, [...R.country.options]);
  assert.equal(s.properties.experience.type, 'integer');
  assert.equal(s.properties.experience.maximum, 40);
  assert.equal(s.properties.phone.pattern, R.phone.pattern.source);
  assert.equal(s.properties.dateOfBirth.format, 'date');
  assert.match(s.properties.dateOfBirth.description, /at least 16/);
  assert.match(s.properties.onboardingCall.description, /Monday to Friday/);
  assert.equal(s.properties.terms.const, true);
  assert.ok(s.required.includes('email') && s.required.includes('terms'));
  const withSecrets = rulesToJsonSchema(R, { includeSecrets: true }) as any;
  assert.equal(withSecrets.properties.password.writeOnly, true);
});

test('publicRules and agent rules never expose secrets or consent', () => {
  assert.ok(!('password' in publicRules(R)));
  for (const k of ['password', 'confirmPassword', 'terms']) assert.ok(!(k in REGISTRATION_DRAFT_RULES), k);
  assert.ok('email' in REGISTRATION_DRAFT_RULES);
  assert.deepEqual(registrationDraftSchema.required, []);
  assert.ok(!('terms' in (registrationDraftSchema.properties as object)));
});

test('validatePartial checks present fields only and rejects unknown ones', () => {
  assert.equal(validatePartial(REGISTRATION_DRAFT_RULES, { email: 'ada@example.com' }).ok, true);
  const bad = validatePartial(REGISTRATION_DRAFT_RULES, { email: 'nope', country: 'XX', password: 'x' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.email && bad.errors.country);
  assert.equal(bad.errors.password, 'Unexpected field.');
  assert.equal(validatePartial(REGISTRATION_DRAFT_RULES, { fullName: '  Ada  ' }).data.fullName, 'Ada');
  assert.equal(validatePartial(REGISTRATION_DRAFT_RULES, null).ok, false);
});
