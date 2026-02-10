/**
 * Zhipu GLM provider adapter.
 *
 * Supports: GLM-4, GLM-4-Flash, GLM-4-Air
 * API format: OpenAI-compatible chat completions
 *
 * Zhipu BigModel API is compatible with OpenAI's API format
 * but uses a different base URL and auth mechanism.
 */

import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types';

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

const AVAILABLE_MODELS = [
  'glm-4',
  'glm-4-flash',
  'glm-4-air',
  'glm-4-airx',
  'glm-4-long',
];

export class GLMProvider implements LLMProvider {
  readonly name = 'glm' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Send a minimal request to check connectivity
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
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

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: this.getHeaders(),
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
          provider: 'glm',
          model: request.model,
          latencyMs,
          error: `GLM API error ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        content,
        provider: 'glm',
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
        provider: 'glm',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown GLM error',
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
        headers: this.getHeaders(),
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
          provider: 'glm',
          model: request.model,
          latencyMs: Date.now() - startTime,
          error: `GLM stream error ${response.status}: ${errorText}`,
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
        provider: 'glm',
        model: request.model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'glm',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown GLM streaming error',
      };
    }
  }

  estimateTokens(input: string): number {
    // CJK characters tend to use more tokens
    const cjkChars = (input.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const nonCjk = input.length - cjkChars;
    return Math.ceil(nonCjk / 4 + cjkChars / 1.5);
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
  }
}
