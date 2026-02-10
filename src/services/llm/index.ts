/**
 * Multi-Provider LLM System
 *
 * This module exports the complete LLM abstraction layer.
 *
 * Usage:
 *   import { getLLMRouter } from '@/services/llm';
 *
 *   const router = getLLMRouter();
 *   const response = await router.request({
 *     model: 'gpt-4o',
 *     systemPrompt: 'You are a clinical assistant.',
 *     userPrompt: 'Summarize this patient data...',
 *     responseFormat: 'json',
 *     temperature: 0.2,
 *   }, {
 *     task: 'clinical_note',
 *     feature: 'clinical_summary',
 *   });
 */

// Core types
export type {
  LLMProvider,
  LLMProviderName,
  LLMRequest,
  LLMResponse,
  TokenUsage,
  TaskCategory,
  RoutingRule,
  RouterConfig,
  LLMLogEntry,
  ValidationResult,
  ClinicalSafetyResult,
  ClinicalSafetyIssue,
  ConsensusRequest,
  ConsensusResult,
  ProviderConfig,
  LLMSystemConfig,
} from './types';

// Router (main entry point)
export { LLMRouter } from './LLMRouter';

// Configuration & initialization
export {
  getLLMRouter,
  createRouter,
  resetRouter,
  buildConfigFromEnv,
  AVAILABLE_MODELS,
  type ModelOption,
} from './config';

// Prompt compiler
export { compilePrompt } from './PromptCompiler';

// Output validation
export {
  validateJSON,
  validateTextContent,
  validateClinicalOutput,
} from './OutputValidator';

// Clinical safety
export { verifyClinicalOutput } from './ClinicalGuardrails';

// Consensus engine
export { ConsensusEngine } from './ConsensusEngine';

// Logging & observability
export {
  logLLMEvent,
  createLogEntry,
  getMetrics,
  getRecentLogs,
  getAverageLatency,
  getFailureRate,
  hashPrompt,
  resetMetrics,
} from './LLMLogger';

// Provider adapters (for direct use or testing)
export {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  GrokProvider,
  GLMProvider,
  HuggingFaceProvider,
} from './providers';
