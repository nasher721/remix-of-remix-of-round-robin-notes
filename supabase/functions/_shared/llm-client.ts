export class MissingAPIKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingAPIKeyError";
  }
}

export class LLMProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMProviderError";
  }
}

export class InvalidLLMModelError extends Error {
  constructor(message = "Requested model is not allowed") {
    super(message);
    this.name = "InvalidLLMModelError";
  }
}

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  provider: "openai" | "gemini" | "anthropic" | "grok" | "glm";
}

export const DEFAULT_LLM_OUTPUT_TOKENS = 4_000;
export const MAX_LLM_OUTPUT_TOKENS = 8_000;

const ALLOWED_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gemini-1.5-flash": "gemini-1.5-flash",
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "grok-2": "llama3-70b-8192",
  "grok-2-mini": "llama3-70b-8192",
  "llama3-70b-8192": "llama3-70b-8192",
};

export type RequestedModelResult =
  | { valid: true; model: string | undefined }
  | { valid: false; error: string };

/** Validate and canonicalize every client-selectable completion model. */
export function resolveRequestedModel(value: unknown): RequestedModelResult {
  if (value === undefined || value === null || value === "") {
    return { valid: true, model: undefined };
  }
  if (typeof value !== "string") {
    return { valid: false, error: "Model must be a string" };
  }

  const model = ALLOWED_MODEL_ALIASES[value.trim()];
  if (!model) {
    return { valid: false, error: "Requested model is not allowed" };
  }
  return { valid: true, model };
}

export function providerForModel(
  model?: string,
): "openai" | "gemini" | "grok" | undefined {
  if (!model) return undefined;
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("llama") || model.startsWith("mixtral")) return "grok";
  return undefined;
}

/** Never send a provider a model identifier from another provider family. */
export function selectModelForConfig(
  requestedModel: string | undefined,
  config: LLMConfig,
  preferredDefault?: string,
): string {
  const candidate = requestedModel || preferredDefault || config.defaultModel;
  const resolved = resolveRequestedModel(candidate);
  if (!resolved.valid || !resolved.model) {
    throw new InvalidLLMModelError(resolved.valid ? undefined : resolved.error);
  }
  if (providerForModel(resolved.model) !== config.provider) {
    throw new InvalidLLMModelError(
      "Requested model does not belong to the selected provider",
    );
  }
  return resolved.model;
}

export function normalizeOutputTokenLimit(value?: number): number {
  if (value === undefined) return DEFAULT_LLM_OUTPUT_TOKENS;
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_LLM_OUTPUT_TOKENS;
  }
  return Math.min(Math.floor(value), MAX_LLM_OUTPUT_TOKENS);
}

function normalizeTemperature(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0.3;
  return Math.min(1, Math.max(0, value));
}

export function getLLMConfig(
  preferredProvider?: "openai" | "gemini" | "grok" | "glm",
  getEnvironmentValue: (name: string) => string | undefined = Deno.env.get,
): LLMConfig {
  // Helper to check OpenAI
  const getOpenAI = (): LLMConfig | null => {
    const key = getEnvironmentValue("OPENAI_API_KEY");
    if (key && key.length > 10 && !key.includes("placeholder")) {
      return {
        apiKey: key,
        baseURL: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        provider: "openai",
      };
    }
    return null;
  };

  // Helper to check Gemini
  const getGemini = (): LLMConfig | null => {
    const key = getEnvironmentValue("GEMINI_API_KEY");
    if (key && key.length > 10) {
      return {
        apiKey: key,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        defaultModel: "gemini-1.5-flash",
        provider: "gemini",
      };
    }
    return null;
  };

  // Helper to check Grok
  const getGrok = (): LLMConfig | null => {
    const key = getEnvironmentValue("GROQ_API_KEY") ||
      getEnvironmentValue("GROK_API_KEY");
    if (key && key.length > 10) {
      return {
        apiKey: key,
        baseURL: "https://api.groq.com/openai/v1",
        defaultModel: "llama3-70b-8192",
        provider: "grok",
      };
    }
    return null;
  };

  // A model-selected provider is a privacy boundary. If its key is missing,
  // return an unconfigured entry for that provider instead of sending the
  // prompt to another vendor.
  if (preferredProvider) {
    if (preferredProvider === "openai") {
      const config = getOpenAI();
      if (config) return config;
    }
    if (preferredProvider === "gemini") {
      const config = getGemini();
      if (config) return config;
    }
    if (preferredProvider === "grok") {
      const config = getGrok();
      if (config) return config;
    }
    logLLMEvent("warn", "Preferred LLM provider unavailable", {
      provider: preferredProvider,
    });
    return emptyConfigForProvider(preferredProvider);
  }

  // Requests without an explicit model may auto-discover a configured vendor.
  const openAI = getOpenAI();
  if (openAI) return openAI;

  const gemini = getGemini();
  if (gemini) return gemini;

  const grok = getGrok();
  if (grok) return grok;

  // Default fallback (no providers configured)
  return {
    apiKey: "",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    provider: "openai",
  };
}

