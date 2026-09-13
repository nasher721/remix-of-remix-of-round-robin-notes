import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_NOTES_PORT ?? "5193";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "continuous-note.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/e2e/notes-harness.html`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: baseURL,
      VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-notes-public-key",
      VITE_PUBLIC_APP_URL: baseURL,
      VITE_SESSION_IDLE_TIMEOUT_SECONDS: "1800",
    },
  },
});
