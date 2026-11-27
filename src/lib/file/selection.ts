// The file field's value. Only type imports from the core, so it also runs in Node (tests).
import type { EncryptionKey, FileReference, FileUploader, SerializableValue } from '../index';
import { sealFile } from './crypto.ts';

/** The field's value: the chosen files. Serializes by encrypting and uploading each one. */
export class FileSelection implements SerializableValue {
  readonly files: readonly File[];
  constructor(files: readonly File[] = []) {
    this.files = files;
  }
  get length(): number {
    return this.files.length;
  }
  async serializeWith(ctx: { field: string; encryptionKey?: EncryptionKey; upload?: FileUploader }): Promise<FileReference[]> {
    if (!this.files.length) return [];
    if (!ctx.encryptionKey) throw new Error(`serialize: "${ctx.field}" has files; pass encryptionKey (files are always encrypted)`);
    if (!ctx.upload) throw new Error(`serialize: "${ctx.field}" has files; pass upload (or set config.upload)`);
    const out: FileReference[] = [];
    for (let i = 0; i < this.files.length; i++) {
      const sealed = await sealFile(this.files[i], ctx.encryptionKey, ctx.field, i);
      try {
        out.push({ id: await ctx.upload(sealed.blob, { field: ctx.field, index: i }), key: sealed.key });
      } finally {
        sealed.blob.fill(0);
      }
    }
    return out;
  }
}

