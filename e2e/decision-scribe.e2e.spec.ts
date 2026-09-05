import { expect, test } from "@playwright/test";
test.describe("Decision Scribe synthetic release journey", () => {
  test("consent, capture, transcript extraction, edit/reject/evidence, and attestation", async ({ page }) => {
    await page.goto("/__decision-scribe-test");
    await page.getByTestId("decision-scribe-harness").waitFor();
    await page.getByLabel("I consent to microphone capture for this Round and patient.").check();
    await page.getByLabel(/I acknowledge that this recording is limited/).check();
    await page.getByLabel(/I acknowledge my institution's Decision Scribe/).check();
    await page.getByRole("button", { name: "Start capture" }).click();
    await page.getByRole("button", { name: "Stop and review" }).click();
    await expect(page.getByTestId("decision-review")).toBeVisible();
    const medicationRow = page.getByTestId("decision-draft-row").filter({ hasText: "medication" });
    await medicationRow.getByRole("button", { name: "Edit" }).click();
    // Keep the candidate explicitly affirmed after editing; attestation must
    // never silently promote a merely proposed/uncertain statement.
    await page.getByRole("textbox", { name: "Edit proposed decision" }).fill("We will continue the medication at the current dose");
    await page.getByRole("button", { name: "Save edit" }).click();
    await page.getByRole("button", { name: "Evidence" }).first().click();
    await expect(page.getByText(/continue the medication/i).first()).toBeVisible();
    await page.getByTestId("decision-draft-row").filter({ hasText: "radiology" }).getByRole("button", { name: "Reject" }).click();
    await page.getByRole("button", { name: /attest and apply approved changes/i }).click();
    await expect(page.getByText("Attested 1 synthetic changes", { exact: true })).toBeVisible();
  });

  test("patient switch boundary leaves no cross-patient scribe state", async ({ page }) => {
    await page.goto("/__decision-scribe-test");
    const state = await page.evaluate(async () => ({
      localStorage: JSON.stringify(localStorage),
      indexedDbNames: typeof indexedDB.databases === "function" ? (await indexedDB.databases()).map((db) => db.name ?? "") : [],
    }));
    expect(state.localStorage).not.toMatch(/SYNTH-A|raw|transcript|audio/i);
    expect(state.indexedDbNames.join(" ")).not.toMatch(/audio|transcript|scribe/i);
    await expect(page.getByRole("status", { name: "Decision Scribe status: Ready" })).toBeVisible();
  });
});
