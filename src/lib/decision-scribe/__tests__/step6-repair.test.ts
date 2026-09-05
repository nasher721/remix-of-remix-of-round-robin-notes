import assert from "node:assert/strict";
import test from "node:test";
import {
  retryDecisionScribeOutbox,
  undoDecisionOperation,
} from "../attestationController";
import {
  createMemoryDecisionScribeOutboxStore,
  decisionScribeOutbox,
} from "../decisionScribeOutbox";
import type { DecisionScribeOutboxEntry } from "../decisionScribeOutbox";
import type { DurableDecisionOperation } from "@/types/decisionScribe";

const candidate = {
  id: "c1",
  destination: "todo",
  statementType: "task",
  polarity: "affirmed",
  changeType: "add",
  proposedContent: "Call family",
  task: { owner: "physician", deadline: null, urgency: "routine" },
  conditionality: null,
  source: "rounds-audio",
  provenance: "spoken-span",
  material: "provisional-structured",
};
const attestation = {
  id: "a1",
  draftId: "d1",
  sessionId: "s1",
  patientId: "p1",
  physicianId: "u1",
  attestedAt: new Date().toISOString(),
  approvedCandidateIds: ["c1"],
  roundId: "r1",
  deviceId: "device1",
};

function entry(overrides = {}) {
  return {
    id: "entry1",
    operationId: "u1:a1:c1",
    ownerId: "u1",
    attestation,
    patientId: "p1",
    roundId: "r1",
    candidate,
    payloadFingerprint: "fp",
    status: "pending",
    createdAt: attestation.attestedAt,
    retryCount: 0,
    ...overrides,
  } as unknown as DecisionScribeOutboxEntry;
}

test("typed failed retry persists failed state and backoff", async () => {
  const store = createMemoryDecisionScribeOutboxStore();
  decisionScribeOutbox.setStore(store);
  await store.add(entry());
  await retryDecisionScribeOutbox("u1", async () => ({ status: "failed" }));
  const saved = await store.get("entry1");
  assert.equal(saved?.status, "failed");
  assert.equal(saved?.retryCount, 1);
  assert.ok(saved?.nextRetryAt);
  decisionScribeOutbox.resetStore();
});

test("durable undo is idempotent and never emits a blank inverse", async () => {
  const store = createMemoryDecisionScribeOutboxStore();
  decisionScribeOutbox.setStore(store);
  await store.add(
    entry({
      status: "completed",
      undo: {
        reversible: true,
        deadline: new Date(Date.now() + 60_000).toISOString(),
        inverseOperationId: "u1:a1:c1:undo",
        createdTodoId: "decision-u1:a1:c1",
        inverseCandidate: {
          ...candidate,
          changeType: "remove",
          proposedContent: "decision-u1:a1:c1",
          rawAudio: "secret-audio",
          supportingSpan: { text: "secret-transcript" },
          confidence: 0.1,
          binding: { patientId: "wrong-patient" },
        },
      },
    }),
  );
  const seen: string[] = [];
  const first = await undoDecisionOperation(
    "u1",
    "entry1",
    async (operation) => {
      seen.push(operation.candidate.proposedContent);
      return "committed";
    },
  );
  assert.equal(first.status, "undone");
  assert.deepEqual(seen, ["decision-u1:a1:c1"]);
  const second = await undoDecisionOperation(
    "u1",
    "entry1",
    async () => "failed",
  );
  assert.equal(second.status, "undone");
  decisionScribeOutbox.resetStore();
});

test("outbox read failures fail closed for undo", async () => {
  decisionScribeOutbox.setStore({
    get: async () => undefined,
    put: async () => undefined,
    add: async () => undefined,
    list: async () => {
      throw new Error("read failed");
    },
    delete: async () => undefined,
  });
  const result = await undoDecisionOperation(
    "u1",
    "entry1",
    async () => "committed",
  );
  assert.equal(result.status, "unavailable");
  assert.match(result.reason ?? "", /outbox is unavailable/i);
  decisionScribeOutbox.resetStore();
});

test("queued undo remains explicitly queued", async () => {
  const store = createMemoryDecisionScribeOutboxStore();
  decisionScribeOutbox.setStore(store);
  await store.add(
    entry({
      status: "completed",
      undo: {
        reversible: true,
        deadline: new Date(Date.now() + 60_000).toISOString(),
        inverseOperationId: "u1:a1:c1:undo",
        createdTodoId: "decision-u1:a1:c1",
        inverseCandidate: {
          ...candidate,
          changeType: "remove",
          proposedContent: "decision-u1:a1:c1",
          rawAudio: "secret-audio",
          supportingSpan: { text: "secret-transcript" },
          confidence: 0.1,
          binding: { patientId: "wrong-patient" },
        },
      },
    }),
  );
  const result = await undoDecisionOperation(
    "u1",
    "entry1",
    async () => "queued",
  );
  assert.equal(result.status, "queued");
  const queued = await store.get("entry1");
  assert.equal(queued?.status, "undo-pending");
  assert.ok(queued?.undo?.requestedAt);
  assert.equal(queued?.undo?.inverseOperationId, "u1:a1:c1:undo");
  decisionScribeOutbox.resetStore();
});

