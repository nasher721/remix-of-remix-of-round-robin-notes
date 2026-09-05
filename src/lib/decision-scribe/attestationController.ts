import type {
  Attestation,
  CaptureBinding,
  DecisionCandidate,
  DecisionDraft,
  DurableDecisionOperation,
  ApprovedDecisionProjection,
} from "@/types/decisionScribe";
import type { PatientMedications } from "@/types/patient";
import { asAttestationId } from "@/types/decisionScribe";
import {
  canDurablyWrite,
  durableWriteViolations,
} from "./decisionScribePolicy";
import {
  decisionScribeOutbox,
  type DecisionScribeOutboxEntry,
  type DecisionScribeUndoMetadata,
} from "./decisionScribeOutbox";
import { inferSystemKey } from "./decisionMutationMapping";
export interface AttestationCommitResult {
  status: "committed" | "queued" | "conflict";
  attestation: Attestation;
  candidateIds: string[];
}
export interface CommitConflict {
  mine?: string;
  theirs?: string;
}
export type AttestationCommitOutcome =
  | "committed"
  | "queued"
  | "conflict"
  | "failed"
  | {
      status: "committed" | "queued" | "conflict" | "failed";
      conflict?: CommitConflict;
      receipt?: string;
    };
export type CommitResult = AttestationCommitOutcome;
export interface AttestationCommitter {
  commit: (
    candidate: DecisionCandidate,
    attestation: Attestation,
    operationId?: string,
  ) => Promise<AttestationCommitOutcome>;
}
export interface AttestationRequest {
  ownerId: string;
  physicianId: string;
  draft: DecisionDraft | null | undefined;
  binding: CaptureBinding;
  patientSnapshotId: string;
  approvedCandidateIds: readonly string[];
  approvedCandidates?: readonly DecisionCandidate[];
  now?: Date;
}
const flights = new Map<string, Promise<AttestationCommitResult>>();
const statusOf = (
  o: AttestationCommitOutcome,
): "committed" | "queued" | "conflict" | "failed" =>
  typeof o === "string" ? o : o.status;
const conflictOf = (o: AttestationCommitOutcome) =>
  typeof o === "string" ? undefined : o.conflict;
