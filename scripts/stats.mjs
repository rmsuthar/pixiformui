// Usage report for PixiFormUI: npm downloads, jsDelivr hits, GitHub, and self-hosted /v/ downloads.
//   npm run stats                 (last 30 days; optional GITHUB_TOKEN avoids GitHub's anonymous rate limit)
// Self-hosted downloads come from Workers Analytics Engine and need a Cloudflare API token with
// "Account Analytics: Read":  CLOUDFLARE_API_TOKEN=… npm run stats
const PKG = 'pixiformui';
const REPO = 'rmsuthar/pixiformui';
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? '4af9d9d35deae8ad0716390fe20cdc7c';
const DATASET = 'pixiformui_downloads';
const DAYS = 30;

const get = async (url, opts = {}) => {
  try {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(10_000) });
    return r.ok ? await r.json() : { error: `${r.status} ${r.statusText}` };
  } catch (e) {
    return { error: e.message };
  }
};
const spark = (values) => {
  const bars = '▁▂▃▄▅▆▇█';
  const max = Math.max(1, ...values);
  return values.map((v) => bars[Math.min(7, Math.round((v / max) * 7))]).join('');
};
const n = (x) => Number(x ?? 0).toLocaleString('en');
const head = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const table = (rows, cols) => {
  if (!rows.length) return console.log('  (no data yet)');
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  console.log('  ' + cols.map((c, i) => c.padEnd(w[i])).join('  '));
  for (const r of rows) console.log('  ' + cols.map((c, i) => String(r[c] ?? '').padEnd(w[i])).join('  '));
};

console.log(`\x1b[1mPixiFormUI usage, last ${DAYS} days\x1b[0m  (${new Date().toISOString().slice(0, 10)})`);

// ---- npm
head('npm downloads');
const range = await get(`https://api.npmjs.org/downloads/range/last-month/${PKG}`);
if (range.error) console.log(`  unavailable: ${range.error}`);
else {
  const days = range.downloads.map((d) => d.downloads);
  console.log(`  total ${n(days.reduce((a, b) => a + b, 0))}   last 7 days ${n(days.slice(-7).reduce((a, b) => a + b, 0))}   ${spark(days)}`);
}
const versions = await get(`https://api.npmjs.org/versions/${PKG}/last-week`);
if (!versions.error) table(Object.entries(versions.downloads).sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true })).map(([version, d]) => ({ version, 'last 7 days': n(d) })), ['version', 'last 7 days']);
console.log('  Note: npm counts include registry mirrors, scanners and CI, not just people.');

// ---- jsDelivr
head('jsDelivr CDN (script tags)');
const jsd = await get(`https://data.jsdelivr.com/v1/stats/packages/npm/${PKG}?period=month`);
if (jsd.error) console.log(`  unavailable: ${jsd.error}`);
else {
  const days = Object.values(jsd.hits?.dates ?? {});
  console.log(`  hits ${n(jsd.hits?.total)}   bandwidth ${(Number(jsd.bandwidth?.total ?? 0) / 1e6).toFixed(1)} MB   ${spark(days)}`);
  const jv = await get(`https://data.jsdelivr.com/v1/stats/packages/npm/${PKG}/versions?period=month`);
  if (Array.isArray(jv) && jv.length) table(jv.map((v) => ({ version: v.version, hits: n(v.hits?.total) })), ['version', 'hits']);
}

// ---- GitHub
head('GitHub');
const ghHeaders = { Accept: 'application/vnd.github+json', 'User-Agent': 'pixiformui-stats', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
const gh = await get(`https://api.github.com/repos/${REPO}`, { headers: ghHeaders });
if (gh.error) console.log(`  unavailable: ${gh.error}`);
else console.log(`  stars ${n(gh.stargazers_count)}   forks ${n(gh.forks_count)}   watchers ${n(gh.subscribers_count)}   open issues ${n(gh.open_issues_count)}`);
try {
  const html = await (await fetch(`https://github.com/${REPO}/network/dependents`, { signal: AbortSignal.timeout(10_000) })).text();
  const m = html.match(/([\d,]+)\s*Repositor(?:y|ies)/);
  console.log(`  used by ${m ? m[1] : '0'} public repositories   https://github.com/${REPO}/network/dependents`);
} catch {}
console.log(`  traffic (views, clones, referrers): https://github.com/${REPO}/graphs/traffic`);

// ---- self-hosted downloads (Workers Analytics Engine)
head('Self-hosted downloads (pixiformui.lets.gen.in/v/…)');
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.log('  Set CLOUDFLARE_API_TOKEN (Cloudflare → My Profile → API Tokens → Create token,');
  console.log('  permission "Account → Account Analytics → Read") to see downloads, embedding sites and countries.');
} else {
  const sql = async (q) => {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: `${q} FORMAT JSON`,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text).data ?? [];
  };
  const since = `timestamp > NOW() - INTERVAL '${DAYS}' DAY`;
  try {
    const files = await sql(`SELECT blob1 AS version, blob2 AS file, SUM(_sample_interval) AS downloads FROM ${DATASET} WHERE ${since} GROUP BY version, file ORDER BY downloads DESC LIMIT 20`);
    table(files.map((r) => ({ ...r, downloads: n(r.downloads) })), ['version', 'file', 'downloads']);
    head('  Embedding sites (Referer), excluding bots');
    const sites = await sql(`SELECT blob4 AS site, SUM(_sample_interval) AS downloads FROM ${DATASET} WHERE ${since} AND blob5 != 'bot/tool' GROUP BY site ORDER BY downloads DESC LIMIT 20`);
    table(sites.map((r) => ({ ...r, downloads: n(r.downloads) })), ['site', 'downloads']);
    head('  Countries');
    const countries = await sql(`SELECT blob3 AS country, SUM(_sample_interval) AS downloads FROM ${DATASET} WHERE ${since} GROUP BY country ORDER BY downloads DESC LIMIT 15`);
    table(countries.map((r) => ({ ...r, downloads: n(r.downloads) })), ['country', 'downloads']);
    head('  Clients');
    const clients = await sql(`SELECT blob5 AS client, SUM(_sample_interval) AS downloads FROM ${DATASET} WHERE ${since} GROUP BY client ORDER BY downloads DESC`);
    table(clients.map((r) => ({ ...r, downloads: n(r.downloads) })), ['client', 'downloads']);
  } catch (e) {
    console.log(`  unavailable: ${e.message}`);
    if (/dataset|not exist|unknown table/i.test(e.message)) console.log('  (The dataset is created on the first download after deploying.)');
  }
}
console.log('');
