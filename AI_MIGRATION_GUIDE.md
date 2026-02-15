# AI Migration Guide — Multi-Provider LLM System

## Overview

This migration replaces the hardcoded single-provider AI integration with a **provider-agnostic multi-model orchestration system** that supports 6 LLM providers with automatic fallback, retry, clinical safety validation, and multi-model consensus.

---

## Architecture

```
┌──────────────────┐
│  React Component  │
│  (or Hook)        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────────┐
│ useLLMClinical-  │────▶│   LLMRouter          │
│ Assistant hook   │     │   (routing + retry +  │
│                  │     │    fallback + timeout) │
└──────────────────┘     └────────┬─────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼──┐   ┌─────▼──┐   ┌─────▼──┐
              │Prompt   │   │Output  │   │Clinical│
              │Compiler │   │Validator│  │Guard-  │
              │         │   │         │  │rails   │
              └─────┬───┘   └─────┬───┘  └────┬───┘
                    │             │            │
              ┌─────▼─────────────▼────────────▼───┐
              │          Provider Adapters          │
              ├────────┬────────┬────────┬──────────┤
              │ OpenAI │Anthro- │ Gemini │ Grok/   │
              │        │pic     │        │ GLM/HF  │
              └────────┴────────┴────────┴──────────┘
```

---

## New Files

### Core System (`src/services/llm/`)

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript interfaces and types |
| `LLMRouter.ts` | Central routing engine with fallback/retry/timeout |
| `PromptCompiler.ts` | Provider-specific prompt formatting |
| `OutputValidator.ts` | JSON validation, repair, clinical output validation |
| `ClinicalGuardrails.ts` | Clinical safety checks (contradictions, fabrication) |
| `ConsensusEngine.ts` | Multi-model consensus pipeline |
| `LLMLogger.ts` | Structured logging and metrics |
| `config.ts` | Environment configuration and router initialization |
| `index.ts` | Public API exports |

### Provider Adapters (`src/services/llm/providers/`)

| File | Provider | API Format |
|------|----------|-----------|
| `openai.ts` | OpenAI (GPT-4o, etc.) | Chat Completions |
| `anthropic.ts` | Anthropic (Claude) | Messages API |
| `gemini.ts` | Google Gemini | generateContent |
| `grok.ts` | xAI Grok | OpenAI-compatible |
| `glm.ts` | Zhipu GLM | OpenAI-compatible |
| `huggingface.ts` | HuggingFace | Native + OpenAI-compat |

### React Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useLLMClinicalAssistant.ts` | Drop-in replacement for `useAIClinicalAssistant` |
| `src/hooks/useLLMModelSelection.ts` | Model selection UI state management |

### Configuration

| File | Purpose |
|------|---------|
| `.env.example` | Template showing all environment variables |
| `AI_USAGE_REPORT.md` | Audit of existing AI usage |

---

## Migration Steps

### Step 1: Set Environment Variables

Add API keys for the providers you want to use. At minimum, you need `OPENAI_API_KEY`.

```bash
# Required:
OPENAI_API_KEY=sk-...

# Optional (for multi-provider support):
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
GROK_API_KEY=xai-...
GLM_API_KEY=...
HUGGINGFACE_API_KEY=hf-...
```

### Step 2: Replace Hook Imports (Per-Component)

Replace the old hook with the new one. The API is identical:

```typescript
// Before:
import { useAIClinicalAssistant } from '@/hooks/useAIClinicalAssistant';

// After:
import { useLLMClinicalAssistant } from '@/hooks/useLLMClinicalAssistant';

// Usage is the same:
const { processWithAI, getDifferentialDiagnosis, ... } = useLLMClinicalAssistant();
```

### Step 3: Add Model Selection (Optional)

To let users choose their preferred model:

```typescript
import { useLLMModelSelection } from '@/hooks/useLLMModelSelection';

const {
  selectedProvider,
  selectedModel,
  availableModels,
  setModel,
} = useLLMModelSelection();

// Pass to the clinical assistant hook:
const { processWithAI } = useLLMClinicalAssistant({
  provider: selectedProvider,
  model: selectedModel,
});
```

### Step 4: Use Consensus Mode (Optional)

For critical clinical decisions, use multi-model consensus:

```typescript
import { ConsensusEngine, getLLMRouter } from '@/services/llm';

const engine = new ConsensusEngine(getLLMRouter());
const result = await engine.runConsensus({
  request: { model: '', systemPrompt: '...', userPrompt: '...' },
  models: [
    { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'gemini', model: 'gemini-2.5-pro' },
  ],
  task: 'clinical_note',
});
```

---

## Backward Compatibility

The migration is **fully backward compatible**:

1. **Existing hooks still work**: `useAIClinicalAssistant` is unchanged and continues to call Supabase edge functions.
2. **New hook falls back gracefully**: If no client-side API keys are configured, `useLLMClinicalAssistant` automatically falls back to the Supabase edge function path.
3. **Edge functions unchanged**: All 10 Supabase edge functions continue to work as before.
4. **No database changes**: No schema modifications required.

---

## Routing Rules

The LLMRouter applies task-specific routing:

| Task | Preferred Provider | Preferred Model | Fallbacks |
|------|-------------------|-----------------|-----------|
| Clinical Note | Anthropic | Claude Sonnet 4 | GPT-4o → Gemini 2.5 Flash |
| Reasoning | OpenAI | GPT-4o | Claude Sonnet 4 → Gemini 2.5 Pro |
| Fast Query | Grok | Grok 2 Mini | GPT-4o-mini → Gemini 2.0 Flash |
| Low Cost | GLM | GLM-4 Flash | GPT-4o-mini → Llama 3.1 8B |
| Offline | HuggingFace | Llama 3.1 8B | GLM-4 Flash |
| General | OpenAI | GPT-4o-mini | Haiku → Gemini Flash → Grok Mini |

---

## Safety Features

### Output Validation
- JSON schema enforcement for structured outputs
- Automatic JSON repair (trailing commas, unclosed braces)
- Minimum content length checks
- Hallucination pattern detection

### Clinical Guardrails
- Fabricated lab value detection (checks against input data)
- Clinical contradiction detection (e.g., input says "afebrile" but output says "febrile")
- Dangerous drug combination warnings
- Incomplete plan detection
- Placeholder text detection

### Reliability
- Automatic retry with exponential backoff (max 2 retries)
- 30-second timeout per request
- Provider fallback chain (tries next provider if current fails)
- Structured logging with PHI-safe content hashing
- Per-provider latency and error rate tracking

---

## Monitoring

Access metrics in the browser console or programmatically:

```typescript
import { getMetrics, getRecentLogs, getAverageLatency, getFailureRate } from '@/services/llm';

// All provider metrics
console.log(getMetrics());

// Specific provider
console.log(getAverageLatency('openai'));
console.log(getFailureRate('anthropic'));

// Recent log entries
console.log(getRecentLogs(10));
```

---

## Testing

The new system can be tested independently of Supabase:

```typescript
import { createRouter } from '@/services/llm';

const router = createRouter({
  providers: {
    openai: { apiKey: 'test-key' },
  },
  router: { ... },
  logging: false,
  clinicalSafety: false,
});

const response = await router.request({
  model: 'gpt-4o-mini',
  systemPrompt: 'Test',
  userPrompt: 'Hello',
});
```
