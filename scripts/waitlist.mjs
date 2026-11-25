// Exports the Pro & Cloud waitlist (Cloudflare KV, binding WAITLIST) to a CSV file.
//   npm run waitlist                 → waitlist-YYYY-MM-DD.csv (git-ignored)
//   npm run waitlist -- --out x.csv
// Uses your wrangler login (only the account owner can read the list). One list call: every
// sign-up's record is stored in its key's metadata by site/worker.ts.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? process.argv[outArg + 1] : `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
const raw = execFileSync('npx', ['wrangler', 'kv', 'key', 'list', '--binding', 'WAITLIST', '--remote', '--prefix', 'wl:'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const keys = JSON.parse(raw.slice(raw.indexOf('[')));
const cols = ['createdAt', 'updatedAt', 'email', 'name', 'company', 'teamSize', 'interests', 'message', 'source'];
const cell = (v) => {
  const s = Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v);
  // Quote everything; neutralise spreadsheet formulas (=, +, -, @ at the start).
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};
const rows = keys.map((k) => k.metadata ?? {}).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
writeFileSync(out, [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
const counts = {};
for (const r of rows) for (const i of r.interests ?? []) counts[i] = (counts[i] ?? 0) + 1;
console.log(`${rows.length} sign-ups → ${out}`);
if (rows.length) console.log('Interest:', Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
