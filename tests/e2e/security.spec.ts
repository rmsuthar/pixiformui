import { expect, test } from '@playwright/test';
import { focusField, pageContains, proxy } from './helpers';

test.describe('values never enter the DOM', () => {
  test('typed text and passwords stay out of the page', async ({ page }) => {
    await page.goto('/');
    await focusField(page, 'Full name');
    await page.keyboard.type('Zyxwvu Qrstpo', { delay: 5 });
    await focusField(page, 'Password');
    await expect(proxy(page)).toHaveAttribute('type', 'password');
    await page.keyboard.type('Tr0ub4dor&Horse!', { delay: 5 });
    expect(await pageContains(page, 'Zyxwvu')).toBe(false);
    expect(await pageContains(page, 'Tr0ub4dor')).toBe(false);
    // The relay input is reset after every keystroke (only a zero-width placeholder remains).
    expect(await proxy(page).inputValue()).toBe('​');
  });

  test('untrusted (scripted) input is ignored', async ({ page }) => {
    await page.goto('/');
    await focusField(page, 'Full name');
    await proxy(page).evaluate((el: HTMLInputElement) => {
      el.value = 'injected';
      el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 'injected', bubbles: true }));
    });
    await page.keyboard.press('Tab');
    expect(await pageContains(page, 'injected')).toBe(false);
    await focusField(page, 'Full name');
    await expect(proxy(page)).toHaveAttribute('aria-invalid', 'true'); // still empty → required error
  });
});
