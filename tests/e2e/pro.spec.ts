import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { type Env } from '../../site/worker.ts';
import { focusField } from './helpers';

// The built website (dist-site, from `npm run build:site`) with /api/* handled by the real Worker.
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist-site');
test.skip(!existsSync(join(dist, 'pro', 'index.html')), 'run `npm run build:site` first');

const store = new Map<string, { value: string; metadata?: unknown }>();
const env: Env = {
  ASSETS: { fetch: async () => new Response('not used') },
  WAITLIST: { get: async (k) => store.get(k)?.value ?? null, put: async (k, value, o) => void store.set(k, { value, metadata: o?.metadata }) },
  WAITLIST_SECRET: 'e2e-secret-value-123',
  POW_DIFFICULTY: '14',
  MIN_FILL_MS: '1500',
};
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, base);
    if (url.pathname.startsWith('/api/')) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const r = await worker.fetch(new Request(url, { method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), env);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let file = join(dist, decodeURIComponent(url.pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://localhost:${(server.address() as { port: number }).port}`;
});
test.afterAll(() => server?.close());

test('pro page: joining the waitlist stores the sign-up; the form locks afterwards', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/pro/?utm_source=newsletter`);
  await expect(page.locator('#waitlist .pixiform-a11y')).toBeAttached({ timeout: 15000 });
  await focusField(page, 'Work email');
  await page.keyboard.type('grace@navy.example', { delay: 2 });
  await focusField(page, 'Company');
  await page.keyboard.type('Remington Rand', { delay: 2 });
  await focusField(page, 'Secure card field');
  await page.keyboard.press(' ');
  await focusField(page, 'Email me about PixiFormUI Pro and Cloud');
  await page.keyboard.press(' ');
  await page.waitForTimeout(1800); // minimum fill time
  const [res] = await Promise.all([page.waitForResponse('**/api/waitlist'), (async () => { await focusField(page, 'Join the waitlist'); await page.keyboard.press('Enter'); })()]);
  expect(res.status()).toBe(200);
  const rec = JSON.parse([...store].find(([k]) => k.startsWith('wl:'))![1].value);
  expect(rec).toMatchObject({ email: 'grace@navy.example', company: 'Remington Rand', source: 'newsletter', interests: ['card-field'] });
  await expect.poll(() => page.evaluate(() => document.body.textContent ?? '')).toContain('on the list'); // announced
  // Typed values never enter the DOM (the outline holds labels and messages only).
  const dom = await page.evaluate(() => document.documentElement.outerHTML + [...document.querySelectorAll('input, textarea')].map((i) => (i as HTMLInputElement).value).join(' '));
  expect(dom).not.toContain('grace@navy.example');
  expect(dom).not.toContain('Remington Rand');
  await expect(page.locator('.pixiform-a11y [aria-label^="Join the waitlist"]')).toHaveAttribute('aria-disabled', 'true'); // once: true
  expect(errors).toEqual([]);
});
