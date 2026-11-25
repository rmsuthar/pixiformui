import { expect, test } from '@playwright/test';

test.use({ bypassCSP: true }); // Firefox applies the page CSP to evaluate()

const FIELDS = [
  { type: 'text', name: 'name', label: 'Full name', required: true, row: 'a' },
  { type: 'email', name: 'email', label: 'Email', row: 'a' },
  { type: 'password', name: 'pw', label: 'Password', strengthMeter: true },
  { type: 'radio', name: 'contact', label: 'Contact me by', value: 'email', direction: 'horizontal', options: [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }] },
  { type: 'phone', name: 'phone', label: 'Mobile', showIf: { field: 'contact', equals: 'phone' } },
  { type: 'textarea', name: 'notes', label: 'Notes', rows: 3 },
  { type: 'checkbox', name: 'terms', label: 'I agree', required: true },
];

test('a server-rendered skeleton is replaced by the form on its first frame, with little layout shift', async ({ page }) => {
  await page.goto('/examples/html/index.html');
  const r = await page.evaluate(async (fields) => {
    const path = '/dist-lib/pixiformui.js';
    const ssrPath = '/dist-lib/pixiformui-ssr.js';
    const lib = { ...(await import(/* @vite-ignore */ path)), ...(await import(/* @vite-ignore */ ssrPath)) };
    const config = { title: 'Create your account', submitText: 'Create account', fields, onSubmit: () => ({ ok: true }) };
    document.getElementById('contact')?.remove();
    const style = document.createElement('style');
    style.textContent = lib.PIXIFORM_SKELETON_CSS;
    document.head.append(style);
    // What a server would send: the skeleton inside the host, then content below it.
    const host = document.createElement('div');
    host.innerHTML = lib.pixiformSkeleton(config);
    const below = document.createElement('p');
    below.textContent = 'Below the form';
    document.body.prepend(host, below);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const before = below.getBoundingClientRect().top;
    const labels = host.textContent;
    const handle = await lib.mountPixiForm(host, config);
    await handle.loaded;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
      labels,
      before,
      after: below.getBoundingClientRect().top,
      skeletons: host.querySelectorAll('[data-pixiform-skeleton]').length,
      canvasShown: getComputedStyle(host.querySelector('canvas')!).display !== 'none',
    };
  }, FIELDS);
  expect(r.labels).toContain('Full name *');
  expect(r.labels).not.toContain('Mobile'); // hidden by its showIf at first
  expect(r.skeletons).toBe(0);
  expect(r.canvasShown).toBe(true);
  const shift = Math.abs(r.after - r.before);
  console.log(`skeleton → form: content below moved ${Math.round(shift)} px (form top ${Math.round(r.before)})`);
  expect(shift / r.before).toBeLessThan(0.12); // within ~12% of the form's height
});
