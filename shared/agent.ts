/**
 * What an AI agent (MCP client) may fill in on a user's behalf.
 *
 * Never: secret fields (passwords travel only from the user's keyboard, encrypted),
 * fields that must match a secret, or consent checkboxes (`mustBeTrue`, e.g. terms),
 * which the person has to tick themselves.
 */
import { rulesToJsonSchema, publicRules } from './jsonSchema.ts';
import { registrationRules, type RuleSet } from './rules.ts';

export function agentRules(rules: RuleSet): RuleSet {
  return Object.fromEntries(Object.entries(publicRules(rules) as RuleSet).filter(([, r]) => !r.mustBeTrue));
}

export const REGISTRATION_DRAFT_RULES = agentRules(registrationRules);

export const registrationDraftSchema = rulesToJsonSchema(REGISTRATION_DRAFT_RULES, {
  title: 'Registration details',
  description:
    'Account details to prefill. Password, password confirmation and terms acceptance are not accepted here: the person completes them in the secure form.',
});
// Drafts may be partial: the person fills in whatever is missing.
registrationDraftSchema.required = [];
