/**
 * OpenAI provider adapter.
 *
 * Supports: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo, Whisper
 * API format: Chat Completions (messages array with role/content)
 */

import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

const AVAILABLE_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo-preview',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1-preview',
  'o1-mini',
];

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai' as const;
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
      const body = this.buildRequestBody(request);

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organizationId && { 'OpenAI-Organization': this.config.organizationId }),
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
          provider: 'openai',
          model: request.model,
          latencyMs,
          error: `OpenAI API error ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        content,
        provider: 'openai',
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
        provider: 'openai',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown OpenAI error',
      };
    }
  }

  async stream(request: LLMRequest, onToken: (token: string) => void): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const body = { ...this.buildRequestBody(request), stream: true };

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organizationId && { 'OpenAI-Organization': this.config.organizationId }),
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
          provider: 'openai',
          model: request.model,
          latencyMs: Date.now() - startTime,
          error: `OpenAI stream error ${response.status}: ${errorText}`,
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
            // Skip malformed SSE chunks
          }
        }
      }

      return {
        success: true,
        content: fullContent,
        provider: 'openai',
        model: request.model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'openai',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown OpenAI streaming error',
      };
    }
  }

  estimateTokens(input: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(input.length / 4);
  }

  private buildRequestBody(request: LLMRequest) {
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

    return body;
  }
}
