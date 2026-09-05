/** Fail-closed release policy for Decision Scribe. No policy decision is implicit. */

export type DecisionScribeRolloutMode =
  | "off"
  | "shadow"
  | "full-review"
  | "adaptive-composition"
  | "exception-first";

export interface PilotMetrics {
  reviewedSessions: number;
  approvalRate: number;
  editRate: number;
  reversalRate: number;
  contradictionRate: number;
  criticalMissRate?: number;
  minimumSessions?: number;
  minimumApprovalRate?: number;
  maximumEditRate?: number;
  maximumReversalRate?: number;
  maximumContradictionRate?: number;
  maximumCriticalMissRate?: number;
}

export interface RolloutGates {
  consent: boolean;
  recordingDisclosure: boolean;
  institutionalPolicy: boolean;
  encryption: boolean;
  retention: boolean;
  pilot?: PilotMetrics;
  modelVersion?: string;
  expectedModelVersion?: string;
  contextVersion?: string;
  expectedContextVersion?: string;
  driftDetected?: boolean;
}

export interface RolloutDecision {
  requestedMode: DecisionScribeRolloutMode;
  mode: DecisionScribeRolloutMode;
  allowed: boolean;
  reasons: readonly string[];
  evaluatedAt: string;
}

export interface RolloutTransition {
  from: DecisionScribeRolloutMode;
  to: DecisionScribeRolloutMode;
  actor: string;
  reason: string;
  at: string;
}

const MODES = new Set<DecisionScribeRolloutMode>([
  "off", "shadow", "full-review", "adaptive-composition", "exception-first",
]);

const finiteRate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

export const pilotThresholdsMet = (pilot?: PilotMetrics): boolean => {
  if (!pilot || !Number.isInteger(pilot.reviewedSessions) || pilot.reviewedSessions < (pilot.minimumSessions ?? 20)) return false;
  const minSessions = Math.max(20, pilot.minimumSessions ?? 20);
  const minApproval = Math.max(.95, pilot.minimumApprovalRate ?? .95);
  const maxEdit = Math.min(.1, pilot.maximumEditRate ?? .1);
  const maxReversal = Math.min(.02, pilot.maximumReversalRate ?? .02);
  const maxContradiction = Math.min(.02, pilot.maximumContradictionRate ?? .02);
  const maxCriticalMiss = Math.min(.01, pilot.maximumCriticalMissRate ?? .01);
  if (pilot.reviewedSessions < minSessions) return false;
  return finiteRate(pilot.approvalRate) && pilot.approvalRate >= (pilot.minimumApprovalRate ?? 0.95)
    && pilot.approvalRate >= minApproval && finiteRate(pilot.editRate) && pilot.editRate <= maxEdit
    && finiteRate(pilot.reversalRate) && pilot.reversalRate <= maxReversal
    && finiteRate(pilot.contradictionRate) && pilot.contradictionRate <= maxContradiction
    && (pilot.criticalMissRate === undefined || (finiteRate(pilot.criticalMissRate) && pilot.criticalMissRate <= maxCriticalMiss));
};

const gateFailures = (gates: RolloutGates, requested: DecisionScribeRolloutMode): string[] => {
  const failures: string[] = [];
  if (gates.consent !== true) failures.push("consent-required");
  if (gates.recordingDisclosure !== true) failures.push("recording-disclosure-required");
  if (gates.institutionalPolicy !== true) failures.push("institutional-policy-not-approved");
  if (gates.encryption !== true) failures.push("encryption-not-verified");
  if (gates.retention !== true) failures.push("retention-policy-not-verified");
  if (gates.driftDetected === true) failures.push("model-or-context-drift");
  if (!gates.modelVersion || !gates.expectedModelVersion || gates.modelVersion !== gates.expectedModelVersion) failures.push("model-version-not-verified");
  if (!gates.contextVersion || !gates.expectedContextVersion || gates.contextVersion !== gates.expectedContextVersion) failures.push("context-version-not-verified");
  if ((requested === "adaptive-composition" || requested === "exception-first") && !pilotThresholdsMet(gates.pilot)) failures.push("pilot-thresholds-not-met");
  return failures;
};

export const evaluateRollout = (
  requestedMode: DecisionScribeRolloutMode,
  gates: RolloutGates,
  now = new Date(),
): RolloutDecision => {
  const safeRequested = MODES.has(requestedMode) ? requestedMode : "off";
  if (safeRequested === "off") return { requestedMode: safeRequested, mode: "off", allowed: true, reasons: [], evaluatedAt: now.toISOString() };
  const reasons = gateFailures(gates, safeRequested);
  return { requestedMode: safeRequested, mode: reasons.length ? "full-review" : safeRequested, allowed: reasons.length === 0, reasons, evaluatedAt: now.toISOString() };
};

/** Explicit transition helper. Callers should persist this audit record if required. */
export const transitionRollout = (
  current: DecisionScribeRolloutMode,
  requested: DecisionScribeRolloutMode,
  gates: RolloutGates,
  actor: string,
  now = new Date(),
): { decision: RolloutDecision; transition: RolloutTransition } => {
  const decision = evaluateRollout(requested, gates, now);
  return {
    decision,
    transition: { from: MODES.has(current) ? current : "off", to: decision.mode, actor: actor.trim() || "unknown", reason: decision.reasons.join(",") || "verified-gates", at: decision.evaluatedAt },
  };
};

export const defaultRolloutMode: DecisionScribeRolloutMode = "off";
