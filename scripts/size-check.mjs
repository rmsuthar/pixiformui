// Fails if the published bundles grow past their gzip budgets (npm run size; runs in CI).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGETS = {
  'dist-lib/pixiformui.standalone.js': 68 * 1024, // everything, minified (≈64 KB in 0.1.6: + proof-of-work, human check)
  'dist-lib/pixiformui.js': 88 * 1024, // ES module, unminified with comments; apps minify it (≈84 KB in 0.1.6)
};
let failed = false;
for (const [file, budget] of Object.entries(BUDGETS)) {
  const size = gzipSync(readFileSync(new URL(`../${file}`, import.meta.url)), { level: 9 }).length;
  const ok = size <= budget;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${file}: ${(size / 1024).toFixed(1)} KB gzip (budget ${(budget / 1024).toFixed(0)} KB)`);
}
if (failed) {
  console.error('Bundle size budget exceeded. Trim the code or raise the budget deliberately in scripts/size-check.mjs.');
  process.exit(1);
}