test("concurrent undo clicks share one inverse transport and stable inverse id", async () => {
  const store = createMemoryDecisionScribeOutboxStore();
  decisionScribeOutbox.setStore(store);
  await store.add(
    entry({
      status: "completed",
      undo: {
        reversible: true,
        deadline: new Date(Date.now() + 60_000).toISOString(),
        inverseOperationId: "u1:a1:c1:undo",
        inverseCandidate: {
          ...candidate,
          changeType: "remove",
          proposedContent: "decision-u1:a1:c1",
        },
      },
    }),
  );
  let calls = 0;
  let inverseId = "";
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const committer = async (operation: DurableDecisionOperation) => {
    calls++;
    inverseId = operation.operationId;
    await gate;
    return "queued" as const;
  };
  const first = undoDecisionOperation("u1", "entry1", committer);
  const second = undoDecisionOperation("u1", "entry1", committer);
  release();
  const results = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(inverseId, "u1:a1:c1:undo");
  assert.equal(results[0].status, "queued");
  assert.equal(results[1].status, "queued");
  assert.equal((await store.get("entry1"))?.status, "undo-pending");
  decisionScribeOutbox.resetStore();
});

test("undo retry sends the stable inverse operation id", async () => {
  const store = createMemoryDecisionScribeOutboxStore();
  decisionScribeOutbox.setStore(store);
  await store.add(
    entry({
      status: "undo-pending",
      undo: {
        reversible: true,
        requestedAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 60_000).toISOString(),
        inverseOperationId: "u1:a1:c1:undo",
        inverseCandidate: {
          ...candidate,
          changeType: "remove",
          proposedContent: "decision-u1:a1:c1",
          rawAudio: "secret-audio",
          supportingSpan: { text: "secret-transcript" },
          confidence: 0.1,
          binding: { patientId: "wrong-patient" },
        },
      },
    }),
  );
  let operationId = "";
  await retryDecisionScribeOutbox("u1", async (operation) => {
    operationId = operation.operationId;
    assert.equal(operation.candidate.proposedContent, "decision-u1:a1:c1");
    assert.equal("rawAudio" in operation.candidate, false);
    assert.equal("supportingSpan" in operation.candidate, false);
    assert.equal("confidence" in operation.candidate, false);
    assert.equal("binding" in operation.candidate, false);
    return "committed";
  });
  assert.equal(operationId, "u1:a1:c1:undo");
  assert.equal((await store.get("entry1"))?.status, "undone");
  decisionScribeOutbox.resetStore();
});

test("malformed reversible metadata fails closed without inverse transport", async () => {
  const store = createMemoryDecisionScribeOutboxStore();
  decisionScribeOutbox.setStore(store);
  await store.add(
    entry({
      status: "completed",
      undo: {
        reversible: true,
        deadline: new Date(Date.now() + 60_000).toISOString(),
        inverseOperationId: "u1:a1:c1:undo",
      },
    }),
  );
  let calls = 0;
  const result = await undoDecisionOperation("u1", "entry1", async () => {
    calls++;
    return "committed";
  });
  assert.equal(result.status, "unavailable");
  assert.equal(calls, 0);
  assert.equal((await store.get("entry1"))?.status, "completed");
  decisionScribeOutbox.resetStore();
});

test("failed durable undo claim makes zero inverse transport calls", async () => {
  const base = createMemoryDecisionScribeOutboxStore();
  await base.add(
    entry({
      status: "completed",
      undo: {
        reversible: true,
        deadline: new Date(Date.now() + 60_000).toISOString(),
        inverseOperationId: "u1:a1:c1:undo",
        inverseCandidate: { ...candidate, changeType: "remove" },
      },
    }),
  );
  decisionScribeOutbox.setStore({
    ...base,
    put: async () => {
      throw new Error("claim failed");
    },
  });
  let calls = 0;
  await assert.rejects(
    undoDecisionOperation("u1", "entry1", async () => {
      calls++;
      return "committed";
    }),
    /claim failed/,
  );
  assert.equal(calls, 0);
  decisionScribeOutbox.resetStore();
});
