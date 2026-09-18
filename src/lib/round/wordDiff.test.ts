import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeWordDiff, tokenizeWords } from "./wordDiff";

describe("tokenizeWords", () => {
  it("splits text into words, punctuation, and whitespace tokens", () => {
    const tokens = tokenizeWords("PEEP 8, FiO2 40%");
    assert.deepEqual(tokens, ["PEEP", " ", "8", ",", " ", "FiO2", " ", "40", "%"]);
  });

  it("handles empty string", () => {
    assert.deepEqual(tokenizeWords(""), []);
  });
});

describe("computeWordDiff", () => {
  it("returns single 'same' segment when texts are identical", () => {
    const diff = computeWordDiff("Patient extubated", "Patient extubated");
    assert.deepEqual(diff, [{ type: "same", value: "Patient extubated" }]);
  });

  it("identifies word additions", () => {
    const diff = computeWordDiff("Patient stable", "Patient stable today");
    assert.deepEqual(diff, [
      { type: "same", value: "Patient stable" },
      { type: "added", value: " today" },
    ]);
  });

  it("identifies word removals and replacements", () => {
    const diff = computeWordDiff("PEEP 10 FiO2 50%", "PEEP 8 FiO2 50%");
    assert.deepEqual(diff, [
      { type: "same", value: "PEEP " },
      { type: "removed", value: "10" },
      { type: "added", value: "8" },
      { type: "same", value: " FiO2 50%" },
    ]);
  });

  it("handles empty string transitions", () => {
    assert.deepEqual(computeWordDiff("", "New text"), [
      { type: "added", value: "New text" },
    ]);
    assert.deepEqual(computeWordDiff("Old text", ""), [
      { type: "removed", value: "Old text" },
    ]);
    assert.deepEqual(computeWordDiff("", ""), []);
  });
});
