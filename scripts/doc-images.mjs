// Renders the pictures in docs/images/ with the real library, so the guide always shows what
// PixiFormUI actually draws.
//   npm run build:lib && npm run docs:images          (all)
//   npm run docs:images -- controls/date layout/row   (some)
// Scenes are defined in scripts/doc-images/harness.js. Output: 2x PNGs; the guide shows them at
// half size (<img width="…">), so they stay sharp on high-density screens.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs', 'images');
if (!existsSync(join(root, 'dist-lib', 'pixiformui.js'))) {
  console.error('Build the library first: npm run build:lib');
  process.exit(1);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.css': 'text/css' };
const server = createServer((req, res) => {
  const file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
await page.goto(`http://localhost:${port}/scripts/doc-images/index.html`);
await page.waitForFunction(() => window.__docImages);
const all = await page.evaluate(() => window.__docImages.names);
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : all;

let failed = 0;
for (const name of wanted) {
  if (!all.includes(name)) {
    console.error(`  ✖ unknown scene ${name} (known: ${all.join(', ')})`);
    failed++;
    continue;
  }
  problems.length = 0;
  await page.evaluate((n) => window.__docImages.render(n), name);
  const file = join(outDir, `${name}.png`);
  mkdirSync(dirname(file), { recursive: true });
  const stage = page.locator('#stage');
  await stage.screenshot({ path: file });
  const box = await stage.boundingBox();
  const kb = Math.round(statSync(file).size / 1024);
  if (problems.length) {
    failed++;
    console.error(`  ✖ ${name}: ${problems.join(' | ')}`);
  } else console.log(`  ✓ docs/images/${name}.png  (${Math.round(box.width)}×${Math.round(box.height)} CSS px, ${kb} KB)`);
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
