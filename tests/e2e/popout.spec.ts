import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The home page demo (dist-site, from `npm run build:site`) has config.popout on.
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist-site');
test.skip(!existsSync(join(dist, 'index.html')), 'run `npm run build:site` first');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
let server: Server;
let base = '';
test.beforeAll(async () => {
  server = createServer((req, res) => {
    let file = normalize(join(dist, decodeURIComponent(new URL(req.url!, 'http://x').pathname)));
    if (!file.startsWith(dist + sep) && file !== dist) return void res.writeHead(404).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(() => server?.close());

test('pop-out: the form opens in a dialog and goes back to its place, keeping its state', async ({ page }) => {
  await page.goto(`${base}/`);
  const host = page.locator('#demo-form');
  await host.scrollIntoViewIfNeeded();
  const tree = page.locator('#demo-form .pixiform-a11y');
  const focus = (label: string) => tree.locator(`[aria-label="${label}"], [aria-label^="${label}, "]`).first().evaluate((e: HTMLElement) => e.focus());
  await expect(tree.locator('[aria-label^="Username"]').first()).toBeAttached({ timeout: 15000 });

  // Some state: a value and its validation error.
  await focus('Username');
  await page.keyboard.type('ada l', { delay: 5 });
  await focus('Full name');
  await expect(tree.getByText(/can’t contain spaces/).first()).toBeAttached();
  await expect(tree.locator('[aria-label^="Username"]').first()).toHaveAttribute('aria-invalid', 'true');
  const before = await host.boundingBox();
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/popout-inline.png', clip: { x: before!.x, y: before!.y, width: before!.width, height: 260 } });

  const open = page.getByRole('button', { name: 'Open in a larger view' });
  await expect(open).toBeVisible();
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Create your account' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#demo-form')).toHaveCount(1); // the same element moved
  await expect(page.getByRole('button', { name: 'Back to the page' })).toBeFocused();
  await expect(dialog.locator('.pixiform-a11y [aria-label^="Username"]').first()).toHaveAttribute('aria-invalid', 'true'); // state kept
  expect(await page.evaluate(() => document.querySelector('main')?.closest('[inert]') !== null || (document.querySelector('header') as HTMLElement)?.inert)).toBe(true); // page behind is inert
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/popout-open.png' });

  // Typing keeps working inside the dialog: fixing the value clears the error.
  await focus('Username');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('ada_l', { delay: 5 });
  await focus('Full name');
  await expect(tree.locator('[aria-label^="Username"]').first()).not.toHaveAttribute('aria-invalid', 'true');

  // Escape puts it back, in the same place.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#demo .demo-grid #demo-form')).toHaveCount(1);
  const after = await host.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  expect(Math.abs(after!.width - before!.width)).toBeLessThan(2);
  await expect(page.getByRole('button', { name: 'Open in a larger view' })).toBeFocused();

  // The button toggles both ways, and a click on the backdrop also closes it.
  await page.getByRole('button', { name: 'Open in a larger view' }).click();
  await page.getByRole('button', { name: 'Back to the page' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open in a larger view' }).click();
  await page.mouse.click(5, 5);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
});
