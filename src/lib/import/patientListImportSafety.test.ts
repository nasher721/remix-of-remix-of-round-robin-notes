import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectPatientListImportKind,
  MAX_PATIENT_LIST_TEXT_BYTES,
  validateExtractedPatientListText,
  validatePatientListImportFile,
} from "@/lib/import/patientListImportSafety";

describe("patient list import safety", () => {
  it("detects common clinical export formats", () => {
    assert.equal(detectPatientListImportKind("census.xlsx"), "spreadsheet");
    assert.equal(detectPatientListImportKind("handoff.docx"), "docx");
    assert.equal(detectPatientListImportKind("list.csv"), "spreadsheet");
    assert.equal(detectPatientListImportKind("notes.html"), "html");
    assert.equal(detectPatientListImportKind("bundle.json"), "json");
    assert.equal(detectPatientListImportKind("scan.png"), "image");
    assert.equal(detectPatientListImportKind("unknown.bin"), null);
  });

  it("accepts pdf files within size limits", () => {
    assert.equal(validatePatientListImportFile("handoff.pdf", 1_000), null);
    assert.match(
      validatePatientListImportFile("huge.pdf", 20 * 1024 * 1024) ?? "",
      /too large/i,
    );
  });

  it("enforces per-format size limits", () => {
    assert.match(
      validatePatientListImportFile("list.txt", MAX_PATIENT_LIST_TEXT_BYTES + 1) ?? "",
      /too large/i,
    );
    assert.equal(validatePatientListImportFile("list.csv", 2_000), null);
    assert.equal(validatePatientListImportFile("photo.jpg", 2_000), null);
  });

  it("rejects empty extracted text", () => {
    assert.match(validateExtractedPatientListText("   ") ?? "", /usable text/i);
    assert.equal(validateExtractedPatientListText("Bed 1 Jane Doe"), null);
  });
});
