/**
 * LLM System Configuration
 *
 * Reads provider API keys from environment variables and
 * initializes the router with available providers.
 *
 * Environment variables (set in Supabase secrets for edge functions,
 * or in .env with VITE_ prefix for client-side config):
 *
 * OPENAI_API_KEY / VITE_OPENAI_API_KEY
 * ANTHROPIC_API_KEY / VITE_ANTHROPIC_API_KEY
 * GEMINI_API_KEY / VITE_GEMINI_API_KEY
 * GROK_API_KEY / VITE_GROK_API_KEY
 * GLM_API_KEY / VITE_GLM_API_KEY
 * HUGGINGFACE_API_KEY / VITE_HUGGINGFACE_API_KEY
 *
 * VITE_DEFAULT_LLM_PROVIDER (e.g. "openai")
 * VITE_DEFAULT_LLM_MODEL (e.g. "gpt-4o-mini")
 * VITE_FALLBACK_LLM_PROVIDER (e.g. "gemini")
 * VITE_FALLBACK_LLM_MODEL (e.g. "gemini-2.0-flash")
 */

import { DEFAULT_CONFIG, STORAGE_KEYS } from '@/constants/config';
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

function getEnv(key: string): string | undefined {
  // Works in both Vite (import.meta.env) and Deno (Deno.env) environments
  try {
    // Vite client-side — import.meta.env is always an object in Vite
    const meta = import.meta;
    if (meta && typeof meta === 'object' && 'env' in meta) {
      const env = (meta as { env: Record<string, string> }).env;
      return env[`VITE_${key}`] || env[key];
    }
  } catch {
    // Not in Vite environment
  }

  try {
    // Deno (edge functions)
    const g = globalThis as Record<string, unknown>;
    if (typeof g.Deno !== 'undefined') {
      return (g.Deno as { env: { get: (k: string) => string } }).env.get(key);
    }
  } catch {
    // Not in Deno environment
  }

  return undefined;
}

function getStoredCredentials(): Partial<Record<LLMProviderName, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.AI_CREDENTIALS);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<LLMProviderName, string>>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Build config from environment
// ---------------------------------------------------------------------------

export function buildConfigFromEnv(): LLMSystemConfig {
  const providers: Partial<Record<LLMProviderName, ProviderConfig>> = {};

  const storedCredentials = getStoredCredentials();

  const openaiKey = getEnv('OPENAI_API_KEY') || storedCredentials.openai;
  if (openaiKey) {
    providers.openai = { apiKey: openaiKey };
  }

  const anthropicKey = getEnv('ANTHROPIC_API_KEY') || storedCredentials.anthropic;
  if (anthropicKey) {
    providers.anthropic = { apiKey: anthropicKey };
  }

  const geminiKey = getEnv('GEMINI_API_KEY') || storedCredentials.gemini;
  if (geminiKey) {
    providers.gemini = { apiKey: geminiKey };
  }

  const grokKey = getEnv('GROK_API_KEY') || storedCredentials.grok;
  if (grokKey) {
    providers.grok = { apiKey: grokKey };
  }

  const glmKey = getEnv('GLM_API_KEY') || storedCredentials.glm;
  if (glmKey) {
    providers.glm = { apiKey: glmKey };
  }

  const hfKey = getEnv('HUGGINGFACE_API_KEY') || storedCredentials.huggingface;
  if (hfKey) {
    providers.huggingface = {
      apiKey: hfKey,
      baseUrl: getEnv('HUGGINGFACE_BASE_URL'),
    };
  }

  const defaultProvider = (getEnv('DEFAULT_LLM_PROVIDER') || DEFAULT_CONFIG.DEFAULT_AI_PROVIDER) as LLMProviderName;
  const defaultModel = getEnv('DEFAULT_LLM_MODEL') || DEFAULT_CONFIG.DEFAULT_AI_MODEL;
  const fallbackProvider = (getEnv('FALLBACK_LLM_PROVIDER') || 'gemini') as LLMProviderName;
  const fallbackModel = getEnv('FALLBACK_LLM_MODEL') || 'gemini-2.0-flash';

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
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI
  { provider: 'openai', model: 'gpt-4o', label: 'GPT-4o', category: 'premium' },
  { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini', category: 'standard' },
  { provider: 'openai', model: 'o1-preview', label: 'o1 Preview', category: 'premium' },

  // Anthropic
  { provider: 'anthropic', model: 'claude-opus-4-20250514', label: 'Claude Opus 4', category: 'premium' },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', category: 'premium' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', category: 'standard' },

  // Gemini
  { provider: 'gemini', model: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', category: 'premium' },
  { provider: 'gemini', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', category: 'standard' },
  { provider: 'gemini', model: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', category: 'economy' },

  // Grok
  { provider: 'grok', model: 'grok-2', label: 'Grok 2', category: 'standard' },
  { provider: 'grok', model: 'grok-2-mini', label: 'Grok 2 Mini', category: 'economy' },

  // GLM
  { provider: 'glm', model: 'glm-4', label: 'GLM-4', category: 'standard' },
  { provider: 'glm', model: 'glm-4-flash', label: 'GLM-4 Flash', category: 'economy' },

  // HuggingFace
  { provider: 'huggingface', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B', category: 'local' },
  { provider: 'huggingface', model: 'meta-llama/Meta-Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B', category: 'local' },
  { provider: 'huggingface', model: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B', category: 'local' },
];
