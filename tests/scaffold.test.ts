/** create-pixiformui: CLI and the starter server's validation.  npm test (after `node packages/create-pixiformui/build.mjs`) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pkg = new URL('../packages/create-pixiformui/', import.meta.url).pathname;
const cli = join(pkg, 'index.mjs');
execFileSync(process.execPath, [join(pkg, 'build.mjs')]); // generate server/lib from the library sources

const { validate } = await import(join(pkg, 'templates/_shared/server/validate.mjs'));
const { fields } = await import(join(pkg, 'templates/_shared/shared/fields.js'));
const base = { source: 'x', fullName: 'Ada', email: 'ada@example.com', password: 'pfe1.a', confirmPassword: 'pfe1.b', contact: 'email', business: false, terms: true };

test('CLI scaffolds each template with the name filled in', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cpf-'));
  const own: Record<string, string[]> = {
    vanilla: ['server/server.mjs', 'src/main.ts', 'src/style.css', 'index.html'],
    react: ['server/server.mjs', 'src/App.tsx', 'src/PixiForm.tsx', 'vite.config.ts'],
    next: ['app/page.tsx', 'app/PixiForm.tsx', 'app/api/signup/route.ts', 'app/api/session/route.ts', 'next.config.mjs'],
  };
  try {
    for (const t of Object.keys(own)) {
      execFileSync(process.execPath, [cli, join(dir, `My App ${t}`), '--template', t], { stdio: 'pipe' });
      const app = join(dir, `My App ${t}`);
      const p = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
      assert.equal(p.name, `my-app-${t}`);
      assert.match(p.dependencies.pixiformui, /^\^\d+\.\d+\.\d+$/);
      for (const f of ['.gitignore', 'server/app.mjs', 'server/lib/pfe.mjs', 'shared/fields.js', 'src/form.ts', 'README.md', ...own[t]]) assert.ok(existsSync(join(app, f)), `${t}: ${f}`);
      if (t === 'next') assert.ok(!existsSync(join(app, 'server/server.mjs')), 'next uses route handlers, not the Node server');
      for (const f of ['README.md', 'package.json']) assert.ok(!readFileSync(join(app, f), 'utf8').includes('{{'), `${t}: placeholders replaced in ${f}`);
    }
    assert.match(readFileSync(join(dir, 'My App next/app/PixiForm.tsx'), 'utf8'), /^'use client';/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI refuses a non-empty folder and an unknown template', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cpf-'));
  try {
    mkdirSync(join(dir, 'busy'));
    writeFileSync(join(dir, 'busy', 'x.txt'), 'x');
    const busy = spawnSync(process.execPath, [cli, join(dir, 'busy')], { encoding: 'utf8' });
    assert.equal(busy.status, 1);
    assert.match(busy.stderr, /isn't empty/);
    const bad = spawnSync(process.execPath, [cli, join(dir, 'new'), '--template', 'vue'], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /Unknown template "vue"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('server validation: valid sign-up; hidden fields ignored', () => {
  const { data, errors } = validate(fields, { ...base, phone: 'ignored', companyName: 'ignored' });
  assert.deepEqual(errors, {});
  assert.equal('phone' in data, false); // contact is email: phone is hidden by its rule
  assert.equal('companyName' in data, false); // business is off: the Company group is hidden
});

test('server validation: showIf makes fields required, including inside groups', () => {
  const { errors } = validate(fields, { ...base, contact: 'phone', business: true });
  assert.deepEqual(errors, { phone: 'Mobile is required.', companyName: 'Company name is required.' });
  const ok = validate(fields, { ...base, contact: 'phone', phone: '+919876543210', business: true, companyName: 'ACME', teamSize: '11-50', vat: 'GB123' });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.data.vat, 'GB123');
  // vat is shown only once a company name is filled in
  assert.equal('vat' in validate(fields, { ...base, business: true, companyName: '', vat: 'GB1' }).data, false);
});

test('server validation: types, choices, unknown fields and the human check', () => {
  const { errors } = validate(fields, { ...base, email: 'nope', contact: 'fax', terms: false, password: 'plain', admin: true, human: true });
  assert.equal(errors.email, 'Enter a valid email address.');
  assert.match(errors.contact, /valid/);
  assert.equal(errors.terms, 'Please accept the terms.');
  assert.match(errors.password, /encrypted/);
  assert.equal(errors.admin, 'Unexpected field.');
  assert.equal(errors.human, 'Unexpected field.'); // browser-only: never sent
});
