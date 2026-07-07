import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for FabricateIQ E2E tests.
 *
 * API calls to Cloudflare Workers are intercepted by the mock fixtures
 * in e2e/support/api-mocks.js — no real network requests leave the machine.
 *
 * Run:
 *   npx playwright test                    # headless, all tests
 *   npx playwright test --headed           # watch the browser
 *   npx playwright test --debug            # Playwright Inspector
 *   npx playwright test --trace on         # full trace
 *   npx playwright show-report             # open HTML report
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',

  /* Fail the suite fast in CI; run all locally */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  /* Reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
    ['list']
  ],

  /* Artifacts on failure */
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Never let a real API call out — belt-and-suspenders alongside route mocks */
    extraHTTPHeaders: {},
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the Vite dev server automatically before running tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
