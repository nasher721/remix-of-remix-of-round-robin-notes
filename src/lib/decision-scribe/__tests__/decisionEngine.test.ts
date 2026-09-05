import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractDecisionCandidates } from "../decisionEngine";
import { asCaptureSessionId, asTranscriptSegmentId, type CaptureBinding, type TemporaryTranscriptSegment } from "../../../types/decisionScribe";

const binding: CaptureBinding = { sessionId: asCaptureSessionId("s1"), roundId: "r1", patientId: "p1", physicianId: "u1", deviceId: "d1", startedAt: "2026-09-04T10:00:00.000Z", expiresAt: "2026-09-04T11:00:00.000Z", source: "rounds-audio", patientSnapshotId: "snap1", patientSnapshotCapturedAt: "2026-09-04T10:00:01.000Z" };
const segment = (text: string, id = "a"): TemporaryTranscriptSegment => ({ id: asTranscriptSegmentId(id), binding: { sessionId: binding.sessionId, roundId: binding.roundId, patientId: binding.patientId }, speaker: "physician", text, startMs: (id.charCodeAt(0) - 96) * 2000, endMs: (id.charCodeAt(0) - 96) * 2000 + 1000, expiresAt: binding.expiresAt });

describe("decision extraction", () => {
  it("extracts affirmed decisions, tasks, and contingencies with provenance", () => {
    const result = extractDecisionCandidates([segment("We will continue the norepinephrine and repeat labs by morning."), segment("If pressure falls, then start fluids.", "b")], { patientId: "p1", snapshotId: "snap1", systems: {} }, binding, new Date("2026-09-04T10:10:00Z"));
    assert.equal(result.candidates.length, 4); assert.equal(result.candidates[0].source, "rounds-audio"); assert.match(result.candidates[0].supportingSpan.text, /norepinephrine/); assert.equal(result.candidates.some((candidate) => candidate.conditionality), true);
  });
  it("omits ordinary speech and rejects cross-patient content", () => {
    const result = extractDecisionCandidates([segment("How is he doing?"), segment("For bed 12, stop the drip.", "b")], { patientId: "p1", snapshotId: "snap1", bed: "7" }, binding, new Date("2026-09-04T10:10:00Z"));
    assert.equal(result.candidates.length, 0); assert.deepEqual(result.rejected.map((x) => x.reason), ["unsupported", "cross-patient"]);
  });
});
