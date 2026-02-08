import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureString, extractStringField } from "@/lib/ai-response-utils";

describe("AI response utils", () => {
  it("returns empty string for nullish values", () => {
    assert.equal(ensureString(null), "");
    assert.equal(ensureString(undefined), "");
  });

  it("coerces primitives to strings", () => {
    assert.equal(ensureString(42), "42");
    assert.equal(ensureString(true), "true");
  });

  it("stringifies objects as JSON", () => {
    const value = { name: "Alex", count: 2 };
    assert.equal(ensureString(value), JSON.stringify(value, null, 2));
  });

  it("extracts a field safely", () => {
    assert.equal(extractStringField({ message: "ok" }, "message"), "ok");
    assert.equal(extractStringField({ message: 12 }, "message"), "12");
  });
});
