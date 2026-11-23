/**
 * Converts shared rules into JSON Schema (2020-12), e.g. for an MCP tool's
 * `inputSchema`, OpenAPI, or form builders. The rules stay the source of truth:
 * the server still validates with validatePayload(), which also checks things
 * JSON Schema can't express (relative dates, ages, weekdays, password policy).
 */
import type { FieldRule, RuleSet } from './rules.ts';

export interface JsonSchema {
  type?: string;
  title?: string;
  description?: string;
  [k: string]: unknown;
}

export interface ToJsonSchemaOptions {
  /** Include secret fields (as writeOnly strings). Default false: secrets don't belong in agent tool calls. */
  includeSecrets?: boolean;
  /** Field names to leave out. */
  omit?: string[];
  title?: string;
  description?: string;
}

/** Rules without secret fields, nor fields that must match a secret (e.g. confirm password). */
export function publicRules<R extends RuleSet>(rules: R): Partial<R> {
  const secret = new Set(Object.entries(rules).filter(([, r]) => r.type === 'secret').map(([k]) => k));
  return Object.fromEntries(
    Object.entries(rules).filter(([, r]) => r.type !== 'secret' && !(r.matches && secret.has(r.matches))),
  ) as Partial<R>;
}

export function rulesToJsonSchema(rules: RuleSet, opts: ToJsonSchemaOptions = {}): JsonSchema {
  const source = opts.includeSecrets ? rules : (publicRules(rules) as RuleSet);
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [name, rule] of Object.entries(source)) {
    if (opts.omit?.includes(name)) continue;
    properties[name] = fieldSchema(rule);
    if (rule.required || rule.mustBeTrue) required.push(name);
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    ...(opts.title ? { title: opts.title } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    properties,
    required,
    additionalProperties: false,
  };
}

function fieldSchema(r: FieldRule): JsonSchema {
  const notes: string[] = [];
  const s: JsonSchema = { title: r.label };
  switch (r.type) {
    case 'text':
    case 'secret':
      s.type = 'string';
      if (r.minLength !== undefined) s.minLength = r.minLength;
      if (r.maxLength !== undefined) s.maxLength = r.maxLength;
      if (r.pattern) s.pattern = r.pattern.source;
      if (r.patternMessage) notes.push(r.patternMessage);
      if (r.inputMode === 'email') s.format = 'email';
      if (r.type === 'secret') s.writeOnly = true;
      break;
    case 'number':
      s.type = r.step !== undefined && Number.isInteger(r.step) ? 'integer' : 'number';
      if (r.min !== undefined) s.minimum = r.min;
      if (r.max !== undefined) s.maximum = r.max;
      if (r.step !== undefined && r.step !== 1) s.multipleOf = r.step;
      break;
    case 'choice':
      s.type = 'string';
      s.enum = [...(r.options ?? [])];
      break;
    case 'boolean':
      s.type = 'boolean';
      if (r.mustBeTrue) {
        s.const = true;
        notes.push('Must be true; only set it when the user has explicitly agreed.');
      }
      break;
    case 'date':
      s.type = 'string';
      if (r.withTime) {
        s.pattern = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$';
        notes.push("Local date and time, 'YYYY-MM-DDTHH:mm'.");
      } else {
        s.format = 'date';
        notes.push("Date, 'YYYY-MM-DD'.");
      }
      if (r.minDate) notes.push(`On or after ${describeDate(r.minDate)}.`);
      if (r.maxDate) notes.push(`On or before ${describeDate(r.maxDate)}.`);
      if (r.minAge !== undefined) notes.push(`Person must be at least ${r.minAge} years old.`);
      if (r.maxAge !== undefined) notes.push(`Person must be at most ${r.maxAge} years old.`);
      if (r.notInPast) notes.push('Must be in the future.');
      if (r.weekdaysOnly) notes.push('Monday to Friday only.');
      break;
  }
  if (r.matches) notes.push(`Must equal "${r.matches}".`);
  if (notes.length) s.description = notes.join(' ');
  return s;
}

function describeDate(v: string): string {
  const m = /^today(?:([+-])(\d+))?$/.exec(v);
  if (!m) return v;
  if (!m[1]) return 'today';
  return `${m[2]} day${m[2] === '1' ? '' : 's'} ${m[1] === '+' ? 'from' : 'before'} today`;
}
