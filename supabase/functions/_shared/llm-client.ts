import { corsHeaders } from './mod.ts';

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  provider: 'openai' | 'gemini' | 'anthropic' | 'grok' | 'glm';
}

export function getLLMConfig(): LLMConfig {
  // Check providers in order of preference (or availability)
  
  // 1. OpenAI
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  // Check if key looks valid (basic check to avoid using empty/dummy keys)
  if (openAIKey && openAIKey.length > 10 && !openAIKey.includes('placeholder')) {
    return {
      apiKey: openAIKey,
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      provider: 'openai'
    };
  }

  // 2. Gemini (via OpenAI-compatible endpoint)
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey && geminiKey.length > 10) {
    return {
      apiKey: geminiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      defaultModel: 'gemini-1.5-flash',
      provider: 'gemini'
    };
  }
  
  // 3. Grok (via OpenAI-compatible endpoint)
  const grokKey = Deno.env.get('GROQ_API_KEY') || Deno.env.get('GROK_API_KEY');
  if (grokKey && grokKey.length > 10) {
    return {
      apiKey: grokKey,
      baseURL: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama3-70b-8192',
      provider: 'grok'
    };
  }

  // Default fallback (will fail if no keys, but keeps types happy)
  return {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    provider: 'openai'
  };
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
  const config = getLLMConfig();
  
  if (!config.apiKey) {
    throw new Error('No valid LLM API key found (checked OPENAI_API_KEY, GEMINI_API_KEY, GROK_API_KEY)');
  }

  // Map requested model to provider-specific model if needed
  let model = options.model || config.defaultModel;
  
  // Simple model mapping fallback
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

  const body: any = {
    model,
    messages,
    temperature: options.temperature ?? 0.3,
  };

  if (options.jsonMode && config.provider === 'openai') {
    body.response_format = { type: 'json_object' };
  }
  // Note: Gemini/Groq JSON mode might vary, but standard OpenAI compat usually supports response_format or just prompt engineering.

  console.log(`Calling LLM: Provider=${config.provider} Model=${model} BaseURL=${config.baseURL}`);

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
    throw new Error(`LLM provider error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
