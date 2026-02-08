import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateFormula,
  evaluateCondition,
  extractFieldKeys,
  generateSentenceFromSelections,
  searchPhrases,
  validateFieldValues,
} from "@/lib/phraseExpander";
import type { ClinicalPhrase, PhraseField } from "@/types/phrases";

describe("phrase expander utilities", () => {
  it("extracts unique field keys", () => {
    const keys = extractFieldKeys("Hello {{name}} and {{bed}} and {{name}}");
    assert.deepEqual(keys, ["name", "bed"]);
  });

  it("evaluates conditional logic", () => {
    assert.equal(
      evaluateCondition({ field: "status", operator: "equals", value: "ok" }, { status: "ok" }),
      true
    );
    assert.equal(
      evaluateCondition({ field: "status", operator: "contains", value: "icu" }, { status: "ICU-1" }),
      true
    );
    assert.equal(
      evaluateCondition({ field: "status", operator: "is_empty" }, { status: "" }),
      true
    );
  });

  it("calculates formulas with numeric values", () => {
    const result = calculateFormula("bmi = weight / (height * height)", {
      weight: 10,
      height: 2,
    });
    assert.equal(result, 2.5);
  });

  it("returns null for unsafe formulas", () => {
    const result = calculateFormula("weight + alert(1)", { weight: 10 });
    assert.equal(result, null);
  });

  it("generates sentences for checkbox selections", () => {
    const sentence = generateSentenceFromSelections(["cough", "no_fever"]);
    assert.equal(sentence, "Patient reports cough. Patient denies fever.");
  });

  it("validates required fields and numeric boundaries", () => {
    const fields: PhraseField[] = [
      {
        id: "field-1",
        phraseId: "phrase-1",
        fieldKey: "age",
        fieldType: "number",
        label: "Age",
        sortOrder: 1,
        createdAt: "2024-01-01T00:00:00Z",
        validation: { required: true, min: 18, max: 65 },
      },
    ];

    const errors = validateFieldValues(fields, { age: 10 });
    assert.equal(errors.age, "Age must be at least 18");
  });

  it("searches phrases by multiple fields", () => {
    const phrases: ClinicalPhrase[] = [
      {
        id: "phrase-1",
        userId: "user-1",
        name: "Shortness of Breath",
        description: "dyspnea note",
        content: "Patient reports dyspnea",
        shortcut: ".sob",
        hotkey: null,
        contextTriggers: {},
        isActive: true,
        isShared: false,
        usageCount: 0,
        lastUsedAt: null,
        version: 1,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];

    assert.equal(searchPhrases(phrases, "dyspnea").length, 1);
    assert.equal(searchPhrases(phrases, ".sob").length, 1);
  });
});
