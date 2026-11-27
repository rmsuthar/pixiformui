/** Website Worker: "describe a form" (site/form-builder.ts), against a fake Anthropic API.  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type Env } from '../site/worker.ts';
import { sanitizeConfig } from '../site/form-builder.ts';

const ORIGIN = 'https://pixiformui.lets.gen.in';

/** A fake Messages API: records each request body and answers with `reply(body)`. */
function fakeAnthropic(reply: (body: Record<string, unknown>) => { text?: string; stop_reason?: string; status?: number }) {
  const calls: Record<string, unknown>[] = [];
  const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push(body);
    const r = reply(body);
    if (r.status && r.status >= 400) return Response.json({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, { status: r.status });
    return Response.json({
      id: 'msg_test', type: 'message', role: 'assistant', model: body.model, stop_reason: r.stop_reason ?? 'end_turn', stop_sequence: null,
      content: r.text === undefined ? [] : [{ type: 'text', text: r.text }],
      usage: { input_tokens: 10, output_tokens: 10 },
    });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

function makeEnv(over: Partial<Env> = {}) {
  const store = new Map<string, string>();
  const env: Env = {
    ASSETS: { fetch: async () => new Response('asset') },
    WAITLIST: { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) },
    WAITLIST_SECRET: 'test-secret-0123456789',
    ANTHROPIC_API_KEY: 'sk-ant-test',
    SITE_ORIGIN: ORIGIN,
    ...over,
  };
  return { env, store };
}

const generate = (env: Env, body: unknown, headers: Record<string, string> = {}) =>
  worker.fetch(new Request(`${ORIGIN}/api/generate-form`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...headers }, body: JSON.stringify(body) }), env);

const MODEL_FORM = {
  title: 'Job application',
  subtitle: null,
  submitText: 'Apply',
  fields: [
    { type: 'group', title: 'You', description: null, collapsible: false, fields: [
      { type: 'text', name: 'fullName', label: 'Full name', text: null, required: true, placeholder: null, helperText: null, info: null, maxLength: 80, options: null, min: null, max: null, row: 'n', strengthMeter: null, showIf: null },
      { type: 'email', name: 'email', label: 'Email', text: null, required: true, placeholder: 'you@example.com', helperText: null, info: null, maxLength: null, options: null, min: null, max: null, row: null, strengthMeter: null, showIf: null },
    ] },
    { type: 'select', name: 'notice', label: 'Notice period', text: null, required: true, placeholder: null, helperText: null, info: null, maxLength: null, options: [{ value: '0', label: 'Immediate' }, { value: '30', label: '30 days' }, { value: '60', label: '60 days' }], min: null, max: null, row: null, strengthMeter: null, showIf: null },
    { type: 'textarea', name: 'reason', label: 'Why 60 days?', text: null, required: false, placeholder: null, helperText: null, info: null, maxLength: null, options: null, min: null, max: null, row: null, strengthMeter: null, showIf: { field: 'notice', equals: '60', in: null, filled: null } },
    { type: 'humancheck', name: 'human', label: 'Quick check', text: null, required: true, placeholder: null, helperText: null, info: null, maxLength: null, options: null, min: null, max: null, row: null, strengthMeter: null, showIf: null },
  ],
};

test('sanitizeConfig keeps known fields and drops everything else', () => {
  const out = sanitizeConfig({
    title: 'T', submitText: 'Go', action: 'https://evil.example', onSubmit: 'alert(1)',
    fields: [
      { type: 'text', name: 'a', label: 'A', onclick: 'x', style: 'y' },
      { type: 'script', name: 'b', label: 'B' }, // unknown type
      { type: 'hidden', name: 'c', value: 'secret' }, // not offered to the model
      { type: 'radio', name: 'r', label: 'R', options: [{ value: 'only', label: 'Only one' }] }, // < 2 options
      { type: 'text', name: 'a', label: 'Duplicate name' },
      { type: 'text', name: '1 bad name!', label: 'Bad', showIf: { field: 'later', equals: 'x' } },
      { type: 'slider', name: 's', label: 'S', min: 10, max: 5 },
      { type: 'paragraph', text: 'Hello\u0000 world' },
    ],
  })!;
  assert.deepEqual(Object.keys(out).sort(), ['fields', 'submitText', 'title']);
  assert.deepEqual(out.fields.map((f) => f.type), ['text', 'text', 'text', 'slider', 'paragraph']);
  assert.deepEqual(out.fields[0], { type: 'text', name: 'a', label: 'A' });
  assert.equal(out.fields[1].name, 'a2'); // made unique
  assert.equal(out.fields[2].name, 'field3'); // invalid names get a safe one
  assert.equal(out.fields[2].showIf, undefined); // only earlier fields
  assert.deepEqual([out.fields[3].min, out.fields[3].max, out.fields[3].value], [10, 100, 10]); // impossible max → default
  assert.equal(out.fields[4].text, 'Hello  world');
  assert.equal(sanitizeConfig({ fields: [] }), null);
  assert.equal(sanitizeConfig('nope'), null);
});

