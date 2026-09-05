export type DecisionSystemKey =
  | "neuro"
  | "resp"
  | "cv"
  | "renalGU"
  | "gi"
  | "heme"
  | "infectious"
  | "endo"
  | "skinLines"
  | "dispo";

declare const decisionScribeBrand: unique symbol;
export type BrandedId<Kind extends string> = string & {
  readonly [decisionScribeBrand]: Kind;
};
export type CaptureSessionId = BrandedId<"capture-session">;
export type TranscriptSegmentId = BrandedId<"transcript-segment">;
export type DecisionCandidateId = BrandedId<"decision-candidate">;
export type DecisionDraftId = BrandedId<"decision-draft">;
export type AttestationId = BrandedId<"attestation">;
export type AdaptationPatternId = BrandedId<"adaptation-pattern">;
export type StatementType = "decision" | "task" | "contingency" | "question";
export type DecisionPolarity =
  "affirmed" | "proposed" | "negated" | "uncertain";
export type ChangeType =
  | "add"
  | "modify"
  | "remove"
  | "assign"
  | "start"
  | "stop"
  | "continue"
  | "discontinue";
export type DecisionDestination =
  | "clinicalSummary"
  | "intervalEvents"
  | "imaging"
  | "labs"
  | "medications"
  | "systems"
  | "todo";
export type SpeakerRole =
  "physician" | "resident" | "fellow" | "nurse" | "other" | "unknown";
export type ReviewDisposition = "pending" | "approved" | "rejected";
export type DecisionScribeLifecycle =
  | "idle"
  | "capturing"
  | "paused"
  | "processing"
  | "review"
  | "attested"
  | "discarded"
  | "expired"
  | "invalidated"
  | "failed";
export type DecisionScribeFailure =
  | "wrong-patient"
  | "missing-span"
  | "unattested"
  | "unsupported"
  | "cancelled"
  | "conflict"
  | "timeout";
export type DurableMaterial =
  | "approved-structured"
  | "nonclinical-audit"
  | "raw-audio"
  | "temporary-transcript"
  | "rejected-candidate"
  | "unattested-candidate";
export interface CaptureBinding {
  sessionId: CaptureSessionId;
  roundId: string;
  patientId: string;
  physicianId: string;
  deviceId: string;
  startedAt: string;
  expiresAt: string;
  source: "rounds-audio";
  patientSnapshotId: string;
  patientSnapshotCapturedAt: string;
}
export interface SupportingSpan {
  segmentId: TranscriptSegmentId;
  startMs: number;
  endMs: number;
  text: string;
  speaker: SpeakerRole;
  sessionId: CaptureSessionId;
  patientId: string;
}
export interface TemporaryTranscriptSegment {
  id: TranscriptSegmentId;
  binding: Pick<CaptureBinding, "sessionId" | "roundId" | "patientId">;
  speaker: SpeakerRole;
  text: string;
  startMs: number;
  endMs: number;
  expiresAt: string;
}
export interface DecisionTaskMetadata {
  owner?: string;
  dueAt?: string;
  timing?: string;
  conditionalOn?: string;
}
export interface DecisionCandidate {
  id: DecisionCandidateId;
  binding: CaptureBinding;
  speaker: SpeakerRole;
  statementType: StatementType;
  polarity: DecisionPolarity;
  changeType?: ChangeType;
  destination: DecisionDestination;
  proposedContent: string;
  task?: DecisionTaskMetadata;
  confidence: number;
  supportingSpan: SupportingSpan;
  disposition: ReviewDisposition;
  conditionality?: string;
  contradiction?: string;
  currentValue?: string;
  source: "rounds-audio";
  provenance: "spoken-span";
  material: "provisional-structured";
}

export interface ApprovedMedicationState {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText?: string;
}

/** Sanitized, typed projection that is allowed to cross the durable-write boundary. */
export interface ApprovedDecisionProjection {
  id: DecisionCandidateId;
  destination: DecisionDestination;
  statementType: StatementType;
  polarity: DecisionPolarity;
  changeType?: ChangeType;
  inverseAction?: "restore" | "remove";
  /** Exact system destination for reversible system updates; never inferred on undo. */
  systemKey?: DecisionSystemKey;
  proposedContent: string;
  /** Typed prior medication state used only by a sanitized undo projection. */
  previousMedications?: ApprovedMedicationState;
  task?: DecisionTaskMetadata;
  conditionality?: string;
}

export interface DurableDecisionOperation {
  operationId: string;
  ownerId: string;
  attestation: Attestation;
  patientId: string;
  roundId: string;
  candidate: ApprovedDecisionProjection;
}
export interface DecisionDraft {
  id: DecisionDraftId;
  binding: CaptureBinding;
  candidates: DecisionCandidate[];
  createdAt: string;
  expiresAt: string;
  provenance: "provisional";
  status: "review" | "attested" | "discarded";
}
export interface Attestation {
  id: AttestationId;
  draftId: DecisionDraftId;
  sessionId: CaptureSessionId;
  patientId: string;
  physicianId: string;
  attestedAt: string;
  approvedCandidateIds: DecisionCandidateId[];
  roundId: string;
  deviceId: string;
}
export interface AdaptationPattern {
  id: AdaptationPatternId;
  physicianId: string;
  contextKey: string;
  modelVersion: string;
  observationCount: number;
  approvalRate: number;
  editRate: number;
  reversalRate: number;
  contradictionRate: number;
  autonomy: "full-review" | "exception-first";
  revoked: boolean;
  lastObservedAt: string;
}
export const asCaptureSessionId = (v: string) => v as CaptureSessionId;
export const asTranscriptSegmentId = (v: string) => v as TranscriptSegmentId;
export const asDecisionCandidateId = (v: string) => v as DecisionCandidateId;
export const asDecisionDraftId = (v: string) => v as DecisionDraftId;
export const asAttestationId = (v: string) => v as AttestationId;
export const asAdaptationPatternId = (v: string) => v as AdaptationPatternId;
export type DecisionScribeLifecycleState = DecisionScribeLifecycle;
export type DecisionScribeFailureType = DecisionScribeFailure;
