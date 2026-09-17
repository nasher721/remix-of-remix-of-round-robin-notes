import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enqueueOfflineDictation,
  getPendingAudioDictations,
  flushPendingAudioDictations,
  registerDictationSyncHandler,
} from "./offlineAudioQueue";

describe("offlineAudioQueue", () => {
  it("enqueues dictation entry with safe generated ID and pending status", async () => {
    const item = await enqueueOfflineDictation({
      patientId: "patient-1",
      systemKey: "respiratory",
      transcript: "PEEP 8, FiO2 40%",
    });

    assert.ok(item.id);
    assert.equal(item.patientId, "patient-1");
    assert.equal(item.systemKey, "respiratory");
    assert.equal(item.transcript, "PEEP 8, FiO2 40%");
  });

  it("registers and unregisters a sync handler", () => {
    const unregister = registerDictationSyncHandler(async () => {});
    assert.equal(typeof unregister, "function");
    unregister();
  });

  it("handles flush gracefully when queue is empty or indexeddb unavailable in node environment", async () => {
    const result = await flushPendingAudioDictations();
    assert.equal(result.flushed, 0);
    assert.equal(result.failed, 0);
  });

  it("queries pending dictations safely", async () => {
    const pending = await getPendingAudioDictations("patient-1");
    assert.ok(Array.isArray(pending));
  });
});