const usableProjection = (
  value: unknown,
): value is ApprovedDecisionProjection => {
  if (!value || typeof value !== "object") return false;
  const projection = value as Partial<ApprovedDecisionProjection>;
  return (
    typeof projection.id === "string" &&
    projection.id.trim().length > 0 &&
    typeof projection.destination === "string" &&
    typeof projection.statementType === "string" &&
    typeof projection.polarity === "string" &&
    typeof projection.proposedContent === "string" &&
    projection.proposedContent.trim().length > 0
  );
};
const sanitizeInverseProjection = (
  value: ApprovedDecisionProjection,
): ApprovedDecisionProjection => ({
  id: value.id,
  destination: value.destination,
  statementType: value.statementType,
  polarity: value.polarity,
  ...(value.changeType ? { changeType: value.changeType } : {}),
  ...(value.inverseAction ? { inverseAction: value.inverseAction } : {}),
  ...(value.systemKey ? { systemKey: value.systemKey } : {}),
  proposedContent: value.proposedContent.trim(),
  ...(value.previousMedications
    ? {
        previousMedications: {
          infusions: [...value.previousMedications.infusions],
          scheduled: [...value.previousMedications.scheduled],
          prn: [...value.previousMedications.prn],
          ...(value.previousMedications.rawText !== undefined
            ? { rawText: value.previousMedications.rawText }
            : {}),
        },
      }
    : {}),
  ...(value.task ? { task: { ...value.task } } : {}),
  ...(value.conditionality ? { conditionality: value.conditionality } : {}),
});
const conflictFor = (
  c: Pick<DecisionCandidate, "id" | "destination" | "proposedContent">,
  e: DecisionScribeOutboxEntry,
  d?: CommitConflict,
) => {
  const mine = (d?.mine ?? c.proposedContent).trim();
  const theirs = (d?.theirs ?? "[server value unavailable]").trim();
  return {
    candidateId: c.id,
    destination: c.destination,
    resolution: "unresolved" as const,
    mine: { value: mine, candidate: e.candidate, destination: c.destination },
    theirs: {
      value: theirs,
      candidate: {
        ...e.candidate,
        proposedContent: theirs,
      },
      destination: c.destination,
    },
  };
};
const undoMetadata = (
  candidate: DecisionCandidate,
  attestation: Attestation,
  ownerId: string,
): DecisionScribeUndoMetadata => {
  const operationId = `${ownerId}:${attestation.id}:${candidate.id}`;
  const projection = (
    proposedContent: string,
    changeType = candidate.changeType,
    inverseAction?: "restore" | "remove",
    previousMedications?: PatientMedications,
    systemKey = candidate.destination === "systems" ? inferSystemKey(candidate) : undefined,
  ) => ({
    id: candidate.id,
    destination: candidate.destination,
    statementType: candidate.statementType,
    polarity: candidate.polarity,
    changeType,
    proposedContent: proposedContent.trim(),
    ...(previousMedications ? { previousMedications } : {}),
    task: candidate.task,
    conditionality: candidate.conditionality,
    ...(inverseAction ? { inverseAction } : {}),
    ...(systemKey ? { systemKey } : {}),
  });
  const previousMedications =
    candidate.destination === "medications" && candidate.currentValue?.trim()
      ? (() => {
          try {
            const parsed: unknown = JSON.parse(candidate.currentValue!);
            return parsed &&
              typeof parsed === "object" &&
              Array.isArray((parsed as PatientMedications).infusions) &&
              Array.isArray((parsed as PatientMedications).scheduled) &&
              Array.isArray((parsed as PatientMedications).prn) &&
              [...(parsed as PatientMedications).infusions, ...(parsed as PatientMedications).scheduled, ...(parsed as PatientMedications).prn].every((item) => typeof item === "string")
              ? {
                  infusions: [...(parsed as PatientMedications).infusions],
                  scheduled: [...(parsed as PatientMedications).scheduled],
                  prn: [...(parsed as PatientMedications).prn],
                  ...((parsed as PatientMedications).rawText !== undefined ? { rawText: String((parsed as PatientMedications).rawText) } : {}),
                }
              : {
                  infusions: [],
                  scheduled: [candidate.currentValue!.trim()],
                  prn: [],
                };
          } catch {
            return {
              infusions: [],
              scheduled: [candidate.currentValue.trim()],
              prn: [],
            };
          }
        })()
      : undefined;
  const previousStructuredValue = candidate.currentValue?.trim()
    ? projection(
        candidate.currentValue,
        candidate.changeType,
        "restore",
        previousMedications,
      )
    : undefined;
  const createdTodoId =
    candidate.destination === "todo" ? `decision-${operationId}` : undefined;
  const insertedMedicationValue = candidate.proposedContent
    .replace(/^(add|start)\s+/i, "")
    .trim();
  const inverseCandidate =
    candidate.destination === "todo"
      ? projection(createdTodoId!, "remove", "remove")
      : candidate.destination === "medications" &&
          (candidate.changeType === "add" ||
            candidate.changeType === "start") &&
          !previousStructuredValue &&
          insertedMedicationValue
        ? projection(insertedMedicationValue, "remove", "remove")
        : undefined;
  return {
    ...(previousStructuredValue ? { previousStructuredValue } : {}),
    ...(createdTodoId ? { createdTodoId } : {}),
    ...(inverseCandidate ? { inverseCandidate } : {}),
    reversible: Boolean(previousStructuredValue || inverseCandidate),
    deadline: candidate.binding.expiresAt,
    inverseOperationId: `${operationId}:undo`,
  };
};
export async function attest(
  request: AttestationRequest,
  committer: AttestationCommitter,
): Promise<AttestationCommitResult> {
  const ids = [...new Set(request.approvedCandidateIds)].sort();
  const flightKey = `${request.ownerId}:${request.draft?.id}:${ids.join(",")}`;
  const running = flights.get(flightKey);
  if (running) return running;
  const operation: Promise<AttestationCommitResult> = (async () => {
    const draft = request.draft;
    if (
      !draft ||
      draft.status !== "review" ||
      !ids.length ||
      ids.length !== request.approvedCandidateIds.length ||
      request.patientSnapshotId !== request.binding.patientSnapshotId ||
      request.physicianId !== request.binding.physicianId
    )
      throw new Error(
        "Attestation refused: unavailable, stale, or invalid review",
      );
    if (
      draft.binding.patientId !== request.binding.patientId ||
      draft.binding.sessionId !== request.binding.sessionId ||
      draft.binding.roundId !== request.binding.roundId
    )
      throw new Error("Attestation refused: patient/session/round mismatch");
    const selected = ids.map(
      (id) =>
        request.approvedCandidates?.find((c) => c.id === id) ??
        draft.candidates.find((c) => c.id === id),
    );
    if (selected.some((c) => !c))
      throw new Error("Attestation refused: candidate identity mismatch");
    const candidates = selected.filter((c): c is DecisionCandidate =>
      Boolean(c),
    );
    const now = request.now ?? new Date();
    const attestation: Attestation = {
      id: asAttestationId(
        `attestation-${draft.id}-${request.binding.sessionId}-${ids.join(",")}`,
      ),
      draftId: draft.id,
      sessionId: request.binding.sessionId,
      patientId: request.binding.patientId,
      physicianId: request.physicianId,
      attestedAt: now.toISOString(),
      approvedCandidateIds: candidates.map((c) => c.id),
      roundId: request.binding.roundId,
      deviceId: request.binding.deviceId,
    };
    const outcomes: Array<"committed" | "queued" | "conflict"> = [];
    for (const candidate of candidates) {
      const policyRequest = {
        draft,
        candidate: { ...candidate, disposition: "approved" as const },
        attestation,
        binding: request.binding,
        patientSnapshotId: request.patientSnapshotId,
        material: "approved-structured" as const,
        now,
      };
      if (!canDurablyWrite(policyRequest))
        throw new Error(
          `Attestation refused: ${durableWriteViolations(policyRequest).join(", ")}`,
        );
      const e = await decisionScribeOutbox.enqueue({
        ownerId: request.ownerId,
        attestation,
        candidate: policyRequest.candidate,
        undo: undoMetadata(candidate, attestation, request.ownerId),
      });
      if (e.status === "completed") {
        outcomes.push("committed");
        continue;
      }
      if (!(await decisionScribeOutbox.beginSync(e.id, request.ownerId))) {
        outcomes.push(e.status === "conflict" ? "conflict" : "queued");
        continue;
      }
      try {
        const result = await committer.commit(
          candidate,
          attestation,
          e.operationId,
        );
        const status = statusOf(result);
        if (status === "conflict")
          await decisionScribeOutbox.update(
            e.id,
            { status, conflict: conflictFor(candidate, e, conflictOf(result)) },
            request.ownerId,
          );
        else if (status === "committed")
          await decisionScribeOutbox.acknowledge(e.id, request.ownerId);
        else if (status === "queued") {
          const receipt =
            typeof result === "string" ? undefined : result.receipt;
          await decisionScribeOutbox.update(
            e.id,
            {
              status: "pending",
              retryCount: e.retryCount + 1,
              nextRetryAt:
                Date.now() + Math.min(300000, 1000 * 2 ** e.retryCount),
              ...(receipt ? { receipt } : {}),
            },
            request.ownerId,
          );
        } else if (status === "failed")
          throw new Error("Decision Scribe durable write failed");
        if (
          status === "committed" ||
          status === "queued" ||
          status === "conflict"
        )
          outcomes.push(status);
      } catch (error) {
        await decisionScribeOutbox.update(
          e.id,
          {
            status: "failed",
            retryCount: e.retryCount + 1,
            nextRetryAt:
              Date.now() + Math.min(300000, 1000 * 2 ** e.retryCount),
          },
          request.ownerId,
        );
        throw error;
      }
    }
    return {
      status: outcomes.includes("conflict")
        ? "conflict"
        : outcomes.includes("queued")
          ? "queued"
          : "committed",
      attestation,
      candidateIds: ids,
    };
  })();
  flights.set(flightKey, operation);
  try {
    return await operation;
  } finally {
    flights.delete(flightKey);
  }
}
export async function retryDecisionScribeOutbox(
  ownerId: string,
  committer: (
    operation: DurableDecisionOperation,
  ) => Promise<AttestationCommitOutcome>,
) {
  decisionScribeOutbox.setOwner(ownerId);
  let acknowledged = 0;
  let conflicts = 0;
  const now = Date.now();
  const entries = await decisionScribeOutbox.list(ownerId);
  for (const e of entries.filter(
    (x) =>
      (x.status === "pending" ||
        x.status === "failed" ||
        x.status === "undo-pending" ||
        (x.status === "syncing" &&
          now - new Date(x.createdAt).getTime() >= 60000)) &&
      (!x.nextRetryAt || x.nextRetryAt <= now),
  )) {
    const isUndo = e.status === "undo-pending";
    const inverseCandidate = e.undo?.previousStructuredValue ?? e.undo?.inverseCandidate;
    if (
      isUndo &&
      (!e.undo?.reversible ||
        !e.undo.inverseOperationId?.trim() ||
        !usableProjection(inverseCandidate))
    ) {
      await decisionScribeOutbox.update(
        e.id,
        { status: "failed", lastError: "Undo metadata is invalid" },
        ownerId,
      );
      continue;
    }
    if (!(await decisionScribeOutbox.beginSync(e.id, ownerId))) continue;
    const operation: DurableDecisionOperation = {
      operationId: isUndo ? e.undo!.inverseOperationId : e.operationId,
      ownerId: e.ownerId,
      attestation: e.attestation,
      patientId: e.patientId,
      roundId: e.roundId,
      candidate: isUndo
        ? sanitizeInverseProjection(inverseCandidate as ApprovedDecisionProjection)
        : e.candidate,
    };
    try {
      const result = await committer(operation);
      const status = statusOf(result);
      if (status === "conflict") {
        conflicts++;
        await decisionScribeOutbox.update(
          e.id,
          { status, conflict: conflictFor(operation.candidate, e, conflictOf(result)) },
          ownerId,
        );
      } else if (status === "committed") {
        acknowledged++;
        if (isUndo) {
          await decisionScribeOutbox.update(
            e.id,
            {
              status: "undone",
              ...(typeof result === "string" || !result.receipt
                ? {}
                : { receipt: result.receipt }),
            },
            ownerId,
          );
        } else {
          await decisionScribeOutbox.acknowledge(e.id, ownerId);
        }
      } else if (status === "queued") {
        const receipt = typeof result === "string" ? undefined : result.receipt;
        await decisionScribeOutbox.update(
          e.id,
          {
            status: isUndo ? "undo-pending" : "pending",
            retryCount: e.retryCount + 1,
            nextRetryAt:
              Date.now() + Math.min(300000, 1000 * 2 ** e.retryCount),
            ...(receipt ? { receipt } : {}),
          },
          ownerId,
        );
      } else if (status === "failed") {
        await decisionScribeOutbox.update(
          e.id,
          {
            status: "failed",
            retryCount: e.retryCount + 1,
            nextRetryAt:
              Date.now() + Math.min(300000, 1000 * 2 ** e.retryCount),
            lastError: isUndo ? "Undo commit failed" : "Decision Scribe commit failed",
          },
          ownerId,
        );
      }
    } catch {
      await decisionScribeOutbox.update(
        e.id,
        {
          status: "failed",
          retryCount: e.retryCount + 1,
          nextRetryAt: Date.now() + Math.min(300000, 1000 * 2 ** e.retryCount),
        },
        ownerId,
      );
    }
  }
  return { acknowledged, conflicts };
}

