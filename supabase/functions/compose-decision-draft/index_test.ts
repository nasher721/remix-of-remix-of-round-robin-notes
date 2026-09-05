import assert from "node:assert/strict";
import { handleComposeDecisionDraft } from "./index.ts";
const binding = {
  sessionId: "s1",
  roundId: "r1",
  patientId: "p1",
  physicianId: "u1",
  deviceId: "d1",
  startedAt: "2026-09-04T10:00:00Z",
  expiresAt: "2026-09-04T11:00:00Z",
  source: "rounds-audio",
  patientSnapshotId: "snap1",
  patientSnapshotCapturedAt: "2026-09-04T09:59:59Z",
};
const auth = () => Promise.resolve({ userId: "u1", user: {} } as never);
const rateLimit = () => Promise.resolve({ allowed: true } as never);
const body = (extra = {}) =>
  new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({
      binding,
      snapshot: { patientId: "p1", snapshotId: "snap1" },
      segments: [{
        id: "seg",
        binding,
        speaker: "physician",
        text: "We will continue the medication.",
        startMs: 0,
        endMs: 1000,
        expiresAt: binding.expiresAt,
      }],
      ...extra,
    }),
    headers: { "content-type": "application/json" },
  });
Deno.test("compose boundary returns provisional draft and never writes", async () => {
  const response = await handleComposeDecisionDraft(body(), {
    authenticate: auth,
    rateLimit,
    now: () => Date.parse("2026-09-04T10:10:00Z"),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.draft.status, "review");
  assert.equal(result.draft.provenance, "provisional");
});
Deno.test("compose boundary rejects wrong physician", async () => {
  const response = await handleComposeDecisionDraft(body(), {
    authenticate: () => Promise.resolve({ userId: "other", user: {} } as never),
    rateLimit,
  });
  assert.equal(response.status, 403);
});