function emptyConfigForProvider(
  provider: "openai" | "gemini" | "grok" | "glm",
): LLMConfig {
  switch (provider) {
    case "gemini":
      return {
        apiKey: "",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        defaultModel: "gemini-1.5-flash",
        provider,
      };
    case "grok":
      return {
        apiKey: "",
        baseURL: "https://api.groq.com/openai/v1",
        defaultModel: "llama3-70b-8192",
        provider,
      };
    case "glm":
      return {
        apiKey: "",
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        defaultModel: "glm-4-flash",
        provider,
      };
    case "openai":
      return {
        apiKey: "",
        baseURL: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        provider,
      };
  }
}

export interface SanitizedLLMPrompts {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Remove direct identifiers at the final outbound boundary while retaining
 * diagnoses, findings, medications, and other clinically useful text.
 */
export function sanitizeOutboundLLMPrompts(
  systemPrompt: string,
  userPrompt: string,
): SanitizedLLMPrompts {
  const names = extractLabeledPatientNames(`${systemPrompt}\n${userPrompt}`);
  return {
    systemPrompt: sanitizeOutboundPrompt(systemPrompt, names),
    userPrompt: sanitizeOutboundPrompt(userPrompt, names),
  };
}

function extractLabeledPatientNames(text: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /\bpatient(?:[\s_-]*name)?\s*[:=]\s*["']?([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3}?)(?=["']?(?:\s+(?:as|is|has|with)\b|[.,;|\n]|$))/gi,
    /\bgenerate\s+a\s+comprehensive\s+daily\s+summary\s+for\s+([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(?=\s*:)/gi,
    /\bgenerate\s+a\s+chronological\s+hospital\s+course\s+for\s+([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(?=\s+from\b)/gi,
    /<patient_name>\s*([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})\s*<\/patient_name>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1]?.trim().replace(/[.,;:]+$/, "");
      if (candidate && !/^(?:patient|this patient|unknown)$/i.test(candidate)) {
        names.add(candidate);
      }
    }
  }
  return [...names];
}

function sanitizeOutboundPrompt(text: string, names: string[]): string {
  let sanitized = redactLabeledPatientNames(text);

  for (const name of names.sort((a, b) => b.length - a.length)) {
    // A single-token name can also be ordinary clinical prose (for example,
    // "May" or "Will"). Redact it at labeled locations only.
    if (!/\s/.test(name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(
      new RegExp(`\\b${escaped}\\b`, "gi"),
      "[Patient]",
    );
  }

  const replacements: Array<[RegExp, string]> = [
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL REDACTED]"],
    [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]"],
    [
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      "[PHONE REDACTED]",
    ],
    [
      /\b(?:MRN|Medical Record(?:\s+Number)?)\s*[:#=]?\s*[A-Z0-9][A-Z0-9-]{3,31}\b/gi,
      "[MRN REDACTED]",
    ],
    [
      /\b(?:DOB|Date of Birth|D\.O\.B\.?)\s*[:#=]?\s*(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/gi,
      "[DOB REDACTED]",
    ],
    [
      /\b(?:Insurance|Policy|Member)\s*(?:ID|#|Number)\s*[:#=]?\s*[A-Z0-9-]{6,32}\b/gi,
      "[INSURANCE REDACTED]",
    ],
    [
      /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Ct|Court|Way|Pl|Place)\.?\b/gi,
      "[ADDRESS REDACTED]",
    ],
  ];

  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function redactLabeledPatientNames(text: string): string {
  return text
    .replace(
      /(\bpatient(?:[\s_-]*name)?\s*[:=]\s*["']?)([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3}?)(?=["']?(?:\s+(?:as|is|has|with)\b|[.,;|\n]|$))/gi,
      "$1[Patient]",
    )
    .replace(
      /(\bgenerate\s+a\s+comprehensive\s+daily\s+summary\s+for\s+)([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(?=\s*:)/gi,
      "$1[Patient]",
    )
    .replace(
      /(\bgenerate\s+a\s+chronological\s+hospital\s+course\s+for\s+)([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(?=\s+from\b)/gi,
      "$1[Patient]",
    )
    .replace(
      /(<patient_name>\s*)([A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){0,3})(\s*<\/patient_name>)/gi,
      "$1[Patient]$3",
    );
}

interface LLMRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  } = {},
) {
  const requestedModel = resolveRequestedModel(options.model);
  if (!requestedModel.valid) {
    throw new InvalidLLMModelError(requestedModel.error);
  }
  const preferredProvider = providerForModel(requestedModel.model);

  const config = getLLMConfig(preferredProvider);

  if (!config.apiKey) {
    throw new MissingAPIKeyError(
      "No LLM API key configured. Add OPENAI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY to your Supabase project secrets.",
    );
  }

  const model = selectModelForConfig(requestedModel.model, config);

  const sanitizedPrompts = sanitizeOutboundLLMPrompts(systemPrompt, userPrompt);
  const messages = [
    { role: "system", content: sanitizedPrompts.systemPrompt },
    { role: "user", content: sanitizedPrompts.userPrompt },
  ];

  const body: LLMRequestBody = {
    model,
    messages,
    temperature: normalizeTemperature(options.temperature),
    max_tokens: normalizeOutputTokenLimit(options.maxTokens),
  };

  if (options.jsonMode && config.provider === "openai") {
    body.response_format = { type: "json_object" };
  }
  // Note: Gemini/Groq JSON mode might vary, but standard OpenAI compat usually supports response_format or just prompt engineering.

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    logLLMEvent("error", "LLM provider request failed", {
      provider: config.provider,
      statusCode: response.status,
    });
    throw new LLMProviderError(
      `LLM provider request failed (${config.provider}, status ${response.status})`,
    );
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  return content;
}

export interface StreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
}

export async function* streamLLM(
  systemPrompt: string,
  userPrompt: string,
  options: StreamOptions = {},
): AsyncGenerator<string, void, unknown> {
  const requestedModel = resolveRequestedModel(options.model);
  if (!requestedModel.valid) {
    throw new InvalidLLMModelError(requestedModel.error);
  }
  const preferredProvider = providerForModel(requestedModel.model);

  const config = getLLMConfig(preferredProvider);

  if (!config.apiKey) {
    throw new MissingAPIKeyError("No LLM API key configured.");
  }

  const model = selectModelForConfig(requestedModel.model, config);
  const sanitizedPrompts = sanitizeOutboundLLMPrompts(systemPrompt, userPrompt);

  const body = {
    model,
    messages: [
      { role: "system", content: sanitizedPrompts.systemPrompt },
      { role: "user", content: sanitizedPrompts.userPrompt },
    ],
    temperature: normalizeTemperature(options.temperature),
    max_tokens: normalizeOutputTokenLimit(options.maxTokens),
    stream: true,
  };

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    logLLMEvent("error", "LLM streaming request failed", {
      provider: config.provider,
      statusCode: response.status,
    });
    throw new LLMProviderError(
      `LLM streaming request failed (${config.provider}, status ${response.status})`,
    );
  }

  if (!response.body) {
    throw new LLMProviderError("No response body for streaming");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          options.onToken?.(content);
          yield content;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}

function logLLMEvent(
  level: "warn" | "error",
  event: string,
  data: { provider?: string; statusCode?: number },
): void {
  console.log(JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    data,
  }));
}

export async function streamLLMToString(
  systemPrompt: string,
  userPrompt: string,
  options: StreamOptions = {},
): Promise<string> {
  let result = "";
  for await (const chunk of streamLLM(systemPrompt, userPrompt, options)) {
    result += chunk;
  }
  return result;
}
