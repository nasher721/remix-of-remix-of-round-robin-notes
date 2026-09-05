/**
 * Evidence-gated adaptation.  This module deliberately accepts attestation
 * outcomes, rather than encounters or candidates, as its only input.
 */

export type Autonomy = "full-review" | "exception-first";
export type VerifiedOutcome = "approved" | "edited" | "reversed";
export type RationaleCode = "physician-request" | "reversal" | "drift" | "context-change" | "model-change" | "reset";

export interface VerifiedAttestationOutcome {
  eventId: string;
  attestationId: string;
  physicianId: string;
  patternKey: string;
  contextKey: string;
  modelVersion: string;
  attestedAt: string;
  outcome: VerifiedOutcome;
  /** The outcome was checked against the explicit, durable attestation. */
  verified: boolean;
  /** Contradiction is a safety signal, even when the item was ultimately approved. */
  contradiction?: boolean;
}

export interface AdaptationThresholds {
  minimumEvidence: number;
  minimumApprovalRate: number;
  maximumEditRate: number;
  maximumReversalRate: number;
  maximumContradictionRate: number;
  maxEvidenceAgeMs: number;
  maxRecentGapMs: number;
  driftTolerance: number;
}

export interface AdaptationPatternProfile {
  patternKey: string;
  physicianId: string;
  contextKey: string;
  modelVersion: string;
  autonomy: Autonomy;
  revoked: boolean;
  evidenceCount: number;
  approvalRate: number;
  editRate: number;
  reversalRate: number;
  contradictionRate: number;
  lastObservedAt?: string;
  rationale: readonly string[];
}

export interface AdaptationProfile {
  physicianId: string;
  generatedAt: string;
  patterns: readonly AdaptationPatternProfile[];
}

export interface AdaptationControlRecord {
  id: string;
  physicianId: string;
  actorId: string;
  type: "reset" | "revoke" | "reduce-autonomy";
  patternKey?: string;
  rationaleCode: RationaleCode;
  createdAt: string;
  resetBefore?: string;
  retainedUntil: string;
}

export const DEFAULT_ADAPTATION_THRESHOLDS: AdaptationThresholds = {
  minimumEvidence: 5,
  minimumApprovalRate: 0.8,
  maximumEditRate: 0.2,
  maximumReversalRate: 0.05,
  maximumContradictionRate: 0.05,
  maxEvidenceAgeMs: 30 * 24 * 60 * 60 * 1000,
  maxRecentGapMs: 14 * 24 * 60 * 60 * 1000,
  driftTolerance: 0.2,
};

const validDate = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const thresholds = (value?: Partial<AdaptationThresholds>): AdaptationThresholds | undefined => {
  if (!value) return DEFAULT_ADAPTATION_THRESHOLDS;
  const numericKeys: (keyof AdaptationThresholds)[] = ["minimumEvidence", "minimumApprovalRate", "maximumEditRate", "maximumReversalRate", "maximumContradictionRate", "maxEvidenceAgeMs", "maxRecentGapMs", "driftTolerance"];
  const candidate = { ...DEFAULT_ADAPTATION_THRESHOLDS };
  for (const key of numericKeys) if (key in value) candidate[key] = value[key] as never;
  const finite = numericKeys.every((key) => Number.isFinite(candidate[key]));
  const safe = candidate.minimumEvidence >= 5 && candidate.minimumApprovalRate >= 0.8 && candidate.maximumEditRate <= 0.2 && candidate.maximumReversalRate <= 0.05 && candidate.maximumContradictionRate <= 0.05 && candidate.maxEvidenceAgeMs <= DEFAULT_ADAPTATION_THRESHOLDS.maxEvidenceAgeMs && candidate.maxRecentGapMs <= DEFAULT_ADAPTATION_THRESHOLDS.maxRecentGapMs && candidate.driftTolerance <= 0.2;
  return finite && safe && candidate.minimumEvidence > 0 && candidate.minimumApprovalRate >= 0 && candidate.minimumApprovalRate <= 1 && candidate.maximumEditRate >= 0 && candidate.maximumReversalRate >= 0 && candidate.maximumContradictionRate >= 0 && candidate.maxEvidenceAgeMs > 0 && candidate.maxRecentGapMs > 0 && candidate.driftTolerance >= 0 ? candidate : undefined;
};

