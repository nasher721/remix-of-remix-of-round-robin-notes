import assert from "node:assert/strict";
import test from "node:test";
import { ICU_DECISION_CORPUS } from "../fixtures/icuDecisionCorpus";
import type { DecisionCandidate, DecisionDraft } from "../../../types/decisionScribe";

test("contracts preserve provisional provenance and patient/session binding", () => {
  const draft: DecisionDraft = { id: "draft-1" as DecisionDraft["id"], binding: { sessionId: "session-1" as never, roundId: "round-1", patientId: "SYNTH-A", physicianId: "physician-1", deviceId: "device-1", patientSnapshotId: "snapshot-1", patientSnapshotCapturedAt: "2026-01-01T00:00:00Z", source: "rounds-audio", startedAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" }, candidates: [], createdAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", provenance: "provisional", status: "review" };
  assert.equal(draft.provenance, "provisional");
  assert.equal(draft.binding.patientId, "SYNTH-A");
});

test("corpus covers decision hazards without identifiers", () => {
  assert.ok(ICU_DECISION_CORPUS.length >= 7);
  const serialized = JSON.stringify(ICU_DECISION_CORPUS);
  assert.doesNotMatch(serialized, /MRN|medical record|date of birth|\bDOB\b/i);
  assert.ok(ICU_DECISION_CORPUS.every((item) => item.patientLabel.startsWith("SYNTH-")));
  assert.ok(ICU_DECISION_CORPUS.some((item) => item.expectedSignals.includes("conditional")));
});
