import { db, isIndexedDBAvailable } from "@/lib/offline/database";
import type {
  Attestation,
  ApprovedDecisionProjection,
  DecisionCandidate,
  DecisionDestination,
  DurableDecisionOperation,
} from "@/types/decisionScribe";

export type DecisionScribeOutboxStatus =
  | "pending"
  | "syncing"
  | "undo-pending"
  | "conflict"
  | "failed"
  | "completed"
  | "undone";
export type StructuredCandidate = ApprovedDecisionProjection;
export interface DecisionScribeUndoMetadata {
  previousStructuredValue?: ApprovedDecisionProjection;
  inverseCandidate?: ApprovedDecisionProjection;
  createdTodoId?: string;
  reversible: boolean;
  deadline: string;
  inverseOperationId: string;
  requestedAt?: string;
}
export type DurableDecisionOperationWithUndo = DurableDecisionOperation & {
  undo?: DecisionScribeUndoMetadata;
};
export interface ConflictSide {
  value: string;
  candidate: StructuredCandidate;
  destination: DecisionDestination;
}
export interface DecisionScribeConflict {
  mine: ConflictSide;
  theirs: ConflictSide;
  candidateId: string;
  destination: DecisionDestination;
  resolution: "unresolved" | "mine" | "theirs" | "merge";
}
export interface DecisionScribeOutboxEntry extends DurableDecisionOperationWithUndo {
  id: string;
  payloadFingerprint: string;
  status: DecisionScribeOutboxStatus;
  createdAt: string;
  retryCount: number;
  nextRetryAt?: number;
  lastError?: string;
  receipt?: string;
  conflict?: DecisionScribeConflict;
}
export interface DecisionScribeOutboxStore {
  get(id: string): Promise<DecisionScribeOutboxEntry | undefined>;
  put(entry: DecisionScribeOutboxEntry): Promise<void>;
  add(entry: DecisionScribeOutboxEntry): Promise<void>;
  list(ownerId: string): Promise<DecisionScribeOutboxEntry[]>;
  delete(id: string): Promise<void>;
}
export const createMemoryDecisionScribeOutboxStore =
  (): DecisionScribeOutboxStore => {
    const entries = new Map<string, DecisionScribeOutboxEntry>();
    return {
      async get(id) {
        return entries.get(id);
      },
      async put(entry) {
        entries.set(entry.id, entry);
      },
      async add(entry) {
        if (entries.has(entry.id)) throw new Error("duplicate");
        entries.set(entry.id, entry);
      },
      async list(ownerId) {
        return [...entries.values()].filter(
          (entry) => entry.ownerId === ownerId,
        );
      },
      async delete(id) {
        entries.delete(id);
      },
    };
  };
const unavailable = (): never => {
  throw new Error("IndexedDB API missing; inject a test outbox store");
};
const productionStore: DecisionScribeOutboxStore = {
  async get(id) {
    if (!isIndexedDBAvailable()) return unavailable();
    await db.open();
    return db.decisionScribeOutbox.get(id);
  },
  async put(entry) {
    if (!isIndexedDBAvailable()) return unavailable();
    await db.open();
    await db.decisionScribeOutbox.put(entry);
  },
  async add(entry) {
    if (!isIndexedDBAvailable()) return unavailable();
    await db.open();
    await db.decisionScribeOutbox.add(entry);
  },
  async list(ownerId) {
    if (!isIndexedDBAvailable()) return unavailable();
    await db.open();
    return db.decisionScribeOutbox.where("ownerId").equals(ownerId).toArray();
  },
  async delete(id) {
    if (!isIndexedDBAvailable()) return unavailable();
    await db.open();
    await db.decisionScribeOutbox.delete(id);
  },
};
let store: DecisionScribeOutboxStore = productionStore;
let activeOwner: string | null = null;
const listeners = new Set<(entries: DecisionScribeOutboxEntry[]) => void>();
const listenerErrors = new Map<
  (entries: DecisionScribeOutboxEntry[]) => void,
  (error: unknown) => void
>();
const notify = async () => {
  try {
    const entries = activeOwner ? await store.list(activeOwner) : [];
    listeners.forEach((listener) => listener(entries));
  } catch (error) {
    listeners.forEach((listener) => listenerErrors.get(listener)?.(error));
  }
};
const key = (a: Attestation, id: string) =>
  `decision-${a.draftId}-${id}-${a.patientId}`;
const operationIdFor = (ownerId: string, a: Attestation, id: string) =>
  `${ownerId}:${a.id}:${id}`;
const structured = (c: DecisionCandidate): StructuredCandidate => ({
  id: c.id,
  destination: c.destination,
  statementType: c.statementType,
  polarity: c.polarity,
  changeType: c.changeType,
  proposedContent: c.proposedContent.trim(),
  task: c.task,
  conditionality: c.conditionality,
});
const fingerprint = (ownerId: string, a: Attestation, c: StructuredCandidate) =>
  JSON.stringify({
    ownerId,
    attestationId: a.id,
    draftId: a.draftId,
    sessionId: a.sessionId,
    patientId: a.patientId,
    physicianId: a.physicianId,
    roundId: a.roundId,
    candidate: c,
  });