const controlledToken = (value: string): boolean => /^[a-z][a-z0-9._:-]{0,63}$/.test(value) && !/(patient|bed|mrn|encounter|room|name|dob|date|room)/i.test(value);
const rationaleCodes = new Set<RationaleCode>(["physician-request", "reversal", "drift", "context-change", "model-change", "reset"]);
const validControl = (item: AdaptationControlRecord, physicianId: string): boolean => item.physicianId === physicianId && item.actorId === physicianId && (item.type === "reset" || item.type === "revoke" || item.type === "reduce-autonomy") && (!item.patternKey || controlledToken(item.patternKey)) && rationaleCodes.has(item.rationaleCode) && Number.isFinite(validDate(item.createdAt)) && Number.isFinite(validDate(item.retainedUntil)) && validDate(item.retainedUntil) > validDate(item.createdAt) && validDate(item.retainedUntil) <= validDate(item.createdAt) + 90 * 24 * 60 * 60 * 1000 && (!item.resetBefore || Number.isFinite(validDate(item.resetBefore)));

/** Return only evidence that can safely influence a physician's profile. */
export const verifiedOutcomesFor = (
  outcomes: readonly VerifiedAttestationOutcome[],
  physicianId: string,
): VerifiedAttestationOutcome[] => outcomes.filter((item) =>
  typeof item.eventId === "string" && item.eventId.trim().length > 0 &&
  typeof item.attestationId === "string" && item.attestationId.trim().length > 0 &&
  item.physicianId === physicianId &&
  item.verified === true &&
  (item.outcome === "approved" || item.outcome === "edited" || item.outcome === "reversed") &&
  controlledToken(item.patternKey) && controlledToken(item.contextKey) && controlledToken(item.modelVersion) &&
  Number.isFinite(validDate(item.attestedAt)),
);

const uniqueSorted = (items: readonly string[]): string[] => [...new Set(items)].sort();

