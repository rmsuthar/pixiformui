/** pixiformui/translate: collecting, translating and applying form texts.  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStrings, configStrings, translateConfig } from '../src/lib/translate.ts';

const config = {
  title: 'Apply',
  submitText: 'Send',
  onSubmit: () => ({ ok: true }), // functions survive the copy
  fields: [
    { type: 'group', title: 'About you', description: 'How we reach you.', fields: [
      { type: 'text', name: 'name', label: 'Full name', placeholder: 'Ada Lovelace', required: true },
      { type: 'email', name: 'email', label: 'Email', required: true, requiredMessage: 'We need your email.' },
    ] },
    { type: 'select', name: 'notice', label: 'Notice period', options: [{ value: '0', label: 'Immediate' }, { value: '30', label: '30 days' }] },
    { type: 'paragraph', text: 'We reply within a day.' },
    { type: 'checkbox', name: 'terms', label: 'Full name', required: true }, // duplicate text is sent once
  ],
};

test('configStrings: every visible text once, plus the required-message template', () => {
  assert.deepEqual(configStrings(config), ['Apply', 'Send', 'About you', 'How we reach you.', 'Full name', 'Ada Lovelace', 'Email', 'We need your email.', 'Notice period', 'Immediate', '30 days', 'We reply within a day.', '{label} is required.']);
});

test('translateConfig: a translated copy (values, names and functions untouched), with translated required messages', async () => {
  const fr: Record<string, string> = { Apply: 'Postuler', Send: 'Envoyer', 'Full name': 'Nom complet', Email: 'E-mail', 'We need your email.': 'Il nous faut votre e-mail.', Immediate: 'Immédiat', '{label} is required.': '{label} est obligatoire.' };
  const calls: [string[], string, string][] = [];
  const out = await translateConfig(config, { target: 'fr-CA', translate: async (s, t, src) => (calls.push([s, t, src]), s.map((x) => fr[x] ?? '')) });
  assert.deepEqual([calls[0][1], calls[0][2]], ['fr-CA', 'en']);
  assert.equal(out.title, 'Postuler');
  assert.equal(out.onSubmit, config.onSubmit);
  const [group, select, para, terms] = out.fields as Record<string, any>[];
  assert.deepEqual([group.fields[0].label, group.fields[0].requiredMessage, group.fields[0].name, group.fields[0].placeholder], ['Nom complet', 'Nom complet est obligatoire.', 'name', 'Ada Lovelace']); // untranslated stays
  assert.equal(group.fields[1].requiredMessage, 'Il nous faut votre e-mail.');
  assert.deepEqual(select.options, [{ value: '0', label: 'Immédiat' }, { value: '30', label: '30 days' }]);
  assert.equal(para.text, 'We reply within a day.');
  assert.equal(terms.label, 'Nom complet');
  assert.equal((config.fields[0] as any).fields[0].label, 'Full name', 'the original config is not modified');
});

test('translateConfig: same language, failures, timeouts and bad replies keep the original', async () => {
  let called = false;
  const spy = async (s: string[]) => ((called = true), s);
  assert.equal(await translateConfig(config, { target: 'en-GB', translate: spy }), config);
  assert.equal(await translateConfig(config, { target: 'not a tag!', translate: spy }), config);
  assert.equal(called, false);
  assert.equal(await translateConfig(config, { target: 'de', translate: async () => { throw new Error('down'); } }), config);
  assert.equal(await translateConfig(config, { target: 'de', timeoutMs: 20, translate: () => new Promise(() => {}) }), config);
  const lost = await translateConfig(config, { target: 'de', translate: async (s) => s.map((x) => (x === '{label} is required.' ? 'Pflichtfeld' : `DE ${x}`)) });
  assert.equal((lost.fields[0] as any).fields[0].requiredMessage, undefined); // template without {label}: default message kept
  assert.equal(lost.title, 'DE Apply');
});

test('translateConfig with an endpoint: POSTs { source, target, strings } and reads { translations }', async () => {
  const realFetch = globalThis.fetch;
  let sent: any;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = { url, body: JSON.parse(String(init.body)), credentials: init.credentials };
    return Response.json({ translations: sent.body.strings.map((s: string) => s.toUpperCase().replace('{LABEL}', '{label}')) });
  }) as typeof fetch;
  try {
    const out = await translateConfig(config, { url: 'https://cloud.example/f/abc/translate', target: 'hi' });
    assert.deepEqual([sent.url, sent.body.source, sent.body.target, sent.credentials], ['https://cloud.example/f/abc/translate', 'en', 'hi', 'omit']);
    assert.equal(out.submitText, 'SEND');
    assert.equal((out.fields[0] as any).fields[0].requiredMessage, 'FULL NAME IS REQUIRED.');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(applyStrings({ fields: [] }, new Map()), { fields: [] });
});

test('multi-step configs: step titles, descriptions, fields and the Next/Back/progress defaults are translated', async () => {
  const stepsConfig = { steps: [{ title: 'About you', description: 'Who you are.', fields: [{ type: 'text', name: 'n', label: 'Name' }] }, { title: 'Contact', fields: [{ type: 'email', name: 'e', label: 'Email' }] }] };
  const strings = configStrings(stepsConfig);
  assert.deepEqual(strings, ['About you', 'Who you are.', 'Name', 'Contact', 'Email', 'Next', 'Back', 'Step {n} of {total}']);
  const de: Record<string, string> = { 'About you': 'Über Sie', Name: 'Name', Next: 'Weiter', Back: 'Zurück', 'Step {n} of {total}': 'Schritt {n} von {total}' };
  const out = await translateConfig(stepsConfig, { target: 'de', translate: async (s) => s.map((x) => de[x] ?? '') });
  assert.deepEqual([out.steps[0].title, (out as any).nextText, (out as any).backText, (out as any).stepLabel], ['Über Sie', 'Weiter', 'Zurück', 'Schritt {n} von {total}']);
  const broken = await translateConfig(stepsConfig, { target: 'de', translate: async (s) => s.map((x) => (x.includes('{n}') ? 'Schritt' : x)) });
  assert.equal((broken as any).stepLabel, undefined, 'a translation that drops {n} or {total} is ignored');
});
