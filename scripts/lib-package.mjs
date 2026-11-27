// Writes dist-lib/package.json, README.md and LICENSE: the publishable npm package `pixiformui`.
//   npm run build:lib && cd dist-lib && npm publish
// REPO_URL overrides the repository link (default: the public GitHub repository).
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const repo = (process.env.REPO_URL ?? 'https://github.com/rmsuthar/pixiformui').replace(/\/+$/, '');
const pkg = {
  name: 'pixiformui',
  version: root.version,
  description: root.description,
  keywords: [
    'form', 'forms', 'secure', 'security', 'canvas', 'password', 'encryption', 'validation',
    'accessibility', 'web-component', 'react', 'angular', 'typescript', 'otp', 'date-picker', 'phone-input', 'csp',
    'form-backend', 'encrypted-forms', 'end-to-end-encryption', 'cloud', 'webhooks',
  ],
  homepage: 'https://pixiformui.lets.gen.in',
  // npm prints "packages are looking for funding" after install; `npm fund` shows this link.
  funding: { type: 'individual', url: 'https://pixiformui.lets.gen.in/pro/' },
  bugs: repo ? { url: `${repo}/issues`, email: 'ravindra.suthar@me.com' } : { email: 'ravindra.suthar@me.com' },
  ...(repo ? { repository: { type: 'git', url: `git+${repo}.git` } } : {}),
  license: 'MIT',
  author: 'Ravindrakumar Suthar <ravindra.suthar@me.com> (https://www.linkedin.com/in/ravindrasuthar/)',
  type: 'module',
  main: './pixiformui.js',
  module: './pixiformui.js',
  types: './types/src/lib/index.d.ts',
  exports: {
    '.': { types: './types/src/lib/index.d.ts', import: './pixiformui.js' },
    './standalone': { types: './types/src/lib/standalone.d.ts', import: './pixiformui.standalone.js' },
    './ssr': { types: './types/src/lib/ssr.d.ts', import: './pixiformui-ssr.js' },
    './file': { types: './types/src/lib/file/index.d.ts', import: './pixiformui-file.js' },
    './file/standalone': { types: './types/src/lib/standalone-file.d.ts', import: './pixiformui-file.standalone.js' },
    './package.json': './package.json',
  },
  files: ['pixiformui.js', 'pixiformui.js.map', 'pixiformui.standalone.js', 'pixiformui.standalone.js.map', 'pixiformui-ssr.js', 'pixiformui-ssr.js.map', 'pixiformui-file.js', 'pixiformui-file.js.map', 'pixiformui-file.standalone.js', 'pixiformui-file.standalone.js.map', 'types', 'README.md', 'LICENSE'],
  sideEffects: ['./pixiformui.standalone.js', './pixiformui.js', './pixiformui-file.js', './pixiformui-file.standalone.js'],
  engines: { node: '>=18' },
  publishConfig: { access: 'public' },
};
const out = (f) => new URL(`../dist-lib/${f}`, import.meta.url);
writeFileSync(out('package.json'), JSON.stringify(pkg, null, 2) + '\n');
// The README quotes the standalone bundle's gzipped size, measured now so it never goes stale.
const sizeKb = Math.round(gzipSync(readFileSync(out('pixiformui.standalone.js'))).length / 1024);
writeFileSync(out('README.md'), readFileSync(new URL('../docs/NPM_README.md', import.meta.url), 'utf8').replaceAll('__PIXIFORM_SIZE_KB__', String(sizeKb)));
copyFileSync(new URL('../LICENSE', import.meta.url), out('LICENSE'));
console.log(`dist-lib ready: ${pkg.name}@${pkg.version}`);
