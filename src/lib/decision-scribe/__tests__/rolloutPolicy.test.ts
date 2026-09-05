import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRollout, pilotThresholdsMet, transitionRollout } from "../rolloutPolicy";

const good = { consent: true, recordingDisclosure: true, institutionalPolicy: true, encryption: true, retention: true, modelVersion: "m1", expectedModelVersion: "m1", contextVersion: "c1", expectedContextVersion: "c1", pilot: { reviewedSessions: 25, approvalRate: .98, editRate: .02, reversalRate: 0, contradictionRate: 0 } };

test("missing safety gates fail closed to full review", () => {
  const result = evaluateRollout("full-review", { ...good, consent: false, encryption: false });
  assert.equal(result.allowed, false);
  assert.equal(result.mode, "full-review");
  assert.deepEqual(result.reasons, ["consent-required", "encryption-not-verified"]);
});

test("all four active modes require verified model/context and consent", () => {
  for (const mode of ["shadow", "full-review", "adaptive-composition", "exception-first"] as const) {
    const result = evaluateRollout(mode, good);
    assert.equal(result.mode, mode);
    assert.equal(result.allowed, true);
  }
  assert.equal(evaluateRollout("exception-first", { ...good, modelVersion: "m2" }).mode, "full-review");
  assert.equal(evaluateRollout("adaptive-composition", { ...good, driftDetected: true }).mode, "full-review");
});

test("exception-first requires pilot thresholds and transitions are auditable", () => {
  assert.equal(pilotThresholdsMet({ ...good.pilot!, reviewedSessions: 19 }), false);
  const transition = transitionRollout("full-review", "exception-first", good, "physician");
  assert.equal(transition.decision.mode, "exception-first");
  assert.equal(transition.transition.from, "full-review");
  assert.equal(transition.transition.actor, "physician");
});
