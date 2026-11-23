/** Unit tests for date rules, calendar math and phone formatting.  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseISODate, registrationRules as R, validateValue, type FieldRule } from '../shared/rules.ts';
import { addDays, addMonths, daysInMonth, parseISO, toISO, weekday } from '../src/lib/controls/dateUtils.ts';
import { COUNTRIES, formatNational } from '../src/lib/controls/countries.ts';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yearsAgo = (n: number, extraDays = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  d.setDate(d.getDate() + extraDays);
  return iso(d);
};

test('parseISODate rejects impossible dates and wrong formats', () => {
  assert.ok(parseISODate('2024-02-29'));
  assert.equal(parseISODate('2026-02-29'), null);
  assert.equal(parseISODate('2026-02-30'), null);
  assert.equal(parseISODate('2026-13-01'), null);
  assert.equal(parseISODate('26-11-2026'), null);
  assert.equal(parseISODate('2026-11-24T09:30'), null); // time not allowed for date-only
  assert.ok(parseISODate('2026-11-24T09:30', true));
  assert.equal(parseISODate('2026-11-24T24:00', true), null);
});

test('date of birth: minimum and maximum age, no future dates', () => {
  const dob = R.dateOfBirth;
  assert.equal(validateValue(dob, yearsAgo(30)), null);
  assert.equal(validateValue(dob, yearsAgo(16)), null); // 16th birthday today
  assert.match(validateValue(dob, yearsAgo(16, 1))!, /at least 16/); // birthday tomorrow
  assert.match(validateValue(dob, yearsAgo(-1))!, /on or before/);
  assert.match(validateValue(dob, '1850-01-01')!, /on or after/);
  assert.match(validateValue(dob, 'not-a-date')!, /valid date/);
});

test('onboarding call: weekdays only, not in the past, needs a time', () => {
  const rule: FieldRule = { ...R.onboardingCall, minDate: undefined, maxDate: undefined };
  // Find the next Saturday and the next Wednesday at least 7 days ahead.
  const base = new Date();
  base.setDate(base.getDate() + 7);
  const sat = new Date(base);
  while (sat.getDay() !== 6) sat.setDate(sat.getDate() + 1);
  const wed = new Date(base);
  while (wed.getDay() !== 3) wed.setDate(wed.getDate() + 1);
  assert.equal(validateValue(rule, `${iso(wed)}T10:30`), null);
  assert.match(validateValue(rule, `${iso(sat)}T10:30`)!, /weekday/);
  assert.match(validateValue(rule, `${iso(wed)}`)!, /date and time/);
  const pastWed = new Date();
  pastWed.setDate(pastWed.getDate() - 14);
  while (pastWed.getDay() !== 3) pastWed.setDate(pastWed.getDate() + 1);
  assert.match(validateValue(rule, `${iso(pastWed)}T10:30`)!, /future/);
});

test('calendar math: month clamping, leap years, weekdays', () => {
  assert.deepEqual(addMonths({ y: 2026, m: 0, d: 31 }, 1), { y: 2026, m: 1, d: 28 });
  assert.deepEqual(addMonths({ y: 2024, m: 0, d: 31 }, 1), { y: 2024, m: 1, d: 29 });
  assert.deepEqual(addMonths({ y: 2026, m: 0, d: 15 }, -1), { y: 2025, m: 11, d: 15 });
  assert.deepEqual(addDays({ y: 2026, m: 11, d: 31 }, 1), { y: 2027, m: 0, d: 1 });
  assert.equal(daysInMonth(2026, 1), 28);
  assert.equal(weekday(2026, 10, 22), 0); // 22 Nov 2026 is a Sunday
  assert.equal(parseISO('2026-02-30'), null);
  assert.equal(toISO({ y: 2026, m: 10, d: 24, hh: 9, mm: 5 }, true), '2026-11-24T09:05');
});

test('phone: national formatting per country and E.164 rule', () => {
  const pattern = (iso: string) => COUNTRIES.find((c) => c.iso === iso)!.pattern;
  assert.equal(formatNational('9876543210', pattern('IN')), '98765 43210');
  assert.equal(formatNational('2015550123', pattern('US')), '(201) 555-0123');
  assert.equal(formatNational('201', pattern('US')), '(201');
  assert.equal(formatNational('7911123456', pattern('GB')), '7911 123456');
  assert.equal(formatNational('612345678', pattern('FR')), '6 12 34 56 78');
  assert.equal(validateValue(R.phone, '+447911123456'), null);
  assert.ok(validateValue(R.phone, '+44 7911 123456'));
  assert.ok(validateValue(R.phone, '07911123456'));
  // Every country has a sane pattern and length range.
  for (const c of COUNTRIES) {
    assert.ok(c.min <= c.max && c.max <= 14, c.iso);
    assert.ok((pattern(c.iso).match(/#/g) ?? []).length >= c.min, `${c.iso} pattern covers min digits`);
  }
});
