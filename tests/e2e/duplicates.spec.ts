import { expect, test, type Page } from '@playwright/test';
import { focusField, mountElement, solveHumanCheck } from './helpers';

async function fillRegistration(page: Page, id: string) {
  const type = async (label: string, text: string) => {
    await focusField(page, label);
    await page.keyboard.type(text, { delay: 3 });
  };
  await type('Full name', 'Grace Hopper');
  await type('Username', `grace_${id}`);
  await type('Email', `grace.${id}@example.com`);
  await type('Password', 'Tr0ub4dor&Horse!2026');
  await type('Confirm password', 'Tr0ub4dor&Horse!2026');
  await focusField(page, 'Country');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ind', { delay: 40 });
  await page.keyboard.press('Enter');
  await focusField(page, 'Date of birth');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 25; i++) await page.keyboard.press('Shift+PageUp');
  await page.keyboard.press('Enter');
  await focusField(page, 'I agree to the Terms of Service and Privacy Policy');
  await page.keyboard.press(' ');
  await solveHumanCheck(page);
}

test('a retry after a lost response is processed once: the original 201 is replayed', async ({ page }) => {
  const id = Date.now().toString(36);
  await page.goto('/');
  await fillRegistration(page, id);
  await page.waitForTimeout(2600); // bot guard minimum fill time

  // First attempt: the server creates the account, but the browser never gets the answer.
  let firstKey = '';
  let firstAborted = false;
  await page.route('**/api/register', async (route) => {
    firstKey = route.request().headers()['idempotency-key'] ?? '';
    const served = await route.fetch();
    expect(served.status()).toBe(201);
    await route.abort('failed');
    firstAborted = true;
  }, { times: 1 });
  await focusField(page, 'Create account');
  await page.keyboard.press('Enter');
  await expect.poll(() => firstAborted).toBe(true);
  // Wait until the failed attempt has finished (the form wipes the password fields at that point).
  await expect.poll(() => page.evaluate(() => document.querySelector('.pixiform-a11y [role=button][aria-label="Create account"]')?.getAttribute('aria-busy') ?? 'false')).toBe('false');
  await page.waitForTimeout(300);

  // Passwords are wiped after a failed attempt; the person re-types them and submits again.
  await focusField(page, 'Password');
  await page.keyboard.type('Tr0ub4dor&Horse!2026', { delay: 3 });
  await focusField(page, 'Confirm password');
  await page.keyboard.type('Tr0ub4dor&Horse!2026', { delay: 3 });
  const [request, response] = await Promise.all([
    page.waitForRequest('**/api/register'),
    page.waitForResponse('**/api/register'),
    (async () => {
      await focusField(page, 'Create account');
      await page.keyboard.press('Enter');
    })(),
  ]);
  expect(request.headers()['idempotency-key']).toBe(firstKey); // same logical submission
  expect(response.status()).toBe(201); // not "already exists", not a challenge error
  expect(response.headers()['idempotency-replayed']).toBe('true');
});

test('server: same key + same data replays; same key + different data is rejected', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const s = await (await fetch('/api/session')).json();
    // Sending a code requires the form proof (bot defence): solve the session's challenge first.
    const path = '/src/lib/index.ts';
    const { FormProof } = await import(/* @vite-ignore */ path);
    const proof = await new FormProof(s.pow).token();
    const post = (body: string, key: string) =>
      fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrfToken, 'Idempotency-Key': key, 'X-Form-Proof': proof }, body });
    const key = crypto.randomUUID();
    const a = await post('{}', key);
    const b = await post('{}', key);
    const c = await post('{"other":true}', key);
    const d = await post('{}', 'bad key!');
    return { a: a.status, b: b.status, bReplayed: b.headers.get('Idempotency-Replayed'), same: (await a.text()) === (await b.text()), c: c.status, d: d.status };
  });
  expect(r.a).toBe(200);
  expect(r.b).toBe(200);
  expect(r.bReplayed).toBe('true');
  expect(r.same).toBe(true); // one code sent, not two
  expect(r.c).toBe(422);
  expect(r.d).toBe(400);
});

test.describe('form options', () => {
  test.use({ bypassCSP: true }); // mountElement() builds configs with new Function()

  test('once: the form locks after success until unlock()', async ({ page }) => {
    await mountElement(page, `{ fields: [{ type: 'text', name: 'a', label: 'A' }], form: { once: true, botGuard: false }, onSubmit: async () => ({ ok: true }) }`);
    const r = await page.evaluate(async () => {
      const el = document.getElementById('f') as any;
      const first = await el.submit();
      const second = await el.submit();
      const locked = el.handle.form.locked;
      el.handle.form.unlock();
      const third = await el.submit();
      return { first: first?.ok, second, locked, third: third?.ok };
    });
    expect(r).toEqual({ first: true, second: null, locked: true, third: true });
  });

  test('cooldownMs: rapid resubmits are blocked', async ({ page }) => {
    await mountElement(page, `{ fields: [{ type: 'text', name: 'a', label: 'A' }], form: { cooldownMs: 3000, botGuard: false }, onSubmit: async () => ({ ok: false, message: 'nope' }) }`);
    const r = await page.evaluate(async () => {
      const el = document.getElementById('f') as any;
      const codes: string[] = [];
      el.addEventListener('pixiform-blocked', (e: CustomEvent) => codes.push(e.detail.code));
      await el.submit();
      const again = await el.submit();
      return { againOk: again?.ok, codes };
    });
    expect(r.againOk).toBe(false);
    expect(r.codes).toEqual(['cooldown']);
  });
});
