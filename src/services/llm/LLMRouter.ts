/**
 * LLMRouter
 *
 * Central routing engine for all LLM requests in the application.
 *
 * Responsibilities:
 * - Route requests to the appropriate provider/model based on task type
 * - Automatic fallback when a provider fails
 * - Retry with exponential backoff
 * - Timeout protection
 * - Prompt compilation (provider-specific formatting)
 * - Output validation
 * - Clinical safety checks
 * - Structured logging
 *
 * This is the ONLY module that components/hooks should call.
 * No direct provider calls should exist outside this router.
 */

import type {
  LLMProvider,
  LLMProviderName,
  LLMRequest,
  LLMResponse,
  RouterConfig,
  RoutingRule,
  TaskCategory,
} from './types';
import { compilePrompt } from './PromptCompiler';
import { validateClinicalOutput } from './OutputValidator';
import { verifyClinicalOutput } from './ClinicalGuardrails';
import { logLLMEvent, createLogEntry, hashPrompt } from './LLMLogger';

// ---------------------------------------------------------------------------
// Default routing rules
// ---------------------------------------------------------------------------

const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    task: 'clinical_note',
    preferredProvider: 'anthropic',
    preferredModel: 'claude-sonnet-4-20250514',
    fallbacks: [
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'gemini', model: 'gemini-2.5-flash' },
    ],
  },
  {
    task: 'reasoning',
    preferredProvider: 'openai',
    preferredModel: 'gpt-4o',
    fallbacks: [
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { provider: 'gemini', model: 'gemini-2.5-pro' },
    ],
  },
  {
    task: 'fast_query',
    preferredProvider: 'grok',
    preferredModel: 'grok-2-mini',
    fallbacks: [
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
    ],
  },
  {
    task: 'low_cost',
    preferredProvider: 'glm',
    preferredModel: 'glm-4-flash',
    fallbacks: [
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'huggingface', model: 'meta-llama/Meta-Llama-3.1-8B-Instruct' },
    ],
  },
  {
    task: 'offline',
    preferredProvider: 'huggingface',
    preferredModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    fallbacks: [
      { provider: 'glm', model: 'glm-4-flash' },
    ],
  },
  {
    task: 'general',
    preferredProvider: 'openai',
    preferredModel: 'gpt-4o-mini',
    fallbacks: [
      { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
      { provider: 'grok', model: 'grok-2-mini' },
    ],
  },
  {
    task: 'transcription',
    preferredProvider: 'openai',
    preferredModel: 'whisper-1',
    fallbacks: [],
  },
];

const DEFAULT_CONFIG: RouterConfig = {
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o-mini',
  fallbackProvider: 'gemini',
  fallbackModel: 'gemini-2.0-flash',
  rules: DEFAULT_ROUTING_RULES,
  maxRetries: 2,
  retryDelayMs: 1000,
  timeoutMs: 30000,
};

// ---------------------------------------------------------------------------
// Router class
// ---------------------------------------------------------------------------

export class LLMRouter {
  private providers: Map<LLMProviderName, LLMProvider> = new Map();
  private config: RouterConfig;
  private clinicalSafety: boolean;

