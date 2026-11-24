import { expect, test } from '@playwright/test';
import { focusField, proxy } from './helpers';

test('accessibility outline exposes structure, names and states (no values)', async ({ page }) => {
  await page.goto('/');
  const outline = page.locator('.pixiform-a11y').first();
  await expect(outline).toHaveAttribute('role', 'form');
  await expect(outline).toHaveAttribute('aria-label', 'Create your account');
  await expect(outline.locator('h2').first()).toHaveText('Create your account');
  await expect(outline.locator('[role=group]').filter({ has: page.locator('span:text-is("Account")') })).toHaveCount(1);
  const email = outline.locator('[role=textbox][aria-label="Email"]');
  await expect(email).toHaveAttribute('aria-required', 'true');
  await expect(outline.locator('[role=button][aria-label="Plan & preferences"]')).toHaveAttribute('aria-expanded', 'false');
});

test('errors are linked to fields with aria-errormessage', async ({ page }) => {
  await page.goto('/');
  await focusField(page, 'Password');
  await page.keyboard.type('a', { delay: 5 });
  await focusField(page, 'Confirm password');
  await page.keyboard.type('b', { delay: 5 });
  await page.keyboard.press('Tab');
  await focusField(page, 'Confirm password');
  const p = proxy(page);
  await expect(p).toHaveAttribute('aria-invalid', 'true');
  const errorId = await p.getAttribute('aria-errormessage');
  expect(errorId).toBeTruthy();
  await expect(page.locator(`#${errorId}`)).toHaveText(/match/i);
});

test('Tab order follows the screen and skips folded groups', async ({ page }) => {
  await page.goto('/');
  await focusField(page, 'Date of birth');
  await page.keyboard.press('Tab');
  await expect(proxy(page)).toHaveAttribute('aria-label', /^Onboarding call/);
  await page.keyboard.press('Tab');
  await expect(proxy(page)).toHaveAttribute('aria-label', 'Plan & preferences');
  await page.keyboard.press('Tab');
  await expect(proxy(page)).toHaveAttribute('aria-label', /^I agree/);
});
