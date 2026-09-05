import assert from "node:assert/strict";
import test from "node:test";
import { isDecisionScribeTelemetrySafe, recordDecisionScribeTelemetry, sanitizeDecisionScribeTelemetry } from "../telemetry";

test("accepts only aggregate lifecycle metrics", () => {
  const event = sanitizeDecisionScribeTelemetry({ event: "review_opened", count: 2, mode: "full-review" });
  assert.deepEqual(event, { event: "review_opened", count: 2, mode: "full-review" });
  let received = 0;
  assert.equal(recordDecisionScribeTelemetry(event, () => { received += 1; }), true);
  assert.equal(received, 1);
});

test("rejects adversarial nested keys and values without recursion leaks", () => {
  assert.equal(isDecisionScribeTelemetrySafe({ event: "capture_failed", nested: { transcript: "secret" } }), false);
  assert.equal(isDecisionScribeTelemetrySafe({ event: "capture_failed", reason: "patient-id" }), false);
  assert.equal(isDecisionScribeTelemetrySafe({ event: "capture_failed", durationMs: -1 }), false);
  assert.equal(isDecisionScribeTelemetrySafe({ event: "capture_failed", sessionId: "anything" }), false);
  assert.equal(isDecisionScribeTelemetrySafe({ event: "capture_failed", extra: { deep: { audio: "raw" } } }), false);
});
