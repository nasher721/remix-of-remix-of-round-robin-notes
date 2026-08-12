/**
 * Round-runner editing regression: typing in the Focus shell must NOT raise
 * conflict UI. The Focus handlers used to dual-write every keystroke through
 * both updatePatient (revision-guarded) and the draft_field outbox; the two
 * writers raced and each flagged the other as a same-field conflict, popping
 * the Mine/Theirs/merge dialog on nearly every keystroke.
 *
 * Credential-gated (real Supabase). Without credentials, tests skip.
 */

import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

async function loginToRoundRunner(page: Page) {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.locator("#password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);

  // Round runner is default ON; make sure the flag does not disable it.
  await page.evaluate(() => {
    window.localStorage.setItem("rr-round-runner", "1");
  });
  await page.reload();

  await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });
}

test.describe("Round runner editing", () => {
  test("typing in a Focus editor never raises self-conflict UI", async ({ page }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(150_000);

    await loginToRoundRunner(page);

    // The conflict dialog ("Resolve" / Mine-Theirs-merge) and the conflict
    // toast are the two surfaces the bug appeared on.
    const conflictDialog = page.getByRole("dialog").filter({ hasText: /conflict/i });
    const conflictToast = page.getByText(/Save conflict/i);

    // Expand the collapsed Clinical summary section to mount its editor.
    const summaryToggle = page.getByRole("button", { name: /Clinical summary/i }).first();
    if (await summaryToggle.isVisible().catch(() => false)) {
      const expanded = await summaryToggle.getAttribute("aria-expanded");
      if (expanded === "false") await summaryToggle.click();
    }

    const editor = page
      .getByTestId("patient-focus")
      .locator('[contenteditable="true"]')
      .first();
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.click();

    // Type with human-ish pacing so both write paths interleave per keystroke.
    const stamp = `ROUND ${new Date().toISOString()}`;
    for (const ch of ` ${stamp}`) {
      await page.keyboard.type(ch, { delay: 120 });
    }

    // Give the drain loop time to process every queued keystroke write.
    await page.waitForTimeout(6_000);

    await expect(conflictDialog).toHaveCount(0);
    await expect(conflictToast).toHaveCount(0);

    // Truth check: the typed content persists after a reload.
    await page.reload();
    await expect(page.getByTestId("patient-focus")).toBeVisible({ timeout: 20_000 });
    const summaryToggleAfter = page.getByRole("button", { name: /Clinical summary/i }).first();
    if (await summaryToggleAfter.isVisible().catch(() => false)) {
      const expanded = await summaryToggleAfter.getAttribute("aria-expanded");
      if (expanded === "false") await summaryToggleAfter.click();
    }
    await expect(
      page.getByTestId("patient-focus").locator('[contenteditable="true"]').first(),
    ).toContainText(stamp, { timeout: 15_000 });
  });
});
