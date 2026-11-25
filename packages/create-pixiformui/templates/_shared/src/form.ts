import { Secret, type FieldConfig, type PixiFormConfig, type Validator } from 'pixiformui';
import { fields, MIN_PASSWORD } from '../shared/fields.js';

// Browser-only checks added to the shared fields (functions can't live in shared/fields.js).
const minLength: Validator<unknown> = (v) =>
  v instanceof Secret && !v.isEmpty && v.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : null;
const matchesPassword: Validator<unknown> = (v, ctx) => {
  const pw = ctx.getField?.('password')?.getValue();
  return v instanceof Secret && pw instanceof Secret && !v.isEmpty && !v.equals(pw) ? 'The passwords don’t match.' : null;
};
const extra: Record<string, Validator<unknown>[]> = { password: [minLength], confirmPassword: [matchesPassword] };

const withValidators = (list: FieldConfig[]): FieldConfig[] =>
  list.map((f) => {
    if (f.type === 'group') return { ...f, fields: withValidators(f.fields) };
    const v = 'name' in f ? extra[f.name] : undefined;
    return v ? ({ ...f, validators: v } as FieldConfig) : f;
  });

export const formConfig: PixiFormConfig = {
  id: 'signup',
  title: 'Create your account',
  subtitle: 'Rendered on canvas: what you type never enters the page.',
  theme: 'indigo',
  maxWidth: 640,
  fields: withValidators(fields),
  submitText: 'Create account',
  resetText: 'Reset',
  // No submit code needed: PixiFormUI fetches a session (CSRF token, encryption key, proof-of-work
  // challenge), encrypts the passwords, solves the proof and POSTs JSON to `action`.
  session: '/api/session',
  action: '/api/signup',
  form: {
    rateLimit: { maxAttempts: 5, windowMs: 60_000, lockoutMs: 15_000 },
    cooldownMs: 1500,
  },
};
