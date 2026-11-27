import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { type Env } from '../../site/worker.ts';
import { focusField } from './helpers';

// The built website's /exam/ demo, with /api/* handled by the real Worker (which holds the answer key).
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist-site');
test.skip(!existsSync(join(dist, 'exam', 'index.html')), 'run `npm run build:site` first');

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
    let file = normalize(join(dist, decodeURIComponent(url.pathname)));
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

test('exam demo: answer, finish, see what the server receives and the score the server computes', async ({ page }) => {
  await page.goto(`${base}/exam/`);
  const tree = page.locator('#exam .pixiform-a11y');
  await expect(tree.getByRole('heading', { name: /^Question 1 of 5/ })).toBeVisible({ timeout: 15000 });
  const html = await page.content();
  expect(html.includes('Hydrogen and helium')).toBe(false); // questions aren't in the page's HTML
  // Choose "Jupiter" whatever the shuffled order, through the control (labels are on the canvas).
  await focusField(page, 'Your answer', '#exam');
  const answer = page.locator('#exam .pixiform-a11y [aria-label^="Your answer"]').first();
  for (let i = 0; i < 6; i++) {
    const before = await answer.getAttribute('aria-label');
    await page.keyboard.press('ArrowDown');
    await expect(answer).not.toHaveAttribute('aria-label', before!); // the outline has caught up
    if ((await answer.getAttribute('aria-label'))?.includes('Jupiter')) break;
  }
  await expect(page.locator('#exam .pixiform-a11y [aria-label^="Your answer"]').first()).toHaveAttribute('aria-label', /Jupiter/);
  await focusField(page, 'Next question', '#exam');
  await page.keyboard.press('Enter');
  await expect(tree.getByRole('heading', { name: /^Question 2 of 5/ })).toBeVisible();
  await page.locator('#exam .pixiform-a11y [aria-label^="Go to question"]').first().evaluate((el: HTMLElement) => el.focus());
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(tree.getByRole('heading', { name: /^Question 5 of 5/ })).toBeVisible();
  await focusField(page, 'Finish exam', '#exam');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // confirm with questions unanswered
  await expect(page.locator('#exam-payload')).toContainText('"q1": "b"');
  await expect(page.locator('#exam-payload')).toContainText('examReport');
  await expect(page.locator('#exam-score')).toHaveText('Scored by the server: 1 of 4 correct (the open question isn’t scored).');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/exam-demo.png`, fullPage: true });
  await expect(page.locator('#exam-again')).toBeVisible();
  // No sideways scrolling, even with the long report line.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
