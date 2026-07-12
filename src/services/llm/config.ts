/**
 * LLM System Configuration
 *
 * Initializes the router from server-only environment secrets or user-supplied
 * credentials that exist only in browser memory.
 *
 * Provider secrets may be set only in a Deno/server environment:
 *
 * OPENAI_API_KEY
 * ANTHROPIC_API_KEY
 * GEMINI_API_KEY
 * GROK_API_KEY
 * GLM_API_KEY
 * HUGGINGFACE_API_KEY
 *
 * VITE_DEFAULT_LLM_PROVIDER (e.g. "openai")
 * VITE_DEFAULT_LLM_MODEL (e.g. "gpt-4o-mini")
 * VITE_FALLBACK_LLM_PROVIDER (e.g. "gemini")
 * VITE_FALLBACK_LLM_MODEL (e.g. "gemini-2.0-flash")
 */

import { DEFAULT_CONFIG } from '@/constants/config';
import type { LLMProviderName, LLMSystemConfig, ProviderConfig, RouterConfig } from './types';
import { LLMRouter } from './LLMRouter';
import {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  GrokProvider,
  GLMProvider,
  HuggingFaceProvider,
} from './providers';

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getServerEnv(key: string): string | undefined {
  try {
    const g = globalThis as Record<string, unknown>;
    if (typeof g.Deno !== 'undefined') {
      return (g.Deno as { env: { get: (k: string) => string } }).env.get(key);
    }
  } catch {
    // Not in Deno environment
  }

  return undefined;
}

type ClientSetting =
  | 'DEFAULT_LLM_PROVIDER'
  | 'DEFAULT_LLM_MODEL'
  | 'FALLBACK_LLM_PROVIDER'
  | 'FALLBACK_LLM_MODEL'
  | 'HUGGINGFACE_BASE_URL';

function getSetting(key: ClientSetting): string | undefined {
  const serverValue = getServerEnv(key);
  if (serverValue) return serverValue;

  // Keep this allowlist explicit. Reading the complete import.meta.env object
  // can cause every VITE_* value, including a mistakenly named secret, to be
  // embedded in the browser bundle.
  try {
    switch (key) {
      case 'DEFAULT_LLM_PROVIDER':
        return import.meta.env.VITE_DEFAULT_LLM_PROVIDER;
      case 'DEFAULT_LLM_MODEL':
        return import.meta.env.VITE_DEFAULT_LLM_MODEL;
      case 'FALLBACK_LLM_PROVIDER':
        return import.meta.env.VITE_FALLBACK_LLM_PROVIDER;
      case 'FALLBACK_LLM_MODEL':
        return import.meta.env.VITE_FALLBACK_LLM_MODEL;
      case 'HUGGINGFACE_BASE_URL':
        return import.meta.env.VITE_HUGGINGFACE_BASE_URL;
    }
  } catch {
    // import.meta.env is injected by Vite and is absent in the Node test runner.
    return undefined;
  }
}

let runtimeCredentials: Partial<Record<LLMProviderName, string>> = {};

/**
 * User-supplied provider keys intentionally live in memory only. Persisting
 * billable credentials in Web Storage or synced user preferences exposes them
 * to any script executing in the origin and to backups of the settings row.
 */
export function setRuntimeCredentials(
  credentials: Partial<Record<LLMProviderName, string>>,
): void {
  runtimeCredentials = { ...credentials };
  resetRouter();
}

export function clearRuntimeCredentials(): void {
  runtimeCredentials = {};
  resetRouter();
}

// ---------------------------------------------------------------------------
// Build config from environment
// ---------------------------------------------------------------------------

export function buildConfigFromEnv(): LLMSystemConfig {
  const providers: Partial<Record<LLMProviderName, ProviderConfig>> = {};

  const storedCredentials = runtimeCredentials;

  const openaiKey = getServerEnv('OPENAI_API_KEY') || storedCredentials.openai;
  if (openaiKey) {
    providers.openai = { apiKey: openaiKey };
  }

  const anthropicKey = getServerEnv('ANTHROPIC_API_KEY') || storedCredentials.anthropic;
  if (anthropicKey) {
    providers.anthropic = { apiKey: anthropicKey };
  }

  const geminiKey = getServerEnv('GEMINI_API_KEY') || storedCredentials.gemini;
  if (geminiKey) {
    providers.gemini = { apiKey: geminiKey };
  }

  const grokKey = getServerEnv('GROK_API_KEY') || storedCredentials.grok;
  if (grokKey) {
    providers.grok = { apiKey: grokKey };
  }

  const glmKey = getServerEnv('GLM_API_KEY') || storedCredentials.glm;
  if (glmKey) {
    providers.glm = { apiKey: glmKey };
  }

  const hfKey = getServerEnv('HUGGINGFACE_API_KEY') || storedCredentials.huggingface;
  if (hfKey) {
    providers.huggingface = {
      apiKey: hfKey,
      baseUrl: getSetting('HUGGINGFACE_BASE_URL'),
    };
  }

  const defaultProvider = (getSetting('DEFAULT_LLM_PROVIDER') || DEFAULT_CONFIG.DEFAULT_AI_PROVIDER) as LLMProviderName;
  const defaultModel = getSetting('DEFAULT_LLM_MODEL') || DEFAULT_CONFIG.DEFAULT_AI_MODEL;
  const fallbackProvider = (getSetting('FALLBACK_LLM_PROVIDER') || 'gemini') as LLMProviderName;
  const fallbackModel = getSetting('FALLBACK_LLM_MODEL') || 'gemini-2.0-flash';

  return {
    providers,
    router: {
      defaultProvider,
      defaultModel,
      fallbackProvider,
      fallbackModel,
      rules: [], // Uses LLMRouter defaults
      maxRetries: 2,
      retryDelayMs: 1000,
      timeoutMs: 30000,
    },
    logging: true,
    clinicalSafety: true,
  };
}

