/**
 * Shared E2E helpers. All specs here run against one real Supabase account,
 * so they share login flow and must agree on which shell is active: the
 * Focus-first Round runner is default ON, while older specs assert classic
 * dashboard chrome.
 */

import { test, expect, type Page } from "@playwright/test";

export const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
export const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
export const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

export function requireCredentials() {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
}

/**
 * Log in and land on the app with the requested shell.
 * roundRunner=true keeps the Focus-first shell; false pins the classic
 * dashboard via the rr-round-runner localStorage flag.
 */
export async function loginWithShell(page: Page, options: { roundRunner: boolean }) {
  requireCredentials();

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.locator("#password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);

  await page.evaluate((roundRunner) => {
    window.localStorage.setItem("rr-round-runner", roundRunner ? "1" : "0");
  }, options.roundRunner);
  await page.reload();

  if (options.roundRunner) {
    await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });
  } else {
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
  }
}
