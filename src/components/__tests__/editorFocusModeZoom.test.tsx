import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSource(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("editor click must not trigger focus-mode layout zoom", () => {
  it("PatientCard does not auto-enter dashboard focus mode on editor focus", () => {
    const source = readSource("src/components/PatientCard.tsx");
    assert.equal(
      source.includes("onRequestDashboardFocusMode"),
      false,
      "PatientCard should not accept click-to-enter focus mode callbacks",
    );
    assert.equal(
      source.includes("onFocusCapture"),
      false,
      "PatientCard editors should not capture focus to reshape the workspace",
    );
    assert.equal(
      source.includes("whileTap"),
      false,
      "PatientCard should not scale on tap when clicking textboxes",
    );
  });

  it("PatientSystemsReview does not forward editor focus into focus mode", () => {
    const source = readSource("src/components/PatientSystemsReview.tsx");
    assert.equal(source.includes("onAnyEditorFocus"), false);
    assert.equal(source.includes("onFocusCapture"), false);
  });

  it("desktop workspace wiring does not bind enterFocusMode to editor clicks", () => {
    const list = readSource("src/components/dashboard/VirtualizedPatientList.tsx");
    const workspace = readSource("src/components/dashboard/PatientWorkspace.tsx");
    assert.equal(list.includes("onRequestDashboardFocusMode"), false);
    assert.equal(workspace.includes("onRequestDashboardFocusMode"), false);
    assert.equal(list.includes("enterFocusMode"), false);
    assert.equal(workspace.includes("enterFocusMode"), false);
  });

  it("note editors resolve font size through the iOS zoom floor helper", () => {
    const rich = readSource("src/components/RichTextEditor.tsx");
    const imaging = readSource("src/components/ImagePasteEditor.tsx");
    assert.match(rich, /resolveEditorFontSizePx/);
    assert.match(imaging, /resolveEditorFontSizePx/);
  });
});
