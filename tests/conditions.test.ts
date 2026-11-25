/** showIf conditions (src/lib/conditions.ts).  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditionFields, evaluateCondition, type ConditionField } from '../src/lib/conditions.ts';

const fields: Record<string, ConditionField> = {
  contact: { value: 'phone', empty: false },
  age: { value: 21, empty: false },
  ageText: { value: '17', empty: false },
  plan: { value: 'pro', empty: false },
  terms: { value: false, empty: true },
  company: { value: '', empty: true },
  when: { value: new Date('2026-01-02T00:00:00.000Z'), empty: false },
};
const get = (n: string) => fields[n];
const ev = (c: Parameters<typeof evaluateCondition>[0]) => evaluateCondition(c, get);

test('equality and lists', () => {
  assert.equal(ev({ field: 'contact', equals: 'phone' }), true);
  assert.equal(ev({ field: 'contact', equals: 'email' }), false);
  assert.equal(ev({ field: 'contact', notEquals: 'email' }), true);
  assert.equal(ev({ field: 'plan', in: ['pro', 'team'] }), true);
  assert.equal(ev({ field: 'plan', notIn: ['pro', 'team'] }), false);
  assert.equal(ev({ field: 'terms', equals: true }), false);
  assert.equal(ev({ field: 'when', equals: '2026-01-02T00:00:00.000Z' }), true);
});

test('numbers, including numeric text', () => {
  assert.equal(ev({ field: 'age', gte: 18 }), true);
  assert.equal(ev({ field: 'age', gte: 18, lt: 21 }), false); // all operators must hold
  assert.equal(ev({ field: 'ageText', lt: 18 }), true);
  assert.equal(ev({ field: 'contact', gt: 1 }), false); // not a number
});

test('empty / filled and the bare form', () => {
  assert.equal(ev({ field: 'company', empty: true }), true);
  assert.equal(ev({ field: 'company', filled: true }), false);
  assert.equal(ev({ field: 'age' }), true);
  assert.equal(ev({ field: 'company' }), false);
});

test('unknown or hidden fields count as empty', () => {
  assert.equal(ev({ field: 'missing', equals: 'x' }), false);
  assert.equal(ev({ field: 'missing', notEquals: 'x' }), true);
  assert.equal(ev({ field: 'missing', empty: true }), true);
});

test('all / any / not', () => {
  assert.equal(ev({ all: [{ field: 'contact', equals: 'phone' }, { field: 'age', gte: 18 }] }), true);
  assert.equal(ev({ all: [{ field: 'contact', equals: 'phone' }, { field: 'age', gte: 30 }] }), false);
  assert.equal(ev({ any: [{ field: 'contact', equals: 'email' }, { field: 'plan', equals: 'pro' }] }), true);
  assert.equal(ev({ not: { field: 'plan', equals: 'pro' } }), false);
});

test('conditionFields lists names and rejects bad shapes', () => {
  assert.deepEqual(conditionFields({ all: [{ field: 'a', equals: 1 }, { not: { field: 'b', empty: true } }] }), ['a', 'b']);
  assert.equal(conditionFields(() => true), null);
  assert.throws(() => conditionFields({ field: 'a', equal: 1 } as never), /unknown operator "equal"/);
  assert.throws(() => conditionFields({ any: 'x' } as never), /list of conditions/);
  assert.throws(() => conditionFields({ equals: 1 } as never), /needs a "field"/);
});
