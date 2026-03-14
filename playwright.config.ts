import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for Round Robin Notes.
 * Run: npm run test:e2e (or npx playwright test)
 * For login flow, set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (real Supabase required).
 * @see e2e/README.md
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
