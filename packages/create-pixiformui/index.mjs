#!/usr/bin/env node
/**
 * create-pixiformui: scaffolds a PixiFormUI app with a demo form and a secure Node server.
 *
 *   npm create pixiformui@latest my-app
 *   npm create pixiformui@latest my-app -- --template react
 *
 * No dependencies: Node's built-ins only.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const TEMPLATES = {
  vanilla: 'TypeScript, no framework (Vite)',
  react: 'React 19 + TypeScript (Vite)',
};
const TEXT = /\.(m?[jt]sx?|json|html|css|md|txt)$|^_gitignore$/;

const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s);
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s);
const fail = (msg) => {
  console.error(`\n  ✖ ${msg}\n`);
  process.exit(1);
};

function parseArgs(argv) {
  const out = { dir: undefined, template: undefined, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '-v' || a === '--version') out.version = true;
    else if (a === '-t' || a === '--template') out.template = argv[++i];
    else if (a.startsWith('--template=')) out.template = a.slice(11);
    else if (a.startsWith('-')) fail(`Unknown option ${a}. Try --help.`);
    else if (!out.dir) out.dir = a;
    else fail(`Unexpected argument ${a}. Try --help.`);
  }
  return out;
}

function help() {
  console.log(`
  ${bold('create-pixiformui')} ${pkg.version}: start a PixiFormUI app with a demo form and a secure server.

  Usage:
    npm create pixiformui@latest [directory] [-- --template <name>]

  Templates:
${Object.entries(TEMPLATES).map(([k, v]) => `    ${k.padEnd(9)} ${v}`).join('\n')}

  Docs: https://pixiformui.lets.gen.in/docs/
`);
}

/** A valid npm package name from a directory name. */
const packageName = (dir) =>
  basename(resolve(dir))
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, '-')
    .replace(/^[._-]+|[-]+$/g, '') || 'pixiform-app';

function isEmptyDir(dir) {
  return !existsSync(dir) || readdirSync(dir).filter((f) => f !== '.git' && f !== '.DS_Store').length === 0;
}

function copyDir(src, dest, vars) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    const to = join(dest, name === '_gitignore' ? '.gitignore' : name);
    if (statSync(from).isDirectory()) copyDir(from, to, vars);
    else if (TEXT.test(name)) writeFileSync(to, readFileSync(from, 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m));
    else copyFileSync(from, to);
  }
}

async function main() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 20) fail(`Node.js 20 or newer is required (you have ${process.versions.node}).`);
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();
  if (args.version) return console.log(pkg.version);

  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  try {
    let dir = args.dir;
    if (!dir) dir = rl ? (await rl.question(`  Project folder ${dim('(pixiform-app)')}: `)).trim() || 'pixiform-app' : 'pixiform-app';
    let template = args.template;
    if (!template) {
      if (rl) {
        console.log(`\n  Templates:\n${Object.entries(TEMPLATES).map(([k, v], i) => `    ${i + 1}. ${k.padEnd(9)} ${dim(v)}`).join('\n')}`);
        const answer = (await rl.question(`  Choose a template ${dim('(1)')}: `)).trim();
        const keys = Object.keys(TEMPLATES);
        template = keys[Number(answer) - 1] ?? (keys.includes(answer) ? answer : 'vanilla');
      } else template = 'vanilla';
    }
    if (!(template in TEMPLATES)) fail(`Unknown template "${template}". Choose one of: ${Object.keys(TEMPLATES).join(', ')}.`);

    const target = resolve(dir);
    if (!isEmptyDir(target)) fail(`${dir} already exists and isn't empty. Pick another folder.`);

    const vars = { name: packageName(dir), pixiformuiVersion: process.env.PIXIFORMUI_VERSION ?? `^${pkg.version}`, template };
    copyDir(join(here, 'templates', '_shared'), target, vars);
    copyDir(join(here, 'templates', template), target, vars);

    const cd = dir === '.' ? '' : `    cd ${dir.includes(' ') ? JSON.stringify(dir) : dir}\n`;
    console.log(`
  ${bold('Done.')} Created ${vars.name} (${template}) in ${target}

  Next:
${cd}    npm install
    npm run dev          ${dim('# http://localhost:5173')}

  The demo form is in src/form.ts, its fields in shared/fields.js (used by the
  browser and the server), and the server in server/. See README.md.
`);
  } finally {
    rl?.close();
  }
}

main().catch((err) => fail(err?.message ?? String(err)));
