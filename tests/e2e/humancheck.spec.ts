import { expect, test, type Page } from '@playwright/test';
import { mountElement, solveHumanCheck } from './helpers';

test.use({ bypassCSP: true }); // Firefox applies the page CSP to evaluate()

const peek = (page: Page, expr: string) =>
  page.evaluate((e) => new Function('c', 'f', `return ${e}`)((document.getElementById('f') as any).get('human'), document.getElementById('f')), expr);

/** Screen geometry of the track: handle centre at a position 0..1, and the mark's position. */
const geometry = (page: Page) =>
  page.evaluate(() => {
    const c = (document.getElementById('f') as any).get('human');
    const g = c.geom();
    const b = c.body.getBounds();
    const r = document.querySelector('#f canvas')!.getBoundingClientRect();
    return { left: r.left + b.x, y: r.top + b.y + g.h / 2, x0: g.x0, span: g.span, target: c.target as number, pos: c.pos as number };
  });

/** A person-like drag: eases in and out, with uneven steps and small pauses. */
async function humanDrag(page: Page, from: number, to: number, y: number): Promise<void> {
  await page.mouse.move(from, y);
  await page.mouse.down();
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from + (to - from) * ease, y + Math.sin(i) * 1.5);
    await page.waitForTimeout(12 + (i % 3) * 9);
  }
  await page.waitForTimeout(80);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await mountElement(
    page,
    `{ title: 'Join', fields: [
      { type: 'text', name: 'name', label: 'Name' },
      { type: 'humancheck', name: 'human', label: 'Quick check', maxAttempts: 3, cooldownMs: 60000 },
    ], form: { botGuard: false }, onSubmit: (v) => { window.__sent = v; return { ok: true }; } }`,
  );
});

test('it blocks submit until solved, solves by keyboard, and is never sent', async ({ page }) => {
  // Before any interaction nothing in the DOM reveals where the mark is.
  const item = page.locator('#f .pixiform-a11y [role="slider"]');
  await expect(item).toHaveAttribute('aria-valuetext', '0%');
  await page.evaluate(() => (document.getElementById('f') as any).submit());
  await expect.poll(() => peek(page, 'c.error')).toBe('Please complete the human check.');
  await solveHumanCheck(page);
  expect(await peek(page, 'c.getValue()')).toBe(true);
  expect(await peek(page, 'c.error')).toBeNull();
  await expect(item).toHaveAttribute('aria-valuetext', 'Verified');
  expect(await peek(page, `'human' in f.values()`)).toBe(false);
  const r = await page.evaluate(() => (document.getElementById('f') as any).submit());
  expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
  expect(await page.evaluate(() => 'human' in (window as any).__sent)).toBe(false);
});

test('a person-like mouse drag onto the mark solves it', async ({ page }) => {
  const g = await geometry(page);
  await humanDrag(page, g.left + g.x0, g.left + g.x0 + g.target * g.span, g.y);
  expect(await peek(page, 'c.lastFailure')).toBeNull();
  expect(await peek(page, 'c.getValue()')).toBe(true);
});

test('a perfectly even, instant drag onto the mark is refused and the mark moves', async ({ page }) => {
  const g = await geometry(page);
  await page.mouse.move(g.left + g.x0, g.y);
  await page.mouse.down();
  await page.mouse.move(g.left + g.x0 + g.target * g.span, g.y, { steps: 10 });
  await page.mouse.up();
  expect(await peek(page, 'c.getValue()')).toBe(false);
  expect(['too-fast', 'robotic']).toContain(await peek(page, 'c.lastFailure'));
  expect((await geometry(page)).target).not.toBe(g.target);
  expect(await peek(page, 'c.error')).toMatch(/Not quite/);
});

test('synthetic (untrusted) pointer events from page scripts never solve it', async ({ page }) => {
  const g = await geometry(page);
  await page.evaluate(async ({ g }) => {
    const canvas = document.querySelector('#f canvas')!;
    const fire = (type: string, x: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: g.y, bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }));
    fire('pointerdown', g.left + g.x0);
    for (let i = 1; i <= 30; i++) {
      fire('pointermove', g.left + g.x0 + g.target * g.span * (i / 30) ** 1.7);
      await new Promise((r) => setTimeout(r, 15 + (i % 4) * 7));
    }
    fire('pointerup', g.left + g.x0 + g.target * g.span);
  }, { g });
  expect(await peek(page, 'c.getValue()')).toBe(false);
});

test('clicking the mark directly does nothing; three misses pause the check', async ({ page }) => {
  let g = await geometry(page);
  await page.mouse.click(g.left + g.x0 + g.target * g.span, g.y);
  expect(await peek(page, 'c.getValue()')).toBe(false);
  expect(await peek(page, 'c.pos')).toBe(0);
  for (let i = 0; i < 3; i++) {
    g = await geometry(page);
    const miss = g.target > 0.6 ? 0.1 : 0.98; // release far from the mark
    await humanDrag(page, g.left + g.x0, g.left + g.x0 + miss * g.span, g.y);
  }
  expect(await peek(page, 'c.coolingDown')).toBe(true);
  expect(await peek(page, 'c.error')).toMatch(/Too many tries/);
  // Even a correct drag is refused during the pause.
  g = await geometry(page);
  await humanDrag(page, g.left + g.x0, g.left + g.x0 + g.target * g.span, g.y);
  expect(await peek(page, 'c.getValue()')).toBe(false);
});
