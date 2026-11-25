/**
 * Conditions for showing fields (`showIf`). Plain data, so they work in JSON configs, the
 * playground and on a server; or a function for anything else.
 *
 *   showIf: { field: 'contact', equals: 'phone' }
 *   showIf: { field: 'age', gte: 18 }
 *   showIf: { field: 'plan', in: ['pro', 'team'] }
 *   showIf: { field: 'company', filled: true }
 *   showIf: { all: [{ field: 'type', equals: 'business' }, { not: { field: 'country', equals: 'IN' } }] }
 *   showIf: (values) => values.newsletter === true
 *
 * A field condition with several operators needs all of them to hold. A field that is itself
 * hidden counts as empty (value undefined), so conditions chain naturally.
 */

export interface FieldCondition {
  /** Name of the field to look at. */
  field: string;
  equals?: unknown;
  notEquals?: unknown;
  in?: unknown[];
  notIn?: unknown[];
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  /** true: the field has no value (unchecked, nothing selected, empty text). */
  empty?: boolean;
  /** true: the field has a value. */
  filled?: boolean;
}

export type Condition = FieldCondition | { all: Condition[] } | { any: Condition[] } | { not: Condition };

export type ShowIf = Condition | ((values: Record<string, unknown>) => boolean);

/** What a condition can see of a field. */
export interface ConditionField {
  value: unknown;
  empty: boolean;
}

const OPS = ['equals', 'notEquals', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'empty', 'filled'] as const;

/** Comparable form of a value: dates as ISO strings, everything else as is. */
const norm = (v: unknown): unknown => (v instanceof Date ? v.toISOString() : v);
const same = (a: unknown, b: unknown) => norm(a) === norm(b);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : v instanceof Date ? v.getTime() : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Evaluates a condition. `get` returns undefined for unknown or hidden fields. */
export function evaluateCondition(c: Condition, get: (name: string) => ConditionField | undefined, depth = 0): boolean {
  if (depth > 16) throw new Error('showIf: conditions are nested too deeply');
  if ('all' in c) return c.all.every((x) => evaluateCondition(x, get, depth + 1));
  if ('any' in c) return c.any.some((x) => evaluateCondition(x, get, depth + 1));
  if ('not' in c) return !evaluateCondition(c.not, get, depth + 1);
  const f = get(c.field);
  const value = f?.value;
  const empty = f ? f.empty : true;
  let used = false;
  const check = (has: boolean, ok: () => boolean): boolean => {
    if (!has) return true;
    used = true;
    return ok();
  };
  const n = () => num(value);
  const ok =
    check('equals' in c, () => !!f && same(value, c.equals)) &&
    check('notEquals' in c, () => !f || !same(value, c.notEquals)) &&
    check(Array.isArray(c.in), () => !!f && c.in!.some((x) => same(value, x))) &&
    check(Array.isArray(c.notIn), () => !f || !c.notIn!.some((x) => same(value, x))) &&
    check(c.gt !== undefined, () => n() !== null && n()! > c.gt!) &&
    check(c.gte !== undefined, () => n() !== null && n()! >= c.gte!) &&
    check(c.lt !== undefined, () => n() !== null && n()! < c.lt!) &&
    check(c.lte !== undefined, () => n() !== null && n()! <= c.lte!) &&
    check(c.empty !== undefined, () => empty === c.empty) &&
    check(c.filled !== undefined, () => !empty === c.filled);
  // `{ field: 'x' }` alone means "x has a value".
  return used ? ok : !empty;
}

/** Field names a condition reads (functions can read anything: returns null). */
export function conditionFields(s: ShowIf): string[] | null {
  if (typeof s === 'function') return null;
  const out: string[] = [];
  const walk = (c: Condition, depth: number) => {
    if (depth > 16) throw new Error('showIf: conditions are nested too deeply');
    if (!c || typeof c !== 'object') throw new Error('showIf: each condition must be an object');
    if ('all' in c || 'any' in c) {
      const list = 'all' in c ? c.all : c.any;
      if (!Array.isArray(list)) throw new Error('showIf: "all" and "any" take a list of conditions');
      list.forEach((x) => walk(x, depth + 1));
    } else if ('not' in c) walk(c.not, depth + 1);
    else {
      if (typeof c.field !== 'string') throw new Error('showIf: a condition needs a "field" name');
      for (const k of Object.keys(c)) if (k !== 'field' && !(OPS as readonly string[]).includes(k)) throw new Error(`showIf: unknown operator "${k}"`);
      out.push(c.field);
    }
  };
  walk(s, 0);
  return out;
}
