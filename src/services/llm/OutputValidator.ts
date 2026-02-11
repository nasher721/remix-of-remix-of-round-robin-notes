/**
 * OutputValidator
 *
 * Validates and repairs LLM output for clinical documentation.
 *
 * Responsibilities:
 * - Enforce JSON schema when requested
 * - Repair malformed JSON (common with weaker models)
 * - Detect missing required fields
 * - Reject empty or nonsensical output
 * - Detect hallucinated content markers
 */

import type { ValidationResult } from './types';

// ---------------------------------------------------------------------------
// JSON validation & repair
// ---------------------------------------------------------------------------

/**
 * Validate that content is valid JSON and optionally check required fields.
 */
export function validateJSON(
  content: string,
  requiredFields?: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Try to extract JSON from potential markdown wrapping
  let jsonStr = content.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try to find JSON object/array boundaries
  if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
    const firstBrace = jsonStr.indexOf('{');
    const firstBracket = jsonStr.indexOf('[');
    const start = Math.min(
      firstBrace >= 0 ? firstBrace : Infinity,
      firstBracket >= 0 ? firstBracket : Infinity,
    );
    if (start !== Infinity) {
      warnings.push('JSON was preceded by non-JSON text; extracted object');
      jsonStr = jsonStr.slice(start);
    }
  }

  // Try direct parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Attempt repair
    const repaired = repairJSON(jsonStr);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired);
        warnings.push('JSON was malformed and was auto-repaired');
        jsonStr = repaired;
      } catch {
        errors.push('Invalid JSON that could not be repaired');
        return { valid: false, errors, warnings };
      }
    } else {
      errors.push('Invalid JSON that could not be repaired');
      return { valid: false, errors, warnings };
    }
  }

  // Check required fields
  if (requiredFields && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    for (const field of requiredFields) {
      if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check for empty content
  if (typeof parsed === 'object' && parsed !== null) {
    const str = JSON.stringify(parsed);
    if (str === '{}' || str === '[]') {
      errors.push('JSON is empty');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    repairedContent: jsonStr,
  };
}

/**
 * Attempt to repair common JSON issues.
 */
function repairJSON(input: string): string | null {
  let str = input;

  try {
    // Remove trailing commas before } or ]
    str = str.replace(/,\s*([}\]])/g, '$1');

    // Fix unescaped newlines in strings
    str = str.replace(/(?<=":[ ]*"[^"]*)\n(?=[^"]*")/g, '\\n');

    // Balance braces
    const openBraces = (str.match(/{/g) || []).length;
    const closeBraces = (str.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      str += '}'.repeat(openBraces - closeBraces);
    }

    // Balance brackets
    const openBrackets = (str.match(/\[/g) || []).length;
    const closeBrackets = (str.match(/]/g) || []).length;
    if (openBrackets > closeBrackets) {
      str += ']'.repeat(openBrackets - closeBrackets);
    }

    // Verify the repair worked
    JSON.parse(str);
    return str;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Content validation
// ---------------------------------------------------------------------------

/**
 * Validate that text content meets minimum quality standards.
 */
export function validateTextContent(
  content: string,
  options: {
    minLength?: number;
    maxLength?: number;
    mustNotContain?: string[];
  } = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { minLength = 10, maxLength = 50000, mustNotContain = [] } = options;

  if (!content || content.trim().length === 0) {
    errors.push('Content is empty');
    return { valid: false, errors, warnings };
  }

  if (content.trim().length < minLength) {
    errors.push(`Content too short (${content.trim().length} chars, minimum ${minLength})`);
  }

  if (content.length > maxLength) {
    warnings.push(`Content exceeds maximum length (${content.length} chars, maximum ${maxLength})`);
  }

  // Check for hallucination markers
  const hallucinationPatterns = [
    /I don't have (?:access to|information about) (?:the|this) patient/i,
    /As an AI(?: language model)?/i,
    /I cannot (?:provide|give) medical (?:advice|diagnosis)/i,
    /Please consult (?:a|your) (?:doctor|physician|healthcare)/i,
  ];

  for (const pattern of hallucinationPatterns) {
    if (pattern.test(content)) {
      warnings.push(`Response contains disclaimer pattern: ${pattern.source}`);
    }
  }

  // Check for forbidden content
  for (const forbidden of mustNotContain) {
    if (content.toLowerCase().includes(forbidden.toLowerCase())) {
      errors.push(`Content contains forbidden text: "${forbidden}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    repairedContent: content,
  };
}

// ---------------------------------------------------------------------------
// Clinical output validation
// ---------------------------------------------------------------------------

/** Required fields for each clinical feature's JSON output */
const FEATURE_REQUIRED_FIELDS: Record<string, string[]> = {
  differential_diagnosis: ['differentials', 'mostLikely', 'criticalToRuleOut', 'suggestedWorkup'],
  documentation_check: ['overallScore', 'gaps', 'strengths', 'suggestions'],
  soap_format: ['subjective', 'objective', 'assessment', 'plan'],
  assessment_plan: ['problems', 'overallAssessment'],
};

/**
 * Validate clinical feature output based on the feature type.
 */
export function validateClinicalOutput(
  content: string,
  feature: string,
): ValidationResult {
  const requiredFields = FEATURE_REQUIRED_FIELDS[feature];

  // JSON-output features
  if (requiredFields) {
    return validateJSON(content, requiredFields);
  }

  // Text-output features (smart_expand, clinical_summary, medical_correction)
  return validateTextContent(content, { minLength: 20 });
}
