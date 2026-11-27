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

/** Simulates leaving the page (another tab) and coming back, as the browser reports it. */
async function leaveAndReturn(page: Page, awayMs = 50) {
  await page.evaluate(async (ms) => {
    const set = (v: string) => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
    window.dispatchEvent(new Event('blur'));
    set('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, ms));
    set('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  }, awayMs);
}

test('exam integrity: rule breaks are logged with reasons and times, warned, and end the exam at the limit', async ({ page, browserName, context }) => {
  await page.goto('/tests/e2e/pages/exam.html?rules');
  await focusField(page, 'Your answer');
  await page.keyboard.press('ArrowDown'); // q1 = 'b'

  // 1. Left the tab for a while: one rule break, its length recorded, a warning.
  await leaveAndReturn(page, 300);
  await expect(page.locator('body').getByText('You left the exam tab. 1 of 3 allowed.').first()).toBeAttached();

  // 2. Pasting is blocked (and counted); a burst of text is a signal, not a rule break.
  await page.evaluate(() => (window as any).__exam.handle.goToStep(3));
  await expect(heading(page)).toHaveText(/^Question 4 of 4/); // the outline has moved to the new question
  await focusField(page, 'Your answer');
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => navigator.clipboard.writeText('An answer pasted from a chatbot.'));
    await page.keyboard.press('ControlOrMeta+V');
    await expect(page.locator('body').getByText('Pasting isn’t allowed. 2 of 3 allowed.').first()).toBeAttached();
    expect(await page.evaluate(() => (window as any).__exam.handle.values().q4)).toBe('');
  } else await leaveAndReturn(page); // the second rule break another way
  await page.evaluate(() => (window as any).__exam.handle.get('q4').setValue('x'.repeat(60)));

  // 3. The third rule break submits the answers and locks the exam.
  await leaveAndReturn(page);
  await expect.poll(() => page.evaluate(() => (window as any).__submitted)).not.toBeNull();
  expect(await page.evaluate(() => (window as any).__exam.handle.form.locked)).toBe(true);
  const report = JSON.parse((await page.evaluate(() => (window as any).__submitted)).examReport);
  expect(report.endedBy).toBe('violations');
  expect(report.integrity.violations).toBe(3);
  expect(report.integrity.counts).toEqual(browserName === 'chromium' ? { 'tab-hidden': 2, paste: 1, 'typing-burst': 1 } : { 'tab-hidden': 3, 'typing-burst': 1 });
  const first = report.integrity.events[0];
  expect(first.type).toBe('tab-hidden');
  expect(first.ms).toBeGreaterThanOrEqual(250);
  if (browserName === 'chromium') expect(report.integrity.events.find((e: { type: string }) => e.type === 'paste').size).toBe(32);
  expect(JSON.stringify(report)).not.toContain('chatbot'); // never the pasted text
});