export const deriveAdaptationProfile = (
  physicianId: string,
  outcomes: readonly VerifiedAttestationOutcome[],
  now = new Date(),
  options?: Partial<AdaptationThresholds> & { contextKey?: string; modelVersion?: string; controls?: readonly AdaptationControlRecord[] },
): AdaptationProfile => {
  const limit = thresholds(options);
  const effectiveLimit = limit ?? DEFAULT_ADAPTATION_THRESHOLDS;
  const nowMs = now.getTime();
  const controls = options?.controls ?? [];
  const controlsValid = controls.every((item) => validControl(item, physicianId));
  const reset = controls.filter((item) => validControl(item, physicianId) && item.type === "reset").sort((a, b) => validDate(b.createdAt) - validDate(a.createdAt))[0];
  const revoked = new Set(controls.filter((item) => validControl(item, physicianId) && (item.type === "revoke" || item.type === "reduce-autonomy") && item.patternKey).map((item) => item.patternKey));
  const seenEvent = new Map<string, VerifiedAttestationOutcome>();
  const seenAttestation = new Map<string, VerifiedAttestationOutcome>();
  let duplicateConflict = false;
  for (const item of verifiedOutcomesFor(outcomes, physicianId)) {
    const priorEvent = seenEvent.get(item.eventId);
    const priorAttestation = seenAttestation.get(item.attestationId);
    if ((priorEvent && JSON.stringify(priorEvent) !== JSON.stringify(item)) || (priorAttestation && JSON.stringify(priorAttestation) !== JSON.stringify(item))) duplicateConflict = true;
    else { seenEvent.set(item.eventId, item); seenAttestation.set(item.attestationId, item); }
  }
  const verifiedBeforeControls = [...seenEvent.values()];
  const verified = verifiedBeforeControls.filter((item) => !reset || validDate(item.attestedAt) > validDate(reset.resetBefore ?? reset.createdAt));
  const eligible = verified.filter((item) => {
    const age = nowMs - validDate(item.attestedAt);
    return age >= 0 && age <= effectiveLimit.maxEvidenceAgeMs;
  });
  // Keep stale patterns visible as full-review entries so the physician can
  // inspect and reset them; stale observations never count toward graduation.
  const keys = uniqueSorted(verifiedBeforeControls.map((item) => `${item.patternKey}\u0000${item.contextKey}\u0000${item.modelVersion}`));
  const patterns = keys.map((key) => {
    const [patternKey, contextKey, modelVersion] = key.split("\u0000");
    const evidence = eligible.filter((item) => item.patternKey === patternKey && item.contextKey === contextKey && item.modelVersion === modelVersion).sort((a, b) => validDate(a.attestedAt) - validDate(b.attestedAt));
    const count = evidence.length;
    const approved = evidence.filter((item) => item.outcome === "approved").length;
    const edits = evidence.filter((item) => item.outcome === "edited").length;
    const reversals = evidence.filter((item) => item.outcome === "reversed").length;
    const contradictions = evidence.filter((item) => item.contradiction === true).length;
    const approvalRate = count ? approved / count : 0;
    const editRate = count ? edits / count : 0;
    const reversalRate = count ? reversals / count : 0;
    const contradictionRate = count ? contradictions / count : 0;
    const lastObservedAt = evidence.at(-1)?.attestedAt;
    const reasons: string[] = [];
    let autonomy: Autonomy = "full-review";
    if (!limit) reasons.push("unsafe threshold configuration; full review enforced");
    if (!controlsValid) reasons.push("invalid physician control; full review enforced");
    if (duplicateConflict) reasons.push("conflicting duplicate evidence event; full review enforced");
    if (count < (limit?.minimumEvidence ?? DEFAULT_ADAPTATION_THRESHOLDS.minimumEvidence)) reasons.push(`insufficient verified attestations (${count}/${limit?.minimumEvidence ?? DEFAULT_ADAPTATION_THRESHOLDS.minimumEvidence})`);
    if (verified.filter((item) => item.patternKey === patternKey && item.contextKey === contextKey && item.modelVersion === modelVersion).length > count) reasons.push("evidence is stale or outside the current time window");
    if (approvalRate < (limit?.minimumApprovalRate ?? 1)) reasons.push("approval calibration below threshold");
    if (editRate >= (limit?.maximumEditRate ?? 0)) reasons.push("edit rate reaches threshold");
    if (reversalRate > 0 || reversalRate >= (limit?.maximumReversalRate ?? 0)) reasons.push("reversal requires full review");
    if (contradictionRate >= (limit?.maximumContradictionRate ?? 0) || evidence.some((item) => item.contradiction)) reasons.push("contradictory evidence requires review");
    if (lastObservedAt && nowMs - validDate(lastObservedAt) >= (limit?.maxRecentGapMs ?? 0)) reasons.push("evidence is stale");
    if (options?.contextKey && options.contextKey !== contextKey) reasons.push("context changed");
    if (options?.modelVersion && options.modelVersion !== modelVersion) reasons.push("model version changed");
    if (count >= effectiveLimit.minimumEvidence && evidence.length >= 4) {
      const recent = evidence.slice(-Math.max(2, Math.floor(evidence.length / 2)));
      const recentApproval = recent.filter((item) => item.outcome === "approved").length / recent.length;
      if (approvalRate - recentApproval >= (limit?.driftTolerance ?? 0)) reasons.push("recent approval drift detected");
    }
    if (revoked.has(patternKey)) reasons.push("physician control requires full review");
    if (reasons.length === 0) {
      autonomy = "exception-first";
      reasons.push("thresholds met from recent, verified explicit attestations");
    }
    return Object.freeze({ patternKey, physicianId, contextKey, modelVersion, autonomy, revoked: revoked.has(patternKey), evidenceCount: count, approvalRate, editRate, reversalRate, contradictionRate, lastObservedAt, rationale: Object.freeze([...reasons]) });
  });
  return Object.freeze({ physicianId, generatedAt: now.toISOString(), patterns: Object.freeze(patterns) });
};

