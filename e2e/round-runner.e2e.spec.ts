/**
 * Today's Round Focus-first runner E2E
 *
 * Credential-gated (real Supabase). Without credentials, tests skip.
 * Run with:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Round runner"
 *
 * Prefer enabling the runner shell: localStorage rr-round-runner=1 (default ON).
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

async function loginToRoundRunner(page: Page) {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for Round runner E2E");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.locator("#password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);

  // Force Focus-first shell even if a prior classic preference exists.
  await page.evaluate(() => {
    window.localStorage.setItem("rr-round-runner", "1");
  });
  await page.reload();

  await expect(
    page.getByTestId("desktop-round-shell").or(page.getByTestId("mobile-round-shell")),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("Round runner Focus-first path", () => {
  test.beforeEach(async ({ page }) => {
    await loginToRoundRunner(page);
  });

  test("primary chrome has Tools + roster, not demoted megabar utilities", async ({ page }) => {
    const chrome = page.getByTestId("round-chrome");
    await expect(chrome).toBeVisible();
    await expect(chrome.getByTestId("round-tools-entry")).toBeVisible();
    await expect(chrome.getByTestId("round-roster-entry")).toBeVisible();

    await expect(chrome.getByText(/ibcc/i)).toHaveCount(0);
    await expect(chrome.getByRole("button", { name: /compare/i })).toHaveCount(0);

    await chrome.getByTestId("round-tools-entry").click();
    const tools = page.getByTestId("tools-sheet");
    await expect(tools).toBeVisible({ timeout: 5_000 });
    await expect(tools.getByTestId("tools-ai")).toBeVisible();
    await expect(tools.getByTestId("tools-ibcc")).toBeVisible();
    await expect(tools.getByTestId("tools-compare")).toBeVisible();
  });

  test("roster overlay opens and closes without leaving Focus surface", async ({ page }) => {
    const shell = page.getByTestId("desktop-round-shell").or(page.getByTestId("mobile-round-shell"));
    await expect(shell).toHaveAttribute("data-round-surface", /focus|home/);

    // Ensure Focus surface when patients exist.
    const start = page.getByTestId("round-home-start");
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    }

    await expect(page.getByTestId("patient-focus").or(page.getByTestId("patient-focus-empty"))).toBeVisible();

    await page.getByTestId("round-roster-entry").click();
    await expect(page.getByTestId("roster-overlay")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("roster-search")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("roster-overlay")).toBeHidden({ timeout: 5_000 });
  });

  test("walk next/prev/done across roster then reach End print", async ({ page }) => {
    const start = page.getByTestId("round-home-start");
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    }

    const position = page.getByTestId("round-position");
    await expect(position).toBeVisible({ timeout: 15_000 });

    const positionText = (await position.textContent()) ?? "";
    const match = positionText.match(/Round · (\d+)\/(\d+)/);
    test.skip(!match || Number(match[2]) < 3, "Seeded roster needs ≥3 patients for walk path");

    const total = Number(match![2]);
    expect(total).toBeGreaterThanOrEqual(3);

    await page.getByTestId("round-next").click();
    await expect(position).toContainText(`Round · 2/${total}`);

    await page.getByTestId("round-prev").click();
    await expect(position).toContainText(`Round · 1/${total}`);

    await page.getByTestId("round-done").click();
    await expect(position).toContainText(`Round · 2/${total}`);

    await page.getByTestId("round-end-entry").click();
    await expect(page.getByTestId("round-end")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("round-end-print")).toBeVisible();

    await page.getByTestId("round-end-print").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
  });

  test("Round Home keeps Import Patient List first-class", async ({ page }) => {
    const goHome = page.getByTestId("round-go-home");
    if (await goHome.isVisible().catch(() => false)) {
      await goHome.click();
    } else {
      // Already on home when empty, or open via roster.
      await page.getByTestId("round-roster-entry").click();
      const rosterHome = page.getByTestId("roster-go-home");
      if (await rosterHome.isVisible().catch(() => false)) {
        await rosterHome.click();
      }
    }

    await expect(page.getByTestId("round-home")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId("round-home-import")).toBeVisible();
  });
});
