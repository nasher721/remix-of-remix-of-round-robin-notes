import assert from "node:assert/strict";
import test from "node:test";
import { asCaptureSessionId, asTranscriptSegmentId, type CaptureBinding, type TemporaryTranscriptSegment } from "../../../types/decisionScribe";
import { CaptureController } from "../captureController";
import { attest, retryDecisionScribeOutbox } from "../attestationController";
import { deriveAdaptationProfile, type VerifiedAttestationOutcome } from "../adaptationProfile";
import { extractDecisionCandidates } from "../decisionEngine";
import { composeDecisionDraft } from "../draftComposer";
import { createMemoryDecisionScribeOutboxStore, decisionScribeOutbox } from "../decisionScribeOutbox";
import { evaluateRollout } from "../rolloutPolicy";
import { processTemporaryTranscript, disposeTemporaryTranscript, type TranscriptBinding } from "../transcriptProcessor";

const now = new Date("2026-09-04T10:10:00Z");
const binding: CaptureBinding = {
  sessionId: asCaptureSessionId("synth-session"), roundId: "synth-round", patientId: "SYNTH-A",
  physicianId: "synth-physician", deviceId: "synth-device", patientSnapshotId: "synth-snapshot",
  startedAt: "2026-09-04T10:01:30Z", expiresAt: "2026-09-04T11:00:00Z",
  source: "rounds-audio", patientSnapshotCapturedAt: "2026-09-04T10:01:00Z",
};

const segments = (items: string[]): TemporaryTranscriptSegment[] => items.map((text, index) => ({
  id: `${binding.sessionId}:${index}` as TemporaryTranscriptSegment["id"],
  binding: binding as TemporaryTranscriptSegment["binding"],
  speaker: "physician", text, startMs: index * 1000, endMs: index * 1000 + 900, expiresAt: binding.expiresAt,
}));

const transcriptBinding: TranscriptBinding = { ...binding };

test("synthetic decision flow captures, extracts, edits, rejects, and preserves evidence", async () => {
  const transcript = await processTemporaryTranscript(new Uint8Array([1, 2]), transcriptBinding, async () => ({
    segments: [{ text: "Continue the medication and call radiology within ten minutes.", start: 0, end: 2, speaker: "physician" }],
  }), { now: () => now.getTime() });
  const extracted = extractDecisionCandidates(transcript.map((s) => ({ ...s, id: asTranscriptSegmentId(s.id), binding: binding as TemporaryTranscriptSegment["binding"] })), { patientId: binding.patientId, snapshotId: binding.patientSnapshotId, systems: {} }, binding, now);
  assert.equal(extracted.rejected.length, 0);
  const draft = composeDecisionDraft(extracted.candidates, binding, now);
  assert.equal(draft.status, "review");
  assert.ok(draft.candidates.length >= 2);
  const edited = { ...draft.candidates[0], proposedContent: "Continue the medication at the current dose." };
  const rejected = draft.candidates[1];
  assert.equal(edited.supportingSpan.text, draft.candidates[0].supportingSpan.text);
  assert.equal(rejected.disposition, "pending");
  assert.equal(rejected.provenance, "spoken-span");
  assert.notEqual(edited.proposedContent, edited.supportingSpan.text);
});

test("attestation queues approved structured content, retries idempotently, and isolates patient conflicts", async () => {
  const transcript = segments(["We will continue the medication."]);
  const draft = composeDecisionDraft(extractDecisionCandidates(transcript, { patientId: binding.patientId, snapshotId: binding.patientSnapshotId }, binding, now).candidates, binding, now);
  assert.equal(draft.candidates.length, 1);
  const candidate = { ...draft.candidates[0], disposition: "approved" as const };
  let commits = 0;
  const memoryStore = createMemoryDecisionScribeOutboxStore();
  decisionScribeOutbox.setStore(memoryStore);
  try {
    const result = await attest({ ownerId: "integration-owner", physicianId: binding.physicianId, draft, binding, patientSnapshotId: binding.patientSnapshotId, approvedCandidateIds: [candidate.id], approvedCandidates: [candidate], now }, { commit: async () => { commits += 1; return "committed"; } });
    assert.equal(result.status, "committed");
    assert.equal(commits, 1);
    const again = await attest({ ownerId: "integration-owner", physicianId: binding.physicianId, draft, binding, patientSnapshotId: binding.patientSnapshotId, approvedCandidateIds: [candidate.id], approvedCandidates: [candidate], now }, { commit: async () => { commits += 1; return "committed"; } });
    assert.equal(again.attestation.id, result.attestation.id);
    assert.equal(commits, 1, "completed replay must not commit twice");
    const replay = await retryDecisionScribeOutbox("integration-owner", async () => { commits += 1; return "committed"; });
    assert.deepEqual(replay, { acknowledged: 0, conflicts: 0 });
  } finally {
    decisionScribeOutbox.resetStore();
  }
  if (!globalThis.indexedDB) {
    await assert.rejects(() => attest({ ownerId: "integration-owner", physicianId: binding.physicianId, draft, binding, patientSnapshotId: binding.patientSnapshotId, approvedCandidateIds: [candidate.id], approvedCandidates: [candidate], now }, { commit: async () => "committed" }), /IndexedDB API missing/);
  }
  const wrongPatient = { ...candidate, binding: { ...candidate.binding, patientId: "SYNTH-B" } };
  await assert.rejects(() => attest({ ownerId: "integration-owner", physicianId: binding.physicianId, draft, binding, patientSnapshotId: binding.patientSnapshotId, approvedCandidateIds: [wrongPatient.id], approvedCandidates: [wrongPatient], now }, { commit: async () => "committed" }), /candidate identity mismatch|patient\/session\/round mismatch|wrong-patient/);
});

