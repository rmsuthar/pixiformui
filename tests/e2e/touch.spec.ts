import { expect, test, type Page } from '@playwright/test';
import { mountElement } from './helpers';

// mountElement() builds the config from a string with new Function(); Firefox applies the page CSP
// to test scripts too, so these specs bypass it. Security, a11y and submit specs keep the real CSP.
test.use({ bypassCSP: true });

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// Real touch drags are sent through the Chrome DevTools protocol.
test.skip(({ browserName }) => browserName !== 'chromium', 'touch drags use CDP (Chromium only)');

/** A real touch drag (touchstart → touchmove… → touchend) via the DevTools protocol. */
async function drag(page: Page, x: number, y: number, dx: number, dy: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const point = (px: number, py: number) => [{ x: Math.round(px), y: Math.round(py) }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x, y) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x + (dx * i) / 10, y + (dy * i) / 10) });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
}

const fieldPoint = (page: Page, label: string) =>
  page.evaluate((l) => {
    const e = [...document.querySelectorAll('#f .pixiform-a11y [aria-label]')].find((x) => x.getAttribute('aria-label')!.startsWith(l))!;
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height - 22 };
  }, label);

/** Screen rectangle of a control's open popup panel. */
const panelRect = (page: Page, name: string) =>
  page.evaluate((n) => {
    const c = (document.getElementById('f') as any).get(n);
    const b = c.panel.getBounds();
    const r = document.querySelector('#f canvas')!.getBoundingClientRect();
    return { x: r.left + b.x, y: r.top + b.y, w: b.width, h: b.height };
  }, name);

const peek = (page: Page, name: string, expr: string) =>
  page.evaluate(([n, e]) => new Function('c', `return ${e}`)((document.getElementById('f') as any).get(n)), [name, expr]);

test.beforeEach(async ({ page }) => {
  const fields = `[
    { type: 'select', name: 'country', label: 'Country', options: Array.from({ length: 40 }, (_, i) => ({ value: 'c' + i, label: 'Country ' + i })) },
    { type: 'date', name: 'when', label: 'Date' },
    ...Array.from({ length: 8 }, (_, i) => ({ type: 'text', name: 't' + i, label: 'Text ' + i })),
  ]`;
  await mountElement(page, `{ title: 'Touch', fields: ${fields}, onSubmit: () => ({ ok: true }) }`);
});

test('dragging inside an open dropdown scrolls the list, not the page', async ({ page }) => {
  const p = await fieldPoint(page, 'Country');
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(() => peek(page, 'country', 'c.open')).toBe(true);
  const m = await panelRect(page, 'country');
  await drag(page, m.x + m.w / 2, m.y + m.h * 0.7, 0, -m.h * 0.5);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await peek(page, 'country', 'c.scrollTop')).toBeGreaterThan(40);
  expect(await peek(page, 'country', 'c.open')).toBe(true);
  expect(await peek(page, 'country', 'c.getValue()')).toBeNull(); // the drag didn't pick an option
});

test('dragging elsewhere on the form still scrolls the page', async ({ page }) => {
  const p = await fieldPoint(page, 'Text 3');
  await drag(page, p.x, p.y, 0, -250);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test('swiping the calendar changes the month without scrolling or picking a day', async ({ page }) => {
  const p = await fieldPoint(page, 'Date');
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(() => peek(page, 'when', 'c.open')).toBe(true);
  const month = () => peek(page, 'when', 'c.viewYear * 12 + c.viewMonth');
  const start = (await month()) as number;
  const c = await panelRect(page, 'when');
  await drag(page, c.x + c.w * 0.75, c.y + c.h / 2, -c.w * 0.5, 8);
  expect(await month()).toBe(start + 1);
  await drag(page, c.x + c.w * 0.25, c.y + c.h / 2, c.w * 0.5, -8);
  expect(await month()).toBe(start);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await peek(page, 'when', 'c.getValue()')).toBeNull();
  expect(await peek(page, 'when', 'c.open')).toBe(true);
});
