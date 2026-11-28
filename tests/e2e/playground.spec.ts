import { expect, test } from '@playwright/test';

// The playground page from the website, served by the dev server straight from site/.
const URL = '/site/playground/index.html';
const setConfig = (page: import('@playwright/test').Page, text: string) =>
  page.locator('#editor').evaluate((el: HTMLTextAreaElement, t) => {
    el.value = t;
    el.dispatchEvent(new Event('input'));
  }, text);

test('playground renders presets, rebuilds on edit and reports config errors', async ({ page }) => {
  await page.goto(URL);
  const outline = page.locator('#preview .pixiform-a11y');
  await expect(outline).toHaveAttribute('aria-label', 'Create your account');
  await expect(page.locator('#editor-status')).toHaveText(/Valid config/);

  await page.selectOption('#preset', 'login');
  await expect(outline).toHaveAttribute('aria-label', 'Welcome back');

  await setConfig(page, '{ "fields": [ { "type": "text", }');
  await expect(page.locator('#editor-status')).toHaveText(/⚠/);
  await expect(outline).toHaveAttribute('aria-label', 'Welcome back'); // last good form stays

  await setConfig(page, JSON.stringify({ fields: [{ type: 'teleport', name: 'x' }] }));
  await expect(page.locator('#editor-status')).toHaveText(/unknown field type "teleport"/);

  await setConfig(page, JSON.stringify({ title: 'Edited', fields: [{ type: 'email', name: 'email', label: 'Email' }] }));
  await expect(outline).toHaveAttribute('aria-label', 'Edited');
  await expect(page.locator('#code')).toContainText('"title": "Edited"');
});

test('share links reopen the same config', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(URL);
  await setConfig(page, JSON.stringify({ title: 'Shared form', fields: [{ type: 'text', name: 'a', label: 'A' }] }));
  await expect(page.locator('#preview .pixiform-a11y')).toHaveAttribute('aria-label', 'Shared form');
  await page.click('#share');
  await expect(page).toHaveURL(/#c=/);
  const shared = page.url();
  const other = await context.newPage();
  await other.goto(shared);
  await expect(other.locator('#preview .pixiform-a11y')).toHaveAttribute('aria-label', 'Shared form');
});

test('describe a form: the generated config fills the editor and the preview; changes send the current form', async ({ page }) => {
  const sent: { prompt: string; current?: { title?: string } }[] = [];
  await page.route('**/api/generate-form', async (route) => {
    const body = route.request().postDataJSON() as { prompt: string; current?: { title?: string } };
    sent.push(body);
    if (body.prompt === 'boom') return route.fulfill({ status: 429, json: { ok: false, message: 'You’ve generated a lot of forms this hour.' } });
    const title = body.current ? 'Job application (changed)' : 'Job application';
    await route.fulfill({ json: { ok: true, config: { title, submitText: 'Apply', fields: [{ type: 'text', name: 'fullName', label: 'Full name', required: true }, { type: 'email', name: 'email', label: 'Email' }] } } });
  });
  await page.goto(URL);
  const outline = page.locator('#preview .pixiform-a11y');
  await expect(outline).toHaveAttribute('aria-label', 'Create your account');
  await expect(page.locator('#ai-status')).toContainText('Form values are never sent');

  await page.getByRole('button', { name: 'Create form' }).click();
  await expect(page.locator('#ai-status')).toContainText('Describe the form first');
  expect(sent).toHaveLength(0);

  await page.fill('#ai-prompt', 'job application with name and email');
  await page.getByRole('button', { name: 'Create form' }).click();
  await expect(outline).toHaveAttribute('aria-label', 'Job application');
  await expect(page.locator('#editor')).toHaveValue(/"title": "Job application"/);
  await expect(page.locator('#ai-status')).toContainText('Done');
  expect(sent[0]).toEqual({ prompt: 'job application with name and email' }); // a new form sends no current config

  await page.fill('#ai-prompt', 'make email required');
  await page.getByRole('button', { name: 'Change current form' }).click();
  await expect(outline).toHaveAttribute('aria-label', 'Job application (changed)');
  expect(sent[1].current?.title).toBe('Job application');

  await page.fill('#ai-prompt', 'boom');
  await page.getByRole('button', { name: 'Create form' }).click();
  await expect(page.locator('#ai-status')).toContainText('a lot of forms this hour');
  await expect(outline).toHaveAttribute('aria-label', 'Job application (changed)'); // the form stays
});

test('every preset in the dropdown builds a working form', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  const status = page.locator('#editor-status');
  await expect(status).toHaveText(/Valid config/);
  const presets = await page.locator('#preset option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== 'custom'));
  expect(presets.length).toBeGreaterThanOrEqual(8);
  for (const value of presets) {
    await page.selectOption('#preset', value);
    const title = (JSON.parse(await page.locator('#editor').inputValue()) as { title?: string }).title;
    if (title) await expect(page.locator('#preview .pixiform-a11y'), value).toHaveAttribute('aria-label', title);
    await expect(status, value).toHaveText(/Valid config/);
    await expect(page.locator('#preview-meta'), value).toHaveText(/[1-9]\d* fields?/);
  }
  expect(errors).toEqual([]);
});
