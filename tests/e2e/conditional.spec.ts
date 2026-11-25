import { expect, test, type Page } from '@playwright/test';
import { mountElement } from './helpers';

test.use({ bypassCSP: true }); // Firefox applies the page CSP to evaluate()

const CONFIG = `{
  title: 'Contact',
  form: { botGuard: false },
  on: { fieldvisibility: (e) => (window.__vis = window.__vis || []).push(e.name + ':' + e.visible) },
  fields: [
    { type: 'hidden', name: 'campaign', value: 'spring-sale-7Q' },
    { type: 'radio', name: 'contact', label: 'Contact me by', value: 'email',
      options: [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }] },
    { type: 'email', name: 'email', label: 'Email', required: true, showIf: { field: 'contact', equals: 'email' }, row: 'r' },
    { type: 'text', name: 'mobile', label: 'Mobile', required: true, showIf: { field: 'contact', equals: 'phone' }, row: 'r' },
    { type: 'switch', name: 'business', label: 'Buying for a business' },
    { type: 'group', name: 'company', title: 'Company', showIf: { field: 'business', equals: true }, fields: [
      { type: 'text', name: 'companyName', label: 'Company name', required: true },
      { type: 'text', name: 'vat', label: 'VAT number', showIf: { field: 'companyName', filled: true } },
    ] },
  ],
  onSubmit: (v) => { window.__sent = v; return { ok: true }; },
}`;

const el = (page: Page, expr: string) => page.evaluate((e) => new Function('h', 'el', `return ${e}`)((document.getElementById('f') as any).handle, document.getElementById('f')), expr);
const outline = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#f .pixiform-a11y [aria-label]')].map((x) => x.getAttribute('aria-label')!.split(',')[0]));
const width = (page: Page, name: string) => el(page, `h.get('${name}').layoutWidth`) as Promise<number>;

test.beforeEach(async ({ page }) => {
  await mountElement(page, CONFIG);
});

test('a field shows only when its condition holds; hidden fields are not validated or sent', async ({ page }) => {
  expect(await el(page, `[h.isVisible('email'), h.isVisible('mobile')]`)).toEqual([true, false]);
  expect(await outline(page)).not.toContain('Mobile');
  // The visible field takes the whole row.
  const full = await width(page, 'email');
  await el(page, `h.get('email').setValue('ada@example.com')`);

  await el(page, `h.get('contact').setValue('phone')`);
  await expect.poll(() => outline(page)).toContain('Mobile');
  expect(await outline(page)).not.toContain('Email');
  expect(await width(page, 'mobile')).toBe(full);
  expect(await page.evaluate(() => (window as any).__vis)).toEqual(['email:false', 'mobile:true']);

  // Mobile is required now; the hidden (required) email is not checked.
  const r1 = await el(page, 'el.submit()');
  expect((r1 as any).fieldErrors).toEqual({ mobile: 'Mobile is required.' });

  await el(page, `h.get('mobile').setValue('98765 43210')`);
  const r2 = await el(page, 'el.submit()');
  expect((r2 as any).ok).toBe(true);
  const sent = await page.evaluate(() => (window as any).__sent);
  expect(sent.mobile).toBe('98765 43210');
  expect('email' in sent).toBe(false);

  // Switching back restores the kept value.
  await el(page, `h.get('contact').setValue('email')`);
  expect(await el(page, `h.values().email`)).toBe('ada@example.com');
});

test('groups hide with their fields, and conditions chain inside them', async ({ page }) => {
  expect(await el(page, `h.isVisible('company')`)).toBe(false);
  expect(await el(page, `h.isVisible('companyName')`)).toBe(false);
  expect(await outline(page)).not.toContain('Company name');
  expect(await el(page, `'companyName' in h.values()`)).toBe(false);

  await el(page, `h.get('business').setValue(true)`);
  await expect.poll(() => outline(page)).toContain('Company name');
  expect(await el(page, `h.isVisible('vat')`)).toBe(false); // waits for a company name
  await el(page, `h.get('companyName').setValue('Analytical Engines Ltd')`);
  expect(await el(page, `h.isVisible('vat')`)).toBe(true);

  // Hiding the group hides everything in it, and their errors don't block submit.
  await el(page, `h.get('companyName').setValue('')`);
  await el(page, `h.get('business').setValue(false)`);
  expect(await el(page, `[h.isVisible('companyName'), h.isVisible('vat')]`)).toEqual([false, false]);
  await el(page, `h.get('email').setValue('ada@example.com')`);
  expect(((await el(page, 'el.submit()')) as any).ok).toBe(true);
});

test('setVisible overrides a rule; null hands control back', async ({ page }) => {
  await el(page, `el.setVisible('email', false)`);
  expect(await el(page, `h.isVisible('email')`)).toBe(false);
  await el(page, `el.setVisible('mobile', true)`);
  expect(await el(page, `h.isVisible('mobile')`)).toBe(true);
  await el(page, `(el.setVisible('email', null), el.setVisible('mobile', null))`);
  expect(await el(page, `[h.isVisible('email'), h.isVisible('mobile')]`)).toEqual([true, false]);
  expect(await page.evaluate(() => { try { (document.getElementById('f') as any).setVisible('nope', true); return 'no error'; } catch (e) { return (e as Error).message; } })).toMatch(/unknown field/);
});

test('a hidden field is submitted but never drawn, focusable or in the page', async ({ page }) => {
  expect(await el(page, `h.values().campaign`)).toBe('spring-sale-7Q');
  expect(await page.evaluate(() => document.documentElement.outerHTML.includes('spring-sale-7Q'))).toBe(false);
  expect(await outline(page)).not.toContain('campaign');
  expect(await el(page, `h.get('campaign').isFocusable()`)).toBe(false);
  await el(page, `h.get('campaign').setValue('from-url')`);
  await el(page, `h.get('email').setValue('ada@example.com')`);
  await el(page, 'el.submit()');
  expect(await page.evaluate(() => (window as any).__sent.campaign)).toBe('from-url');
  // Reset brings back the configured value.
  await el(page, 'el.reset()');
  expect(await el(page, `h.values().campaign`)).toBe('spring-sale-7Q');
});

test('a showIf naming an unknown field fails at mount with a clear error', async ({ page }) => {
  const message = await page.evaluate(async () => {
    const { mountPixiForm } = (window as any).PixiFormUI ?? {};
    const host = document.createElement('div');
    document.body.append(host);
    const el = document.createElement('pixi-form') as any;
    const failed = new Promise<string>((r) => el.addEventListener('pixiform-error', (e: CustomEvent) => r(e.detail.error.message), { once: true }));
    document.body.append(el);
    el.config = { fields: [{ type: 'text', name: 'a', label: 'A', showIf: { field: 'nope', equals: 1 } }], onSubmit: () => ({ ok: true }) };
    void mountPixiForm;
    return Promise.race([failed, new Promise<string>((r) => setTimeout(() => r('no error'), 3000))]);
  });
  expect(message).toMatch(/unknown field "nope"/);
});
