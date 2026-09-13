import { defineConfig, devices } from "@playwright/test";

// Synthetic microphone and attestation fixtures exist only on the dev server.
// Keep these scenarios separate from the authenticated production preview.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /decision-scribe(?:-privacy)?\.e2e\.spec\.ts/,
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5194" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5194 --strictPort",
    url: "http://127.0.0.1:5194/__decision-scribe-test",
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:5194",
      VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-scribe-public-key",
      VITE_PUBLIC_APP_URL: "http://127.0.0.1:5194",
      VITE_SESSION_IDLE_TIMEOUT_SECONDS: "1800",
    },
  },
});
