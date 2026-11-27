/**
 * "Describe a form → get a form": POST /api/generate-form turns a sentence into a PixiFormUI config.
 *
 *   POST /api/generate-form  { prompt, current? }  →  { ok, config } | { ok: false, message }
 *
 * Claude returns JSON constrained to FORM_SCHEMA (structured outputs), and sanitizeConfig() then
 * rebuilds it from an allowlist, so only known field types and plain strings ever reach the page.
 * `current` (the playground's config) lets a follow-up refine the form ("make phone optional").
 *
 * Cost and abuse: same-origin requests only, a short prompt, a per-visitor hourly limit and a
 * site-wide daily cap (KV counters). Without ANTHROPIC_API_KEY the endpoint answers 503.
 */
import Anthropic from '@anthropic-ai/sdk';

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
export interface BuilderEnv {
  WAITLIST: KV;
  /** Anthropic API key (wrangler secret put ANTHROPIC_API_KEY). Unset: the feature is off. */
  ANTHROPIC_API_KEY?: string;
  /** The site's origin; requests from elsewhere are refused. */
  SITE_ORIGIN?: string;
  /** Limits (defaults: 8 an hour per visitor, 300 a day for the whole site). */
  GEN_PER_HOUR?: string;
  GEN_PER_DAY?: string;
  /** Tests only: a fake fetch for the Anthropic client. */
  ANTHROPIC_FETCH?: typeof fetch;
}

const MODEL = 'claude-opus-5-5';
const MAX_PROMPT = 600;
const MAX_FIELDS = 40;

const FIELD_TYPES = ['text', 'email', 'tel', 'url', 'number', 'textarea', 'password', 'otp', 'date', 'phone', 'checkbox', 'switch', 'radio', 'select', 'slider', 'heading', 'paragraph', 'humancheck'] as const;
type FieldType = (typeof FIELD_TYPES)[number];

// ------------------------------------------------------------------ the schema Claude must follow
const str = { type: 'string' };
const nullable = (s: object) => ({ anyOf: [s, { type: 'null' }] });
const field = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'name', 'label', 'text', 'required', 'placeholder', 'helperText', 'info', 'maxLength', 'options', 'min', 'max', 'row', 'strengthMeter', 'showIf'],
  properties: {
    type: { type: 'string', enum: FIELD_TYPES },
    name: { ...str, description: 'camelCase, unique, letters and digits only' },
    label: str,
    text: nullable({ ...str, description: 'Only for heading and paragraph' }),
    required: { type: 'boolean' },
    placeholder: nullable(str),
    helperText: nullable(str),
    info: nullable({ ...str, description: 'Tooltip text shown from an (i) icon' }),
    maxLength: nullable({ type: 'integer' }),
    options: nullable({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['value', 'label'], properties: { value: str, label: str } } }),
    min: nullable({ type: 'number' }),
    max: nullable({ type: 'number' }),
    row: nullable({ ...str, description: 'Fields with the same row key sit side by side' }),
    strengthMeter: nullable({ type: 'boolean' }),
    showIf: nullable({
      type: 'object',
      additionalProperties: false,
      required: ['field', 'equals', 'in', 'filled'],
      properties: { field: str, equals: nullable(str), in: nullable({ type: 'array', items: str }), filled: nullable({ type: 'boolean' }) },
    }),
  },
};
export const FORM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'subtitle', 'submitText', 'fields'],
  properties: {
    title: str,
    subtitle: nullable(str),
    submitText: str,
    fields: {
      type: 'array',
      items: {
        anyOf: [
          { $ref: '#/$defs/field' },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'title', 'description', 'collapsible', 'fields'],
            properties: { type: { const: 'group' }, title: str, description: nullable(str), collapsible: { type: 'boolean' }, fields: { type: 'array', items: { $ref: '#/$defs/field' } } },
          },
        ],
      },
    },
  },
  $defs: { field },
};

