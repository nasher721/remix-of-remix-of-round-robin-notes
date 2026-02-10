/**
 * PromptCompiler
 *
 * Converts canonical prompts into provider-specific formats.
 * Different providers interpret prompts differently — this module
 * ensures consistent behavior across all providers.
 *
 * Responsibilities:
 * - Inject patient context into prompts safely (no PHI in logs)
 * - Apply provider-specific formatting hints
 * - Handle JSON output instructions per provider
 * - Manage prompt size limits
 */

import type { LLMProviderName, LLMRequest } from './types';

// ---------------------------------------------------------------------------
// Provider-specific prompt adjustments
// ---------------------------------------------------------------------------

interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Compile a canonical LLMRequest's prompts for a specific provider.
 *
 * This adjusts the prompt text to account for known provider quirks:
 * - Claude: Responds better to XML-structured prompts
 * - OpenAI: Supports explicit JSON mode instruction
 * - Gemini: Needs explicit format instructions in the prompt
 * - GLM: Benefits from bilingual instructions for medical terms
 */
export function compilePrompt(
  request: LLMRequest,
  provider: LLMProviderName,
): CompiledPrompt {
  let systemPrompt = request.systemPrompt;
  let userPrompt = request.userPrompt;

  // Inject patient context into the user prompt if present
  if (request.patientContext && Object.keys(request.patientContext).length > 0) {
    const contextStr = formatPatientContext(request.patientContext);
    userPrompt = `${userPrompt}\n\n---\n\nPATIENT CONTEXT:\n${contextStr}`;
  }

  // Apply provider-specific adjustments
  switch (provider) {
    case 'anthropic':
      ({ systemPrompt, userPrompt } = compileForAnthropic(systemPrompt, userPrompt, request));
      break;
    case 'openai':
      ({ systemPrompt, userPrompt } = compileForOpenAI(systemPrompt, userPrompt, request));
      break;
    case 'gemini':
      ({ systemPrompt, userPrompt } = compileForGemini(systemPrompt, userPrompt, request));
      break;
    case 'grok':
      ({ systemPrompt, userPrompt } = compileForGrok(systemPrompt, userPrompt, request));
      break;
    case 'glm':
      ({ systemPrompt, userPrompt } = compileForGLM(systemPrompt, userPrompt, request));
      break;
    case 'huggingface':
      ({ systemPrompt, userPrompt } = compileForHuggingFace(systemPrompt, userPrompt, request));
      break;
  }

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Provider-specific compilers
// ---------------------------------------------------------------------------

function compileForAnthropic(
  systemPrompt: string,
  userPrompt: string,
  request: LLMRequest,
): CompiledPrompt {
  // Claude responds well to XML-structured prompts
  if (request.responseFormat === 'json') {
    systemPrompt += '\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any text before or after the JSON object. Do not wrap in markdown code blocks.';
  }

  // Wrap complex context in XML tags for Claude
  if (request.patientContext) {
    userPrompt = userPrompt.replace(
      /PATIENT CONTEXT:\n([\s\S]+)$/,
      '<patient_context>\n$1\n</patient_context>'
    );
  }

  return { systemPrompt, userPrompt };
}

function compileForOpenAI(
  systemPrompt: string,
  userPrompt: string,
  request: LLMRequest,
): CompiledPrompt {
  // OpenAI supports response_format natively for JSON, but still
  // benefits from explicit instructions
  if (request.responseFormat === 'json') {
    systemPrompt += '\n\nYou must respond with valid JSON only.';
  }

  return { systemPrompt, userPrompt };
}

function compileForGemini(
  systemPrompt: string,
  userPrompt: string,
  request: LLMRequest,
): CompiledPrompt {
  // Gemini benefits from explicit format instructions since
  // system instructions are less strongly followed
  if (request.responseFormat === 'json') {
    systemPrompt += '\n\nCRITICAL: Your response must be ONLY valid JSON. No markdown, no explanation, just the JSON object.';
    userPrompt += '\n\nRemember: respond with valid JSON only, no other text.';
  }

  return { systemPrompt, userPrompt };
}

function compileForGrok(
  systemPrompt: string,
  userPrompt: string,
  request: LLMRequest,
): CompiledPrompt {
  if (request.responseFormat === 'json') {
    systemPrompt += '\n\nRespond with valid JSON only. No additional text or formatting.';
  }

  return { systemPrompt, userPrompt };
}

function compileForGLM(
  systemPrompt: string,
  userPrompt: string,
  request: LLMRequest,
): CompiledPrompt {
  if (request.responseFormat === 'json') {
    systemPrompt += '\n\nPlease respond with valid JSON only. Do not include any other text. 请仅返回有效的JSON格式。';
  }

  return { systemPrompt, userPrompt };
}

function compileForHuggingFace(
  systemPrompt: string,
  userPrompt: string,
  request: LLMRequest,
): CompiledPrompt {
  // Open-source models need very explicit instructions
  if (request.responseFormat === 'json') {
    systemPrompt += '\n\nYou MUST respond with ONLY a valid JSON object. Do not include any text, explanation, or markdown formatting before or after the JSON. Start your response with { and end with }.';
  }

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Patient context formatting
// ---------------------------------------------------------------------------

/**
 * Formats patient context into a readable string for prompts.
 * Strips HTML and handles nested structures.
 */
function formatPatientContext(context: Record<string, unknown>): string {
  const sections: string[] = [];

  for (const [key, value] of Object.entries(context)) {
    if (value === null || value === undefined) continue;

    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

    if (typeof value === 'string') {
      const cleaned = stripHtml(value).trim();
      if (cleaned) {
        sections.push(`${label}: ${cleaned}`);
      }
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = formatPatientContext(value as Record<string, unknown>);
      if (nested) {
        sections.push(`${label}:\n${nested}`);
      }
    } else if (Array.isArray(value)) {
      const items = value.filter(v => v).map(v => typeof v === 'string' ? stripHtml(v) : JSON.stringify(v));
      if (items.length > 0) {
        sections.push(`${label}: ${items.join(', ')}`);
      }
    }
  }

  return sections.join('\n');
}

function stripHtml(text: string): string {
  return text?.replace(/<[^>]*>/g, '').trim() || '';
}
