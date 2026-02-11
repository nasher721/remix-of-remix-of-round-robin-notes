/**
 * Core types for the multi-provider LLM system.
 *
 * These types define the canonical request/response formats used across
 * all providers. Individual provider adapters translate to/from these types.
 */

// ---------------------------------------------------------------------------
// Provider identifiers
// ---------------------------------------------------------------------------

export type LLMProviderName =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'grok'
  | 'glm'
  | 'huggingface';

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

export interface LLMRequest {
  /** Provider-specific model identifier (e.g. "gpt-4o", "claude-sonnet-4-20250514") */
  model: string;
  /** System-level instruction */
  systemPrompt: string;
  /** User message / main prompt */
  userPrompt: string;
  /** Optional structured patient context (will be serialized into the prompt) */
  patientContext?: Record<string, unknown>;
  /** Desired output format */
  responseFormat?: 'json' | 'markdown' | 'note' | 'text';
  /** Sampling temperature (0-1) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface LLMResponse {
  /** Whether the request succeeded */
  success: boolean;
  /** The generated text content */
  content: string;
  /** Provider that generated this response */
  provider: LLMProviderName;
  /** Specific model used */
  model: string;
  /** Token usage if available */
  usage?: TokenUsage;
  /** Latency in milliseconds */
  latencyMs?: number;
  /** Error message if success is false */
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface LLMProvider {
  /** Provider name identifier */
  name: LLMProviderName;
  /** Check if the provider is reachable and configured */
  healthCheck(): Promise<boolean>;
  /** List available models for this provider */
  listModels(): Promise<string[]>;
  /** Send a message and get a complete response */
  sendMessage(request: LLMRequest): Promise<LLMResponse>;
  /** Stream a response token-by-token */
  stream(request: LLMRequest, onToken: (token: string) => void): Promise<LLMResponse>;
  /** Estimate token count for a given input string */
  estimateTokens(input: string): number;
}

// ---------------------------------------------------------------------------
// Router configuration
// ---------------------------------------------------------------------------

export type TaskCategory =
  | 'clinical_note'
  | 'reasoning'
  | 'fast_query'
  | 'low_cost'
  | 'offline'
  | 'transcription'
  | 'general';

export interface RoutingRule {
  task: TaskCategory;
  preferredProvider: LLMProviderName;
  preferredModel: string;
  fallbacks: Array<{ provider: LLMProviderName; model: string }>;
}

export interface RouterConfig {
  defaultProvider: LLMProviderName;
  defaultModel: string;
  fallbackProvider: LLMProviderName;
  fallbackModel: string;
  rules: RoutingRule[];
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
}

// ---------------------------------------------------------------------------
// Logging & observability
// ---------------------------------------------------------------------------

export interface LLMLogEntry {
  timestamp: string;
  provider: LLMProviderName;
  model: string;
  task: TaskCategory;
  feature?: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  tokenUsage?: TokenUsage;
  /** Never log patient identifiers — this is a content hash for dedup only */
  promptHash?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** The repaired/cleaned content if fixable */
  repairedContent?: string;
}

export interface ClinicalSafetyResult {
  safe: boolean;
  issues: ClinicalSafetyIssue[];
}

export interface ClinicalSafetyIssue {
  type: 'contradiction' | 'fabricated_data' | 'missing_data' | 'incomplete_plan' | 'unsafe_recommendation';
  description: string;
  severity: 'critical' | 'warning' | 'info';
  field?: string;
}

// ---------------------------------------------------------------------------
// Consensus
// ---------------------------------------------------------------------------

export interface ConsensusRequest {
  /** The original request */
  request: LLMRequest;
  /** Models to use in the consensus pipeline */
  models: Array<{ provider: LLMProviderName; model: string }>;
  /** Task type for routing decisions */
  task: TaskCategory;
}

export interface ConsensusResult {
  /** Final synthesized output */
  finalContent: string;
  /** Individual model responses */
  responses: LLMResponse[];
  /** The critique from the second model */
  critique?: string;
  /** Agreement score (0-1) */
  agreementScore: number;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  defaultModel?: string;
  /** Custom headers for the provider */
  headers?: Record<string, string>;
}

export interface LLMSystemConfig {
  providers: Partial<Record<LLMProviderName, ProviderConfig>>;
  router: RouterConfig;
  /** Enable structured logging */
  logging: boolean;
  /** Enable clinical safety guardrails */
  clinicalSafety: boolean;
}