const SYSTEM = `You design web forms for PixiFormUI, a secure canvas-rendered form library. Turn the user's description into a form config that follows the JSON schema exactly.

Rules:
- Use the most specific field type: email, tel or phone (phone has a country picker), url, number, date, password (set strengthMeter true on sign-up forms), otp (one-time codes), textarea for long text, select for 6+ choices, radio for 2-5 choices, checkbox for a single consent, switch for on/off settings, slider for a bounded number.
- Labels are short and in sentence case. Mark only truly necessary fields required. Add a placeholder or helperText only when it helps.
- name: unique camelCase identifiers (letters and digits).
- Group related fields with a group when the form has more than about 6 fields; put short related pairs (first and last name, city and postcode) in the same row.
- Use showIf for fields that only matter after a choice, e.g. { field: "contactMethod", equals: "phone" }. Reference fields that come earlier.
- heading and paragraph fields carry their content in text (set label to an empty string).
- Add a humancheck field (label "Quick check") at the end of public forms such as sign-ups and contact forms.
- Never add fields for full card numbers, card security codes, bank passwords or government ID numbers; if asked, add a paragraph saying those must be collected by a payment or identity provider.
- If the user is refining an existing form, keep everything they didn't ask to change.
- Keep it under ${MAX_FIELDS} fields. Write all text in the language of the user's description.`;

// ------------------------------------------------------------------ allowlist rebuild (never trust the model's JSON)
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');
const NAME = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function cleanField(f: Record<string, unknown>, names: Set<string>): Record<string, unknown> | null {
  const type = f.type as FieldType;
  if (!FIELD_TYPES.includes(type)) return null;
  if (type === 'heading' || type === 'paragraph') {
    const text = clip(f.text, type === 'heading' ? 120 : 400) || clip(f.label, 120);
    return text ? { type, text, ...(clip(f.row, 20) ? { row: clip(f.row, 20) } : {}) } : null;
  }
  let name = clip(f.name, 40).replace(/[^A-Za-z0-9]/g, '');
  if (!NAME.test(name)) name = `field${names.size + 1}`;
  while (names.has(name)) name = `${name}2`;
  const out: Record<string, unknown> = { type, name, label: clip(f.label, 80) || name };
  if (f.required === true && type !== 'humancheck') out.required = true;
  for (const k of ['placeholder', 'helperText'] as const) if (clip(f[k], 120)) out[k] = clip(f[k], 120);
  if (clip(f.info, 240)) out.info = clip(f.info, 240);
  if (clip(f.row, 20)) out.row = clip(f.row, 20);
  const maxLength = num(f.maxLength);
  if (maxLength && ['text', 'email', 'tel', 'url', 'textarea'].includes(type)) out.maxLength = Math.min(5000, Math.max(1, Math.round(maxLength)));
  if (type === 'radio' || type === 'select') {
    const opts = (Array.isArray(f.options) ? f.options : [])
      .map((o: Record<string, unknown>) => ({ value: clip(o?.value, 60), label: clip(o?.label, 80) }))
      .filter((o) => o.value && o.label)
      .slice(0, 60);
    if (opts.length < 2) return null;
    out.options = opts;
    if (type === 'radio' && opts.length <= 3) out.direction = 'horizontal';
  }
  if (type === 'slider' || type === 'number') {
    const min = num(f.min);
    const max = num(f.max);
    if (min !== undefined) out.min = min;
    if (max !== undefined && (min === undefined || max > min)) out.max = max;
    if (type === 'slider') {
      out.min ??= 0;
      out.max ??= 100;
      out.value = out.min;
    }
  }
  if (type === 'password' && f.strengthMeter === true) out.strengthMeter = true;
  names.add(name); // reserved only for fields that are kept
  return out;
}

function cleanShowIf(s: unknown, known: Set<string>): Record<string, unknown> | undefined {
  if (!s || typeof s !== 'object') return undefined;
  const c = s as Record<string, unknown>;
  const field = clip(c.field, 40);
  if (!known.has(field)) return undefined; // only fields that exist earlier in the form
  if (typeof c.equals === 'string') return { field, equals: clip(c.equals, 60) };
  if (Array.isArray(c.in)) return { field, in: c.in.map((v) => clip(v, 60)).filter(Boolean).slice(0, 20) };
  if (c.filled === true) return { field, filled: true };
  return undefined;
}

