import type { Attestation, CaptureBinding, DecisionCandidate, DecisionDraft, DurableMaterial, SupportingSpan } from "../../types/decisionScribe";

export type PolicyViolation = "wrong-patient" | "wrong-session" | "wrong-round" | "wrong-device" | "wrong-physician" | "missing-span" | "invalid-span" | "expired" | "rejected" | "pending" | "unsupported" | "uncertain" | "unattested" | "invalid-provenance" | "impermissible-material" | "attestation-membership";
export interface DurableWriteRequest { candidate: DecisionCandidate; now: Date; attestation?: Attestation; draft: DecisionDraft; binding: CaptureBinding; material?: DurableMaterial; currentPatientSnapshotId?: string; }

export const isBindingMatch = (candidate: Pick<DecisionCandidate, "binding">, binding: CaptureBinding): boolean => ["sessionId", "roundId", "patientId", "physicianId", "deviceId", "source", "patientSnapshotId", "startedAt", "expiresAt"].every((key) => candidate.binding[key as keyof CaptureBinding] === binding[key as keyof CaptureBinding]);
export const hasValidSupportingSpan = (span: SupportingSpan | undefined): boolean => Boolean(span && span.text.trim() && Number.isFinite(span.startMs) && Number.isFinite(span.endMs) && span.startMs >= 0 && span.endMs > span.startMs && span.speaker && span.sessionId && span.patientId);
export const isAllowedSource = (source: unknown): source is "rounds-audio" => source === "rounds-audio";
export const isAllowedDurableMaterial = (material: unknown): material is "approved-structured" | "nonclinical-audit" => material === "approved-structured" || material === "nonclinical-audit";
const allowed = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === "string" && values.includes(value as T);
const destinations = ["clinicalSummary", "intervalEvents", "imaging", "labs", "medications", "systems", "todo"] as const;
const statements = ["decision", "task", "contingency", "question"] as const;
const changes = ["add", "modify", "remove", "assign", "start", "stop", "continue", "discontinue"] as const;
const speakers = ["physician", "resident", "fellow", "nurse", "other", "unknown"] as const;
const polarities = ["affirmed", "proposed", "negated", "uncertain"] as const;
const dispositions = ["pending", "approved", "rejected"] as const;
export const isExpired = (expiresAt: string, now = new Date()): boolean => { const expiry = Date.parse(expiresAt); return !Number.isFinite(expiry) || expiry <= now.getTime(); };

export const durableWriteViolations = (request: DurableWriteRequest): PolicyViolation[] => {
  const { candidate, binding, now } = request;
  const violations: PolicyViolation[] = [];
  if (candidate.binding.patientId !== binding.patientId) violations.push("wrong-patient");
  if (candidate.binding.sessionId !== binding.sessionId) violations.push("wrong-session");
  if (candidate.binding.roundId !== binding.roundId) violations.push("wrong-round");
  if (candidate.binding.deviceId !== binding.deviceId) violations.push("wrong-device");
  if (candidate.binding.physicianId !== binding.physicianId) violations.push("wrong-physician");
  if (!isAllowedSource(candidate.binding.source) || !isAllowedSource(binding.source) || candidate.source !== "rounds-audio" || candidate.material !== "provisional-structured" || candidate.provenance !== "spoken-span") violations.push("invalid-provenance");
  if (!binding.patientSnapshotId || candidate.binding.patientSnapshotId !== binding.patientSnapshotId || (request.currentPatientSnapshotId !== undefined && request.currentPatientSnapshotId !== binding.patientSnapshotId)) violations.push("wrong-patient");
  const snapshotTime = Date.parse(binding.patientSnapshotCapturedAt); const sessionStart = Date.parse(binding.startedAt);
  if (!Number.isFinite(snapshotTime) || snapshotTime > now.getTime() || snapshotTime < now.getTime() - 15 * 60 * 1000 || snapshotTime > sessionStart) violations.push("expired");
  if (!hasValidSupportingSpan(candidate.supportingSpan)) violations.push("missing-span"); else if (candidate.supportingSpan.sessionId !== binding.sessionId || candidate.supportingSpan.patientId !== binding.patientId) violations.push("invalid-span");
  if (isExpired(candidate.binding.expiresAt, now) || isExpired(binding.expiresAt, now) || candidate.binding.expiresAt !== binding.expiresAt) violations.push("expired");
  if (!candidate.proposedContent.trim() || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1 || !candidate.destination) violations.push("unsupported");
  if (candidate.disposition === "rejected") violations.push("rejected"); if (candidate.disposition === "pending") violations.push("pending");
  if (candidate.polarity === "uncertain") violations.push("uncertain"); if (candidate.polarity === "proposed" || candidate.polarity === "negated") violations.push("unsupported");
  if (request.material !== "approved-structured") violations.push("impermissible-material");
  if (!allowed(destinations, candidate.destination) || !allowed(statements, candidate.statementType) || (candidate.changeType !== undefined && !allowed(changes, candidate.changeType)) || !allowed(speakers, candidate.speaker) || !allowed(polarities, candidate.polarity) || !allowed(dispositions, candidate.disposition)) violations.push("unsupported");
  const draft = request.draft;
  if (!draft || draft.provenance !== "provisional" || draft.status !== "review" || !isBindingMatch({ binding: draft.binding }, binding) || isExpired(draft.expiresAt, now) || !draft.candidates.some((item) => item.id === candidate.id)) violations.push("unattested");
  const attestation = request.attestation;
  if (!attestation) violations.push("unattested"); else {
    if (attestation.sessionId !== binding.sessionId || attestation.patientId !== binding.patientId || attestation.roundId !== binding.roundId || attestation.deviceId !== binding.deviceId || attestation.physicianId !== binding.physicianId) violations.push("unattested");
    if (attestation.draftId !== draft.id) violations.push("unattested");
    if (!attestation.approvedCandidateIds.includes(candidate.id)) violations.push("attestation-membership");
    const attestedAt = Date.parse(attestation.attestedAt); if (!Number.isFinite(attestedAt) || attestedAt < sessionStart || attestedAt > now.getTime()) violations.push("unattested");
  }
  return violations;
};
export const canDurablyWrite = (request: DurableWriteRequest): boolean => durableWriteViolations(request).length === 0;
export const draftIsProvisional = (draft: DecisionDraft): boolean => draft.provenance === "provisional" && draft.status === "review";
export const canRetainApprovedCandidate = (request: DurableWriteRequest): boolean => canDurablyWrite(request);
export const isPermittedRetention = (value: unknown): value is "approved-structured" | "nonclinical-audit" => value === "approved-structured" || value === "nonclinical-audit";
export const isDurableMaterialPermitted = (kind: unknown): boolean => isPermittedRetention(kind);
export const validateDurableWrite = (request: DurableWriteRequest): { allowed: boolean; violations: PolicyViolation[] } => { const violations = durableWriteViolations(request); return { allowed: violations.length === 0, violations }; };
