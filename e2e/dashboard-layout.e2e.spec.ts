/**
 * Dashboard Layout E2E Tests
 *
 * Credential-gated because the authenticated workspace renders from `/`.
 * Run with: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Dashboard"
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

async function loginToDashboard(page: Page) {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for dashboard E2E");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.locator("#password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });
}

test.describe("Dashboard Panel Collapse", () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test("collapse and expand panel controls update shell state", async ({ page }) => {
    const dashboard = page.getByTestId("dashboard");
    await expect(dashboard).toHaveAttribute("data-left-panel-collapsed", "false");

    await page.getByRole("button", { name: /collapse patient list/i }).click();
    await expect(dashboard).toHaveAttribute("data-left-panel-collapsed", "true");

    await page.getByRole("button", { name: /expand patient list/i }).click();
    await expect(dashboard).toHaveAttribute("data-left-panel-collapsed", "false");
  });

  test("panel state persists after reload", async ({ page }) => {
    await page.getByRole("button", { name: /collapse patient list/i }).click();
    await expect(page.getByTestId("dashboard")).toHaveAttribute("data-left-panel-collapsed", "true");

    await page.reload();
    await expect(page.getByTestId("dashboard")).toHaveAttribute("data-left-panel-collapsed", "true");
  });
});

test.describe("Focus Mode", () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test("clicking clinical summary enters focus mode and Escape exits", async ({ page }) => {
    const dashboard = page.getByTestId("dashboard");
    await page.locator('[data-editor-type="clinical-summary"]').first().click();

    await expect(dashboard).toHaveAttribute("data-focus-mode", "true");

    await page.keyboard.press("Escape");
    await expect(dashboard).toHaveAttribute("data-focus-mode", "false");
  });
});

test.describe("Dashboard Controls", () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test("core command surfaces remain reachable", async ({ page }) => {
    await expect(page.getByLabel(/search patients/i)).toBeVisible();

    await page.getByRole("button", { name: /filter and sort patients/i }).click();
    await expect(page.getByRole("menuitemradio", { name: /with notes/i })).toBeVisible();

    await page.getByRole("button", { name: /open workspace tools/i }).click();
    await expect(page.getByRole("tab", { name: /resources/i })).toBeVisible();

    await page.getByRole("button", { name: /print/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  });
});
