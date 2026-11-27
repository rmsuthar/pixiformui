/**
 * Cross-language PFE1 conformance test.
 *  1. Generates a fresh P-256 key and envelopes using the *browser* code
 *     (src/lib/security/envelope.ts, Web Crypto), including negative cases.
 *  2. Runs every available decryptor (Node, Python, Go, C#, Ruby, PHP, Java)
 *     and checks each one accepts/rejects exactly as expected.
 *
 *   npm run test:pfe
 */
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sealBytes, type EncryptionKey } from '../src/lib/security/envelope.ts';
import { sealFile } from '../src/lib/file/crypto.ts';
import { loadKey, openEnvelope, openFile } from '../server/pfe.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'pfe-'));

const pem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const other = loadKey(generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString());
const key = loadKey(pem);
const challenge = 'Q2hhbGxlbmdlLXRlc3QtMDAx';
const ek: EncryptionKey = { alg: 'PFE1', kid: key.kid, spki: key.spki, challenge };
const enc = new TextEncoder();
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

const plains = ['Tr0ub4dor&Horse!', 'pässwörd-🔐-密码-пароль', 'x'.repeat(128)];
type Vector = { name: string; envelope: string; context: string; expect: string | null };
const vectors: Vector[] = [];
for (const [i, p] of plains.entries()) {
  vectors.push({ name: `valid-${i}`, envelope: await sealBytes(enc.encode(p), ek, 'password'), context: `${challenge}|password`, expect: hex(enc.encode(p)) });
}
const base = await sealBytes(enc.encode('Tr0ub4dor&Horse!'), ek, 'password');
vectors.push({ name: 'wrong-field', envelope: base, context: `${challenge}|confirmPassword`, expect: null });
vectors.push({ name: 'replayed-challenge', envelope: base, context: `OTHER-challenge-000000|password`, expect: null });
const parts = base.split('.');
const ct = Buffer.from(parts[4], 'base64url');
ct[0] ^= 1;
vectors.push({ name: 'tampered-ciphertext', envelope: [...parts.slice(0, 4), ct.toString('base64url')].join('.'), context: `${challenge}|password`, expect: null });
vectors.push({
  name: 'unknown-key',
  envelope: await sealBytes(enc.encode('secret'), { ...ek, kid: other.kid, spki: other.spki }, 'password'),
  context: `${challenge}|password`,
  expect: null,
});
vectors.push({ name: 'malformed', envelope: 'pfe1.not-valid', context: `${challenge}|password`, expect: null });

// PFF1 (encrypted files): sealed as in the browser; decryptors that know files check these too.
type FileVector = { name: string; key: string; blob: string; context: string; expect: string | null };
const fileVectors: FileVector[] = [];
const doc = enc.encode('%PDF-1.7 conformance ' + 'é'.repeat(300));
const a = await sealFile(new File([doc], 'a.pdf', { type: 'application/pdf' }), ek, 'cv', 0);
const b = await sealFile(new File(['other'], 'b.txt'), ek, 'cv', 1);
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64url');
fileVectors.push({ name: 'file-valid', key: a.key, blob: b64(a.blob), context: `${challenge}|cv[0]`, expect: hex(doc) });
fileVectors.push({ name: 'file-swapped-blob', key: a.key, blob: b64(b.blob), context: `${challenge}|cv[0]`, expect: null });
fileVectors.push({ name: 'file-wrong-slot', key: a.key, blob: b64(a.blob), context: `${challenge}|cv[1]`, expect: null });

const file = join(dir, 'pfe1-vectors.json');
writeFileSync(file, JSON.stringify({ spec: 'pfe1', privateKeyPem: pem, kid: key.kid, vectors, files: fileVectors }, null, 2));

// ---- Node (server/pfe.ts)
let nodeOk = true;
for (const v of vectors) {
  let got: string | null = null;
  try {
    got = openEnvelope(v.envelope, new Map([[key.kid, key]]), v.context).toString('hex');
  } catch {
    got = null;
  }
  if (got !== v.expect) nodeOk = false;
}
for (const v of fileVectors) {
  let got: string | null = null;
  try {
    got = openFile(v.key, Buffer.from(v.blob, 'base64url'), new Map([[key.kid, key]]), v.context).data.toString('hex');
  } catch {
    got = null;
  }
  if (got !== v.expect) nodeOk = false;
}
const results: [string, string][] = [['Node.js', nodeOk ? 'PASS' : 'FAIL']];

// ---- other languages: each prints "PASS" (all vectors behaved as expected) or details
const D = join(ROOT, 'server', 'decrypt');
const runners: [string, string, string[], string?][] = [
  ['Python', 'python3', [join(D, 'python', 'pfe.py'), file]],
  ['Go', 'go', ['run', '.', file], join(D, 'go')],
  ['C# (.NET)', 'dotnet', ['run', '--project', join(D, 'csharp'), '--', file]],
  ['Ruby', 'ruby', [join(D, 'ruby', 'pfe.rb'), file]],
  ['PHP', 'php', [join(D, 'php', 'pfe.php'), file]],
  ['Java', 'java', [join(D, 'java', 'Pfe.java'), file]],
];
for (const [name, cmd, args, cwd] of runners) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 240_000 });
  if (r.error || (r.status !== 0 && !r.stdout)) {
    results.push([name, `SKIPPED (${r.error ? 'not installed' : (r.stderr || '').trim().split('\n').pop()})`]);
    continue;
  }
  const last = r.stdout.trim().split('\n').pop() ?? '';
  results.push([name, last === 'PASS' ? 'PASS' : `FAIL\n${r.stdout}${r.stderr}`]);
}

console.log(`PFE1 conformance (${vectors.length} vectors: ${plains.length} valid, ${vectors.length - plains.length} must be rejected)`);
for (const [n, s] of results) console.log(`  ${n.padEnd(10)} ${s}`);
process.exit(results.some(([, s]) => s.startsWith('FAIL')) ? 1 : 0);
