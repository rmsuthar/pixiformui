import { expect, test } from '@playwright/test';

// Server-enforced bot defences (the browser-side bot guard can be skipped by calling the API directly).
test('sending a code without a valid form proof is refused; with one it works once', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const s = await (await fetch('/api/session')).json();
    const send = (proof?: string) =>
      fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrfToken, ...(proof ? { 'X-Form-Proof': proof } : {}) }, body: '{}' });
    const none = await send();
    const forged = await send(`${s.pow.challenge}:1`);
    const path = '/src/lib/index.ts';
    const { FormProof } = await import(/* @vite-ignore */ path);
    const started = performance.now();
    const token = await new FormProof(s.pow).token();
    const solveMs = Math.round(performance.now() - started);
    const ok = await send(token);
    const reused = await send(token); // a proof is good for one successful use
    return { difficulty: s.pow.difficulty, none: none.status, forged: forged.status, ok: ok.status, newChallenge: (await ok.json()).pow?.challenge !== s.pow.challenge, reused: reused.status, solveMs };
  });
  expect(r.difficulty).toBeGreaterThan(0);
  expect(r.none).toBe(400);
  expect(r.forged).toBe(400);
  expect(r.ok).toBe(200);
  expect(r.newChallenge).toBe(true);
  expect(r.reused).toBe(400);
  console.log(`form proof (difficulty ${r.difficulty}) solved in ${r.solveMs} ms`);
});

test('a registration sent too soon after the page loads is refused by the server', async ({ page }) => {
  await page.goto('/');
  const status = await page.evaluate(async () => {
    const s = await (await fetch('/api/session', { cache: 'no-store' })).json();
    // A fresh session (cookie cleared) gets a new issue time; post immediately.
    return s.pow ? 'has-session' : 'no-pow';
  });
  expect(status).toBe('has-session');
  // New browser context: brand-new session, then an instant submit.
  const ctx = await page.context().browser()!.newContext();
  const p = await ctx.newPage();
  await p.goto('/');
  const r = await p.evaluate(async () => {
    const s = await (await fetch('/api/session')).json();
    const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrfToken }, body: '{}' });
    return { status: res.status, message: (await res.json()).message };
  });
  await ctx.close();
  expect(r.status).toBe(400);
  expect(r.message).toMatch(/too quickly|Security check/);
});
