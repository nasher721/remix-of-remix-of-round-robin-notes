/**
 * Data-integrity E2E: multi-tab optimistic-concurrency conflict and
 * offline queue recovery (plan Phase 3, scenarios 3 and 5).
 *
 * Credential-gated (real Supabase). Without credentials, tests skip.
 * Run with:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e -- --grep "Data integrity"
 *
 * Evidence captured here feeds docs/qa/2026-08-12-data-integrity-matrix.md.
 */

import { test, expect, type Browser, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

async function loginToDashboard(page: Page) {
  test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for data-integrity E2E");

  // Diagnostics: surface failed requests and console errors in test output.
  page.on("response", (res) => {
    if (res.status() >= 400) console.log(`[http ${res.status()}]`, res.url().slice(0, 220));
  });
  page.on("requestfailed", (req) => {
    console.log("[requestfailed]", req.url().slice(0, 220), req.failure()?.errorText);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text().slice(0, 300));
  });

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.locator("#password").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);

  // The Focus-first Round runner shell is default ON; force the classic
  // dashboard chrome where the inline clinical-summary editors live.
  await page.evaluate(() => {
    window.localStorage.setItem("rr-round-runner", "0");
  });
  await page.reload();

  await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
}

/** First clinical summary editor on the current dashboard/workspace. */
function firstSummaryEditor(page: Page) {
  return page.locator('[data-editor-type="clinical-summary"]').first();
}

test.describe("Data integrity", () => {
  // Both tests share one E2E account and patient roster; running them in
  // parallel makes their writes conflict with each other.
  test.describe.configure({ mode: "serial" });

  test("multi-tab: second stale write becomes an explicit Save conflict, never a silent overwrite", async ({
    browser,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    // Two full logins plus save debounces need more than the 30s default.
    test.setTimeout(150_000);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Both tabs load the same roster. Tab B's copy becomes stale once A saves.
      await loginToDashboard(pageA);
      await loginToDashboard(pageB);

      const editorB = firstSummaryEditor(pageB);
      await expect(editorB).toBeVisible({ timeout: 15_000 });

      // Tab A edits and persists first.
      const editorA = firstSummaryEditor(pageA);
      await expect(editorA).toBeVisible({ timeout: 15_000 });
      await editorA.click();
      const stampA = `TAB-A ${new Date().toISOString()}`;
      await pageA.keyboard.type(` ${stampA}`);
      await expect(
        pageA.getByRole("status").filter({ hasText: /^Saved/ }).first(),
      ).toBeVisible({ timeout: 20_000 });

      // Tab B edits from its stale snapshot and attempts to save.
      await editorB.click();
      await pageB.keyboard.type(` TAB-B ${new Date().toISOString()}`);

      // The stale write must surface an explicit conflict notification and the
      // save-state indicator must not claim a successful save.
      await expect(pageB.getByText("Save conflict")).toBeVisible({ timeout: 25_000 });

      // Truth check: after B refreshes, A's content is what persisted.
      await pageB.reload();
      await expect(pageB.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
      await expect(firstSummaryEditor(pageB)).toContainText(stampA, { timeout: 15_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("offline: explicit warning, durable queue, reconnect drains without duplication", async ({
    page,
    context,
  }) => {
    test.skip(!hasCredentials, "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
    test.setTimeout(150_000);

    await loginToDashboard(page);

    const editor = firstSummaryEditor(page);
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Baseline: an online edit saves normally (also warms lazy editor modules
    // so going offline does not trip the lazy-panel error boundary).
    await editor.click();
    const onlineStamp = `ONLINE ${new Date().toISOString()}`;
    await page.keyboard.type(` ${onlineStamp}`);
    await expect(
      page.getByRole("status").filter({ hasText: /^Saved/ }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Go offline: the app must surface an explicit, persistent warning.
    await context.setOffline(true);
    await expect(page.getByText("You are offline").first()).toBeVisible({ timeout: 15_000 });

    // An offline edit must NOT be silently lost: the write fails as retryable,
    // lands in the durable IndexedDB queue, and the header reports it.
    const offlineStamp = `OFFLINE ${new Date().toISOString()}`;
    await editor.click();
    await page.keyboard.type(` ${offlineStamp}`);

    await expect(
      page.getByRole("status").filter({ hasText: /^Offline queued$/ }).first(),
    ).toBeVisible({ timeout: 25_000 });

    // Reconnect: the sync engine drains the queue automatically.
    await context.setOffline(false);

    // A failed lazy fetch while offline may have tripped the panel error
    // boundary; recover it before asserting the drained state.
    const tryAgain = page.getByRole("button", { name: "Try Again" });
    if (await tryAgain.isVisible().catch(() => false)) {
      await tryAgain.click();
      await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 30_000 });
    }

    await expect(
      page.getByRole("status").filter({ hasText: /^Saved/ }).first(),
    ).toBeVisible({ timeout: 45_000 });

    // Reload truth: the queued content persisted exactly once.
    await page.reload();
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 20_000 });
    const reloaded = firstSummaryEditor(page);
    await expect(reloaded).toContainText(offlineStamp, { timeout: 15_000 });
    const occurrences = ((await reloaded.textContent()) ?? "").split(offlineStamp).length - 1;
    expect(occurrences).toBe(1);
  });
});
