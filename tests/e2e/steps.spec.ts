import { expect, test } from '@playwright/test';
import { focusField } from './helpers';

// Multi-step forms (config.steps): one screen per step, Next checks only that step, one submit at the end.
test('steps: progress, per-step checks, Back, Enter as Next, a conditional step, one submit with everything', async ({ page }) => {
  await page.goto('/tests/e2e/pages/steps.html');
  const tree = page.locator('.pixiform-a11y');
  const heading = () => tree.getByRole('heading', { name: /^Step/ });
  await expect(heading()).toHaveText('Step 1 of 2: About you'); // the business step is skipped for "Personal"
  await expect(tree.locator('[aria-label^="Email"]')).toHaveCount(0); // other steps aren't in the outline
  await expect(tree.locator('[aria-label="Back"]')).toHaveCount(0);
  await expect(tree.locator('[aria-label="Submit"]')).toHaveCount(0);

  // Next checks this step only.
  await focusField(page, 'Next');
  await page.keyboard.press('Enter');
  await expect(tree.getByText('Full name is required.').first()).toBeAttached();
  await expect(heading()).toHaveText('Step 1 of 2: About you');

  // Choosing "Business" adds the conditional step.
  await focusField(page, 'Account type');
  await page.keyboard.press('ArrowDown');
  await expect(heading()).toHaveText('Step 1 of 3: About you');
  await focusField(page, 'Full name');
  await page.keyboard.type('Ada Lovelace', { delay: 5 });
  if (process.env.SHOTS) await page.locator('#f').screenshot({ path: `${process.env.SHOTS}/steps-1.png` });
  await focusField(page, 'Next');
  await page.keyboard.press('Enter');
  await expect(heading()).toHaveText('Step 2 of 3: Your business');
  await expect(page.locator('input[aria-label]').first()).toHaveAttribute('aria-label', /^Company name/); // focus moved to the step

  // Enter on the step's last field acts as Next (after its check passes).
  await page.keyboard.type('Analytical Engines Ltd', { delay: 5 });
  await page.keyboard.press('Enter');
  await expect(heading()).toHaveText('Step 3 of 3: Contact');
  await expect(tree.locator('[aria-label="Next"]')).toHaveCount(0);
  await expect(tree.locator('[aria-label="Submit"]')).toHaveCount(1);

  // Back keeps what was typed.
  await focusField(page, 'Back');
  await page.keyboard.press('Enter');
  await expect(heading()).toHaveText('Step 2 of 3: Your business');
  expect(await page.evaluate(() => (window as any).__handle.values().company)).toBe('Analytical Engines Ltd');
  await page.evaluate(() => (window as any).__handle.goToStep(2));
  await expect(heading()).toHaveText('Step 3 of 3: Contact');

  // Submit sends every step's values at once.
  await focusField(page, 'Email');
  await page.keyboard.type('ada@example.com', { delay: 5 });
  if (process.env.SHOTS) await page.locator('#f').screenshot({ path: `${process.env.SHOTS}/steps-3.png` });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__submitted)).toEqual({ name: 'Ada Lovelace', kind: 'business', company: 'Analytical Engines Ltd', email: 'ada@example.com' });
  const steps = await page.evaluate(() => (window as any).__steps);
  expect(steps.map((s: { index: number; count: number }) => `${s.index + 1}/${s.count}`)).toEqual(['2/3', '3/3', '2/3', '3/3']);
});

test('steps: a skipped step isn’t submitted; a problem on an earlier step brings it back on submit', async ({ page }) => {
  await page.goto('/tests/e2e/pages/steps.html');
  const tree = page.locator('.pixiform-a11y');
  // Personal: the business step is skipped, its field not validated or submitted.
  await focusField(page, 'Full name');
  await page.keyboard.type('Grace', { delay: 5 });
  await page.keyboard.press('Enter'); // next field (Account type)
  await focusField(page, 'Next');
  await page.keyboard.press('Enter');
  await expect(tree.getByRole('heading', { name: /^Step/ })).toHaveText('Step 2 of 2: Contact');
  // Clear step 1 from code, then submit: the form returns to step 1 with the problem focused.
  await page.evaluate(() => (window as any).__handle.form.setValues({ name: '' }));
  await focusField(page, 'Email');
  await page.keyboard.type('grace@example.com', { delay: 5 });
  await focusField(page, 'Submit');
  await page.keyboard.press('Enter');
  await expect(tree.getByRole('heading', { name: /^Step/ })).toHaveText('Step 1 of 2: About you');
  await expect(page.locator('input[aria-label]').first()).toHaveAttribute('aria-label', /^Full name/);
  await page.keyboard.type('Grace Hopper', { delay: 5 });
  await focusField(page, 'Next');
  await page.keyboard.press('Enter');
  await focusField(page, 'Submit');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__submitted)).toEqual({ name: 'Grace Hopper', kind: 'personal', email: 'grace@example.com' });
});