  constructor(config?: Partial<RouterConfig>, clinicalSafety = true) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.clinicalSafety = clinicalSafety;
  }

  /**
   * Register a provider adapter with the router.
   */
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a registered provider by name.
   */
  getProvider(name: LLMProviderName): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * List all registered providers.
   */
  listProviders(): LLMProviderName[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Send a request with automatic routing, fallback, and validation.
   *
   * This is the primary entry point for all LLM calls in the application.
   */
  async request(
    request: LLMRequest,
    options: {
      task?: TaskCategory;
      feature?: string;
      /** Override: specific provider to use */
      provider?: LLMProviderName;
      /** Override: specific model to use */
      model?: string;
      /** Skip clinical safety checks */
      skipSafety?: boolean;
      /** Skip output validation */
      skipValidation?: boolean;
    } = {},
  ): Promise<LLMResponse> {
    const task = options.task || 'general';
    const promptHash = hashPrompt(request.systemPrompt + request.userPrompt);

    // Build the list of provider/model pairs to try
    const candidates = this.buildCandidateList(task, options.provider, options.model, request.model);

    let lastError: string | undefined;

    for (const candidate of candidates) {
      const provider = this.providers.get(candidate.provider);
      if (!provider) continue;

      // Compile the prompt for this specific provider
      const compiled = compilePrompt(request, candidate.provider);
      const compiledRequest: LLMRequest = {
        ...request,
        model: candidate.model,
        systemPrompt: compiled.systemPrompt,
        userPrompt: compiled.userPrompt,
      };

      // Try with retries
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await sleep(delay);
        }

        const response = await this.executeWithTimeout(provider, compiledRequest);

        // Log the attempt
        logLLMEvent(createLogEntry(
          candidate.provider,
          candidate.model,
          task,
          response.latencyMs || 0,
          response.success,
          {
            error: response.error,
            tokenUsage: response.usage,
            feature: options.feature,
            promptHash,
          },
        ));

        if (!response.success) {
          lastError = response.error;
          continue; // Retry
        }

        // Validate output if needed
        if (!options.skipValidation && options.feature) {
          const validation = validateClinicalOutput(response.content, options.feature);
          if (!validation.valid) {
            lastError = `Validation failed: ${validation.errors.join('; ')}`;
            // Use repaired content if available
            if (validation.repairedContent) {
              response.content = validation.repairedContent;
            } else {
              continue; // Try next attempt or fallback
            }
          }
        }

        // Clinical safety check
        if (!options.skipSafety && this.clinicalSafety && request.patientContext) {
          const safety = verifyClinicalOutput(response.content, request.patientContext);
          if (!safety.safe) {
            const criticalIssues = safety.issues.filter(i => i.severity === 'critical');
            console.warn(
              `[LLMRouter] Clinical safety issues detected:`,
              criticalIssues.map(i => i.description),
            );
            // Don't block — log the warning but still return the response
            // The UI should display safety warnings to the clinician
          }
        }

        return response;
      }

      // All retries exhausted for this candidate — move to next fallback
    }

    // All candidates failed
    return {
      success: false,
      content: '',
      provider: candidates[0]?.provider || this.config.defaultProvider,
      model: candidates[0]?.model || this.config.defaultModel,
      error: `All providers failed. Last error: ${lastError || 'unknown'}`,
    };
  }

  /**
   * Stream a response with automatic routing and fallback.
   */
  async requestStream(
    request: LLMRequest,
    onToken: (token: string) => void,
    options: {
      task?: TaskCategory;
      feature?: string;
      provider?: LLMProviderName;
      model?: string;
    } = {},
  ): Promise<LLMResponse> {
    const task = options.task || 'general';
    const candidates = this.buildCandidateList(task, options.provider, options.model, request.model);

    for (const candidate of candidates) {
      const provider = this.providers.get(candidate.provider);
      if (!provider) continue;

      const compiled = compilePrompt(request, candidate.provider);
      const compiledRequest: LLMRequest = {
        ...request,
        model: candidate.model,
        systemPrompt: compiled.systemPrompt,
        userPrompt: compiled.userPrompt,
      };

      const response = await provider.stream(compiledRequest, onToken);

      logLLMEvent(createLogEntry(
        candidate.provider,
        candidate.model,
        task,
        response.latencyMs || 0,
        response.success,
        {
          error: response.error,
          tokenUsage: response.usage,
          feature: options.feature,
        },
      ));

      if (response.success) return response;
    }

    return {
      success: false,
      content: '',
      provider: this.config.defaultProvider,
      model: this.config.defaultModel,
      error: 'All providers failed for streaming request',
    };
  }

  /**
   * Run the same prompt against multiple models and return all results.
   */
  async requestMultiple(
    request: LLMRequest,
    providers: Array<{ provider: LLMProviderName; model: string }>,
  ): Promise<LLMResponse[]> {
    const promises = providers.map(async ({ provider: providerName, model }) => {
      const provider = this.providers.get(providerName);
      if (!provider) {
        return {
          success: false,
          content: '',
          provider: providerName,
          model,
          error: `Provider ${providerName} not registered`,
        } as LLMResponse;
      }

      const compiled = compilePrompt(request, providerName);
      return provider.sendMessage({
        ...request,
        model,
        systemPrompt: compiled.systemPrompt,
        userPrompt: compiled.userPrompt,
      });
    });

    return Promise.all(promises);
  }

  /**
   * Health check all registered providers.
   */
  async healthCheckAll(): Promise<Record<LLMProviderName, boolean>> {
    const results: Record<string, boolean> = {};

    const checks = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        results[name] = await provider.healthCheck();
      },
    );

    await Promise.all(checks);
    return results as Record<LLMProviderName, boolean>;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildCandidateList(
    task: TaskCategory,
    overrideProvider?: LLMProviderName,
    overrideModel?: string,
    requestModel?: string,
  ): Array<{ provider: LLMProviderName; model: string }> {
    const candidates: Array<{ provider: LLMProviderName; model: string }> = [];

    // If an explicit override is given, try it first
    if (overrideProvider && overrideModel) {
      candidates.push({ provider: overrideProvider, model: overrideModel });
    } else if (overrideProvider) {
      // Use the provider's default from the routing rules
      const rule = this.config.rules.find(r => r.task === task);
      candidates.push({
        provider: overrideProvider,
        model: requestModel || rule?.preferredModel || this.config.defaultModel,
      });
    }

    // Add task-specific routing
    const rule = this.config.rules.find(r => r.task === task);
    if (rule) {
      candidates.push({
        provider: rule.preferredProvider,
        model: rule.preferredModel,
      });
      for (const fb of rule.fallbacks) {
        candidates.push(fb);
      }
    }

    // Always add the global default and fallback last
    candidates.push({
      provider: this.config.defaultProvider,
      model: this.config.defaultModel,
    });
    candidates.push({
      provider: this.config.fallbackProvider,
      model: this.config.fallbackModel,
    });

    // Deduplicate (keep first occurrence)
    const seen = new Set<string>();
    return candidates.filter(c => {
      const key = `${c.provider}:${c.model}`;
      if (seen.has(key)) return false;
      seen.add(key);
      // Only include providers that are actually registered
      return this.providers.has(c.provider);
    });
  }

  private async executeWithTimeout(
    provider: LLMProvider,
    request: LLMRequest,
  ): Promise<LLMResponse> {
    const timeoutMs = this.config.timeoutMs;

    return new Promise<LLMResponse>((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          success: false,
          content: '',
          provider: provider.name,
          model: request.model,
          latencyMs: timeoutMs,
          error: `Request timed out after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      provider.sendMessage(request).then((response) => {
        clearTimeout(timer);
        resolve(response);
      }).catch((err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          content: '',
          provider: provider.name,
          model: request.model,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
