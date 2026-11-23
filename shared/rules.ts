/**
 * Predefined, declarative security rules shared by the browser and the server.
 *
 * The client uses them for instant feedback and to configure controls
 * (max lengths, allowed characters, keyboards). The server re-applies the
 * exact same rules to every request — client validation is never trusted.
 *
 * This file must stay dependency-free and use only erasable TypeScript
 * (no enums / parameter properties) so Node can run it with type stripping.
 */

export type FieldType = 'text' | 'secret' | 'boolean' | 'number' | 'choice' | 'date';

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  /** How many of: lowercase, uppercase, digit, symbol. */
  minCharClasses: number;
  /** Reject 3+ identical characters in a row (e.g. "aaa"). */
  noTripleRepeat: boolean;
  /** Reject if it contains the value of these fields (case-insensitive). */
  notContainingFields: string[];
  /** Reject well-known passwords. */
  rejectCommon: boolean;
}

export interface FieldRule {
  label: string;
  type: FieldType;
  required?: boolean;
  requiredMessage?: string;
  minLength?: number;
  maxLength?: number;
  /** Per-character allow-list (applied while typing and on the server). */
  charset?: RegExp;
  /** Whole-value pattern. */
  pattern?: RegExp;
  patternMessage?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Allowed values for 'choice'. */
  options?: readonly string[];
  /** For 'boolean': must be true (e.g. accept terms). */
  mustBeTrue?: boolean;
  /** Must equal another field's value (e.g. confirm password). */
  matches?: string;
  matchesMessage?: string;
  password?: PasswordPolicy;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'url';
  // ---- 'date' fields: 'YYYY-MM-DD', or 'YYYY-MM-DDTHH:mm' when withTime is set (local time)
  withTime?: boolean;
  /** Earliest / latest date: ISO date, 'today', or 'today±N' (days). */
  minDate?: string;
  maxDate?: string;
  /** Age limits in whole years (date of birth). */
  minAge?: number;
  maxAge?: number;
  /** Date (and time, when withTime) must not be before now. */
  notInPast?: boolean;
  weekdaysOnly?: boolean;
}

export type RuleSet = Record<string, FieldRule>;

// ------------------------------------------------------------------ date helpers (no timezone shifts)
interface DateParts {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
}

export function parseISODate(s: unknown, withTime = false): DateParts | null {
  if (typeof s !== 'string') return null;
  const m = (withTime ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/).exec(s);
  if (!m) return null;
  const [y, mo, d, hh, mm] = [+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0];
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (y < 1000 || mo < 1 || mo > 12 || d < 1 || d > dim || hh > 23 || mm > 59) return null;
  return { y, m: mo, d, hh, mm };
}

function localToday(offsetDays = 0): DateParts {
  const n = new Date();
  const t = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hh: 0, mm: 0 };
}

function resolveRuleDate(s: string | undefined): DateParts | null {
  if (!s) return null;
  const rel = /^today([+-]\d+)?$/.exec(s);
  return rel ? localToday(rel[1] ? +rel[1] : 0) : parseISODate(s);
}

const dayKey = (p: DateParts) => p.y * 10000 + p.m * 100 + p.d;

function ageOn(birth: DateParts, on: DateParts): number {
  let age = on.y - birth.y;
  if (on.m < birth.m || (on.m === birth.m && on.d < birth.d)) age--;
  return age;
}

/** Display form 'D Mon YYYY' for messages (locale-neutral). */
function shortDate(p: DateParts): string {
  return `${p.d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][p.m - 1]} ${p.y}`;
}

// ------------------------------------------------------------------ predefined rules
export const COUNTRIES = ['IN', 'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'SG', 'AE', 'BR', 'ZA'] as const;
export const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', DE: 'Germany',
  FR: 'France', JP: 'Japan', SG: 'Singapore', AE: 'United Arab Emirates', BR: 'Brazil', ZA: 'South Africa',
};
export const PLANS = ['free', 'pro', 'team'] as const;

