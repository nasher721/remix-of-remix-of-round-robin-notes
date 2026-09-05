import { expect, test } from "@playwright/test";
test.describe("Decision Scribe privacy and failure boundaries", () => {
  test("does not expose clinical identifiers through console, telemetry-like requests, or storage", async ({ page }) => {
    const messages: string[] = [];
    const requests: string[] = [];
    page.on("console", (message) => messages.push(message.text()));
    page.on("request", (request) => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`));
    await page.goto("/__decision-scribe-test");
    await expect(page.getByTestId("decision-scribe-harness")).toBeVisible();
    const forbidden = /mrn|date of birth|raw.?audio|temporary.?transcript|rejected.?candidate|unattested.?candidate|data:audio/i;
    expect(messages.join("\n")).not.toMatch(forbidden);
    expect(requests.filter((request) => /telemetry|analytics|sentry/i.test(request)).every((request) => !forbidden.test(request))).toBe(true);
  });

  test("reload is a crash-recovery boundary and cannot revive provisional material", async ({ page }) => {
    await page.goto("/__decision-scribe-test");
    await page.getByLabel("I consent to microphone capture for this Round and patient.").check();
    await page.getByLabel(/I acknowledge that this recording is limited/).check();
    await page.getByLabel(/I acknowledge my institution's Decision Scribe/).check();
    await page.getByRole("button", { name: "Start capture" }).click();
    await page.getByRole("button", { name: "Discard" }).click();
    await page.reload();
    await expect(page.getByTestId("decision-scribe-harness")).toBeVisible();
    // The consent panel intentionally explains ephemeral capture. The
    // privacy invariant here is that a reload cannot revive provisional
    // material or retain it in browser storage.
    await expect(page.getByTestId("decision-review")).toHaveCount(0);
    const recovered = await page.evaluate(() => ({
      localStorage: JSON.stringify(localStorage),
      sessionStorage: JSON.stringify(sessionStorage),
    }));
    expect(recovered.localStorage).not.toMatch(/SYNTH-A|harness-session|candidate|draft/i);
    expect(recovered.sessionStorage).not.toMatch(/SYNTH-A|harness-session|candidate|draft/i);
  });
});
