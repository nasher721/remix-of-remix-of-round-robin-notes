/**
 * Google Gemini provider adapter.
 *
 * Supports: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash
 * API format: generateContent with parts array
 *
 * Key differences:
 * - Uses "parts" array instead of "messages"
 * - System instruction is a separate top-level field
 * - Different streaming format (Server-Sent Events)
 * - Model name is embedded in the URL path
 */

import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const AVAILABLE_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.config.apiKey}`
      );
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
      const url = `${this.baseUrl}/models/${request.model}:generateContent?key=${this.config.apiKey}`;

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
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
          provider: 'gemini',
          model: request.model,
          latencyMs,
          error: `Gemini API error ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('') || '';

      const usageMetadata = data.usageMetadata;

      return {
        success: true,
        content,
        provider: 'gemini',
        model: request.model,
        latencyMs,
        usage: usageMetadata ? {
          promptTokens: usageMetadata.promptTokenCount || 0,
          completionTokens: usageMetadata.candidatesTokenCount || 0,
          totalTokens: usageMetadata.totalTokenCount || 0,
        } : undefined,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'gemini',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown Gemini error',
      };
    }
  }

  async stream(request: LLMRequest, onToken: (token: string) => void): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const body = this.buildRequestBody(request);
      const url = `${this.baseUrl}/models/${request.model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
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
          provider: 'gemini',
          model: request.model,
          latencyMs: Date.now() - startTime,
          error: `Gemini stream error ${response.status}: ${errorText}`,
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
            const parts = parsed.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) {
                  fullContent += part.text;
                  onToken(part.text);
                }
              }
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      return {
        success: true,
        content: fullContent,
        provider: 'gemini',
        model: request.model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        provider: 'gemini',
        model: request.model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : 'Unknown Gemini streaming error',
      };
    }
  }

  estimateTokens(input: string): number {
    return Math.ceil(input.length / 4);
  }

  private buildRequestBody(request: LLMRequest) {
    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: request.userPrompt }],
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 4000,
      },
    };

    // Gemini uses systemInstruction at the top level
    if (request.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    if (request.responseFormat === 'json') {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    }

    return body;
  }
}
