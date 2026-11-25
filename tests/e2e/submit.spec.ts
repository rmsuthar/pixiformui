import { expect, test } from '@playwright/test';
import { focusField, solveHumanCheck } from './helpers';

test('registration submits encrypted passwords to the server (201)', async ({ page }) => {
  const id = Date.now().toString(36);
  await page.goto('/');
  const type = async (label: string, text: string) => {
    await focusField(page, label);
    await page.keyboard.type(text, { delay: 3 });
  };
  await type('Full name', 'Ada Lovelace');
  await type('Username', `ada_${id}`);
  await type('Email', `ada.${id}@example.com`);
  await type('Password', 'Tr0ub4dor&Horse!2026');
  await type('Confirm password', 'Tr0ub4dor&Horse!2026');
  await focusField(page, 'Country');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ind', { delay: 40 });
  await page.keyboard.press('Enter');
  await focusField(page, 'Date of birth');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 25; i++) await page.keyboard.press('Shift+PageUp');
  await page.keyboard.press('Enter');
  await focusField(page, 'I agree to the Terms of Service and Privacy Policy');
  await page.keyboard.press(' ');
  await solveHumanCheck(page);
  await page.waitForTimeout(2600); // the bot guard requires a minimum fill time

  const [request, response] = await Promise.all([
    page.waitForRequest('**/api/register'),
    page.waitForResponse('**/api/register'),
    (async () => {
      await focusField(page, 'Create account');
      await page.keyboard.press('Enter');
    })(),
  ]);
  const body = JSON.parse(request.postData() ?? '{}');
  // Regression guard: with referrerPolicy 'no-referrer', Safari and Firefox sent `Origin: null`
  // and the server rejected the request (403).
  expect(request.headers()['origin'] ?? 'not exposed').not.toBe('null');
  expect(response.status()).toBe(201);
  expect(body.password).toMatch(/^pfe1\./);
  expect(body.confirmPassword).toMatch(/^pfe1\./);
  expect(body.country).toBe('IN');
  expect(body.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
