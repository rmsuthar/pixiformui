import { expect, test } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';
import { loadKey, openFile } from '../../server/pfe.ts';
import { focusField, pageContains } from './helpers';

// pixiformui/file in a real browser: choose (picker and drag-and-drop), validate, encrypt, upload,
// submit; then the test opens the uploads with the server's decryptor.
const pem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const key = loadKey(pem);
const keys = new Map([[key.kid, key]]);
const challenge = 'e2e-challenge-0123456789';
const PDF = Buffer.from('%PDF-1.7 Grace Hopper portfolio '.repeat(40));
const TXT = Buffer.from('Cover note: Grace Hopper');

test('file field: picker and drop, checks, encrypted uploads and references that open on the server', async ({ page }) => {
  const uploads: { body: Buffer; csrf: string | null; type: string | null; field: string | null }[] = [];
  let submitted: { name?: string; cv?: { id: string; key: string }[] } | null = null;
  await page.addInitScript((k) => ((window as unknown as { __pfKey: unknown }).__pfKey = k), { alg: 'PFE1', kid: key.kid, spki: key.spki, challenge });
  await page.route('**/__test/upload', async (route) => {
    const r = route.request();
    uploads.push({ body: r.postDataBuffer()!, csrf: r.headers()['x-csrf-token'] ?? null, type: r.headers()['content-type'] ?? null, field: r.headers()['x-upload-field'] ?? null });
    await route.fulfill({ json: { id: `upload_${uploads.length}_abcdefgh` } });
  });
  await page.route('**/__test/submit', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, message: 'Application received.' } });
  });

  await page.goto('/tests/e2e/pages/file.html');
  await focusField(page, 'Name');
  await page.keyboard.type('Grace', { delay: 5 });

  // Picker: Enter on the field opens the system file chooser.
  const cvItem = page.locator('.pixiform-a11y [aria-label^="CV and portfolio"]').first();
  await expect(cvItem).toHaveAttribute('role', 'button');
  await focusField(page, 'CV and portfolio');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles([{ name: 'Grace Hopper portfolio.pdf', mimeType: 'application/pdf', buffer: PDF }]);
  await expect(cvItem).toHaveAccessibleDescription(/1 file attached/);

  // Too big and wrong type are refused with generic messages (no file names in the page).
  const [c2] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await c2.setFiles([{ name: 'huge.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(60 * 1024) }]);
  await expect(page.locator('.pixiform-a11y').getByText('That file is larger than 50 KB.').first()).toBeAttached();
  const [c3] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await c3.setFiles([{ name: 'tool.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') }]);
  await expect(page.locator('.pixiform-a11y').getByText(/That file type isn’t accepted \(PDF, TXT\)/).first()).toBeAttached();

  // Drag and drop onto the drop zone.
  await page.evaluate(async (text) => {
    const c = (window as unknown as { __handle: { get(n: string): { zone: { getBounds(): { x: number; y: number; width: number; height: number } } } } }).__handle.get('cv');
    const canvas = document.querySelector('#f canvas')!.getBoundingClientRect();
    const b = c.zone.getBounds();
    const dt = new DataTransfer();
    dt.items.add(new File([text], 'cover.txt', { type: 'text/plain' }));
    const at = { clientX: canvas.left + b.x + b.width / 2, clientY: canvas.top + b.y + b.height / 2, bubbles: true, cancelable: true, dataTransfer: dt };
    const host = document.getElementById('f')!;
    host.dispatchEvent(new DragEvent('dragover', at));
    host.dispatchEvent(new DragEvent('drop', at));
  }, TXT.toString());
  await expect(cvItem).toHaveAccessibleDescription(/2 files attached/);
  if (process.env.SHOTS) await page.locator('#f').screenshot({ path: `${process.env.SHOTS}/file-field.png` });
  expect(await pageContains(page, 'Grace Hopper portfolio')).toBe(false);
  expect(await pageContains(page, 'cover.txt')).toBe(false);

  // Submit: two encrypted uploads, then the form with references.
  await focusField(page, 'Submit');
  await page.keyboard.press('Enter');
  await expect.poll(() => submitted).not.toBeNull();
  expect(uploads).toHaveLength(2);
  for (const u of uploads) expect([u.csrf, u.type, u.field]).toEqual(['test-csrf-token', 'application/octet-stream', 'cv']);
  expect(uploads[0].body.includes(Buffer.from('Grace'))).toBe(false);
  const refs = submitted!.cv!;
  expect(submitted!.name).toBe('Grace');
  expect(refs.map((r) => r.id)).toEqual(['upload_1_abcdefgh', 'upload_2_abcdefgh']);
  const first = openFile(refs[0].key, uploads[0].body, keys, `${challenge}|cv[0]`);
  const second = openFile(refs[1].key, uploads[1].body, keys, `${challenge}|cv[1]`);
  expect(first.manifest).toEqual({ name: 'Grace Hopper portfolio.pdf', type: 'application/pdf', size: PDF.length });
  expect(first.data.equals(PDF)).toBe(true);
  expect([second.manifest.name, second.data.toString()]).toEqual(['cover.txt', TXT.toString()]);
});

test('file field: { type: "file" } works in a plain config once pixiformui/file is loaded', async ({ page }) => {
  await page.addInitScript((k) => ((window as unknown as { __pfKey: unknown }).__pfKey = k), { alg: 'PFE1', kid: key.kid, spki: key.spki, challenge });
  await page.goto('/tests/e2e/pages/file.html?json');
  const cvItem = page.locator('.pixiform-a11y [aria-label^="CV and portfolio"]').first();
  await expect(cvItem).toHaveAttribute('role', 'button');
  await expect(cvItem).toHaveAccessibleDescription(/PDF, TXT · up to 50 KB · 2 files\. No file attached/);
  await focusField(page, 'CV and portfolio');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await chooser.setFiles([{ name: 'a.pdf', mimeType: 'application/pdf', buffer: PDF }]);
  await expect(cvItem).toHaveAccessibleDescription(/1 file attached/);
});
