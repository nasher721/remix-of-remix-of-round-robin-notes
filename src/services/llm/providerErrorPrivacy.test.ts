import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { safeProviderHttpError, safeProviderRuntimeError } from "./providers/errors";

const providerFiles = ["openai", "anthropic", "gemini", "grok", "glm", "huggingface"];

test("provider adapters never read or interpolate untrusted error bodies", () => {
  for (const provider of providerFiles) {
    const source = readFileSync(`src/services/llm/providers/${provider}.ts`, "utf8");
    assert.doesNotMatch(source, /response\.text\s*\(/, provider);
    assert.doesNotMatch(source, /err instanceof Error\s*\?\s*err\.message/, provider);
    assert.match(source, /safeProvider(?:Http|Runtime)Error/, provider);
  }
});

test("safe provider errors expose status or cancellation only", () => {
  assert.equal(
    safeProviderHttpError("OpenAI", "request", 429),
    "OpenAI request failed (HTTP 429).",
  );
  const sensitive = new Error("PATIENT-MARKER provider echoed input");
  assert.equal(safeProviderRuntimeError("OpenAI", "request", sensitive), "OpenAI request failed.");

  const aborted = new Error("PATIENT-MARKER");
  aborted.name = "AbortError";
  assert.equal(safeProviderRuntimeError("OpenAI", "stream", aborted), "OpenAI stream was cancelled.");
});
