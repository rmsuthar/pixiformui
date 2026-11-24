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
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8787/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
