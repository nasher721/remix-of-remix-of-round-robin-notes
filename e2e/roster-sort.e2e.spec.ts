/**
 * Roster Sort Order E2E Tests
 *
 * Credential-gated because the authenticated workspace renders from `/`.
 * Run with: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Roster sort"
 *
 * Asserts the PatientRosterRail sort dropdown actually re-orders the rendered
 * patient rows. Seeded e2e roster (patient_number / name / bed):
 *   1 · E2E Test Patient One    · T-01
 *   2 · Zebra Test Patient Two  · T-02
 *   3 · Alpha Test Patient Three · A-15
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

const BY_ROOM = ["Alpha Test Patient Three", "E2E Test Patient One", "Zebra Test Patient Two"]; // A-15 < T-01 < T-02 (app default: DEFAULT_SORT_BY = 'room')
const ORDER_ADDED = ["E2E Test Patient One", "Zebra Test Patient Two", "Alpha Test Patient Three"];
const BY_NAME = ["Alpha Test Patient Three", "E2E Test Patient One", "Zebra Test Patient Two"];

async function loginToDashboard(page: Page) {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for dashboard E2E");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.locator("#password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15_000 });
}

/** Visible roster row names, top to bottom (robust to virtualization). */
async function visibleRosterNames(page: Page): Promise<string[]> {
  const rows = page.locator('aside[aria-label="Patient list"] button[aria-label^="Select "]');
  const labels = await rows.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("aria-label") ?? ""),
  );
  return labels.map((label) => label.replace(/^Select /, "").split(",")[0].trim());
}

async function chooseSort(page: Page, option: string) {
  await page.getByRole("button", { name: /filter and sort patients/i }).click();
  await page.getByRole("menuitemradio", { name: option }).click();
}

test.describe("Roster sort order", () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
    // Wait for the seeded roster to load before asserting order.
    await expect(
      page.locator('aside[aria-label="Patient list"] button[aria-label^="Select "]'),
    ).toHaveCount(3, { timeout: 15_000 });
  });

  test("default order is by room; sorting by order-added and name re-orders rows", async ({ page }) => {
    // App default sort is 'room' (DEFAULT_SORT_BY in src/constants/config.ts).
    expect(await visibleRosterNames(page)).toEqual(BY_ROOM);

    await chooseSort(page, "Order added");
    await expect.poll(() => visibleRosterNames(page)).toEqual(ORDER_ADDED);

    await chooseSort(page, "Name");
    await expect.poll(() => visibleRosterNames(page)).toEqual(BY_NAME);

    // Restore the default so persisted prefs can't leak into other specs.
    await chooseSort(page, "Room");
    await expect.poll(() => visibleRosterNames(page)).toEqual(BY_ROOM);
  });
});