export const registrationRules = {
  fullName: {
    label: 'Full name',
    type: 'text',
    required: true,
    minLength: 2,
    maxLength: 80,
    charset: /[\p{L}\p{M} .'-]/u,
    pattern: /^\p{L}[\p{L}\p{M} .'-]*$/u,
    patternMessage: 'Use letters, spaces, apostrophes, dots or hyphens.',
  },
  email: {
    label: 'Email',
    type: 'text',
    required: true,
    maxLength: 254,
    charset: /[A-Za-z0-9.!#$%&'*+/=?^_`{|}~@-]/,
    pattern: /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/,
    patternMessage: 'Enter a valid email address.',
    inputMode: 'email',
  },
  username: {
    label: 'Username',
    type: 'text',
    required: true,
    minLength: 3,
    maxLength: 24,
    charset: /[a-z0-9_]/,
    pattern: /^[a-z][a-z0-9_]{2,23}$/,
    patternMessage: 'Start with a letter; use lowercase letters, digits or _.',
  },
  password: {
    label: 'Password',
    type: 'secret',
    required: true,
    password: {
      minLength: 12,
      maxLength: 128,
      minCharClasses: 3,
      noTripleRepeat: true,
      notContainingFields: ['username', 'email', 'fullName'],
      rejectCommon: true,
    },
  },
  confirmPassword: {
    label: 'Confirm password',
    type: 'secret',
    required: true,
    matches: 'password',
    matchesMessage: 'Passwords do not match.',
  },
  phone: {
    label: 'Phone',
    type: 'text',
    required: false,
    maxLength: 16,
    charset: /[0-9+]/,
    pattern: /^\+[1-9][0-9]{7,14}$/,
    patternMessage: 'Use international format, e.g. +919876543210.',
    inputMode: 'tel',
  },
  country: { label: 'Country', type: 'choice', required: true, options: COUNTRIES },
  plan: { label: 'Plan', type: 'choice', required: true, options: PLANS },
  experience: { label: 'Years of experience', type: 'number', min: 0, max: 40, step: 1 },
  bio: {
    label: 'Short bio',
    type: 'text',
    required: false,
    maxLength: 280,
    // No markup characters: defence in depth if the bio is ever rendered as HTML.
    charset: /[^<>`\\]/,
  },
  dateOfBirth: {
    label: 'Date of birth',
    type: 'date',
    required: true,
    minDate: '1900-01-01',
    maxDate: 'today',
    minAge: 16,
    maxAge: 120,
  },
  onboardingCall: {
    label: 'Onboarding call',
    type: 'date',
    withTime: true,
    required: false,
    minDate: 'today',
    maxDate: 'today+60',
    notInPast: true,
    weekdaysOnly: true,
  },
  newsletter: { label: 'Product updates', type: 'boolean' },
  terms: {
    label: 'I agree to the Terms of Service and Privacy Policy',
    type: 'boolean',
    required: true,
    mustBeTrue: true,
    requiredMessage: 'You must accept the terms to continue.',
  },
} satisfies RuleSet;

export type RegistrationField = keyof typeof registrationRules;

// ------------------------------------------------------------------ validation (pure)
const COMMON_PASSWORDS = new Set([
  '123456789012', 'password1234', 'qwertyuiop12', 'iloveyou1234', 'password123!', 'Password123!',
  'admin1234567', 'welcome12345', 'letmein12345', 'qwerty123456', '1q2w3e4r5t6y', 'abc123456789',
  'passw0rd1234', 'p@ssw0rd1234', 'P@ssw0rd1234', 'changeme1234', 'football1234', 'monkey123456',
]);

export function charClasses(s: string): number {
  let n = 0;
  if (/[a-z]/.test(s)) n++;
  if (/[A-Z]/.test(s)) n++;
  if (/[0-9]/.test(s)) n++;
  if (/[^A-Za-z0-9]/.test(s)) n++;
  return n;
}

function codePointLength(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/** Checks a password against a policy. `context` holds sibling field values. */
export function checkPassword(pw: string, p: PasswordPolicy, context: Record<string, unknown> = {}): string | null {
  const len = codePointLength(pw);
  if (len < p.minLength) return `Use at least ${p.minLength} characters.`;
  if (len > p.maxLength) return `Use at most ${p.maxLength} characters.`;
  if (charClasses(pw) < p.minCharClasses) return `Mix at least ${p.minCharClasses} of: lowercase, uppercase, numbers, symbols.`;
  if (p.noTripleRepeat && /(.)\1\1/u.test(pw)) return 'Avoid repeating the same character 3+ times.';
  if (p.rejectCommon && COMMON_PASSWORDS.has(pw)) return 'This password is too common.';
  const lower = pw.toLowerCase();
  for (const f of p.notContainingFields) {
    const v = context[f];
    if (typeof v !== 'string') continue;
    const parts = f === 'email' ? [v.split('@')[0]] : v.split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3 && lower.includes(part.toLowerCase())) return 'Password must not contain your name, username or email.';
    }
  }
  return null;
}

/**
 * Validates a single plain value. Used directly by the server; the client
 * uses it for non-secret fields (secret fields go through `Secret.use`).
 */
export function validateValue(rule: FieldRule, value: unknown, all: Record<string, unknown> = {}): string | null {
  const empty = value === undefined || value === null || value === '' || (rule.type === 'boolean' && value === false);
  if (empty) {
    if (rule.required) return rule.requiredMessage ?? `${rule.label} is required.`;
    return null;
  }
  switch (rule.type) {
    case 'text':
    case 'secret': {
      if (typeof value !== 'string') return `${rule.label} is invalid.`;
      const len = codePointLength(value);
      if (rule.minLength !== undefined && len < rule.minLength) return `${rule.label} must be at least ${rule.minLength} characters.`;
      if (rule.maxLength !== undefined && len > rule.maxLength) return `${rule.label} must be at most ${rule.maxLength} characters.`;
      if (rule.charset) {
        const re = new RegExp(rule.charset.source, rule.charset.flags.replace(/[gy]/g, ''));
        for (const ch of value) if (ch !== '\n' && !re.test(ch)) return `${rule.label} contains characters that are not allowed.`;
      }
      if (rule.pattern && !rule.pattern.test(value)) return rule.patternMessage ?? `${rule.label} is invalid.`;
      if (rule.password) {
        const r = checkPassword(value, rule.password, all);
        if (r) return r;
      }
      if (rule.matches && value !== all[rule.matches]) return rule.matchesMessage ?? `${rule.label} does not match.`;
      return null;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${rule.label} must be a number.`;
      if (rule.min !== undefined && value < rule.min) return `${rule.label} must be at least ${rule.min}.`;
      if (rule.max !== undefined && value > rule.max) return `${rule.label} must be at most ${rule.max}.`;
      if (rule.step && Math.abs(((value - (rule.min ?? 0)) / rule.step) % 1) > 1e-9) return `${rule.label} is invalid.`;
      return null;
    }
    case 'boolean':
      if (typeof value !== 'boolean') return `${rule.label} is invalid.`;
      if (rule.mustBeTrue && value !== true) return rule.requiredMessage ?? `${rule.label} must be accepted.`;
      return null;
    case 'choice':
      if (typeof value !== 'string' || !rule.options?.includes(value)) return `Choose a valid ${rule.label.toLowerCase()}.`;
      return null;
    case 'date': {
      const p = parseISODate(value, !!rule.withTime);
      if (!p) return `Enter a valid ${rule.withTime ? 'date and time' : 'date'}.`;
      const min = resolveRuleDate(rule.minDate);
      const max = resolveRuleDate(rule.maxDate);
      if (min && dayKey(p) < dayKey(min)) return `Choose a date on or after ${shortDate(min)}.`;
      if (max && dayKey(p) > dayKey(max)) return `Choose a date on or before ${shortDate(max)}.`;
      const today = localToday();
      if (rule.minAge !== undefined && ageOn(p, today) < rule.minAge) return `You must be at least ${rule.minAge} years old.`;
      if (rule.maxAge !== undefined && ageOn(p, today) > rule.maxAge) return `Please check the year: the age can be at most ${rule.maxAge}.`;
      if (rule.weekdaysOnly) {
        const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
        if (wd === 0 || wd === 6) return 'Choose a weekday (Monday to Friday).';
      }
      if (rule.notInPast) {
        const now = new Date();
        const when = new Date(p.y, p.m - 1, p.d, p.hh, p.mm);
        const cutoff = rule.withTime ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (when < cutoff) return rule.withTime ? 'Choose a time in the future.' : 'Choose today or a later date.';
      }
      return null;
    }
  }
}

export interface SchemaResult {
  ok: boolean;
  errors: Record<string, string>;
  /** Only declared fields, with defaults applied. */
  data: Record<string, unknown>;
}

/**
 * Strict whole-payload validation for the server:
 * rejects unknown fields, wrong types and prototype-pollution keys.
 */
export function validatePayload(rules: RuleSet, payload: unknown): SchemaResult {
  const errors: Record<string, string> = Object.create(null);
  const data: Record<string, unknown> = Object.create(null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: { _form: 'Invalid request body.' }, data };
  }
  const input = payload as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(rules, key)) errors[key] = 'Unexpected field.';
  }
  for (const [name, rule] of Object.entries(rules)) {
    let v = Object.prototype.hasOwnProperty.call(input, name) ? input[name] : undefined;
    if (typeof v === 'string' && rule.type === 'text') v = v.normalize('NFC').trim();
    if (typeof v === 'string' && rule.type === 'secret') v = v.normalize('NFKC');
    if (v === undefined && rule.type === 'boolean') v = false;
    data[name] = v;
  }
  for (const [name, rule] of Object.entries(rules)) {
    const e = validateValue(rule, data[name], data);
    if (e) errors[name] = e;
  }
  return { ok: Object.keys(errors).length === 0, errors, data };
}

