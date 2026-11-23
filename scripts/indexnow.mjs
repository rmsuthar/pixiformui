// Notifies IndexNow search engines (Bing, Yandex, Naver, Seznam…) about the site's URLs.
// Runs after deploy (npm run deploy:site). Google doesn't use IndexNow; use Search Console for Google.
//   node scripts/indexnow.mjs            submit every URL in dist-site/sitemap.xml
//   node scripts/indexnow.mjs /docs/x/   submit specific paths
import { readFileSync } from 'node:fs';

const SITE = (process.env.SITE_URL ?? 'https://pixiformui.lets.gen.in').replace(/\/+$/, '');
const KEY = '7b58b7113c27b05c68d9af86890e00b3'; // public by design: served at /<key>.txt to prove ownership
const keyLocation = `${SITE}/${KEY}.txt`;

const paths = process.argv.slice(2);
const urlList = paths.length
  ? paths.map((p) => new URL(p, SITE + '/').href)
  : [...readFileSync(new URL('../dist-site/sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

// The key file must be live before submitting (the engines fetch it to verify).
let live = false;
for (let i = 0; i < 10 && !live; i++) {
  try {
    const r = await fetch(keyLocation, { cache: 'no-store' });
    live = r.ok && (await r.text()).trim() === KEY;
  } catch {}
  if (!live) await new Promise((r) => setTimeout(r, 3000));
}
if (!live) {
  console.error(`IndexNow: key file not reachable at ${keyLocation}; nothing submitted.`);
  process.exit(1);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation, urlList }),
});
const meaning = { 200: 'accepted', 202: 'accepted (key verification pending)', 400: 'bad request', 403: 'key not valid', 422: 'URLs not on this host', 429: 'too many requests' };
console.log(`IndexNow: ${urlList.length} URLs → ${res.status} ${meaning[res.status] ?? res.statusText}`);
if (res.status >= 400) process.exit(1);
