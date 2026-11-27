/** Encrypted files (PFF1): sealed as in the browser (pixiformui/file), opened by server/pfe.ts.  npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { sealFile } from '../src/lib/file/crypto.ts';
import { FileSelection } from '../src/lib/file/selection.ts';
import { loadKey, openFile, PfeError } from '../server/pfe.ts';

const pem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const key = loadKey(pem);
const keys = new Map([[key.kid, key]]);
const ek = { alg: 'PFE1' as const, kid: key.kid, spki: key.spki, challenge: 'challenge-0123456789' };
const ctx = (field: string) => `${ek.challenge}|${field}`;

test('a sealed file opens on the server, with its name and type, and nothing readable in the upload', async () => {
  const content = new TextEncoder().encode('%PDF-1.7 Ada Lovelace CV '.repeat(200));
  const file = new File([content], 'Ada Lovelace CV.pdf', { type: 'application/pdf' });
  const sealed = await sealFile(file, ek, 'cv', 0);
  assert.deepEqual([...sealed.blob.subarray(0, 4)], [...Buffer.from('PFF1')]);
  assert.equal(sealed.blob.length, 4 + 12 + content.length + 16);
  assert.ok(!Buffer.from(sealed.blob).includes('Ada'), 'the upload never contains the content or the name');
  assert.match(sealed.key, /^pfe1\./);
  const { manifest, data } = openFile(sealed.key, Buffer.from(sealed.blob), keys, ctx('cv[0]'));
  assert.deepEqual(manifest, { name: 'Ada Lovelace CV.pdf', type: 'application/pdf', size: content.length });
  assert.ok(data.equals(Buffer.from(content)));
});

test('tampering, swapping files or moving a key to another field all fail', async () => {
  const a = await sealFile(new File(['first file'], 'a.txt', { type: 'text/plain' }), ek, 'docs', 0);
  const b = await sealFile(new File(['second file'], 'b.txt', { type: 'text/plain' }), ek, 'docs', 1);
  assert.throws(() => openFile(a.key, Buffer.from(b.blob), keys, ctx('docs[0]')), /does not match its key/); // swapped blob
  assert.throws(() => openFile(a.key, Buffer.from(a.blob), keys, ctx('docs[1]')), PfeError); // wrong slot
  assert.throws(() => openFile(a.key, Buffer.from(a.blob), keys, ctx('other[0]')), PfeError); // wrong field
  const flipped = Buffer.from(a.blob);
  flipped[flipped.length - 1] ^= 1;
  assert.throws(() => openFile(a.key, flipped, keys, ctx('docs[0]')), /does not match its key/);
  assert.throws(() => openFile(a.key, Buffer.from('nope'), keys, ctx('docs[0]')), /Not a PFF1 file/);
});

test('FileSelection serializes by encrypting and uploading each file, and refuses plaintext', async () => {
  const files = [new File(['one'], 'one.txt'), new File(['two'], 'two.txt')];
  const uploads: { bytes: Buffer; field: string; index: number }[] = [];
  const upload = async (bytes: Uint8Array, info: { field: string; index: number }) => {
    uploads.push({ bytes: Buffer.from(bytes), ...info });
    return `up_${info.index}_0123456789`;
  };
  const refs = await new FileSelection(files).serializeWith({ field: 'attachments', encryptionKey: ek, upload });
  assert.deepEqual(refs.map((r) => r.id), ['up_0_0123456789', 'up_1_0123456789']);
  assert.equal(openFile(refs[1].key, uploads[1].bytes, keys, ctx('attachments[1]')).data.toString(), 'two');
  assert.deepEqual(await new FileSelection([]).serializeWith({ field: 'x' }), []);
  await assert.rejects(new FileSelection(files).serializeWith({ field: 'x', upload }), /pass encryptionKey/);
  await assert.rejects(new FileSelection(files).serializeWith({ field: 'x', encryptionKey: ek }), /pass upload/);
});
