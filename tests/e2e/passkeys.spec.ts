import { expect, test } from '@playwright/test';
import { focusField } from './helpers';

// Chrome's virtual authenticator (a software stand-in for Face ID / a security key) via CDP.
test.skip(({ browserName }) => browserName !== 'chromium', 'virtual authenticator is a Chrome DevTools feature');

test('create a passkey, then sign in with it (server verifies both)', async ({ page, browser }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const username = `pk_${Date.now().toString(36)}`;
  await page.goto('/');

  await focusField(page, 'Passkey username');
  await page.keyboard.type(username, { delay: 5 });
  const created = page.waitForResponse((r) => r.url().endsWith('/api/passkey/register/verify'));
  await focusField(page, 'Create a passkey');
  await page.keyboard.press('Enter');
  const reg = await created;
  expect(reg.status()).toBe(201);
  expect((await reg.json()).username).toBe(username);

  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  expect(credentials).toHaveLength(1);
  expect(credentials[0].isResidentCredential).toBe(true);

  // Sign in (a passkey suggestion may also complete it; either way the server must say 200).
  const signedIn = page.waitForResponse((r) => r.url().endsWith('/api/passkey/login/verify') && r.status() === 200);
  await focusField(page, 'Sign in with a passkey');
  await page.keyboard.press('Enter');
  const login = await signedIn;
  expect((await login.json()).message).toContain(username);
  const after = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  // Another browser session can't claim the same username (no attaching passkeys to others' accounts).
  const other = await browser.newContext();
  const stranger = await other.newPage();
  await stranger.goto('/');
  const status = await stranger.evaluate(async (name) => {
    const s = await (await fetch('/api/session')).json();
    const r = await fetch('/api/passkey/register/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrfToken },
      body: JSON.stringify({ username: name }),
    });
    return r.status;
  }, username);
  expect(status).toBe(409);
  await other.close();

  // Each sign-in bumps the counter (the server rejects counters that go backwards). The virtual
  // authenticator also completes the page's passkey-suggestion request on its own, so only check use.
  expect(after.credentials[0].signCount).toBeGreaterThanOrEqual(1);
});
