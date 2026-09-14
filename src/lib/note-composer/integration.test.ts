import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("composer is reachable in desktop, mobile, and active-round patient workspaces", () => {
  for (
    const path of [
      "../../components/PatientCard.tsx",
      "../../components/mobile/MobilePatientDetail.tsx",
      "../../components/round/PatientFocus.tsx",
    ]
  ) {
    assert.match(
      readFileSync(new URL(path, import.meta.url), "utf8"),
      /<NoteComposerLauncher patient=\{patient\}/,
      path,
    );
  }
});
test("temporary composer content has no storage, clinical memory or telemetry path", () => {
  for (
    const path of [
      "./session.ts",
      "../../hooks/useNoteComposer.ts",
      "../../services/noteComposerService.ts",
      "../../components/note-composer/NoteComposer.tsx",
    ]
  ) {
    const code = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(
      code,
      /(?:localStorage|sessionStorage|indexedDB|retainMemory|recallMemory|useTextTransform|console\.|logMetric|captureException)/,
      path,
    );
  }
});
