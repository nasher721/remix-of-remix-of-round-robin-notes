import {
  authenticateRequest,
  type AuthResult,
  checkRateLimit,
  createErrorResponse,
  handleOptions,
  jsonResponse,
  parseAndValidateBody,
  RATE_LIMITS,
  type RateLimitResult,
} from "../_shared/mod.ts";
import { composeDecisionDraft } from "../../../src/lib/decision-scribe/draftComposer.ts";
import {
  type CurrentPatientSnapshot,
  extractDecisionCandidates,
} from "../../../src/lib/decision-scribe/decisionEngine.ts";
import type {
  CaptureBinding,
  TemporaryTranscriptSegment,
} from "../../../src/types/decisionScribe.ts";

type Auth = AuthResult | { error: Response };
export interface HandlerOptions {
  authenticate?: (req: Request) => Promise<Auth>;
  rateLimit?: (req: Request, userId: string) => Promise<RateLimitResult>;
  now?: () => number;
}
const MAX_SEGMENTS = 200;
const MAX_TEXT = 1000;
const ownString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 500;
function validBinding(v: unknown): v is CaptureBinding {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return [
    "sessionId",
    "roundId",
    "patientId",
    "physicianId",
    "deviceId",
    "patientSnapshotId",
    "patientSnapshotCapturedAt",
    "startedAt",
    "expiresAt",
  ].every((k) => ownString(b[k])) && b.source === "rounds-audio" &&
    Number.isFinite(Date.parse(b.startedAt as string)) &&
    Number.isFinite(Date.parse(b.expiresAt as string)) &&
    Number.isFinite(Date.parse(b.patientSnapshotCapturedAt as string)) &&
    Date.parse(b.patientSnapshotCapturedAt as string) <=
      Date.parse(b.startedAt as string);
}
function validSnapshot(v: unknown): v is CurrentPatientSnapshot {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return ownString(s.patientId) && ownString(s.snapshotId) &&
    (s.systems === undefined ||
      (typeof s.systems === "object" && s.systems !== null));
}
function validSegments(
  v: unknown,
  binding: CaptureBinding,
): v is TemporaryTranscriptSegment[] {
  const ids = new Set<string>();
  return Array.isArray(v) && v.length <= MAX_SEGMENTS && v.every((item) => {
    if (!item || typeof item !== "object") return false;
    const s = item as Record<string, unknown>;
    const b = s.binding as Record<string, unknown> | undefined;
    const valid = ownString(s.id) && !ids.has(s.id as string) &&
      ownString(s.text) && (s.text as string).length <= MAX_TEXT &&
      ["physician", "resident", "fellow", "nurse", "other", "unknown"].includes(
        s.speaker as string,
      ) && Number.isFinite(s.startMs) && Number.isFinite(s.endMs) &&
      (s.startMs as number) >= 0 &&
      (s.endMs as number) > (s.startMs as number) && ownString(s.expiresAt) &&
      Number.isFinite(Date.parse(s.expiresAt as string)) &&
      Date.parse(s.expiresAt as string) === Date.parse(binding.expiresAt) &&
      b?.sessionId === binding.sessionId &&
      b?.patientId === binding.patientId && b?.roundId === binding.roundId &&
      b?.physicianId === binding.physicianId &&
      b?.deviceId === binding.deviceId &&
      b?.patientSnapshotId === binding.patientSnapshotId &&
      b?.patientSnapshotCapturedAt === binding.patientSnapshotCapturedAt &&
      b?.startedAt === binding.startedAt &&
      b?.expiresAt === binding.expiresAt && b?.source === "rounds-audio";
    if (valid) {
      ids.add(s.id as string);
    }
    return valid;
  });
}

export async function handleComposeDecisionDraft(
  req: Request,
  options: HandlerOptions = {},
): Promise<Response> {
  try {
    if (req.method === "OPTIONS") return handleOptions(req);
    if (req.method !== "POST") {
      return createErrorResponse(req, "Method not allowed", 405);
    }
    const auth = options.authenticate
      ? await options.authenticate(req)
      : await authenticateRequest(req);
    if ("error" in auth) return auth.error;
    const limit = await (options.rateLimit ?? ((r, userId) =>
      checkRateLimit(r, RATE_LIMITS.ai, userId)))(req, auth.userId);
    if (!limit.allowed) {
      return limit.response ??
        createErrorResponse(req, "Rate limit exceeded", 429);
    }
    const body = await parseAndValidateBody<
      { binding?: unknown; snapshot?: unknown; segments?: unknown }
    >(req);
    if (!body.valid) {
      return body.response;
    }
    if (
      !validBinding(body.data.binding) || !validSnapshot(body.data.snapshot) ||
      !validSegments(body.data.segments, body.data.binding)
    ) {
      return createErrorResponse(
        req,
        "Unsupported decision draft payload",
        400,
      );
    }
    const binding = body.data.binding;
    const snapshot = body.data.snapshot;
    if (
      binding.physicianId !== auth.userId ||
      snapshot.patientId !== binding.patientId ||
      snapshot.snapshotId !== binding.patientSnapshotId
    ) {
      return createErrorResponse(req, "Forbidden", 403);
    }
    const now = new Date(options.now ? options.now() : Date.now());
    if (Date.parse(binding.expiresAt) <= now.getTime()) {
      return createErrorResponse(req, "Capture session expired", 410);
    }
    const extracted = extractDecisionCandidates(
      body.data.segments,
      snapshot,
      binding,
      now,
    );
    return jsonResponse(req, {
      draft: composeDecisionDraft(extracted.candidates, binding, now),
      rejectedCount: extracted.rejected.length,
    });
  } catch (_error) {
    return createErrorResponse(req, "Decision draft composition failed", 502);
  }
}
if (import.meta.main) Deno.serve((req) => handleComposeDecisionDraft(req));
