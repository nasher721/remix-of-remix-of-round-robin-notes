import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeDecisionDraft } from "../draftComposer";
import { extractDecisionCandidates } from "../decisionEngine";
import { asCaptureSessionId, asTranscriptSegmentId, type CaptureBinding, type TemporaryTranscriptSegment } from "../../../types/decisionScribe";
const binding: CaptureBinding = { sessionId: asCaptureSessionId("s1"), roundId: "r1", patientId: "p1", physicianId: "u1", deviceId: "d1", startedAt: "2026-09-04T10:00:00Z", expiresAt: "2026-09-04T11:00:00Z", source: "rounds-audio", patientSnapshotId: "snap1", patientSnapshotCapturedAt: "2026-09-04T10:00:01Z" };
const s = (text: string, id: string): TemporaryTranscriptSegment => ({ id: asTranscriptSegmentId(id), binding: { sessionId: binding.sessionId, roundId: binding.roundId, patientId: binding.patientId }, speaker: "physician", text, startMs: (id.charCodeAt(0) - 96) * 100, endMs: (id.charCodeAt(0) - 96) * 100 + 50, expiresAt: binding.expiresAt });
describe("draft composition", () => {
  it("merges identical statements and orders exceptions first", () => {
    const extracted = extractDecisionCandidates([s("We will continue the medication.", "a"), s("We will continue the medication.", "b"), s("Maybe stop the medication?", "c")], { patientId: "p1", snapshotId: "snap1", systems: {} }, binding, new Date("2026-09-04T10:10:00Z"));
    const draft = composeDecisionDraft(extracted.candidates, binding, new Date("2026-09-04T10:10:00Z"));
    assert.equal(draft.candidates.length, 2); assert.equal(draft.candidates.some((candidate) => candidate.statementType === "question"), true); assert.equal(draft.status, "review"); assert.equal(draft.provenance, "provisional");
  });
});
