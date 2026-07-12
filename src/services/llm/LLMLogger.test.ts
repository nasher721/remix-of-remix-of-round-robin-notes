import assert from "node:assert/strict";
import test from "node:test";

import {
  createLogEntry,
  getRecentLogs,
  logLLMEvent,
  resetMetrics,
} from "./LLMLogger";

test("LLM logs classify errors without retaining upstream response text", () => {
  resetMetrics();
  const marker = "PATIENT-MARKER upstream diagnostic";

  logLLMEvent({
    timestamp: new Date(0).toISOString(),
    provider: "openai",
    model: "test-model",
    task: "clinical_note",
    latencyMs: 5,
    success: false,
    error: marker,
  });

  const latest = getRecentLogs(1)[0];
  assert.equal(latest?.error, "provider_request_failed");
  assert.doesNotMatch(JSON.stringify(latest), /PATIENT-MARKER/);
});

test("LLM log entry creation preserves only a safe HTTP classification", () => {
  const entry = createLogEntry("gemini", "test-model", "general", 1, false, {
    error: "Gemini request failed (HTTP 429). secret response body",
  });

  assert.equal(entry.error, "provider_http_429");
  assert.doesNotMatch(JSON.stringify(entry), /secret response body/);
});
