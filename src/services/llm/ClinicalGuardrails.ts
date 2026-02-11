/**
 * ClinicalGuardrails
 *
 * Safety layer for clinical documentation outputs.
 *
 * Checks for:
 * - Contradictions between output and input data
 * - Fabricated lab values or vitals not present in input
 * - Missing critical data references
 * - Incomplete treatment plans
 * - Unsafe or inappropriate recommendations
 *
 * If issues are detected, the caller can request a second opinion
 * from another model via the router.
 */

import type { ClinicalSafetyResult, ClinicalSafetyIssue } from './types';

// ---------------------------------------------------------------------------
// Main verification function
// ---------------------------------------------------------------------------

/**
 * Verify that a clinical AI output is safe and consistent with the input data.
 *
 * @param response - The AI-generated text
 * @param patientData - The original patient data sent to the AI
 * @returns Safety assessment with any issues found
 */
export function verifyClinicalOutput(
  response: string,
  patientData?: Record<string, unknown>,
): ClinicalSafetyResult {
  const issues: ClinicalSafetyIssue[] = [];

  // Run all checks
  issues.push(...checkForFabricatedData(response, patientData));
  issues.push(...checkForDangerousRecommendations(response));
  issues.push(...checkForIncompletePlans(response));
  issues.push(...checkForContradictions(response, patientData));

  return {
    safe: !issues.some(i => i.severity === 'critical'),
    issues,
  };
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/**
 * Check if the response contains specific numeric values (lab values, vitals)
 * that were NOT present in the input patient data.
 */
function checkForFabricatedData(
  response: string,
  patientData?: Record<string, unknown>,
): ClinicalSafetyIssue[] {
  if (!patientData) return [];

  const issues: ClinicalSafetyIssue[] = [];

  // Flatten all patient data into a single string for comparison
  const inputText = flattenToString(patientData).toLowerCase();

  // Extract specific numeric values from the response that look like lab values
  // Pattern: word/abbreviation followed by a number with optional decimal and units
  const labPatterns = [
    /(?:WBC|Hgb|Hct|Plt|Na|K|Cl|CO2|BUN|Cr|Glucose|Ca|Mg|Phos|Lactate|Troponin|BNP|INR|PTT)\s*(?:of|=|:)?\s*(\d+\.?\d*)/gi,
    /(?:pH)\s*(?:of|=|:)?\s*(\d+\.\d+)/gi,
    /(?:pCO2|pO2|HCO3)\s*(?:of|=|:)?\s*(\d+\.?\d*)/gi,
  ];

  for (const pattern of labPatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const value = match[1];
      // Check if this specific value appears anywhere in the input
      if (!inputText.includes(value)) {
        issues.push({
          type: 'fabricated_data',
          description: `Numeric value "${match[0].trim()}" not found in input patient data. This may be fabricated.`,
          severity: 'warning',
          field: 'labs',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for potentially dangerous medical recommendations.
 */
function checkForDangerousRecommendations(response: string): ClinicalSafetyIssue[] {
  const issues: ClinicalSafetyIssue[] = [];
  const lowerResponse = response.toLowerCase();

  // Check for contraindicated combinations (common dangerous pairs)
  const dangerousPairs = [
    { drugs: ['warfarin', 'aspirin', 'heparin'], risk: 'multiple anticoagulants' },
    { drugs: ['metformin', 'contrast'], risk: 'metformin with contrast dye' },
    { drugs: ['ace inhibitor', 'arb', 'potassium'], risk: 'hyperkalemia risk combination' },
  ];

  for (const pair of dangerousPairs) {
    const found = pair.drugs.filter(d => lowerResponse.includes(d));
    if (found.length >= 2) {
      issues.push({
        type: 'unsafe_recommendation',
        description: `Response mentions ${found.join(' + ')} — potential ${pair.risk}. Verify clinical appropriateness.`,
        severity: 'warning',
      });
    }
  }

  // Check for absolute contraindication language that may indicate errors
  const absoluteContraPatterns = [
    /(?:absolutely|strictly)\s+contraindicated/i,
    /never\s+(?:give|administer|prescribe)/i,
    /lethal\s+(?:dose|combination)/i,
  ];

  for (const pattern of absoluteContraPatterns) {
    if (pattern.test(response)) {
      issues.push({
        type: 'unsafe_recommendation',
        description: `Response contains strong contraindication language: "${response.match(pattern)?.[0]}". Review carefully.`,
        severity: 'warning',
      });
    }
  }

  return issues;
}

/**
 * Check if the response contains incomplete treatment plans.
 */
function checkForIncompletePlans(response: string): ClinicalSafetyIssue[] {
  const issues: ClinicalSafetyIssue[] = [];

  // Check for placeholder text that indicates incomplete generation
  const placeholderPatterns = [
    /\[(?:TODO|TBD|PENDING|INSERT|FILL IN)\]/i,
    /\.\.\.\s*(?:continue|more|etc)/i,
    /(?:need to|should)\s+(?:determine|decide|assess|evaluate)\s+(?:further|more)/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(response)) {
      issues.push({
        type: 'incomplete_plan',
        description: `Response contains placeholder or incomplete text matching: "${response.match(pattern)?.[0]}"`,
        severity: 'warning',
      });
    }
  }

  return issues;
}

/**
 * Check for contradictions between the response and the input data.
 * For example, if the input says "no fever" but the response says "febrile".
 */
function checkForContradictions(
  response: string,
  patientData?: Record<string, unknown>,
): ClinicalSafetyIssue[] {
  if (!patientData) return [];

  const issues: ClinicalSafetyIssue[] = [];
  const inputText = flattenToString(patientData).toLowerCase();
  const lowerResponse = response.toLowerCase();

  // Common clinical contradictions to check
  const contradictionPairs = [
    { positive: 'febrile', negative: 'afebrile' },
    { positive: 'hypotensive', negative: 'normotensive' },
    { positive: 'tachycardic', negative: 'normal heart rate' },
    { positive: 'intubated', negative: 'extubated' },
    { positive: 'on ventilator', negative: 'room air' },
    { positive: 'dialysis', negative: 'normal renal function' },
  ];

  for (const pair of contradictionPairs) {
    const inputHasPositive = inputText.includes(pair.positive);
    const inputHasNegative = inputText.includes(pair.negative);
    const responseHasPositive = lowerResponse.includes(pair.positive);
    const responseHasNegative = lowerResponse.includes(pair.negative);

    if (inputHasPositive && responseHasNegative) {
      issues.push({
        type: 'contradiction',
        description: `Input states "${pair.positive}" but response states "${pair.negative}"`,
        severity: 'critical',
      });
    }

    if (inputHasNegative && responseHasPositive) {
      issues.push({
        type: 'contradiction',
        description: `Input states "${pair.negative}" but response states "${pair.positive}"`,
        severity: 'critical',
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Recursively flatten an object into a single string for text searching.
 */
function flattenToString(obj: unknown): string {
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (obj === null || obj === undefined) return '';

  if (Array.isArray(obj)) {
    return obj.map(flattenToString).join(' ');
  }

  if (typeof obj === 'object') {
    return Object.values(obj).map(flattenToString).join(' ');
  }

  return '';
}
