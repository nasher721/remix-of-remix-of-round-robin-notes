import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

test.describe("Auth and dashboard", () => {
  test("auth page loads and shows login form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("login redirects to dashboard and dashboard is visible", async ({ page }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for login E2E (real Supabase required)");

    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(E2E_EMAIL!);
    await page.locator("#password").fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page.getByRole("button", { name: /print/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("after login, print/export modal can be opened and shows export", async ({ page }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");

    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(E2E_EMAIL!);
    await page.locator("#password").fill(E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/(\?.*)?$/);
    const printButton = page.getByRole("button", { name: /print/i }).first();
    await expect(printButton).toBeVisible({ timeout: 15_000 });

    await printButton.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/print|export/i).first()).toBeVisible();
  });
});
