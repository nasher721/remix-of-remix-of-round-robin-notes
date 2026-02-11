/**
 * xAI Grok provider adapter.
 *
 * Supports: Grok-2, Grok-2-mini
 * API format: OpenAI-compatible chat completions
 *
 * xAI uses the same API format as OpenAI, so this adapter
 * is similar but points to the xAI endpoint.
 */

import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types';

const DEFAULT_BASE_URL = 'https://api.x.ai/v1';

const AVAILABLE_MODELS = [
  'grok-2',
  'grok-2-mini',
];

export class GrokProvider implements LLMProvider {
  readonly name = 'grok' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
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
      const messages: Array<{ role: string; content: string }> = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.userPrompt });

      const body: Record<string, unknown> = {
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 4000,
      };

      if (request.responseFormat === 'json') {
        body.response_format = { type: 'json_object' };
      }

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      };

      if (request.signal) {
        fetchOptions.signal = request.signal;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, fetchOptions);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          content: '',
          provider: 'grok',
          model: request.model,
          latencyMs,
          error: `Grok API error ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        content,
        provider: 'grok',
        model: data.model || request.model,
        latencyMs,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'grok',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown Grok error',
      };
    }
  }

  async stream(request: LLMRequest, onToken: (token: string) => void): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
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
        stream: true,
      };

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      };

      if (request.signal) {
        fetchOptions.signal = request.signal;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          content: '',
          provider: 'grok',
          model: request.model,
          latencyMs: Date.now() - startTime,
          error: `Grok stream error ${response.status}: ${errorText}`,
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
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content || '';
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
        provider: 'grok',
        model: request.model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'grok',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown Grok streaming error',
      };
    }
  }

  estimateTokens(input: string): number {
    return Math.ceil(input.length / 4);
  }
}
