import type { FieldRule, RuleSet } from '../../shared/rules';
import { validateValue } from '../../shared/rules';
import type { Validator } from './core/Control';
import { Secret } from './security/Secret';

/**
 * Builds a control validator from a shared FieldRule.
 * Secret values are only exposed inside `Secret.use`, and "matches" checks on
 * secrets use constant-time `Secret.equals` without creating strings.
 */
export function ruleValidator(rule: FieldRule): Validator<any> {
  return (value, ctx) => {
    if (value instanceof Secret) {
      if (rule.matches) {
        const other = ctx.getField?.(rule.matches)?.getValue();
        if (other instanceof Secret && !value.equals(other)) return rule.matchesMessage ?? `${rule.label} does not match.`;
      }
      const context: Record<string, unknown> = {};
      for (const f of rule.password?.notContainingFields ?? []) {
        const v = ctx.getField?.(f)?.getValue();
        if (typeof v === 'string') context[f] = v;
      }
      const { matches: _ignored, ...rest } = rule;
      return value.use((plain) => validateValue(rest, plain, context));
    }
    return validateValue(rule, typeof value === 'string' && rule.type === 'text' ? value.trim() : value);
  };
}

/** Control options derived from a rule: label, required, length, charset, keyboard, validator. */
export function fromRule<K extends string>(rules: RuleSet, name: K) {
  const rule = rules[name];
  if (!rule) throw new Error(`No rule for field "${name}"`);
  return {
    name,
    label: rule.label,
    required: !!rule.required,
    requiredMessage: rule.requiredMessage,
    maxLength: rule.password?.maxLength ?? rule.maxLength,
    allow: rule.charset,
    inputMode: rule.inputMode,
    validators: [ruleValidator(rule)],
    // Date rules also configure a DatePicker (range, time, weekdays).
    ...(rule.type === 'date'
      ? {
          min: rule.minDate,
          max: rule.maxDate,
          time: rule.withTime ? { step: 15 } : undefined,
          isDateDisabled: rule.weekdaysOnly
            ? (iso: string) => {
                const [y, m, d] = iso.split('-').map(Number);
                const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
                return wd === 0 || wd === 6;
              }
            : undefined,
        }
      : {}),
  };
}
