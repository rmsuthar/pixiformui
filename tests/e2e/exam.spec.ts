import { expect, test, type Page } from '@playwright/test';
import { focusField } from './helpers';

// pixiformui/exam: one question per screen, navigator, mark for review, unanswered warning, report, timer.
const heading = (page: Page) => page.locator('.pixiform-a11y').getByRole('heading', { name: /^Question/ });
const values = (page: Page) => page.evaluate(() => (window as any).__submitted);

test('exam: answer, navigate, mark for review, warning before finishing, answers + report submitted', async ({ page }) => {
  await page.goto('/tests/e2e/pages/exam.html');
  const tree = page.locator('.pixiform-a11y');
  await expect(heading(page)).toHaveText('Question 1 of 4: Which planet is the largest?');
  await expect(tree.locator('[aria-label^="Go to question 1 of 4"]')).toBeAttached();
  await expect(page.locator('#f canvas')).toBeVisible();
  expect(await page.evaluate(() => document.body.innerText.includes('Jupiter'))).toBe(false); // options aren't page text

  // Answer question 1 (Jupiter = 'b'), then Next.
  await focusField(page, 'Your answer');
  await page.keyboard.press('ArrowDown');
  await focusField(page, 'Next question');
  await page.keyboard.press('Enter');
  await expect(heading(page)).toHaveText('Question 2 of 4: Which is closest to the Sun?');

  // Mark question 2 for review and skip it with the navigator (go to question 4).
  await focusField(page, 'Mark for review');
  await page.keyboard.press(' ');
  const nav = tree.locator('[aria-label^="Go to question"]');
  await expect(nav).toHaveAccessibleDescription(/1 of 4 answered, 1 marked for review/);
  await nav.evaluate((el: HTMLElement) => el.focus()); // its label carries the position, e.g. “Go to question 2 of 4 (…)”
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(nav).toHaveAttribute('aria-label', 'Go to question 4 of 4 (not answered)');
  await page.keyboard.press('Enter');
  await expect(heading(page)).toHaveText('Question 4 of 4: In one sentence: why do we have seasons?');
  if (process.env.SHOTS) await page.locator('#f').screenshot({ path: `${process.env.SHOTS}/exam.png` });

  await focusField(page, 'Your answer');
  await page.keyboard.type('The tilt of the Earth’s axis.', { delay: 2 });
  // Finishing with 2 unanswered questions asks once; the second press submits.
  await focusField(page, 'Finish exam');
  await page.keyboard.press('Enter');
  await expect(page.locator('.pixiform-a11y, body').getByText(/2 questions are unanswered/).first()).toBeAttached();
  expect(await values(page)).toBeNull();
  await page.keyboard.press('Enter');
  await expect.poll(() => values(page)).not.toBeNull();
  const v = await values(page);
  expect([v.q1, v.q2, v.q3, v.q4]).toEqual(['b', null, null, 'The tilt of the Earth’s axis.']);
  const report = JSON.parse(v.examReport);
  expect(report).toMatchObject({ marked: ['q2'], timedOut: false, focusLost: 0 });
  expect(report.timeTakenMs).toBeGreaterThan(0);
  expect(Object.keys(v)).not.toContain('examNavigator');
  expect(Object.keys(v)).not.toContain('examMarkForReview');
});

test('exam: no going back hides Back and the navigator', async ({ page }) => {
  await page.goto('/tests/e2e/pages/exam.html?noback');
  const tree = page.locator('.pixiform-a11y');
  await expect(tree.locator('[aria-label^="Go to question"]')).toHaveCount(0);
  await focusField(page, 'Next question');
  await page.keyboard.press('Enter');
  await expect(heading(page)).toHaveText(/^Question 2 of 4/);
  await expect(tree.locator('[aria-label="Back"]')).toHaveCount(0);
});

test('exam: when time is up the answers are submitted and the form locks', async ({ page }) => {
  await page.goto('/tests/e2e/pages/exam.html?seconds=4');
  await focusField(page, 'Your answer');
  await page.keyboard.press('ArrowDown'); // q1 = 'b'
  await expect.poll(() => page.evaluate(() => (window as any).__timeUp), { timeout: 10_000 }).toBe(true);
  const v = await values(page);
  expect(v.q1).toBe('b');
  expect(JSON.parse(v.examReport).timedOut).toBe(true);
  expect(await page.evaluate(() => (window as any).__exam.handle.form.locked)).toBe(true);
});
