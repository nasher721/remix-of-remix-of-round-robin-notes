# AI Usage Audit Report — Round Robin Notes

## Date: 2026-02-10

---

## Executive Summary

Round Robin Notes uses a **two-tier AI architecture**:

1. **Primary**: OpenAI GPT-4 models (GPT-4o, GPT-4o-mini) for clinical AI features
2. **Fallback**: Lovable AI Gateway (Google Gemini models) as secondary provider
3. **Transcription**: OpenAI Whisper API (no fallback)

All AI calls are proxied through **Supabase Edge Functions** (Deno runtime). Client code never directly calls AI APIs — it invokes Supabase functions which hold the API keys as secrets.

---

## AI Call Inventory

### Supabase Edge Functions (10 total)

| Function | File | Primary Provider | Model | Fallback | Purpose |
|----------|------|-----------------|-------|----------|---------|
| `ai-clinical-assistant` | `supabase/functions/ai-clinical-assistant/index.ts` | OpenAI | GPT-4o / GPT-4o-mini | Gemini 3 Flash | 7 clinical AI features |
| `transcribe-audio` | `supabase/functions/transcribe-audio/index.ts` | OpenAI | Whisper-1 + GPT-4o-mini | Gemini (enhancement only) | Audio → text transcription |
| `transform-text` | `supabase/functions/transform-text/index.ts` | Lovable/Gemini | Gemini 3 Flash | None | Text formatting |
| `generate-daily-summary` | `supabase/functions/generate-daily-summary/index.ts` | Lovable/Gemini | Gemini 3 Flash | None | Daily summaries |
| `generate-patient-course` | `supabase/functions/generate-patient-course/index.ts` | Lovable/Gemini | Gemini 3 Flash | None | Hospital course narratives |
| `generate-interval-events` | `supabase/functions/generate-interval-events/index.ts` | Lovable/Gemini | Gemini 3 Flash | None | Interval event summaries |
| `format-medications` | `supabase/functions/format-medications/index.ts` | Lovable/Gemini | Gemini 3 Flash | None | Medication categorization |
| `generate-todos` | `supabase/functions/generate-todos/index.ts` | Lovable/Gemini | Gemini 3 Flash | None | Todo generation |
| `parse-single-patient` | `supabase/functions/parse-single-patient/index.ts` | Lovable/Gemini | Gemini 2.5 Pro | None | Clinical note parsing |
| `parse-handoff` | `supabase/functions/parse-handoff/index.ts` | Lovable/Gemini | Gemini 2.5 Flash | None | Epic handoff parsing |

### Client-Side Hooks (9 hooks)

| Hook | File | Edge Function Called |
|------|------|-------------------|
| `useAIClinicalAssistant` | `src/hooks/useAIClinicalAssistant.ts` | `ai-clinical-assistant` |
| `useDictation` | `src/hooks/useDictation.ts` | `transcribe-audio` |
| `useTextTransform` | `src/hooks/useTextTransform.ts` | `transform-text` |
| `useMedicationFormat` | `src/hooks/useMedicationFormat.ts` | `format-medications` |
| `useDailySummaryGenerator` | `src/hooks/useDailySummaryGenerator.ts` | `generate-daily-summary` |
| `useIntervalEventsGenerator` | `src/hooks/useIntervalEventsGenerator.ts` | `generate-interval-events` |
| `usePatientTodos` | `src/hooks/usePatientTodos.ts` | `generate-todos` |
| `usePatientCourseGenerator` | `src/hooks/usePatientCourseGenerator.ts` | `generate-patient-course` |
| `useBatchCourseGenerator` | `src/hooks/useBatchCourseGenerator.ts` | (batch orchestration) |

### Configuration

| File | Purpose |
|------|---------|
| `src/lib/openai-config.ts` | AI model constants, types, prompt utilities |

---

## Blocking Problems

1. **Hardcoded providers**: Each edge function has provider URLs and model names baked in. Switching models requires code changes in each function.
2. **No model selection**: Users cannot choose which model to use. The function picks based on task complexity.
3. **8 of 10 functions lack fallback**: Only `ai-clinical-assistant` has OpenAI→Gemini fallback. Others use Gemini only.
4. **Whisper has zero fallback**: If OpenAI is unavailable, transcription completely fails.
5. **No retry logic**: Beyond Supabase's built-in retry, there is no application-level retry with exponential backoff.
6. **No response caching**: Identical requests always hit the API.

## Reliability Risks

1. **Single point of failure**: Most functions depend entirely on Lovable/Gemini gateway.
2. **No timeout protection**: API calls have no explicit timeout; relies on Supabase function timeout.
3. **No circuit breaker**: A failing provider will be retried indefinitely.
4. **No token tracking**: No logging of token consumption for cost monitoring.
5. **No latency tracking**: No measurement of response times per provider.

## Hallucination Risks

1. **No output validation**: AI responses are used directly. JSON parsing has basic error handling but no schema validation.
2. **No clinical safety checks**: No verification that output is consistent with input patient data.
3. **No cross-model verification**: Single model responses are trusted without second opinion.
4. **Prompts warn against fabrication** but provide no enforcement mechanism.

## Prompt Duplication

- `stripHtml()` is defined in both `openai-config.ts` and `ai-clinical-assistant/index.ts`
- `buildContextString()` / `buildClinicalContextString()` duplicated between client and edge function
- System prompts for clinical features exist only in the edge function (not configurable)

## Tight Coupling

- Edge functions directly construct `fetch()` calls to specific API URLs
- Model selection logic is embedded within each function
- Response parsing is interleaved with API call code
- Each function independently handles CORS, auth, and error responses

---

## Recommendations

1. Create a **provider abstraction layer** (`src/services/llm/`) that normalizes all LLM interactions
2. Implement **provider adapters** for OpenAI, Anthropic, Gemini, Grok, GLM, and HuggingFace
3. Build a **router** with automatic fallback, retry, and timeout
4. Add **output validation** with JSON schema enforcement and clinical safety checks
5. Add **consensus mode** for critical clinical decisions
6. Centralize **prompt management** in a PromptCompiler
7. Add **structured logging** and **token tracking**
