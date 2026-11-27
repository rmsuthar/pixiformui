import { expect, test } from '@playwright/test';
import { focusField } from './helpers';

// pixiformui/translate in a real browser: the visitor's language comes from the browser.
const HI: Record<string, string> = { Apply: 'आवेदन करें', 'Full name': 'पूरा नाम', Plan: 'योजना', Free: 'मुफ़्त', Send: 'भेजें', '{label} is required.': '{label} आवश्यक है।' };

test.use({ locale: 'hi-IN' });

test('a form shows in the browser language, including its required message; values are never sent', async ({ page }) => {
  let sent: { source: string; target: string; strings: string[] } | null = null;
  await page.route('**/__test/translate', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { translations: sent!.strings.map((s) => HI[s] ?? s) } });
  });
  await page.goto('/tests/e2e/pages/translate.html');
  const tree = page.locator('.pixiform-a11y');
  await expect(tree).toHaveAttribute('aria-label', 'आवेदन करें');
  expect(sent!.target).toMatch(/^hi/);
  expect(sent!.strings).toContain('{label} is required.');
  await expect(tree.locator('[aria-label^="पूरा नाम"]').first()).toBeAttached();
  await expect(tree.locator('[aria-label^="योजना"]').first()).toBeAttached();
  const options = await page.evaluate(() => (window as unknown as { __handle: { get(n: string): { options: { label: string }[] } } }).__handle.get('plan').options.map((o) => o.label));
  expect(options).toEqual(['मुफ़्त', 'Pro']); // "Pro" had no translation and stays
  await focusField(page, 'भेजें');
  await page.keyboard.press('Enter');
  await expect(tree.getByText('पूरा नाम आवश्यक है।').first()).toBeAttached();
  if (process.env.SHOTS) await page.locator('#f').screenshot({ path: `${process.env.SHOTS}/translated.png` });
});

test('if the translation endpoint fails, the form shows in its original language', async ({ page }) => {
  await page.route('**/__test/translate', (route) => route.fulfill({ status: 503, json: { ok: false } }));
  await page.goto('/tests/e2e/pages/translate.html');
  await expect(page.locator('.pixiform-a11y')).toHaveAttribute('aria-label', 'Apply');
});
