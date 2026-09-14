import { defineConfig, devices } from "@playwright/test";
const baseURL = "http://127.0.0.1:5194";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "note-composer.spec.ts",
  workers: 1,
  reporter: "list",
  use: { baseURL, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: devices["Desktop Chrome"] }, {
    name: "phone",
    use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
  }, { name: "webkit", use: devices["Desktop Safari"] }],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5194 --strictPort",
    url: `${baseURL}/e2e/composer-harness.html`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: baseURL,
      VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
      VITE_PUBLIC_APP_URL: baseURL,
      VITE_SESSION_IDLE_TIMEOUT_SECONDS: "1800",
    },
  },
});