// ---------------------------------------------------------------------------
// Create and initialize router
// ---------------------------------------------------------------------------

let _routerInstance: LLMRouter | null = null;

/**
 * Get the singleton LLMRouter instance.
 * Lazily initializes with environment configuration.
 */
export function getLLMRouter(): LLMRouter {
  if (!_routerInstance) {
    _routerInstance = createRouter();
  }
  return _routerInstance;
}

/**
 * Create a new router with the given or default configuration.
 */
export function createRouter(config?: LLMSystemConfig): LLMRouter {
  const cfg = config || buildConfigFromEnv();

  const router = new LLMRouter(cfg.router, cfg.clinicalSafety);

  // Register available providers
  if (cfg.providers.openai) {
    router.registerProvider(new OpenAIProvider(cfg.providers.openai));
  }
  if (cfg.providers.anthropic) {
    router.registerProvider(new AnthropicProvider(cfg.providers.anthropic));
  }
  if (cfg.providers.gemini) {
    router.registerProvider(new GeminiProvider(cfg.providers.gemini));
  }
  if (cfg.providers.grok) {
    router.registerProvider(new GrokProvider(cfg.providers.grok));
  }
  if (cfg.providers.glm) {
    router.registerProvider(new GLMProvider(cfg.providers.glm));
  }
  if (cfg.providers.huggingface) {
    router.registerProvider(new HuggingFaceProvider(cfg.providers.huggingface));
  }

  return router;
}

/**
 * Reset the singleton (useful for testing or reconfiguration).
 */
export function resetRouter(): void {
  _routerInstance = null;
}

// ---------------------------------------------------------------------------
// Available models registry
// ---------------------------------------------------------------------------

export interface ModelOption {
  provider: LLMProviderName;
  model: string;
  label: string;
  category: 'premium' | 'standard' | 'economy' | 'local';
  description?: string;
  bestFor?: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI
  {
    provider: 'openai',
    model: 'gpt-4o',
    label: 'GPT-4o',
    category: 'premium',
    description: 'High intelligence, complex clinical reasoning',
    bestFor: 'Complex differentials, deep documentation analysis'
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    category: 'standard',
    description: 'Fast, efficient, reliable for daily tasks',
    bestFor: 'Text formatting, simple summarization'
  },
  {
    provider: 'openai',
    model: 'o1-preview',
    label: 'o1 Preview',
    category: 'premium',
    description: 'Advanced reasoning and problem solving',
    bestFor: 'Extremely complex medical cases'
  },

  // Anthropic
  {
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    category: 'premium',
    description: 'Most capable model for nuanced interpretation',
    bestFor: 'Sensitive clinical narratives'
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    category: 'premium',
    description: 'Great balance of speed and high logic',
    bestFor: 'General clinical assistance'
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    category: 'standard',
    description: 'Near-instant responses for quick edits',
    bestFor: 'Real-time text correction'
  },

  // Gemini
  {
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    category: 'premium',
    description: 'Massive context window, multi-modal capabilities',
    bestFor: 'Processing long medical records'
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    category: 'standard',
    description: 'Optimized for speed and long-context efficiency',
    bestFor: 'High-volume clinical data parsing'
  },
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    category: 'economy',
    description: 'Extremely fast and cost-effective',
    bestFor: 'Simple categorization tasks'
  },

  // Grok
  {
    provider: 'grok',
    model: 'grok-2',
    label: 'Grok 2',
    category: 'standard',
    description: 'Strong reasoning and latest training data',
    bestFor: 'General purpose modeling'
  },
  {
    provider: 'grok',
    model: 'grok-2-mini',
    label: 'Grok 2 Mini',
    category: 'economy',
    description: 'Compact and capable',
    bestFor: 'Lightweight transformations'
  },

  // GLM
  {
    provider: 'glm',
    model: 'glm-4',
    label: 'GLM-4',
    category: 'standard',
    description: 'General language model capabilities',
    bestFor: 'Multilingual clinical notes'
  },
  {
    provider: 'glm',
    model: 'glm-4-flash',
    label: 'GLM-4 Flash',
    category: 'economy',
    description: 'Fast inference for basic tasks',
    bestFor: 'Simple text cleanup'
  },

  // HuggingFace
  {
    provider: 'huggingface',
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    label: 'Llama 3.1 70B',
    category: 'local',
    description: 'State-of-the-art open source reasoning',
    bestFor: 'Local inference on large machines'
  },
  {
    provider: 'huggingface',
    model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    label: 'Llama 3.1 8B',
    category: 'local',
    description: 'Fast, efficient open source model',
    bestFor: 'Simple local processing'
  },
  {
    provider: 'huggingface',
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    label: 'Mixtral 8x7B',
    category: 'local',
    description: 'High performance Mixture-of-Experts',
    bestFor: 'Balanced open source choice'
  },
];
