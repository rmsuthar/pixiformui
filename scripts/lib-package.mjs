// Writes dist-lib/package.json, README.md and LICENSE: the publishable npm package `pixiformui`.
//   npm run build:lib && cd dist-lib && npm publish
// REPO_URL overrides the repository link (default: the public GitHub repository).
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const repo = (process.env.REPO_URL ?? 'https://github.com/rmsuthar/pixiformui').replace(/\/+$/, '');
const pkg = {
  name: 'pixiformui',
  version: root.version,
  description: root.description,
  keywords: [
    'form', 'forms', 'secure', 'security', 'canvas', 'password', 'encryption', 'validation',
    'accessibility', 'web-component', 'react', 'angular', 'typescript', 'otp', 'date-picker', 'phone-input', 'csp',
  ],
  homepage: 'https://pixiformui.lets.gen.in',
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
    './package.json': './package.json',
  },
  files: ['pixiformui.js', 'pixiformui.js.map', 'pixiformui.standalone.js', 'pixiformui.standalone.js.map', 'types', 'README.md', 'LICENSE'],
  sideEffects: ['./pixiformui.standalone.js', './pixiformui.js'],
  engines: { node: '>=18' },
  publishConfig: { access: 'public' },
};
const out = (f) => new URL(`../dist-lib/${f}`, import.meta.url);
writeFileSync(out('package.json'), JSON.stringify(pkg, null, 2) + '\n');
copyFileSync(new URL('../docs/NPM_README.md', import.meta.url), out('README.md'));
copyFileSync(new URL('../LICENSE', import.meta.url), out('LICENSE'));
console.log(`dist-lib ready: ${pkg.name}@${pkg.version}`);