/** Rebuilds a config from known keys only; anything else (scripts, styles, URLs, handlers) is dropped. */
export function sanitizeConfig(raw: unknown): { title: string; subtitle?: string; submitText: string; fields: Record<string, unknown>[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const names = new Set<string>();
  let count = 0;
  const one = (f: Record<string, unknown>) => {
    if (count >= MAX_FIELDS || !f || typeof f !== 'object') return null;
    const before = new Set(names);
    const out = cleanField(f, names);
    if (!out) return null;
    count++;
    const showIf = cleanShowIf(f.showIf, before);
    return showIf ? { ...out, showIf } : out;
  };
  const fields: Record<string, unknown>[] = [];
  for (const f of Array.isArray(r.fields) ? (r.fields as Record<string, unknown>[]) : []) {
    if (f?.type === 'group') {
      const inner = (Array.isArray(f.fields) ? (f.fields as Record<string, unknown>[]) : []).map(one).filter((x): x is Record<string, unknown> => !!x);
      if (!inner.length) continue;
      fields.push({ type: 'group', title: clip(f.title, 80) || 'Details', ...(clip(f.description, 200) ? { description: clip(f.description, 200) } : {}), ...(f.collapsible === true ? { collapsible: true } : {}), fields: inner });
    } else {
      const out = one(f);
      if (out) fields.push(out);
    }
  }
  if (!fields.length) return null;
  return { title: clip(r.title, 80) || 'Your form', ...(clip(r.subtitle, 160) ? { subtitle: clip(r.subtitle, 160) } : {}), submitText: clip(r.submitText, 40) || 'Submit', fields };
}

// ------------------------------------------------------------------ the endpoint
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });

async function bump(env: BuilderEnv, key: string, limit: number, ttl: number): Promise<boolean> {
  const n = Number((await env.WAITLIST.get(key)) ?? 0);
  if (n >= limit) return false;
  await env.WAITLIST.put(key, String(n + 1), { expirationTtl: ttl });
  return true;
}
async function hashIp(ip: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`gen:${ip}`)));
  return [...d.subarray(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateForm(req: Request, env: BuilderEnv): Promise<Response> {
  if (req.method !== 'POST') return reply(405, { ok: false, message: 'Method not allowed.' });
  if (!env.ANTHROPIC_API_KEY) return reply(503, { ok: false, message: 'Form generation isn’t switched on yet.' });
  const origin = env.SITE_ORIGIN ?? new URL(req.url).origin;
  if (req.headers.get('Origin') !== origin) return reply(403, { ok: false, message: 'Cross-site request refused.' });
  if (!(req.headers.get('Content-Type') ?? '').startsWith('application/json')) return reply(415, { ok: false, message: 'Send JSON.' });
  const text = await req.text();
  if (text.length > 24 * 1024) return reply(413, { ok: false, message: 'Request too large.' });
  let body: { prompt?: unknown; current?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, message: 'Malformed JSON.' });
  }
  const prompt = clip(body.prompt, MAX_PROMPT + 1);
  if (prompt.length < 3) return reply(422, { ok: false, message: 'Describe the form you want, e.g. “a job application with CV link and notice period”.' });
  if (prompt.length > MAX_PROMPT) return reply(422, { ok: false, message: `Keep the description under ${MAX_PROMPT} characters.` });
  const current = body.current ? sanitizeConfig(body.current) : null;

  const hour = Math.floor(Date.now() / 3_600_000);
  const day = new Date().toISOString().slice(0, 10);
  const ip = await hashIp(req.headers.get('CF-Connecting-IP') ?? 'unknown');
  if (!(await bump(env, `gen:ip:${ip}:${hour}`, Number(env.GEN_PER_HOUR ?? 8), 7200))) return reply(429, { ok: false, message: 'You’ve generated a lot of forms this hour. Try again later, or edit the JSON directly.' }, { 'Retry-After': '3600' });
  if (!(await bump(env, `gen:day:${day}`, Number(env.GEN_PER_DAY ?? 300), 2 * 86400))) return reply(429, { ok: false, message: 'Form generation is busy today. Try again tomorrow, or start from a preset.' }, { 'Retry-After': '3600' });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000, ...(env.ANTHROPIC_FETCH ? { fetch: env.ANTHROPIC_FETCH } : {}) });
  const user = current ? `Current form (JSON):\n${JSON.stringify(current)}\n\nChange it as follows: ${prompt}` : `Create this form: ${prompt}`;
  let msg;
  try {
    msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // A declined request is retried on a fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: FORM_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return reply(429, { ok: false, message: 'Form generation is busy. Try again in a minute.' }, { 'Retry-After': '60' });
    console.error('generate-form: Anthropic API error', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return reply(502, { ok: false, message: 'Couldn’t generate the form right now. Please try again.' });
  }
  if (msg.stop_reason === 'refusal') return reply(422, { ok: false, message: 'That isn’t a form we can build. Try describing a different one.' });
  if (msg.stop_reason === 'max_tokens') return reply(502, { ok: false, message: 'That form came out too large. Try a shorter description.' });
  const out = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
  let config;
  try {
    config = sanitizeConfig(JSON.parse(out));
  } catch {
    config = null;
  }
  if (!config) return reply(502, { ok: false, message: 'Couldn’t make a form from that. Try describing it differently.' });
  return reply(200, { ok: true, config });
}
