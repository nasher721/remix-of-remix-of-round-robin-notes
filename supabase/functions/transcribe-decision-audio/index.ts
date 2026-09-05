import {
  authenticateRequest,
  type AuthResult,
  checkRateLimit,
  createErrorResponse,
  handleOptions,
  jsonResponse,
  MAX_MEDIA_PAYLOAD_BYTES,
  parseAndValidateBody,
  RATE_LIMITS,
  type RateLimitResult,
} from "../_shared/mod.ts";
import {
  ALLOWED_AUDIO_MIME_TYPES,
  processTemporaryTranscript,
  type TranscriptBinding,
  TranscriptProcessingError,
} from "../../../src/lib/decision-scribe/transcriptProcessor.ts";
type Binding = TranscriptBinding & {
  ownershipToken: string;
  captureNonce: string;
};
type Auth = AuthResult | { error: Response };
export type HandlerOptions = {
  authenticate?: (req: Request) => Promise<Auth>;
  rateLimit?: (req: Request, userId: string) => Promise<RateLimitResult>;
  verifyOwnership?: (userId: string, binding: Binding) => Promise<boolean>;
  consumeReplay?: (nonce: string) => Promise<boolean>;
  provider?: (
    audio: Uint8Array,
    mime: string,
    signal: AbortSignal,
  ) => Promise<unknown>;
  now?: () => number;
  delay?: (ms: number, signal: AbortSignal) => Promise<void>;
};
const encoder = new TextEncoder();
const consumedNonces = new Set<string>();
function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(
    /\//g,
    "_",
  ).replace(/=+$/, "");
}
async function signedOwnership(
  userId: string,
  binding: Binding,
): Promise<boolean> {
  const secret = Deno.env.get("DECISION_SCRIBE_BINDING_SECRET");
  if (!secret || secret.length < 32 || binding.physicianId !== userId) {
    return false;
  }
  const parts = binding.ownershipToken.split(".");
  if (parts.length !== 2 || parts[1].length !== 43) return false;
  const payload = {
    sessionId: binding.sessionId,
    roundId: binding.roundId,
    patientId: binding.patientId,
    physicianId: binding.physicianId,
    deviceId: binding.deviceId,
    patientSnapshotId: binding.patientSnapshotId,
    startedAt: binding.startedAt,
    expiresAt: binding.expiresAt,
    source: binding.source,
    captureNonce: binding.captureNonce,
  };
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  if (parts[0] !== encoded) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = base64Url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(encoded)),
    ),
  );
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
  }
  return diff === 0;
}
function consumeReplay(nonce: string): Promise<boolean> {
  if (consumedNonces.has(nonce)) return Promise.resolve(false);
  consumedNonces.add(nonce);
  return Promise.resolve(true);
}
function decode(value: string, mime: string): Uint8Array {
  const match = value.match(/^data:(audio\/[\w.+-]+);base64,(.*)$/is);
  const encoded = match
    ? (match[1].toLowerCase() === mime.toLowerCase() ? match[2] : (() => {
      throw new Error("mime mismatch");
    })())
    : value.replace(/\s/g, "");
  if (
    !encoded || encoded.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  ) throw new Error("base64");
  const binary = atob(encoded);
  if (binary.length > MAX_MEDIA_PAYLOAD_BYTES) throw new Error("size");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function validBinding(value: unknown): value is Binding {
  if (!value || typeof value !== "object") return false;
  const b = value as Partial<Binding>;
  return typeof b.ownershipToken === "string" &&
    typeof b.captureNonce === "string" && b.captureNonce.length > 0 &&
    b.source === "rounds-audio" &&
    [
      b.sessionId,
      b.roundId,
      b.patientId,
      b.physicianId,
      b.deviceId,
      b.patientSnapshotId,
      b.startedAt,
      b.expiresAt,
    ].every((v) => typeof v === "string" && v.trim() !== "") &&
    Number.isFinite(Date.parse(b.startedAt!)) &&
    Number.isFinite(Date.parse(b.expiresAt!));
}
export async function handleTranscribeDecisionAudio(
  req: Request,
  options: HandlerOptions = {},
): Promise<Response> {
  const now = options.now ?? Date.now;
  try {
    if (req.method === "OPTIONS") return handleOptions(req);
    if (req.method !== "POST") {
      return createErrorResponse(req, "Method not allowed", 405);
    }
    const auth = options.authenticate
      ? await options.authenticate(req)
      : await authenticateRequest(req);
    if ("error" in auth) return auth.error;
    const limit = await (options.rateLimit ?? ((r, u) =>
      checkRateLimit(r, RATE_LIMITS.transcription, u)))(req, auth.userId);
    if (!limit.allowed) {
      return limit.response ??
        createErrorResponse(req, "Rate limit exceeded", 429);
    }
    const body = await parseAndValidateBody<
      { audio?: unknown; mimeType?: unknown; binding?: unknown }
    >(req, { maxBytes: MAX_MEDIA_PAYLOAD_BYTES });
    if (!body.valid || !body.data || typeof body.data !== "object") {
      return body.valid
        ? createErrorResponse(req, "Unsupported transcription payload", 400)
        : body.response;
    }
    const { audio, mimeType, binding } = body.data;
    if (
      typeof audio !== "string" || typeof mimeType !== "string" ||
      !ALLOWED_AUDIO_MIME_TYPES.has(mimeType) || !validBinding(binding)
    ) {
      return createErrorResponse(req, "Unsupported transcription payload", 400);
    }
    const b = binding as Binding;
    if (
      !(await (options.verifyOwnership ?? signedOwnership)(auth.userId, b)) ||
      !(await (options.consumeReplay ?? consumeReplay)(b.captureNonce))
    ) {
      return createErrorResponse(req, "Forbidden", 403);
    }
    if (Date.parse(b.expiresAt) <= now()) {
      return createErrorResponse(req, "Capture session expired", 410);
    }
    const bytes = decode(audio, mimeType);
    const provider = options.provider ??
      (async (data: Uint8Array, mime: string, signal: AbortSignal) => {
        const key = Deno.env.get("OPENAI_API_KEY");
        if (!key) {
          throw new Error("provider unavailable");
        }
        const form = new FormData();
        form.append(
          "file",
          new Blob([data.buffer as ArrayBuffer], { type: mime }),
          "rounds-audio",
        );
        form.append("model", "whisper-1");
        form.append("response_format", "verbose_json");
        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: form,
            signal,
          },
        );
        if (!response.ok) {
          throw new Error("provider failed");
        }
        return response.json();
      });
    const segments = await processTemporaryTranscript(bytes, b, provider, {
      mimeType,
      signal: req.signal,
      now,
      maxAttempts: 2,
      retryDelayMs: 0,
    });
    const safeBinding = {
      sessionId: b.sessionId,
      roundId: b.roundId,
      patientId: b.patientId,
      physicianId: b.physicianId,
      deviceId: b.deviceId,
      patientSnapshotId: b.patientSnapshotId,
      startedAt: b.startedAt,
      expiresAt: b.expiresAt,
      source: b.source,
    };
    return jsonResponse(req, { binding: safeBinding, segments });
  } catch (error) {
    if (error instanceof TranscriptProcessingError) {
      return createErrorResponse(
        req,
        error.code === "cancelled"
          ? "Capture was cancelled"
          : error.code === "expired"
          ? "Capture session expired"
          : "Transcription provider failed",
        error.code === "cancelled" ? 499 : error.code === "expired" ? 410 : 502,
      );
    }
    return createErrorResponse(req, "Transcription request failed", 502);
  }
}
if (import.meta.main) Deno.serve((req) => handleTranscribeDecisionAudio(req));
