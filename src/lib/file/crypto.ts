/**
 * PFF1: PixiForm encrypted File (docs/ENCRYPTION.md, "Files").
 *
 *   fileKey   = 32 random bytes, iv = 12 random bytes           (fresh for every file)
 *   blob      = "PFF1" ‖ iv ‖ AES-256-GCM(fileKey, iv, file bytes, aad = "pff1")   ← uploaded
 *   manifest  = JSON { v: 1, k: b64u(fileKey), name, type, size, sha256: b64u(SHA-256(blob)) }
 *   key       = PFE1 envelope of the manifest, field context "<field>[<index>]"  ← submitted
 *
 * The server (or form owner) opens `key` with the same PFE1 decryptor as passwords, checks the
 * blob's SHA-256 against the manifest (so a blob can't be swapped), then decrypts the blob.
 * The file name and type are inside the envelope too, so the upload itself reveals only a size.
 */
// The envelope module has no runtime imports, so this file also runs in Node (tests, servers).
import { b64uEncode, sealBytes, type EncryptionKey } from '../security/envelope.ts';

export const PFF_MAGIC = new Uint8Array([0x50, 0x46, 0x46, 0x31]); // "PFF1"
const AAD = new TextEncoder().encode('pff1');

export interface SealedFile {
  /** Upload this. */
  blob: Uint8Array<ArrayBuffer>;
  /** Submit this (with the upload's id). */
  key: string;
}

export async function sealFile(file: Blob & { name?: string }, key: EncryptionKey, field: string, index: number): Promise<SealedFile> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto unavailable: serve the page over HTTPS or localhost.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileKey = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  try {
    const aes = await subtle.importKey('raw', fileKey, 'AES-GCM', false, ['encrypt']);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD, tagLength: 128 }, aes, bytes));
    const blob = new Uint8Array(PFF_MAGIC.length + iv.length + ct.length);
    blob.set(PFF_MAGIC);
    blob.set(iv, PFF_MAGIC.length);
    blob.set(ct, PFF_MAGIC.length + iv.length);
    const sha256 = b64uEncode(new Uint8Array(await subtle.digest('SHA-256', blob)));
    const manifest = new TextEncoder().encode(JSON.stringify({ v: 1, k: b64uEncode(fileKey), name: file.name ?? 'file', type: file.type || 'application/octet-stream', size: file.size, sha256 }));
    try {
      return { blob, key: await sealBytes(manifest, key, `${field}[${index}]`) };
    } finally {
      manifest.fill(0);
    }
  } finally {
    bytes.fill(0);
    fileKey.fill(0);
  }
}