// ------------------------------------------------------------------ one-time codes
export const OTP_LENGTH = 6;

export const otpRules = {
  code: {
    label: 'Verification code',
    type: 'text',
    required: true,
    requiredMessage: 'Enter the code we sent you.',
    minLength: OTP_LENGTH,
    maxLength: OTP_LENGTH,
    charset: /[0-9]/,
    pattern: new RegExp(`^[0-9]{${OTP_LENGTH}}$`),
    patternMessage: `Enter all ${OTP_LENGTH} digits.`,
    inputMode: 'numeric',
  },
} satisfies RuleSet;

/**
 * Validates only the fields present in the payload (drafts / prefills): unknown
 * fields are rejected, missing ones are fine. Same per-field rules as validatePayload.
 */
export function validatePartial(rules: RuleSet, payload: unknown): SchemaResult {
  const errors: Record<string, string> = Object.create(null);
  const data: Record<string, unknown> = Object.create(null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: { _form: 'Invalid request body.' }, data };
  }
  const input = payload as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(rules, key)) {
      errors[key] = 'Unexpected field.';
      continue;
    }
    const rule = rules[key];
    let v = input[key];
    if (typeof v === 'string' && rule.type === 'text') v = v.normalize('NFC').trim();
    data[key] = v;
  }
  for (const key of Object.keys(data)) {
    const e = validateValue({ ...rules[key], required: false }, data[key], data);
    if (e) errors[key] = e;
  }
  return { ok: Object.keys(errors).length === 0, errors, data };
}
