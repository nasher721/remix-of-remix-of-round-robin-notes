import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/e2e/notes-harness.html");
  await page.getByRole("button", { name: "One page", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Combined clinical note" })).toBeVisible();
});

test("one editor round-trips changes, preserves other fields and remembers the view", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "Combined clinical note" });
  await expect(editor).toHaveCount(1);
  await page.getByRole("button", { name: "Clinical summary, has text", exact: true }).click();
  await page.keyboard.type(" New bedside update.");
  await expect(page.getByTestId("chart-state")).toContainText("New bedside update.");
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Separate clinical summary" })).toContainText("New bedside update.");
  await page.getByRole("button", { name: "One page", exact: true }).click();
  await expect(editor.locator("strong")).toHaveText("Synthetic rounding note.");
  await expect(page.getByTestId("chart-state")).toContainText("Imaging reviewed with the team.");
  await page.reload();
  await expect(editor).toBeVisible();
});

test("section shortcuts, blank outline, formatting, undo, phrases and timestamp work", async ({ page }) => {
  await page.getByRole("button", { name: "Next empty", exact: true }).click();
  const cv = page.locator('[data-note-body="systems.cv"]');
  await page.getByRole("button", { name: "Add outline", exact: true }).click();
  await expect(cv).toContainText("Assessment:");
  await expect(cv).toContainText("Follow-up:");
  await expect(page.getByRole("button", { name: "Add outline", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Timestamp", exact: true }).click();
  await expect(cv).toContainText(/\[\d{1,2}:\d{2}/);
  await page.getByRole("combobox", { name: "Insert saved phrase" }).selectOption("0");
  await expect(cv).toContainText("Follow-up:");
  await page.keyboard.type("Keyboard entry");
  await expect(cv).toContainText("Keyboard entry");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(cv).not.toContainText("Keyboard entry");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(cv).toContainText("Keyboard entry");
  await page.keyboard.press("Alt+ArrowDown");
  await page.keyboard.type("Respiratory entry");
  await expect(page.locator('[data-note-body="systems.resp"]')).toContainText("Respiratory entry");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.keyboard.type(" Bold entry");
  await expect(page.locator('[data-note-body="systems.resp"]').locator("b, strong")).toContainText("Bold entry");
});

test("copies a readable note without empty sections", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy note", exact: true }).click();
  // Windows clipboard text uses CRLF even when writeText receives LF.
  const text = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
  expect(text).toContain("CLINICAL SUMMARY\nSynthetic rounding note.");
  expect(text).toContain("Demo medication A\nDemo medication B");
  expect(text).not.toContain("PRN MEDICATIONS");
  expect(text).not.toContain("<strong>");
  await expect(page.getByRole("status")).toContainText("Note copied.");
});

test("requested system titles stay ordered and L/D/A and SKIN edit independently", async ({ page }) => {
  const sections = page.locator('[data-note-section^="systems."]');
  await expect(sections.locator("h2")).toHaveText([
    "NEURO", "CV", "RESP", "RENAL/GU", "GI", "ENDO", "HEME/ONC", "ID", "L/D/A", "SKIN", "DISPO",
  ]);
  await page.getByRole("button", { name: "L/D/A, empty", exact: true }).click();
  await page.keyboard.type("Line assessment");
  await page.getByRole("button", { name: "SKIN, empty", exact: true }).click();
  await page.keyboard.type("Skin assessment");
  const state = JSON.parse(await page.getByTestId("chart-state").innerText());
  expect(state.systems.skinLines).toContain("Line assessment");
  expect(state.systems.skinLines).not.toContain("Skin assessment");
  expect(state.systems.skin).toContain("Skin assessment");
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page.getByRole("button", { name: "One page", exact: true }).click();
  await expect(page.locator('[data-note-body="systems.skinLines"]')).toContainText("Line assessment");
  await expect(page.locator('[data-note-body="systems.skin"]')).toContainText("Skin assessment");
});

test("protects section headings and keeps patients isolated", async ({ page }) => {
  await page.getByRole("button", { name: "Clinical summary, has text", exact: true }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("status")).toContainText("Section headings stay in place");
  await expect(page.locator('[data-note-body="clinicalSummary"]')).toContainText("Synthetic rounding note.");
  await page.getByRole("button", { name: "Switch patient", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Combined clinical note" })).toContainText("Second patient only");
  await expect(page.getByRole("textbox", { name: "Combined clinical note" })).not.toContainText("Synthetic rounding note.");
  await page.getByRole("button", { name: "Clinical summary, has text", exact: true }).click();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.getByTestId("chart-state")).toContainText("Second patient only");
});

test("medication rows, tracked typing and dark mobile layout work", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Scheduled medications, has text", exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Demo medication C");
  const state = JSON.parse(await page.getByTestId("chart-state").innerText());
  expect(state.medications.scheduled).toEqual(["Demo medication A", "Demo medication B", "Demo medication C"]);
  await page.getByRole("button", { name: "Medication notes, empty", exact: true }).click();
  await page.keyboard.type("Medication context");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second source line");
  const updated = JSON.parse(await page.getByTestId("chart-state").innerText());
  expect(updated.medications.rawText).toBe("Medication context\nSecond source line");
  await page.getByRole("button", { name: "Toggle tracking", exact: true }).click();
  await page.getByRole("button", { name: "Clinical summary, has text", exact: true }).click();
  await page.keyboard.type(" Tracked entry");
  await expect(page.locator('[data-note-body="clinicalSummary"] [data-marked="true"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-note-body="clinicalSummary"]')).not.toContainText("Tracked entry");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator('[data-note-body="clinicalSummary"] [data-marked="true"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await page.getByRole("button", { name: "Larger text", exact: true }).click();
  await expect(page.getByRole("button", { name: "Larger text", exact: true })).toHaveAttribute("aria-pressed", "true");
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    oversized: Array.from(document.querySelectorAll("main, main > div, section, [role=group], .note-document"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth)
      .map((element) => ({ tag: element.tagName, classes: element.className, right: element.getBoundingClientRect().right })),
  }));
  expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
  await page.screenshot({ path: testInfo.outputPath("continuous-note-dark.png"), fullPage: true });
});