test('describe a form: sends a constrained request and returns a sanitized config', async () => {
  const api = fakeAnthropic(() => ({ text: JSON.stringify(MODEL_FORM) }));
  const { env } = makeEnv({ ANTHROPIC_FETCH: api.fetch });
  const res = await generate(env, { prompt: 'job application with notice period' });
  assert.equal(res.status, 200);
  const { config } = (await res.json()) as { config: { title: string; fields: Record<string, unknown>[] } };
  assert.equal(config.title, 'Job application');
  assert.equal(config.fields[0].type, 'group');
  assert.deepEqual(config.fields[2].showIf, { field: 'notice', equals: '60' });
  assert.equal(config.fields[3].required, undefined); // humancheck never "required"
  const sent = api.calls[0] as { model: string; output_config: { effort: string; format: { type: string } }; fallbacks: string; messages: { content: string }[] };
  assert.equal(sent.model, 'claude-opus-5-5');
  assert.deepEqual([sent.output_config.effort, sent.output_config.format.type, sent.fallbacks], ['low', 'json_schema', 'default']);
  assert.match(sent.messages[0].content, /^Create this form: job application/);

  // Refining sends the current form (sanitized) with the change.
  await generate(env, { prompt: 'make email optional', current: { ...config, action: 'https://evil.example' } });
  assert.match((api.calls[1] as { messages: { content: string }[] }).messages[0].content, /^Current form \(JSON\):\n\{"title":"Job application".*Change it as follows: make email optional$/s);
  assert.ok(!JSON.stringify(api.calls[1]).includes('evil.example'));
});

test('describe a form: off without a key, same-origin only, short prompts, limits, refusals', async () => {
  assert.equal((await generate(makeEnv({ ANTHROPIC_API_KEY: undefined }).env, { prompt: 'contact form' })).status, 503);
  const api = fakeAnthropic(() => ({ text: JSON.stringify(MODEL_FORM) }));
  const { env } = makeEnv({ ANTHROPIC_FETCH: api.fetch, GEN_PER_HOUR: '2' });
  assert.equal((await generate(env, { prompt: 'contact form' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await generate(env, { prompt: 'x' })).status, 422);
  assert.equal((await generate(env, { prompt: 'y'.repeat(601) })).status, 422);
  assert.equal(api.calls.length, 0); // nothing above reached the API
  assert.equal((await generate(env, { prompt: 'contact form' })).status, 200);
  assert.equal((await generate(env, { prompt: 'contact form' })).status, 200);
  assert.equal((await generate(env, { prompt: 'contact form' })).status, 429); // 2 an hour per visitor
  assert.equal((await generate(env, { prompt: 'contact form' }, { 'CF-Connecting-IP': '198.51.100.1' })).status, 200); // someone else

  const day = makeEnv({ ANTHROPIC_FETCH: api.fetch, GEN_PER_DAY: '1' }).env;
  assert.equal((await generate(day, { prompt: 'contact form' })).status, 200);
  assert.equal((await generate(day, { prompt: 'contact form' }, { 'CF-Connecting-IP': '198.51.100.2' })).status, 429); // site-wide cap

  const refused = makeEnv({ ANTHROPIC_FETCH: fakeAnthropic(() => ({ stop_reason: 'refusal' })).fetch }).env;
  assert.equal((await generate(refused, { prompt: 'something odd' })).status, 422);
  const garbage = makeEnv({ ANTHROPIC_FETCH: fakeAnthropic(() => ({ text: '{"fields": []}' })).fetch }).env;
  assert.equal((await generate(garbage, { prompt: 'contact form' })).status, 502);
  const busy = makeEnv({ ANTHROPIC_FETCH: fakeAnthropic(() => ({ status: 429 })).fetch }).env;
  assert.equal((await generate(busy, { prompt: 'contact form' })).status, 429);
});
