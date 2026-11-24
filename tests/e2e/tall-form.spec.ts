import { expect, test } from '@playwright/test';
import { mountElement } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

test('a 200-field form stays within mobile canvas limits and works at the bottom', async ({ page }) => {
  const fields = `Array.from({ length: 200 }, (_, i) => ({ type: 'text', name: 'f' + i, label: 'Field ' + i })).concat([{ type: 'text', name: 'last', label: 'Last field' }])`;
  await mountElement(page, `{ title: 'Tall form', fields: ${fields}, form: { botGuard: false }, onSubmit: async () => ({ ok: true }) }`);
  const size = await page.evaluate(() => {
    const c = document.querySelector('#f canvas') as HTMLCanvasElement;
    return { megapixels: (c.width * c.height) / 1e6, host: document.getElementById('f')!.getBoundingClientRect().height, cssHeight: c.clientHeight };
  });
  expect(size.host).toBeGreaterThan(10_000); // the page keeps the form's full height…
  expect(size.cssHeight).toBeLessThanOrEqual(2 * 844); // …but the canvas stays ≤ 2 screens
  expect(size.megapixels).toBeLessThan(16.7); // iOS Safari's canvas limit

  await page.evaluate(() => {
    const h = document.getElementById('f')!;
    window.scrollTo(0, h.offsetTop + h.offsetHeight - 700);
  });
  await page.waitForTimeout(300);
  const box = await page.locator('#f .pixiform-a11y [aria-label="Last field"]').boundingBox();
  expect(box).not.toBeNull();
  await page.touchscreen.tap(box!.x + 40, box!.y + box!.height - 22);
  await page.keyboard.type('bottom', { delay: 10 });
  expect(await page.evaluate(() => (document.getElementById('f') as any).handle.values().last)).toBe('bottom');
});
