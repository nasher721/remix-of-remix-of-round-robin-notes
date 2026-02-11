/**
 * Anthropic Claude provider adapter.
 *
 * Supports: Claude Opus 4, Claude Sonnet 4, Claude 3.5 Haiku, etc.
 * API format: Messages API (system separate, messages array with role/content)
 *
 * Key differences from OpenAI:
 * - system prompt is a top-level parameter, not a message
 * - uses "max_tokens" (required, no default)
 * - streaming uses Server-Sent Events with different event types
 */

import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types';

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const API_VERSION = '2023-06-01';

const AVAILABLE_MODELS = [
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20241022',
  'claude-3-opus-20240229',
];

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Anthropic doesn't have a /models endpoint; send a minimal request
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      return response.ok || response.status === 400; // 400 = reachable but bad request is ok for health
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
      const body = this.buildRequestBody(request);

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      };

      if (request.signal) {
        fetchOptions.signal = request.signal;
      }

      const response = await fetch(`${this.baseUrl}/messages`, fetchOptions);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          content: '',
          provider: 'anthropic',
          model: request.model,
          latencyMs,
          error: `Anthropic API error ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      const content = data.content
        ?.filter((block: { type: string }) => block.type === 'text')
        .map((block: { text: string }) => block.text)
        .join('') || '';

      return {
        success: true,
        content,
        provider: 'anthropic',
        model: data.model || request.model,
        latencyMs,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        } : undefined,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'anthropic',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown Anthropic error',
      };
    }
  }

  async stream(request: LLMRequest, onToken: (token: string) => void): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const body = { ...this.buildRequestBody(request), stream: true };

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      };

      if (request.signal) {
        fetchOptions.signal = request.signal;
      }

      const response = await fetch(`${this.baseUrl}/messages`, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          content: '',
          provider: 'anthropic',
          model: request.model,
          latencyMs: Date.now() - startTime,
          error: `Anthropic stream error ${response.status}: ${errorText}`,
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
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullContent += parsed.delta.text;
              onToken(parsed.delta.text);
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }

      return {
        success: true,
        content: fullContent,
        provider: 'anthropic',
        model: request.model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'anthropic',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown Anthropic streaming error',
      };
    }
  }

  estimateTokens(input: string): number {
    // Claude tokenizer is similar in ratio to GPT for English text
    return Math.ceil(input.length / 4);
  }

  private getHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'anthropic-version': API_VERSION,
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
  }

  private buildRequestBody(request: LLMRequest) {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: request.userPrompt },
    ];

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? 4000,
      temperature: request.temperature ?? 0.3,
    };

    // Anthropic takes system as a top-level param, not a message
    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    return body;
  }
}