export const decisionScribeOutbox = {
  setOwner(ownerId: string | null) {
    activeOwner = ownerId;
  },
  setStore(next: DecisionScribeOutboxStore) {
    store = next;
  },
  resetStore() {
    store = productionStore;
  },
  subscribe(
    listener: (entries: DecisionScribeOutboxEntry[]) => void,
    onError?: (error: unknown) => void,
  ) {
    listeners.add(listener);
    if (onError) listenerErrors.set(listener, onError);
    return () => {
      listeners.delete(listener);
      listenerErrors.delete(listener);
    };
  },
  async list(ownerId?: string) {
    const owner = ownerId ?? activeOwner;
    return owner ? store.list(owner) : [];
  },
  async enqueue(input: {
    ownerId: string;
    attestation: Attestation;
    candidate: DecisionCandidate;
    undo?: DecisionScribeUndoMetadata;
  }) {
    const { ownerId, attestation, candidate } = input;
    if (
      !ownerId.trim() ||
      candidate.disposition !== "approved" ||
      candidate.material !== "provisional-structured" ||
      candidate.source !== "rounds-audio" ||
      candidate.provenance !== "spoken-span" ||
      !attestation.approvedCandidateIds.includes(candidate.id) ||
      candidate.binding.patientId !== attestation.patientId ||
      candidate.binding.sessionId !== attestation.sessionId ||
      candidate.binding.roundId !== attestation.roundId ||
      candidate.binding.physicianId !== attestation.physicianId ||
      !candidate.proposedContent.trim()
    )
      throw new Error(
        "Decision Scribe outbox refused: unattested or impermissible candidate",
      );
    const shaped = structured(candidate);
    const id = key(attestation, candidate.id);
    const operationId = operationIdFor(ownerId, attestation, candidate.id);
    const payloadFingerprint = fingerprint(ownerId, attestation, shaped);
    const existing = await store.get(id);
    if (existing) {
      if (
        existing.ownerId !== ownerId ||
        existing.operationId !== operationId ||
        existing.payloadFingerprint !== payloadFingerprint
      )
        throw new Error("Decision Scribe outbox operation collision");
      return existing;
    }
    const entry: DecisionScribeOutboxEntry = {
      id,
      operationId,
      ownerId,
      attestation,
      patientId: attestation.patientId,
      roundId: attestation.roundId,
      candidate: shaped,
      payloadFingerprint,
      status: "pending",
      createdAt: attestation.attestedAt,
      retryCount: 0,
      ...(input.undo ? { undo: input.undo } : {}),
    };
    try {
      await store.add(entry);
    } catch {
      const raced = await store.get(id);
      if (
        !raced ||
        raced.ownerId !== ownerId ||
        raced.payloadFingerprint !== payloadFingerprint
      )
        throw new Error("Decision Scribe outbox operation collision");
      return raced;
    }
    await notify();
    return entry;
  },
  async beginSync(id: string, ownerId: string) {
    const entry = await store.get(id);
    if (
      !entry ||
      entry.ownerId !== ownerId ||
      entry.status === "completed" ||
      entry.status === "undone" ||
      entry.status === "conflict"
    )
      return false;
    await store.put({ ...entry, status: "syncing" });
    await notify();
    return true;
  },
  async update(
    id: string,
    patch: Partial<DecisionScribeOutboxEntry>,
    ownerId?: string,
  ) {
    const entry = await store.get(id);
    if (!entry || (ownerId && entry.ownerId !== ownerId)) return;
    await store.put({ ...entry, ...patch });
    await notify();
  },
  async acknowledge(id: string, ownerId: string, receipt?: string) {
    const entry = await store.get(id);
    if (!entry || entry.ownerId !== ownerId) return;
    await store.put({
      ...entry,
      status: "completed",
      ...(receipt ? { receipt } : {}),
    });
    await notify();
  },
  async resolveConflict(
    id: string,
    choice: "mine" | "theirs" | "merge",
    merged?: string,
    ownerId?: string,
  ) {
    const entry = (await this.list(ownerId)).find((item) => item.id === id);
    if (!entry?.conflict) return;
    if (choice === "merge" && !merged?.trim())
      throw new Error("A merged value is required");
    const proposedContent =
      choice === "mine"
        ? entry.conflict.mine.value
        : choice === "theirs"
          ? entry.conflict.theirs.value
          : merged!.trim();
    await this.update(
      id,
      {
        status: "pending",
        candidate: { ...entry.candidate, proposedContent },
        conflict: { ...entry.conflict, resolution: choice },
        payloadFingerprint: fingerprint(entry.ownerId, entry.attestation, {
          ...entry.candidate,
          proposedContent,
        }),
      },
      ownerId,
    );
  },
  async removeCompleted(ownerId?: string) {
    await Promise.all(
      (await this.list(ownerId))
        .filter((entry) => entry.status === "completed")
        .map((entry) => store.delete(entry.id)),
    );
    await notify();
  },
  async clear(ownerId?: string) {
    await Promise.all(
      (await this.list(ownerId)).map((entry) => store.delete(entry.id)),
    );
    await notify();
  },
};
