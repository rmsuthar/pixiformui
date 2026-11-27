/**
 * pixiformui/file: encrypted file uploads (a separate import, so forms without files don't load it).
 *
 *   import { mountPixiForm } from 'pixiformui';
 *   import { fileField } from 'pixiformui/file';
 *
 *   mountPixiForm(host, {
 *     action: '/api/apply', session: '/api/session', upload: '/api/upload',
 *     fields: [
 *       { type: 'text', name: 'name', label: 'Name', required: true },
 *       fileField({ name: 'cv', label: 'CV', accept: ['.pdf', '.docx'], maxSize: 10 * 1024 * 1024, required: true }),
 *     ],
 *   });
 *
 * Each file is encrypted in the browser with its own key (PFF1) and uploaded; the form submits
 * `[{ id, key }]` for the field. See docs/ENCRYPTION.md ("Files") for the format and decryptors.
 */
import { registerFieldType, type FieldConfig, type FormUI } from '../index';
import { FileInput, type FileInputOptions } from './FileInput';

export { FileInput, FileSelection, formatBytes, type FileInputOptions } from './FileInput';
export { sealFile, PFF_MAGIC, type SealedFile } from './crypto';

// Importing this module enables `{ type: 'file', … }` in plain configs (e.g. <pixi-form>, JSON).
registerFieldType('file', (ui, opts) => new FileInput(ui, opts as unknown as FileInputOptions));

/** A file field for mountPixiForm's `fields` (supports `row` and `showIf` like any field). */
export function fileField(opts: FileInputOptions & { row?: string; showIf?: Extract<FieldConfig, { type: 'text' }>['showIf'] }): FieldConfig {
  const { row, showIf, ...options } = opts;
  return { type: 'custom', create: (ui: FormUI) => new FileInput(ui, options), ...(row ? { row } : {}), ...(showIf ? { showIf } : {}) } as FieldConfig;
}
