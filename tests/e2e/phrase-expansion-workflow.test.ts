import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expandPhrase } from "@/lib/phraseExpander";
import { sampleFields, samplePhrase } from "../fixtures/phrases";
import { samplePatient } from "../fixtures/patient";

describe("phrase expansion workflow", () => {
  it("expands a phrase using patient data and selections", () => {
    const result = expandPhrase(
      samplePhrase,
      sampleFields,
      {
        status: "stable",
        symptoms: ["cough", "no_fever"],
      },
      samplePatient
    );

    assert.equal(
      result.content,
      "Patient Alex Smith is stable. Patient reports cough. Patient denies fever."
    );
    assert.deepEqual(result.usedFields.sort(), ["name", "status", "symptoms"]);
  });
});
