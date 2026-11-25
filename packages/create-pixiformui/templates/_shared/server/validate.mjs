// Server-side validation from the same field list the browser uses (shared/fields.js).
// Never trust the browser: this re-checks required fields, types, lengths and choices, and applies
// the same showIf conditions (a field the rules say is hidden is ignored, even if it was sent).
import { evaluateCondition } from './lib/conditions.mjs';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/;
const E164 = /^\+[1-9]\d{6,14}$/;
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
/** Types that aren't submitted. */
const UI_ONLY = new Set(['heading', 'paragraph', 'humancheck', 'group']);

/** Flattens groups into fields, each with the showIf rules of its groups. */
function flatten(list, parents = []) {
  const out = [];
  for (const f of list) {
    if (f.type === 'group') out.push(...flatten(f.fields, f.showIf ? [...parents, f.showIf] : parents));
    else if (!UI_ONLY.has(f.type)) out.push({ field: f, rules: f.showIf ? [...parents, f.showIf] : parents });
  }
  return out;
}

const isEmpty = (f, v) => v === undefined || v === null || v === '' || (f.type === 'checkbox' && v === false);

function checkType(f, v) {
  const label = f.label ?? f.name;
  switch (f.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
    case 'tel':
    case 'number':
      if (typeof v !== 'string') return `${label} must be text.`;
      if (v.length > (f.maxLength ?? (f.type === 'textarea' ? 2000 : 256))) return `${label} is too long.`;
      if (f.type === 'email' && !EMAIL.test(v)) return 'Enter a valid email address.';
      return null;
    case 'password':
      return typeof v === 'string' && v.startsWith('pfe1.') ? null : `${label} must be encrypted.`;
    case 'phone':
      return typeof v === 'string' && E164.test(v) ? null : 'Enter a valid phone number.';
    case 'radio':
    case 'select':
      return f.options.some((o) => o.value === v) ? null : `Choose a valid ${label.toLowerCase()}.`;
    case 'checkbox':
    case 'switch':
      return typeof v === 'boolean' ? null : `${label} must be true or false.`;
    case 'slider':
      return typeof v === 'number' && Number.isFinite(v) ? null : `${label} must be a number.`;
    case 'hidden':
      return v === null || ['string', 'number', 'boolean'].includes(typeof v) ? null : 'Invalid value.';
    default:
      return typeof v === 'string' && v.length <= 256 ? null : `${label} is invalid.`;
  }
}

/**
 * Validates a submitted JSON object. Returns `{ data, errors }`: `data` holds only the fields that
 * are shown under the rules; `errors` maps field names to messages (empty when valid).
 */
export function validate(fields, body) {
  const errors = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { data: {}, errors: { _form: 'Invalid request.' } };
  const list = flatten(fields);
  const byName = new Map(list.map((x) => [x.field.name, x]));
  for (const key of Object.keys(body)) {
    if (!SAFE_NAME.test(key) || !byName.has(key)) errors[key] = 'Unexpected field.';
  }

  // Resolve visibility like the browser: in order, with hidden fields counting as empty, until stable.
  const shown = new Map(list.map((x) => [x.field.name, true]));
  const get = (name) => {
    const x = byName.get(name);
    if (!x || !shown.get(name)) return undefined;
    const v = body[name];
    return { value: v, empty: isEmpty(x.field, v) };
  };
  for (let pass = 0; pass <= list.length; pass++) {
    let changed = false;
    for (const { field, rules } of list) {
      const now = rules.every((r) => evaluateCondition(r, get));
      if (now !== shown.get(field.name)) {
        shown.set(field.name, now);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const data = {};
  for (const { field } of list) {
    if (!shown.get(field.name)) continue; // hidden by a rule: ignore whatever was sent
    const v = body[field.name];
    if (isEmpty(field, v)) {
      if (field.required) errors[field.name] = field.requiredMessage ?? `${field.label ?? field.name} is required.`;
      continue;
    }
    const err = checkType(field, v);
    if (err) errors[field.name] = err;
    else data[field.name] = v;
  }
  return { data, errors };
}
