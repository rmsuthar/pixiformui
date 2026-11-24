import { expect, test } from '@playwright/test';
import { focusField, mountElement, pageContains, proxy } from './helpers';

// mountElement() builds the config from a string with new Function(); Firefox applies the page CSP
// to test scripts too, so this spec bypasses it.
test.use({ bypassCSP: true });

test.beforeEach(async ({ page }) => {
  await mountElement(
    page,
    `{ fields: [
      { type: 'email', name: 'email', label: 'Email', autocomplete: 'email' },
      { type: 'password', name: 'password', label: 'Password', autocomplete: 'current-password' },
      { type: 'text', name: 'note', label: 'Note' },
    ], onSubmit: () => ({ ok: true }) }`,
  );
});

test('opted-in fields expose their autocomplete token; others stay hidden from password managers', async ({ page }) => {
  await focusField(page, 'Email', '#f');
  const p = proxy(page);
  await expect(p).toHaveAttribute('autocomplete', 'email');
  await expect(p).toHaveAttribute('name', 'email');
  await expect(p).not.toHaveAttribute('data-lpignore', 'true');
  expect(await p.evaluate((el: HTMLInputElement) => el.getBoundingClientRect().width)).toBeGreaterThan(100); // suggestions line up with the field

  await focusField(page, 'Password', '#f');
  await expect(p).toHaveAttribute('autocomplete', 'current-password');
  await expect(p).toHaveAttribute('type', 'password');

  await focusField(page, 'Note', '#f');
  await expect(p).toHaveAttribute('autocomplete', 'off');
  await expect(p).toHaveAttribute('data-lpignore', 'true');
  await expect(p).not.toHaveAttribute('name', /.+/);
});

test('an autofill suggestion replaces the value and leaves nothing in the DOM', async ({ page, browserName }) => {
  // In Firefox, Playwright's fill() inserts without replacing the input's content, so it doesn't
  // imitate autofill there (real Firefox autofill sends inputType 'insertReplacementText', handled explicitly).
  test.skip(browserName === 'firefox', "Playwright's fill() doesn't imitate autofill in Firefox");
  await focusField(page, 'Email', '#f');
  await page.keyboard.type('old@', { delay: 5 });
  // Like browser autofill, fill() replaces the input's whole value in one trusted edit.
  await proxy(page).fill('ada@example.com');
  await expect.poll(() => page.evaluate(() => (document.getElementById('f') as any).values().email)).toBe('ada@example.com');
  expect(await proxy(page).inputValue()).toBe('​');
  expect(await pageContains(page, 'ada@example.com')).toBe(false);

  await focusField(page, 'Password', '#f');
  await proxy(page).fill('Manager-Generated-Pass-123!');
  await expect.poll(() => page.evaluate(() => (document.getElementById('f') as any).values().password.length)).toBe(27);
  expect(await pageContains(page, 'Manager-Generated')).toBe(false);
});
