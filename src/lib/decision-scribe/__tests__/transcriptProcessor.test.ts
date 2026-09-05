import { strict as assert } from "node:assert";
import { test } from "node:test";
import { processTemporaryTranscript, TranscriptProcessingError, type TranscriptBinding } from "../transcriptProcessor";

const binding: TranscriptBinding = {
  sessionId: "session-1", roundId: "round-1", patientId: "patient-1", physicianId: "physician-1",
  deviceId: "device-1", patientSnapshotId: "snapshot-1", source: "rounds-audio",
  startedAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z",
};

test("returns attributed, patient/session-bound temporary spans", async () => {
  const result = await processTemporaryTranscript(new Uint8Array([1]), binding, async () => ({
    segments: [{ text: "Continue feeds", start: 1, end: 2.5, speaker: "physician", no_speech_prob: 0.1 }],
  }));
  assert.deepEqual(result[0], {
    id: "session-1:0", binding,
    speaker: "physician", text: "Continue feeds", startMs: 1000, endMs: 2500,
    uncertainty: 0.1, expiresAt: binding.expiresAt,
  });
});

test("fails closed for unsupported, expired, and cancelled capture", async () => {
  await assert.rejects(() => processTemporaryTranscript(new Uint8Array(), binding, async () => []), (error: unknown) => error instanceof TranscriptProcessingError && error.code === "unsupported");
  await assert.rejects(() => processTemporaryTranscript(new Uint8Array([1]), { ...binding, expiresAt: "2020-01-01T00:00:00Z" }, async () => []), (error: unknown) => error instanceof TranscriptProcessingError && error.code === "expired");
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => processTemporaryTranscript(new Uint8Array([1]), binding, async () => [], { signal: controller.signal }), (error: unknown) => error instanceof TranscriptProcessingError && error.code === "cancelled");
});

test("provider failures return no partial material", async () => {
  await assert.rejects(() => processTemporaryTranscript(new Uint8Array([1]), binding, async () => { throw new Error("failure"); }), (error: unknown) => error instanceof TranscriptProcessingError && error.code === "provider-error");
});

test("retries one transient failure, but rejects malformed segments", async () => {
  let calls = 0;
  const result = await processTemporaryTranscript(new Uint8Array([1]), binding, async () => {
    calls++;
    if (calls === 1) throw new Error("temporary");
    return { segments: [{ text: "Plan", start: 0, end: 1, speaker: "resident" }] };
  });
  assert.equal(calls, 2);
  assert.equal(result[0]?.speaker, "resident");
  await assert.rejects(() => processTemporaryTranscript(new Uint8Array([1]), binding, async () => ({ segments: [{ text: "bad", start: true, end: 1 }] })), (error: unknown) => error instanceof TranscriptProcessingError && error.code === "provider-error");
  await assert.rejects(() => processTemporaryTranscript(new Uint8Array([1]), binding, async () => null), (error: unknown) => error instanceof TranscriptProcessingError && error.code === "provider-error");
});

test("uses an explicit seconds timestamp contract and rejects unsupported MIME", async () => {
  await assert.rejects(() => processTemporaryTranscript(new Uint8Array([1]), binding, async () => [], { mimeType: "application/octet-stream" }), (error: unknown) => error instanceof TranscriptProcessingError && error.code === "unsupported");
  const result = await processTemporaryTranscript(new Uint8Array([1]), binding, async () => ({ segments: [{ text: "A", start: 0.001, end: 0.002, speaker: "unknown" }] }));
  assert.deepEqual([result[0]?.startMs, result[0]?.endMs], [1, 2]);
});
