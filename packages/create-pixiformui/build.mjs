// Builds the parts of the templates that come from this repository, so they never drift:
//   - server/lib/{pfe,pow,conditions}.mjs from server/pfe.ts, shared/pow.ts, src/lib/conditions.ts
//   - the React wrapper from examples/react/src/PixiForm.tsx
//   - package.json version (same as the library)
// Run from the repository root: node packages/create-pixiformui/build.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { transform } from 'esbuild';

const root = new URL('../../', import.meta.url);
const here = new URL('./', import.meta.url);
const lib = new URL('templates/_shared/server/lib/', here);
mkdirSync(lib, { recursive: true });

const banner = (src) => `// Generated from pixiformui/${src} by create-pixiformui. Don't edit; update the package instead.\n`;
for (const [src, out] of [
  ['server/pfe.ts', 'pfe.mjs'],
  ['shared/pow.ts', 'pow.mjs'],
  ['src/lib/conditions.ts', 'conditions.mjs'],
]) {
  const ts = readFileSync(new URL(src, root), 'utf8');
  const { code } = await transform(ts, { loader: 'ts', format: 'esm', target: 'node20' });
  writeFileSync(new URL(out, lib), banner(src) + code);
}

copyFileSync(new URL('examples/react/src/PixiForm.tsx', root), new URL('templates/react/src/PixiForm.tsx', here));

const version = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).version;
const pkgFile = new URL('package.json', here);
const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
if (pkg.version !== version) {
  pkg.version = version;
  writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
}
console.log(`create-pixiformui ${version}: templates ready`);
