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
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  buildClinicalProviderAttempts,
  type ClinicalProviderAttempt,
  isRetryableProviderStatus,
} from "../_shared/llm-client.ts";
import {
  composePipeline,
  validateRequest,
  verifiedAttempts,
} from "../_shared/note-composer-pipeline.ts";
// deno-lint-ignore no-import-prefix -- Shared Supabase Edge dependency.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
interface Options {
  authenticate?: (req: Request) => Promise<AuthResult | { error: Response }>;
  rateLimit?: (req: Request, userId: string) => Promise<RateLimitResult>;
  canAccess?: (
    req: Request,
    patientId: string,
    userId: string,
  ) => Promise<boolean>;
  attempts?: () => ClinicalProviderAttempt[];
}
async function canAccess(
  req: Request,
  patientId: string,
  userId: string,
): Promise<boolean> {
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
      auth: { persistSession: false },
    },
  );
  const { data, error } = await client.from("patients").select("id").eq(
    "id",
    patientId,
  ).eq("user_id", userId).maybeSingle();
  return !error && !!data;
}
export async function handleComposeRoundingNote(
  req: Request,
  options: Options = {},
): Promise<Response> {
  const uncached = (response: Response) => {
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  try {
    if (req.method === "OPTIONS") return handleOptions(req);
    if (req.method !== "POST") {
      return uncached(createErrorResponse(req, "Method not allowed", 405));
    }
    const auth = options.authenticate
      ? await options.authenticate(req)
      : await authenticateRequest(req);
    if ("error" in auth) return uncached(auth.error);
    const limit = await (options.rateLimit ?? ((r, userId) =>
      checkRateLimit(r, RATE_LIMITS.ai, userId)))(req, auth.userId);
    if (!limit.allowed) {
      return uncached(
        limit.response ?? createErrorResponse(req, "Rate limited", 429),
      );
    }
    const parsed = await parseAndValidateBody<Record<string, unknown>>(req, {
      maxBytes: 1000000,
    });
    if (!parsed.valid) {
      return uncached(parsed.response);
    }
    const body = parsed.data;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return uncached(
        createErrorResponse(req, "Invalid composer request", 400),
      );
    }
    const capability = body.action === "capabilities";
    if (!capability && !validateRequest(body, auth.userId)) {
      return uncached(
        createErrorResponse(req, "Invalid composer request", 400),
      );
    }
    const patientId = capability
      ? body.patientId
      : (body.binding as { patientId: string }).patientId;
    if (typeof patientId !== "string" || patientId.length > 200) {
      return uncached(createErrorResponse(req, "Invalid patient binding", 400));
    }
    if (!await (options.canAccess ?? canAccess)(req, patientId, auth.userId)) {
      return uncached(createErrorResponse(req, "Patient access denied", 403));
    }
    const attempts = (options.attempts ?? (() =>
      verifiedAttempts(
        buildClinicalProviderAttempts(),
        Deno.env.get("NOTE_COMPOSER_VERIFIED_PROVIDERS") ?? "",
      )))();
    if (capability) {
      return uncached(
        jsonResponse(req, {
          generation: attempts.length > 0,
          dictation: false,
          reason: attempts.length
            ? null
            : "Generation requires a configured provider with verified temporary-source retention.",
        }),
      );
    }
    if (!attempts.length) {
      return uncached(
        createErrorResponse(req, "Composer provider is not enabled", 503),
      );
    }
    if (!validateRequest(body, auth.userId)) {
      return uncached(
        createErrorResponse(req, "Invalid composer request", 400),
      );
    }
    const abort = new AbortController();
    const timer = setTimeout(() =>
      abort.abort(), 165000);
    const signal = AbortSignal.any([req.signal, abort.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: unknown) => {
          if (!signal.aborted) {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          }
        };
        try {
          const result = await composePipeline(
            body,
            async (stage, system, input) => {
              if (signal.aborted) {
                throw new Error("Cancelled");
              }
              emit({
                stage: stage === "reconcile"
                  ? "Reconciling updates"
                  : "Drafting note",
              });
              for (const attempt of attempts) {
                if (signal.aborted) {
                  throw new Error("Cancelled");
                }
                try {
                  const response = await fetch(
                    `${attempt.config.baseURL}/chat/completions`,
                    {
                      method: "POST",
                      signal: AbortSignal.any([
                        signal,
                        AbortSignal.timeout(45000),
                      ]),
                      headers: {
                        Authorization: `Bearer ${attempt.config.apiKey}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        model: attempt.model,
                        messages: [{ role: "system", content: system }, {
                          role: "user",
                          content: JSON.stringify(input),
                        }],
                        temperature: 0,
                        max_tokens: 8000,
                        response_format: { type: "json_object" },
                        ...(attempt.config.provider === "openai"
                          ? { store: false }
                          : {}),
                      }),
                    },
                  );
                  if (!response.ok) {
                    await response.body?.cancel();
                    if (isRetryableProviderStatus(response.status)) {
                      continue;
                    }
                    throw new Error("Invalid provider request");
                  }
                  const data = await response.json();
                  if (
                    data.choices?.[0]?.finish_reason !== "stop" ||
                    typeof data.choices?.[0]?.message?.content !== "string"
                  ) {
                    throw new Error("Incomplete provider response");
                  }
                  return JSON.parse(data.choices[0].message.content);
                } catch (error) {
                  if (signal.aborted) {
                    throw new Error("Cancelled");
                  }
                  if (
                    error instanceof Error &&
                    ["TimeoutError", "TypeError"].includes(error.name)
                  ) {
                    continue;
                  }
                  throw new Error("Invalid provider response");
                }
              }
              throw new Error("Provider unavailable");
            },
          );
          emit({ result });
        } catch {
          emit({
            error:
              "Generation could not be verified. Your draft is unchanged. Retry or edit manually.",
          });
        } finally {
          clearTimeout(timer);
          try {
            controller.close();
          } catch {
            /* Client cancelled. */
          }
        }
      },
      cancel() {
        abort.abort();
        clearTimeout(timer);
      },
    });
    return new Response(stream, {
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return uncached(
      createErrorResponse(
        req,
        "Composer unavailable. Retry without changing your draft.",
        503,
      ),
    );
  }
}
if (import.meta.main) Deno.serve((req) => handleComposeRoundingNote(req));
