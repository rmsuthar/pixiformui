/** Server-side rendering: the whole library imports in Node, and pixiformSkeleton() renders.  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Bundle the library like a framework's server build would, then import it with no DOM at all.
const dir = mkdtempSync(join(tmpdir(), 'pf-ssr-'));
const bundle = async (entry: string) => {
  const out = join(dir, entry.replace(/\W/g, '_') + '.mjs');
  await build({ entryPoints: [new URL(entry, import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
  return import(out);
};
// pixiformui and pixiformui/ssr
const lib = { ...(await bundle('../src/lib/index.ts')), ...(await bundle('../src/lib/ssr.ts')) };
rmSync(dir, { recursive: true, force: true });

test('importing the library on a server works (no window, document or HTMLElement)', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof lib.mountPixiForm, 'function');
  assert.equal(typeof lib.PixiFormElement, 'function');
  lib.definePixiFormElement(); // a no-op on the server
});

test('mountPixiForm() explains itself on the server', async () => {
  await assert.rejects(() => lib.mountPixiForm({}, { fields: [] }), /runs in the browser only/);
});

const config = {
  title: 'Sign <up>',
  subtitle: 'Fast & safe',
  submitText: 'Create account',
  resetText: 'Reset',
  maxWidth: 500,
  fields: [
    { type: 'hidden', name: 'source', value: 'secret-campaign' },
    { type: 'text', name: 'name', label: 'Full name', required: true, row: 'a' },
    { type: 'email', name: 'email', label: 'Email', row: 'a' },
    { type: 'password', name: 'pw', label: 'Password', strengthMeter: true },
    { type: 'radio', name: 'contact', label: 'Contact', value: 'email', options: [{ value: 'email' }, { value: 'phone' }] },
    { type: 'phone', name: 'phone', label: 'Mobile', showIf: { field: 'contact', equals: 'phone' } },
    { type: 'switch', name: 'biz', label: 'Business' },
    { type: 'group', title: 'Company', showIf: { field: 'biz', equals: true }, fields: [{ type: 'text', name: 'co', label: 'Company name' }] },
    { type: 'textarea', name: 'notes', label: 'Notes', rows: 4 },
    { type: 'humancheck', name: 'human' },
  ],
};

test('pixiformSkeleton renders labels, rows and buttons, escaped', () => {
  const html = lib.pixiformSkeleton(config);
  assert.match(html, /^<div class="pf-skel pf-skel-w520" data-pixiform-skeleton aria-busy="true">/); // nearest width
  assert.ok(html.includes('Sign &lt;up&gt;') && html.includes('Fast &amp; safe'));
  assert.ok(html.includes('<div class="pf-skel-row"><div class="pf-skel-cell"><div class="pf-skel-field"><span class="pf-skel-label">Full name *</span>'));
  assert.ok(html.includes('pf-skel-meter'));
  assert.ok(html.includes('pf-skel-rows4'));
  assert.ok(html.includes('Human check *'));
  assert.ok(html.includes('pf-skel-outline">Reset</span>') && html.includes('Create account'));
  assert.ok(html.includes('<noscript>'));
  assert.ok(!/style=/.test(html), 'no inline styles (strict CSP)');
});

test('pixiformSkeleton applies showIf to initial values and never prints hidden values', () => {
  const html = lib.pixiformSkeleton(config);
  assert.ok(!html.includes('Mobile'), 'contact starts as email');
  assert.ok(!html.includes('Company'), 'business starts off');
  assert.ok(!html.includes('secret-campaign'));
  const on = lib.pixiformSkeleton({ ...config, fields: config.fields.map((f) => (f.name === 'biz' ? { ...f, checked: true } : f)) });
  assert.ok(on.includes('Company name'));
  assert.ok(lib.PIXIFORM_SKELETON_CSS.includes('.pf-skel-w520 .pf-skel-card{max-width:520px}'));
});

test('pixiformSkeleton shows the first step of a multi-step form, with Next', () => {
  const html = lib.pixiformSkeleton({ title: 'Open an account', steps: [{ title: 'About you', fields: [{ type: 'text', name: 'n', label: 'Full name' }] }, { title: 'Contact', fields: [{ type: 'email', name: 'e', label: 'Email' }] }] });
  assert.match(html, /About you/);
  assert.match(html, /Full name/);
  assert.ok(!html.includes('Email'), 'later steps are not in the placeholder');
  assert.match(html, /pf-skel-button">Next</);
});
