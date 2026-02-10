/**
 * HuggingFace provider adapter.
 *
 * Supports: Any model hosted on HuggingFace Inference API or local TGI
 * API format: text-generation inference (OpenAI-compatible or native)
 *
 * HuggingFace Inference API supports both:
 * 1. Dedicated Inference Endpoints (production)
 * 2. Serverless Inference API (free tier, rate-limited)
 *
 * For local use, users can run Text Generation Inference (TGI)
 * and point the baseUrl to their local instance.
 */

import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types';

const DEFAULT_BASE_URL = 'https://api-inference.huggingface.co/models';

const AVAILABLE_MODELS = [
  'meta-llama/Meta-Llama-3.1-70B-Instruct',
  'meta-llama/Meta-Llama-3.1-8B-Instruct',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'microsoft/Phi-3-mini-4k-instruct',
];

export class HuggingFaceProvider implements LLMProvider {
  readonly name = 'huggingface' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testModel = this.config.defaultModel || AVAILABLE_MODELS[0];
      const response = await fetch(`${this.baseUrl}/${testModel}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ inputs: 'test', parameters: { max_new_tokens: 1 } }),
      });
      // 503 means model is loading — still reachable
      return response.ok || response.status === 503;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    return AVAILABLE_MODELS;
  }

  async sendMessage(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Check if the endpoint looks like an OpenAI-compatible endpoint (TGI or Inference Endpoints)
      const isOpenAICompatible = this.baseUrl.includes('/v1') || this.config.headers?.['x-use-openai-compat'] === 'true';

      if (isOpenAICompatible) {
        return this.sendOpenAICompatible(request, startTime);
      }

      return this.sendNative(request, startTime);
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'huggingface',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown HuggingFace error',
      };
    }
  }

  async stream(request: LLMRequest, onToken: (token: string) => void): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Build prompt manually for native API streaming
      const prompt = this.buildPromptString(request);
      const url = `${this.baseUrl}/${request.model}`;

      const body = {
        inputs: prompt,
        parameters: {
          max_new_tokens: request.maxTokens ?? 4000,
          temperature: request.temperature ?? 0.3,
          return_full_text: false,
        },
        stream: true,
      };

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      };

      if (request.signal) {
        fetchOptions.signal = request.signal;
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          content: '',
          provider: 'huggingface',
          model: request.model,
          latencyMs: Date.now() - startTime,
          error: `HuggingFace stream error ${response.status}: ${errorText}`,
        };
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body for streaming');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();

          try {
            const parsed = JSON.parse(data);
            const token = parsed.token?.text || '';
            if (token) {
              fullContent += token;
              onToken(token);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      return {
        success: true,
        content: fullContent,
        provider: 'huggingface',
        model: request.model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'huggingface',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown HuggingFace streaming error',
      };
    }
  }

  estimateTokens(input: string): number {
    // Most HF models use similar tokenizers with ~4 chars/token
    return Math.ceil(input.length / 4);
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
  }

  /**
   * Native HuggingFace Inference API format
   */
  private async sendNative(request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const prompt = this.buildPromptString(request);
    const url = `${this.baseUrl}/${request.model}`;

    const body = {
      inputs: prompt,
      parameters: {
        max_new_tokens: request.maxTokens ?? 4000,
        temperature: request.temperature ?? 0.3,
        return_full_text: false,
      },
    };

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    };

    if (request.signal) {
      fetchOptions.signal = request.signal;
    }

    const response = await fetch(url, fetchOptions);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();

      // HF returns 503 when model is loading
      if (response.status === 503) {
        return {
          success: false,
          content: '',
          provider: 'huggingface',
          model: request.model,
          latencyMs,
          error: 'Model is loading. Please retry in a moment.',
        };
      }

      return {
        success: false,
        content: '',
        provider: 'huggingface',
        model: request.model,
        latencyMs,
        error: `HuggingFace API error ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();

    // HF Inference API returns an array
    const content = Array.isArray(data)
      ? data[0]?.generated_text || ''
      : data?.generated_text || data?.[0]?.generated_text || '';

    return {
      success: true,
      content,
      provider: 'huggingface',
      model: request.model,
      latencyMs,
    };
  }

  /**
   * OpenAI-compatible format (for TGI or Inference Endpoints)
   */
  private async sendOpenAICompatible(request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.userPrompt });

    const body = {
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 4000,
    };

    const url = this.baseUrl.endsWith('/v1')
      ? `${this.baseUrl}/chat/completions`
      : `${this.baseUrl}/v1/chat/completions`;

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    };

    if (request.signal) {
      fetchOptions.signal = request.signal;
    }

    const response = await fetch(url, fetchOptions);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        content: '',
        provider: 'huggingface',
        model: request.model,
        latencyMs,
        error: `HuggingFace API error ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      success: true,
      content,
      provider: 'huggingface',
      model: request.model,
      latencyMs,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  /**
   * Build a single prompt string from system + user prompts.
   * Uses a simple chat template format.
   */
  private buildPromptString(request: LLMRequest): string {
    const parts: string[] = [];

    if (request.systemPrompt) {
      parts.push(`<|system|>\n${request.systemPrompt}</s>`);
    }
    parts.push(`<|user|>\n${request.userPrompt}</s>`);
    parts.push('<|assistant|>\n');

    return parts.join('\n');
  }
}