test("outbox rejects owner/payload collisions for a stable operation", async () => {
  const store = createMemoryDecisionScribeOutboxStore();
  decisionScribeOutbox.setStore(store);
  try {
    const draft = composeDecisionDraft(extractDecisionCandidates(segments(["Continue the medication."]), { patientId: binding.patientId, snapshotId: binding.patientSnapshotId }, binding, now).candidates, binding, now);
    const candidate = { ...draft.candidates[0], disposition: "approved" as const };
    const attestation = { id: "collision-attestation" as never, draftId: draft.id, sessionId: binding.sessionId, patientId: binding.patientId, physicianId: binding.physicianId, attestedAt: now.toISOString(), approvedCandidateIds: [candidate.id], roundId: binding.roundId, deviceId: binding.deviceId };
    await store.add({ id: `decision-${attestation.draftId}-${candidate.id}-${attestation.patientId}`, operationId: "other-operation", ownerId: "integration-owner", attestation, patientId: binding.patientId, roundId: binding.roundId, candidate: { ...candidate, proposedContent: "other" }, payloadFingerprint: "other", status: "pending", createdAt: now.toISOString(), retryCount: 0 });
    await assert.rejects(() => decisionScribeOutbox.enqueue({ ownerId: "integration-owner", attestation, candidate }), /operation collision/);
  } finally {
    decisionScribeOutbox.resetStore();
  }
});

test("outbox rejects rejected or unattested material before persistence", async () => {
  const draft = composeDecisionDraft(extractDecisionCandidates(segments(["Continue the medication."]), { patientId: binding.patientId, snapshotId: binding.patientSnapshotId }, binding, now).candidates, binding, now);
  const candidate = { ...draft.candidates[0], disposition: "approved" as const };
  await assert.rejects(() => decisionScribeOutbox.enqueue({ ownerId: "retry-owner", attestation: { id: "a" as never, draftId: draft.id, sessionId: binding.sessionId, patientId: binding.patientId, physicianId: binding.physicianId, attestedAt: now.toISOString(), approvedCandidateIds: [], roundId: binding.roundId, deviceId: binding.deviceId }, candidate: { ...candidate, disposition: "rejected" } }), /unattested or impermissible/);
});

test("capture cancellation, expiry, crash recovery, adaptation, and rollout are fail-closed", async () => {
  const controller = new CaptureController({ now: () => now, timeoutMs: 60_000 });
  await controller.start(binding);
  await controller.appendAudio(new Uint8Array([1]));
  controller.handleOffline();
  assert.equal(controller.getState().lifecycle, "invalidated");
  assert.equal(controller.getEncryptedBuffer().length, 0);
  const expired = new CaptureController({ now: () => now, timeoutMs: 60_000 });
  await expired.start(binding);
  expired.expire();
  assert.equal(expired.getState().lifecycle, "expired");
  const crashed = new CaptureController({ now: () => now });
  await crashed.start(binding);
  crashed.recoverAfterCrash();
  assert.equal(crashed.getState().lifecycle, "discarded");
  const outcomes: VerifiedAttestationOutcome[] = Array.from({ length: 5 }, (_, i) => ({ eventId: `e${i}`, attestationId: `a${i}`, physicianId: binding.physicianId, patternKey: "medication", contextKey: "icu", modelVersion: "m1", attestedAt: `2026-09-04T10:0${i}:00Z`, outcome: "approved", verified: true }));
  assert.equal(deriveAdaptationProfile(binding.physicianId, outcomes, now).patterns[0].autonomy, "exception-first");
  const gates = { consent: true, recordingDisclosure: true, institutionalPolicy: true, encryption: true, retention: true, modelVersion: "m1", expectedModelVersion: "m1", contextVersion: "c1", expectedContextVersion: "c1" };
  assert.equal(evaluateRollout("exception-first", gates).mode, "full-review");
  assert.equal(evaluateRollout("exception-first", { ...gates, pilot: { reviewedSessions: 25, approvalRate: .98, editRate: .02, reversalRate: 0, contradictionRate: 0 } }).mode, "exception-first");
});

test("temporary transcript disposal clears text and collection", () => {
  const temporary = [{ id: "x", binding: { sessionId: "s", roundId: "r", patientId: "p", physicianId: "u", deviceId: "d", patientSnapshotId: "snap", startedAt: binding.startedAt, expiresAt: binding.expiresAt, source: "rounds-audio" as const }, speaker: "physician" as const, text: "synthetic only", startMs: 0, endMs: 1, uncertainty: 0, expiresAt: binding.expiresAt }];
  disposeTemporaryTranscript(temporary);
  assert.deepEqual(temporary, []);
});
