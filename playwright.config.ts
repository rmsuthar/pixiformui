import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests (npm run test:e2e). They start the reference server (npm run dev) and drive
 * the forms the way people and assistive technology do: through the accessibility outline
 * and the keyboard.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'retain-on-failure',
  },
  // Chromium (Chrome/Edge), WebKit (Safari, including every iPhone browser) and Firefox.
  projects: [
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npm run dev',
    // Many test pages from one IP: raise the server's rate limits (ignored in production).
    env: { RATE_LIMIT_SCALE: '50' },
    url: 'http://localhost:8787/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