export const revokePattern = (profile: AdaptationProfile, patternKey: string, actorId: string): AdaptationProfile => ({
  ...(actorId === profile.physicianId ? {} : (() => { throw new Error("Adaptation control requires physician ownership"); })()),
  ...profile,
  patterns: Object.freeze(profile.patterns.map((pattern) => pattern.patternKey === patternKey && actorId === profile.physicianId ? Object.freeze({ ...pattern, autonomy: "full-review", revoked: true, rationale: Object.freeze([...pattern.rationale, "revoked by physician"]) }) : pattern)),
});

export const reduceAutonomy = (profile: AdaptationProfile, patternKey: string, actorId: string, rationaleCode: RationaleCode): AdaptationProfile => ({
  ...(actorId === profile.physicianId ? {} : (() => { throw new Error("Adaptation control requires physician ownership"); })()),
  ...profile,
  patterns: Object.freeze(profile.patterns.map((pattern) => pattern.patternKey === patternKey && actorId === profile.physicianId ? Object.freeze({ ...pattern, autonomy: "full-review", rationale: Object.freeze([...pattern.rationale, `autonomy reduced (${rationaleCode})`]) }) : pattern)),
});

export const resetAdaptationProfile = (physicianId: string, actorId: string, now = new Date()): AdaptationProfile => {
  if (actorId !== physicianId) throw new Error("Adaptation control requires physician ownership");
  return Object.freeze({ physicianId, generatedAt: now.toISOString(), patterns: Object.freeze([]) });
};

export const inspectAdaptationRationale = (profile: AdaptationProfile, patternKey: string): readonly string[] => profile.patterns.find((pattern) => pattern.patternKey === patternKey)?.rationale ?? ["pattern not found; full review required"];

export const createControlRecord = (type: AdaptationControlRecord["type"], physicianId: string, actorId: string, now = new Date(), patternKey?: string, rationaleCode: RationaleCode = "physician-request"): AdaptationControlRecord => {
  if (actorId !== physicianId) throw new Error("Adaptation control requires physician ownership");
  if (!rationaleCodes.has(rationaleCode)) throw new Error("Unknown adaptation rationale code");
  const createdAt = now.toISOString();
  const retainedUntil = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  return Object.freeze({ id: `${type}:${physicianId}:${createdAt}`, physicianId, actorId, type, ...(patternKey ? { patternKey } : {}), rationaleCode, createdAt, retainedUntil, ...(type === "reset" ? { resetBefore: createdAt } : {}) });
};

export const resetProfile = (physicianId: string, actorId: string, now = new Date()): AdaptationControlRecord => createControlRecord("reset", physicianId, actorId, now);
export const revokeAdaptationPattern = (physicianId: string, actorId: string, patternKey: string, now = new Date()): AdaptationControlRecord => createControlRecord("revoke", physicianId, actorId, now, patternKey, "physician-request");
export const reduceAutonomyWithControl = (profile: AdaptationProfile, patternKey: string, actorId: string, rationaleCode: RationaleCode, now = new Date()): { profile: AdaptationProfile; control: AdaptationControlRecord } => ({ profile: reduceAutonomy(profile, patternKey, actorId, rationaleCode), control: createControlRecord("reduce-autonomy", profile.physicianId, actorId, now, patternKey, rationaleCode) });
