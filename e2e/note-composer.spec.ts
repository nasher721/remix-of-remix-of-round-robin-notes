import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/e2e/composer-harness.html");
  await expect(page.getByRole("textbox", { name: "Clinical summary" }))
    .toBeVisible();
});
test("manual editing, exact clipboard, save round trip and unrelated chart preservation", async ({ page, browserName }) => {
  const note = "68F w hemorrhage\nTherapy 750->1000 mg\nKeep exact timing q8h";
  await page.getByRole("textbox", { name: "Clinical summary" }).fill(note);
  await page.getByText("Plain-text preview", { exact: true }).click();
  const expected = await page.getByTestId("composer-plain-text").innerText();
  if (browserName === "chromium") {
    await page.context().grantPermissions([
      "clipboard-read",
      "clipboard-write",
    ]);
    await page.getByRole("button", { name: "Copy reviewed note", exact: true })
      .click();
    expect(
      (await page.evaluate(() => navigator.clipboard.readText())).replace(
        /\r\n/g,
        "\n",
      ),
    ).toBe(expected);
    await expect(page.getByRole("status").filter({ hasText: /^Unsaved$/ }))
      .toBeVisible();
  }
  await page.getByRole("button", { name: "Apply reviewed note", exact: true })
    .click();
  await expect(page.getByRole("status").filter({ hasText: /^Saved to chart$/ }))
    .toBeVisible();
  await expect(page.getByTestId("saved-composer-chart")).toContainText(
    "Synthetic medication",
  );
  await page.getByRole("button", { name: "Close composer", exact: true })
    .click();
  await page.getByRole("button", { name: "Reopen composer", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Clinical summary" }))
    .toHaveValue(note);
});
test("patient source selection, original wording, evidence focus return and dark phone layout", async ({ page }) => {
  await page.getByRole("button", { name: "Toggle dark", exact: true }).click();
  await page.getByRole("textbox", { name: "Paste source text" }).fill(
    "Synthetic A: Na 139\nSynthetic B: Na 152",
  );
  await page.getByRole("button", { name: "Add pasted source", exact: true })
    .click();
  const source = page.getByRole("textbox", { name: "Original source text" });
  await expect(source).toHaveValue("Synthetic A: Na 139\nSynthetic B: Na 152");
  await source.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(0, el.value.indexOf("\n"));
  });
  await page.getByRole("button", {
    name: "Use selected text for this patient",
    exact: true,
  }).click();
  await expect(page.getByText("Needs patient selection")).toHaveCount(0);
  await page.getByRole("button", {
    name: "Sources for Clinical summary",
    exact: true,
  }).click();
  await expect(page.getByText(/Source inspection unavailable for saved/))
    .toBeVisible();
  await page.getByRole("dialog").getByRole("button", {
    name: "Close",
    exact: true,
  }).click();
  await expect(
    page.getByRole("button", {
      name: "Sources for Clinical summary",
      exact: true,
    }),
  ).toBeFocused();
  expect(
    await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth
    ),
  ).toBe(true);
});
test("generation proposes changes and requires source review while preserving other sections", async ({ page }) => {
  const neuro = await page.getByRole("textbox", { name: "NEURO", exact: true })
    .inputValue();
  await page.getByRole("textbox", {
    name: "Today's assessment and plan",
    exact: true,
  }).fill("Revised clinician assessment");
  await page.getByRole("button", { name: "Generate draft", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Proposed changes" }))
    .toBeVisible();
  await expect(page.getByRole("textbox", { name: "Clinical summary" })).not
    .toHaveValue("Revised clinician assessment");
  await page.getByRole("button", {
    name: "Accept proposed changes",
    exact: true,
  }).click();
  await page.getByRole("button", { name: "Apply reviewed note", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Review the generated text",
  );
  await page.getByRole("checkbox", { name: /I reviewed this text/ }).check();
  await page.getByRole("button", { name: "Apply reviewed note", exact: true })
    .click();
  await expect(page.getByRole("status").filter({ hasText: /^Saved to chart$/ }))
    .toBeVisible();
  await expect(page.getByRole("textbox", { name: "NEURO", exact: true }))
    .toHaveValue(neuro);
});
test("cancellation, retry and patient switch never show a previous patient draft", async ({ page }) => {
  await page.getByRole("textbox", {
    name: "Today's assessment and plan",
    exact: true,
  }).fill("Temporary patient A input");
  await page.getByRole("button", { name: "Generate draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Proposed changes" }))
    .toHaveCount(0);
  await page.getByRole("button", { name: "Generate draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Switch patient", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Clinical summary" }))
    .toHaveValue("Second patient only");
  await expect(
    page.getByRole("textbox", {
      name: "Today's assessment and plan",
      exact: true,
    }),
  ).toHaveValue("");
  await expect(page.getByRole("region", { name: "Proposed changes" }))
    .toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("region", { name: "Rounding note composer" }))
    .toHaveCount(0);
});
