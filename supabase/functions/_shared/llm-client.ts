// deno-lint-ignore-file

export class MissingAPIKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingAPIKeyError';
  }
}

export class LLMProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  provider: 'openai' | 'gemini' | 'anthropic' | 'grok' | 'glm';
}

export function getLLMConfig(preferredProvider?: 'openai' | 'gemini' | 'grok' | 'glm'): LLMConfig {
  // Helper to check OpenAI
  const getOpenAI = (): LLMConfig | null => {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (key && key.length > 10 && !key.includes('placeholder')) {
      return {
        apiKey: key,
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
        provider: 'openai'
      };
    }
    return null;
  };

  // Helper to check Gemini
  const getGemini = (): LLMConfig | null => {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (key && key.length > 10) {
      return {
        apiKey: key,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultModel: 'gemini-1.5-flash',
        provider: 'gemini'
      };
    }
    return null;
  };

  // Helper to check Grok
  const getGrok = (): LLMConfig | null => {
    const key = Deno.env.get('GROQ_API_KEY') || Deno.env.get('GROK_API_KEY');
    if (key && key.length > 10) {
      return {
        apiKey: key,
        baseURL: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama3-70b-8192',
        provider: 'grok'
      };
    }
    return null;
  };

  // 1. Try preferred provider first
  if (preferredProvider) {
    if (preferredProvider === 'openai') {
      const config = getOpenAI();
      if (config) return config;
    }
    if (preferredProvider === 'gemini') {
      const config = getGemini();
      if (config) return config;
    }
    if (preferredProvider === 'grok') {
      const config = getGrok();
      if (config) return config;
    }
    console.warn(`Preferred provider ${preferredProvider} not configured, falling back to auto-discovery.`);
  }

  // 2. Auto-discovery fallback (priority order)
  const openAI = getOpenAI();
  if (openAI) return openAI;

  const gemini = getGemini();
  if (gemini) return gemini;

  const grok = getGrok();
  if (grok) return grok;

  // Default fallback
  return {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    provider: 'openai'
  };
}

interface LLMRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  } = {}
) {
  // Infer provider preference from model name
  let preferredProvider: 'openai' | 'gemini' | 'grok' | undefined;
  if (options.model) {
    if (options.model.startsWith('gpt')) preferredProvider = 'openai';
    else if (options.model.startsWith('gemini')) preferredProvider = 'gemini';
    else if (options.model.startsWith('llama') || options.model.startsWith('mixtral')) preferredProvider = 'grok';
  }

  const config = getLLMConfig(preferredProvider);

  if (!config.apiKey) {
    throw new MissingAPIKeyError('No LLM API key configured. Add OPENAI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY to your Supabase project secrets.');
  }

  // Map requested model to provider-specific model if needed
  let model = options.model || config.defaultModel;

  // Simple model mapping fallback if provider doesn't match model family
  if (config.provider === 'gemini' && model.startsWith('gpt')) {
    model = 'gemini-1.5-flash';
  }
  if (config.provider === 'grok' && model.startsWith('gpt')) {
    model = 'llama3-70b-8192';
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const body: LLMRequestBody = {
    model,
    messages,
    temperature: options.temperature ?? 0.3,
  };

  if (options.maxTokens) {
    body.max_tokens = options.maxTokens;
  }

  if (options.jsonMode && config.provider === 'openai') {
    body.response_format = { type: 'json_object' };
  }
  // Note: Gemini/Groq JSON mode might vary, but standard OpenAI compat usually supports response_format or just prompt engineering.

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`LLM Error (${config.provider}): ${response.status} ${errorText}`);
    throw new LLMProviderError(`LLM provider error (${config.provider}): ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export interface StreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
}

export async function* streamLLM(
  systemPrompt: string,
  userPrompt: string,
  options: StreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  let preferredProvider: 'openai' | 'gemini' | 'grok' | undefined;
  if (options.model) {
    if (options.model.startsWith('gpt')) preferredProvider = 'openai';
    else if (options.model.startsWith('gemini')) preferredProvider = 'gemini';
    else if (options.model.startsWith('llama') || options.model.startsWith('mixtral')) preferredProvider = 'grok';
  }

  const config = getLLMConfig(preferredProvider);

  if (!config.apiKey) {
    throw new MissingAPIKeyError('No LLM API key configured.');
  }

  let model = options.model || config.defaultModel;
  if (config.provider === 'gemini' && model.startsWith('gpt')) {
    model = 'gemini-1.5-flash';
  }
  if (config.provider === 'grok' && model.startsWith('gpt')) {
    model = 'llama3-70b-8192';
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens,
    stream: true
  };

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMProviderError(`LLM streaming error (${config.provider}): ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new LLMProviderError('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          options.onToken?.(content);
          yield content;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}

export async function streamLLMToString(
  systemPrompt: string,
  userPrompt: string,
  options: StreamOptions = {}
): Promise<string> {
  let result = '';
  for await (const chunk of streamLLM(systemPrompt, userPrompt, options)) {
    result += chunk;
  }
  return result;
}