export type UndoResult = {
  status: "undone" | "unavailable" | "queued";
  receipt?: string;
  reason?: string;
};

/** Reverses a completed operation only when its sanitized inverse is still valid. */
const undoFlights = new Map<string, Promise<UndoResult>>();

async function undoDecisionOperationInternal(
  ownerId: string,
  id: string,
  inverseCommitter: (
    operation: DurableDecisionOperation,
  ) => Promise<CommitResult>,
  now = new Date(),
): Promise<UndoResult> {
  let entry: DecisionScribeOutboxEntry | undefined;
  try {
    entry = (await decisionScribeOutbox.list(ownerId)).find(
      (item) => item.id === id,
    );
  } catch {
    return {
      status: "unavailable",
      reason: "Decision Scribe outbox is unavailable",
    };
  }
  if (!entry || entry.ownerId !== ownerId)
    return { status: "unavailable", reason: "operation not found" };
  const undo = entry.undo;
  const inverseCandidate = undo?.previousStructuredValue ?? undo?.inverseCandidate;
  if (entry.status === "undone")
    return { status: "undone", receipt: entry.receipt };
  if (entry.status !== "completed") {
    if (entry.status === "failed" || entry.status === "conflict")
      return { status: "unavailable", reason: "operation is not completed" };
    if (
      entry.undo?.requestedAt &&
      (entry.status === "undo-pending" || entry.status === "syncing")
    )
      return { status: "queued", reason: "Undo is queued" };
    if (
      !undo?.reversible ||
      !undo.inverseOperationId?.trim() ||
      !usableProjection(inverseCandidate)
    )
      return { status: "unavailable", reason: "undo metadata is invalid" };
    await decisionScribeOutbox.update(
      id,
      {
        status: "undo-pending",
      undo: {
        ...entry.undo,
        requestedAt: now.toISOString(),
        inverseOperationId: undo.inverseOperationId,
        reversible: undo.reversible,
        deadline: undo.deadline,
        ...(undo.previousStructuredValue
          ? { previousStructuredValue: undo.previousStructuredValue }
          : { inverseCandidate: undo.inverseCandidate }),
      },
      },
      ownerId,
    );
    return {
      status: "queued",
      reason: "Undo is queued until the original change is acknowledged",
    };
  }
  if (
    !undo?.reversible ||
    !undo.inverseOperationId?.trim() ||
    !usableProjection(inverseCandidate)
  )
    return { status: "unavailable", reason: "undo metadata is invalid" };
  const safeInverseCandidate = sanitizeInverseProjection(inverseCandidate);
  if (!undo?.reversible)
    return { status: "unavailable", reason: "operation is not reversible" };
  if (now.getTime() > new Date(undo.deadline).getTime())
    return { status: "unavailable", reason: "undo window expired" };
  await decisionScribeOutbox.update(
    id,
    {
      status: "undo-pending",
      undo: {
        ...undo,
        requestedAt: now.toISOString(),
        inverseOperationId: undo.inverseOperationId,
        ...(undo.previousStructuredValue
          ? { previousStructuredValue: undo.previousStructuredValue }
          : { inverseCandidate: safeInverseCandidate }),
      },
    },
    ownerId,
  );
  const inverse: DurableDecisionOperation = {
    operationId: undo.inverseOperationId,
    ownerId: entry.ownerId,
    attestation: entry.attestation,
    patientId: entry.patientId,
    roundId: entry.roundId,
    candidate: safeInverseCandidate,
  };
  let result: CommitResult;
  try {
    result = await inverseCommitter(inverse);
  } catch {
    await decisionScribeOutbox.update(
      id,
      {
        status: "failed",
        retryCount: entry.retryCount + 1,
        nextRetryAt: Date.now() + Math.min(300000, 1000 * 2 ** entry.retryCount),
        lastError: "Undo commit failed",
      },
      ownerId,
    );
    return { status: "unavailable", reason: "inverse commit failed" };
  }
  const status = statusOf(result);
  if (status === "committed") {
    const receipt = typeof result === "string" ? undefined : result.receipt;
    try {
      await decisionScribeOutbox.update(
        id,
        { status: "undone", ...(receipt ? { receipt } : {}) },
        ownerId,
      );
    } catch {
      return {
        status: "unavailable",
        reason: "Decision Scribe outbox is unavailable",
      };
    }
    return { status: "undone", receipt };
  }
  if (status === "queued") {
    const receipt = typeof result === "string" ? undefined : result.receipt;
    await decisionScribeOutbox.update(
      id,
      {
        status: "undo-pending",
        retryCount: entry.retryCount + 1,
        nextRetryAt: Date.now() + Math.min(300000, 1000 * 2 ** entry.retryCount),
        ...(receipt ? { receipt } : {}),
      },
      ownerId,
    );
    return { status: "queued", receipt };
  }
  if (status === "conflict") {
    await decisionScribeOutbox.update(
      id,
      {
        status: "conflict",
        conflict: conflictFor(inverse.candidate, entry, conflictOf(result)),
      },
      ownerId,
    );
    return { status: "unavailable", reason: "inverse conflicted" };
  }
  await decisionScribeOutbox.update(
    id,
    {
      status: "failed",
      retryCount: entry.retryCount + 1,
      nextRetryAt: Date.now() + Math.min(300000, 1000 * 2 ** entry.retryCount),
      lastError: "Undo commit failed",
    },
    ownerId,
  );
  return { status: "unavailable", reason: "inverse commit failed" };
}

/** De-duplicates concurrent undo clicks; retries happen only through the outbox replay path. */
export function undoDecisionOperation(
  ownerId: string,
  id: string,
  inverseCommitter: (operation: DurableDecisionOperation) => Promise<CommitResult>,
  now = new Date(),
): Promise<UndoResult> {
  const key = `${ownerId}:${id}`;
  const running = undoFlights.get(key);
  if (running) return running;
  const operation = undoDecisionOperationInternal(ownerId, id, inverseCommitter, now);
  undoFlights.set(key, operation);
  void operation.then(
    () => undoFlights.delete(key),
    () => undoFlights.delete(key),
  );
  return operation;
}
