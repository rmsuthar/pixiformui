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
