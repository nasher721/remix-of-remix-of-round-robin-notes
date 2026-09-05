/** Nonclinical Decision Scribe metrics. This module never persists or transmits data. */

export type DecisionScribeTelemetryEvent =
  | "capture_started" | "capture_stopped" | "capture_discarded" | "review_opened"
  | "attestation_completed" | "capture_failed" | "rollout_fallback";

export interface DecisionScribeTelemetryInput {
  event: DecisionScribeTelemetryEvent;
  durationMs?: number;
  count?: number;
  mode?: string;
  reason?: string;
}

export interface SafeDecisionScribeTelemetry {
  event: DecisionScribeTelemetryEvent;
  durationMs?: number;
  count?: number;
  mode?: "off" | "shadow" | "full-review" | "adaptive-composition" | "exception-first";
  reason?: "consent-required" | "policy-gate" | "model-or-context-drift" | "timeout" | "unsupported" | "cancelled" | "provider-error" | "user-action";
}
export type DecisionScribeTelemetrySink = (event: SafeDecisionScribeTelemetry) => void;
export type TelemetryRecordResult = { recorded: boolean; status: "recorded" | "disabled" | "rejected" | "sink-failed" };

const EVENTS = new Set<DecisionScribeTelemetryEvent>([
  "capture_started", "capture_stopped", "capture_discarded", "review_opened",
  "attestation_completed", "capture_failed", "rollout_fallback",
]);
const MODES = new Set<SafeDecisionScribeTelemetry["mode"]>(["off", "shadow", "full-review", "adaptive-composition", "exception-first"]);
const REASONS = new Set<NonNullable<SafeDecisionScribeTelemetry["reason"]>>(["consent-required", "policy-gate", "model-or-context-drift", "timeout", "unsupported", "cancelled", "provider-error", "user-action"]);

const forbidden = /patient|mrn|encounter|room|bed|name|dob|date|session|device|round|audio|transcript|candidate|span|text|content|token|secret|key|free.?text|identifier|uuid|email/i;

/** Returns a new, schema-allowlisted object; unknown or suspicious values are rejected. */
export const sanitizeDecisionScribeTelemetry = (input: unknown): SafeDecisionScribeTelemetry | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const allowedKeys = new Set(["event", "durationMs", "count", "mode", "reason"]);
  // Unknown keys are rejected at every nesting level by rejecting non-flat
  // objects; this prevents a future caller from smuggling clinical material
  // inside an otherwise valid payload.
  if (Object.keys(source).some((key) => forbidden.test(key) || !allowedKeys.has(key))) return null;
  if (!EVENTS.has(source.event as DecisionScribeTelemetryEvent)) return null;
  const result: SafeDecisionScribeTelemetry = { event: source.event as DecisionScribeTelemetryEvent };
  if (source.durationMs !== undefined && (typeof source.durationMs !== "number" || !Number.isFinite(source.durationMs) || source.durationMs < 0 || source.durationMs > 86_400_000)) return null;
  if (source.count !== undefined && (!Number.isInteger(source.count) || (source.count as number) < 0 || (source.count as number) > 1_000_000)) return null;
  if (source.mode !== undefined && !MODES.has(source.mode as SafeDecisionScribeTelemetry["mode"])) return null;
  if (source.reason !== undefined && !REASONS.has(source.reason as NonNullable<SafeDecisionScribeTelemetry["reason"]>)) return null;
  if (source.durationMs !== undefined) result.durationMs = source.durationMs as number;
  if (source.count !== undefined) result.count = source.count as number;
  if (source.mode !== undefined) result.mode = source.mode as SafeDecisionScribeTelemetry["mode"];
  if (source.reason !== undefined) result.reason = source.reason as SafeDecisionScribeTelemetry["reason"];
  return result;
};

export const isDecisionScribeTelemetrySafe = (input: unknown): input is SafeDecisionScribeTelemetry => sanitizeDecisionScribeTelemetry(input) !== null;

/** Callback-based sink keeps telemetry ephemeral and makes accidental storage impossible here. */
export const recordDecisionScribeTelemetry = (input: unknown, sink?: (event: SafeDecisionScribeTelemetry) => void): boolean => {
  const safe = sanitizeDecisionScribeTelemetry(input);
  if (!safe) return false;
  try { sink?.(safe); } catch { /* telemetry cannot affect clinical workflow */ }
  return true;
};

/** Explicit status API for production callers; enabled telemetry must provide a sink. */
export const emitDecisionScribeTelemetry = (input: unknown, options: { enabled: boolean; sink?: DecisionScribeTelemetrySink }): TelemetryRecordResult => {
  if (!options.enabled) return { recorded: false, status: "disabled" };
  const safe = sanitizeDecisionScribeTelemetry(input);
  if (!safe) return { recorded: false, status: "rejected" };
  if (!options.sink) return { recorded: false, status: "sink-failed" };
  try { options.sink(safe); return { recorded: true, status: "recorded" }; } catch { return { recorded: false, status: "sink-failed" }; }
};
