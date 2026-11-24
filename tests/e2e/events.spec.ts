import { expect, test } from '@playwright/test';
import { focusField, mountElement } from './helpers';

// mountElement() builds the config from a string with new Function(); Firefox applies the page CSP
// to test scripts too, so these specs bypass it. Security, a11y and submit specs keep the real CSP.
test.use({ bypassCSP: true });

test('lifecycle and form events, cancelable beforesubmit, dirty state', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__ev = [];
    for (const t of ['loadstart', 'load', 'change', 'dirty', 'beforesubmit', 'submitting', 'success', 'reset', 'destroy']) {
      document.addEventListener(`pixiform-${t}`, (e) => {
        (window as any).__ev.push(t);
        if (t === 'beforesubmit' && !(window as any).__allow) e.preventDefault();
      });
    }
  });
  await mountElement(page, `{ fields: [{ type: 'text', name: 'name', label: 'Name' }], form: { botGuard: false }, onSubmit: async () => ({ ok: true }) }`);
  await expect(page.locator('#f')).toHaveAttribute('data-pixiform-state', 'ready');
  await focusField(page, 'Name', '#f');
  await page.keyboard.type('Al', { delay: 5 });
  const handle = 'document.getElementById("f").handle';
  expect(await page.evaluate(`${handle}.submit()`)).toBeNull(); // cancelled by beforesubmit
  await page.evaluate(() => ((window as any).__allow = true));
  expect(await page.evaluate(`${handle}.submit().then((r) => r.ok)`)).toBe(true);
  expect(await page.evaluate(`${handle}.isDirty()`)).toBe(true);
  await page.evaluate(`${handle}.reset()`);
  expect(await page.evaluate(`${handle}.isDirty()`)).toBe(false);
  await page.evaluate(`${handle}.destroy()`);
  const ev: string[] = await page.evaluate(() => (window as any).__ev);
  expect(ev.slice(0, 2)).toEqual(['loadstart', 'load']);
  expect(ev.filter((e) => e === 'dirty')).toHaveLength(1);
  expect(ev.filter((e) => e === 'beforesubmit')).toHaveLength(2);
  expect(ev.filter((e) => e === 'success')).toHaveLength(1);
  expect(ev.slice(-2)).toEqual(['reset', 'destroy']);
});

test('load: "visible" waits until the form scrolls into view', async ({ page }) => {
  await page.goto('/examples/html/index.html');
  const states = await page.evaluate(async () => {
    const path = '/src/lib/index.ts'; // served by the dev server (Vite), not resolved by tsc
    const { mountPixiForm } = await import(/* @vite-ignore */ path);
    const spacer = Object.assign(document.createElement('div'), { style: 'height:3000px' });
    const host = document.createElement('div');
    document.body.append(spacer, host);
    const pending = mountPixiForm(host, { load: 'visible', fields: [{ type: 'email', name: 'email', label: 'Email' }], onSubmit: () => ({ ok: true }) });
    await new Promise((r) => setTimeout(r, 300));
    const before = host.dataset.pixiformState;
    host.scrollIntoView();
    const handle = await pending;
    await handle.loaded;
    return { before, after: host.dataset.pixiformState };
  });
  expect(states).toEqual({ before: 'waiting', after: 'ready' });
});
