import {
  DEFAULT_LLM_OUTPUT_TOKENS,
  getLLMConfig,
  InvalidLLMModelError,
  type LLMConfig,
  MAX_LLM_OUTPUT_TOKENS,
  normalizeOutputTokenLimit,
  providerForModel,
  resolveApprovedClinicalProvider,
  resolveRequestedModel,
  sanitizeOutboundLLMPrompts,
  selectModelForConfig,
} from "./llm-client.ts";

Deno.test("clinical AI requires an explicitly approved PHI provider", () => {
  const missing = resolveApprovedClinicalProvider(undefined, () => undefined);
  if (missing.valid) {
    throw new Error(
      "Expected missing clinical provider approval to fail closed",
    );
  }

  const approved = resolveApprovedClinicalProvider(
    undefined,
    (key) => {
      if (key === "CLINICAL_PHI_LLM_PROVIDER") return "gemini";
      if (key === "CLINICAL_PHI_LLM_MODEL") return "gemini-2.5-flash";
      return undefined;
    },
  );
  if (
    !approved.valid || approved.provider !== "gemini" ||
    approved.model !== "gemini-2.5-flash"
  ) {
    throw new Error("Expected the deployment-approved provider to be selected");
  }
});

Deno.test("clinical AI stays fail-closed in explicit disabled deployment mode", () => {
  const disabled = resolveApprovedClinicalProvider(
    undefined,
    (key) => {
      if (key === "CLINICAL_PHI_LLM_PROVIDER") return "disabled";
      if (key === "CLINICAL_PHI_LLM_MODEL") return "disabled";
      return undefined;
    },
  );
  if (disabled.valid) {
    throw new Error("Expected disabled clinical AI policy to reject requests");
  }
});

Deno.test("clinical AI rejects cross-provider model selection", () => {
  const result = resolveApprovedClinicalProvider(
    "gpt-4o-mini",
    (key) => {
      if (key === "CLINICAL_PHI_LLM_PROVIDER") return "gemini";
      if (key === "CLINICAL_PHI_LLM_MODEL") return "gemini-2.5-flash";
      return undefined;
    },
  );
  if (result.valid) {
    throw new Error("Expected cross-provider clinical model selection to fail");
  }
});

Deno.test("clinical AI rejects non-approved models within the approved provider", () => {
  const result = resolveApprovedClinicalProvider(
    "gemini-2.0-flash",
    (key) => {
      if (key === "CLINICAL_PHI_LLM_PROVIDER") return "gemini";
      if (key === "CLINICAL_PHI_LLM_MODEL") return "gemini-2.5-flash";
      return undefined;
    },
  );
  if (result.valid) {
    throw new Error("Expected a same-provider model override to fail closed");
  }
});

Deno.test("LLM model selection accepts only canonical allowlisted models", () => {
  const allowed = resolveRequestedModel("gpt-4o-mini");
  if (!allowed.valid || allowed.model !== "gpt-4o-mini") {
    throw new Error("Expected allowlisted completion model to pass");
  }

  const alias = resolveRequestedModel("grok-2-mini");
  if (!alias.valid || alias.model !== "llama3-70b-8192") {
    throw new Error("Expected supported UI alias to canonicalize");
  }

  const denied = resolveRequestedModel("attacker-selected-expensive-model");
  if (denied.valid) {
    throw new Error("Expected arbitrary model selection to fail closed");
  }
});

Deno.test("LLM model selection fails closed across provider families", () => {
  const geminiConfig: LLMConfig = {
    apiKey: "test-key",
    baseURL: "https://example.test",
    defaultModel: "gemini-1.5-flash",
    provider: "gemini",
  };

  try {
    selectModelForConfig("gpt-4o", geminiConfig);
    throw new Error("Expected cross-provider model selection to fail");
  } catch (error) {
    if (!(error instanceof InvalidLLMModelError)) {
      throw error;
    }
  }
});

Deno.test("provider configuration never auto-discovers another vendor", () => {
  const environment = (key: string) =>
    key === "OPENAI_API_KEY" ? "openai-test-key-long-enough" : undefined;

  const explicitGemini = getLLMConfig("gemini", environment);
  if (explicitGemini.provider !== "gemini" || explicitGemini.apiKey !== "") {
    throw new Error(
      "Expected unavailable explicit Gemini selection to fail closed",
    );
  }

  const explicitOpenAI = getLLMConfig("openai", environment);
  if (explicitOpenAI.provider !== "openai" || !explicitOpenAI.apiKey) {
    throw new Error(
      "Expected an explicitly selected configured provider to resolve",
    );
  }
});

Deno.test("outbound LLM prompts remove direct identifiers but retain clinical facts", () => {
  const sanitized = sanitizeOutboundLLMPrompts(
    "Use PATIENT: Jane Doe as the subject. DOB: 01/02/1980.",
    "Jane Doe has MRN #A123456 and email jane@example.com. Diagnosis: SAH.",
  );
  const outbound = `${sanitized.systemPrompt}\n${sanitized.userPrompt}`;

  if (/Jane Doe|01\/02\/1980|A123456|jane@example\.com/i.test(outbound)) {
    throw new Error(
      "Expected direct identifiers to be removed before dispatch",
    );
  }
  if (!/Diagnosis: SAH/.test(outbound)) {
    throw new Error("Expected clinical facts to remain in the outbound prompt");
  }
});

Deno.test("outbound de-identification preserves words that match name parts", () => {
  const sanitized = sanitizeOutboundLLMPrompts(
    "PATIENT: May Will.",
    "May Will may improve and we will monitor closely.",
  );
  const outbound = `${sanitized.systemPrompt}\n${sanitized.userPrompt}`;

  if (/May Will/.test(outbound)) {
    throw new Error("Expected the full patient name to be removed");
  }
  if (!/may improve and we will monitor closely/i.test(outbound)) {
    throw new Error("Expected clinical language matching name parts to remain");
  }
});

Deno.test("LLM model selection maps allowlisted identifiers to provider families", () => {
  if (providerForModel("gpt-4o-mini") !== "openai") {
    throw new Error("Expected GPT model to select OpenAI");
  }
  if (providerForModel("gemini-2.5-flash") !== "gemini") {
    throw new Error("Expected Gemini model to select Gemini");
  }
  if (providerForModel("llama3-70b-8192") !== "grok") {
    throw new Error("Expected canonical Groq model to select Groq");
  }
});

Deno.test("LLM output token limits are always finite and bounded", () => {
  if (normalizeOutputTokenLimit() !== DEFAULT_LLM_OUTPUT_TOKENS) {
    throw new Error("Expected a safe default token limit");
  }
  if (
    normalizeOutputTokenLimit(Number.POSITIVE_INFINITY) !==
      DEFAULT_LLM_OUTPUT_TOKENS
  ) {
    throw new Error("Expected non-finite token limits to be rejected");
  }
  if (
    normalizeOutputTokenLimit(MAX_LLM_OUTPUT_TOKENS * 2) !==
      MAX_LLM_OUTPUT_TOKENS
  ) {
    throw new Error("Expected oversized output limits to be capped");
  }
});
