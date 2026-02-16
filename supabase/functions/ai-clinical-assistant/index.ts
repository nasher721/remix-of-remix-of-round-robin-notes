import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createErrorResponse, checkRateLimit, createCorsResponse, safeLog, RATE_LIMITS, MissingAPIKeyError, LLMProviderError } from '../_shared/mod.ts';
import { callLLM, getLLMConfig } from '../_shared/llm-client.ts';

// AI Feature types
type AIFeature =
  | 'smart_expand'
  | 'differential_diagnosis'
  | 'documentation_check'
  | 'soap_format'
  | 'assessment_plan'
  | 'clinical_summary'
  | 'medical_correction';

interface ClinicalContext {
  patientName?: string;
  clinicalSummary?: string;
  intervalEvents?: string;
  imaging?: string;
  labs?: string;
  systems?: Record<string, string>;
  medications?: {
    infusions?: string[];
    scheduled?: string[];
    prn?: string[];
  };
}

// Feature-specific temperatures
const FEATURE_TEMPERATURES: Record<AIFeature, number> = {
  smart_expand: 0.5,
  differential_diagnosis: 0.4,
  documentation_check: 0.3,
  soap_format: 0.4,
  assessment_plan: 0.4,
  clinical_summary: 0.3,
  medical_correction: 0.3,
};

// System prompts for each feature
const SYSTEM_PROMPTS: Record<AIFeature, string> = {
  smart_expand: `You are an expert ICU physician assistant. Your task is to expand abbreviated clinical notes into clear, complete documentation while preserving all clinical information exactly.

RULES:
1. Expand abbreviations to their full medical terms when it improves clarity
2. Convert shorthand into complete sentences
3. Maintain all clinical details - never add or remove information
4. Use proper medical terminology and formatting
5. Keep the tone professional and clinical
6. Format vital signs and lab values consistently
7. Preserve the original meaning exactly
8. Only use data explicitly provided; do not invent values or events
9. If data is missing, state that it is missing rather than guessing

OUTPUT: Return only the expanded text, no explanations.`,

  differential_diagnosis: `You are an expert critical care physician. Analyze the patient data and provide a differential diagnosis.

OUTPUT FORMAT (JSON):
{
  "differentials": [
    {
      "diagnosis": "Primary diagnosis name",
      "likelihood": "high|moderate|low",
      "supportingFindings": ["finding1", "finding2"],
      "workupNeeded": ["test1", "test2"]
    }
  ],
  "mostLikely": "Most likely diagnosis",
  "criticalToRuleOut": ["dangerous conditions to exclude"],
  "suggestedWorkup": ["recommended tests/studies"]
}

RULES:
1. Consider common and dangerous diagnoses
2. Base likelihood on available clinical data
3. Include 3-5 differential diagnoses
4. Always include critical diagnoses that must be ruled out
5. Suggest targeted workup based on differentials
6. Be evidence-based and clinically practical
7. Only use data explicitly provided; do not invent values or events
8. If data is missing, state that it is missing rather than guessing`,

  documentation_check: `You are a clinical documentation specialist. Review the patient documentation for completeness and quality.

OUTPUT FORMAT (JSON):
{
  "overallScore": 85,
  "gaps": [
    {
      "section": "Section name",
      "issue": "What is missing or incomplete",
      "suggestion": "How to improve",
      "priority": "critical|important|minor"
    }
  ],
  "strengths": ["Well-documented areas"],
  "suggestions": ["General improvement recommendations"]
}

EVALUATION CRITERIA:
1. Clinical summary completeness (diagnosis, history, current status)
2. Systems review coverage (all relevant systems documented)
3. Lab and imaging interpretation documented
4. Medication reconciliation (doses, frequencies, indications)
5. Assessment and plan clarity
6. Appropriate use of medical terminology
7. Critical values and findings highlighted
8. Only use data explicitly provided; do not invent values or events
9. If data is missing, state that it is missing rather than guessing`,

  soap_format: `You are an expert medical documentation specialist. Convert the clinical notes into proper SOAP format.

OUTPUT FORMAT (JSON):
{
  "subjective": "Patient symptoms, history, complaints as reported",
  "objective": "Physical exam findings, vital signs, lab values, imaging results",
  "assessment": "Clinical impression, diagnoses, problem list",
  "plan": "Treatment plan, medications, consultations, disposition"
}

RULES:
1. Organize information into appropriate SOAP sections
2. Use proper medical terminology
3. Include all relevant clinical data
4. Keep each section focused and organized
5. Highlight critical findings
6. Do not add information not present in the source data
7. If data is missing, state that it is missing rather than guessing`,

  assessment_plan: `You are an expert ICU attending physician. Generate a problem-based Assessment & Plan from the clinical data.

OUTPUT FORMAT (JSON):
{
  "problems": [
    {
      "problem": "Problem/Diagnosis name",
      "assessment": "Current status, relevant findings, clinical reasoning",
      "plan": ["Action item 1", "Action item 2", "Action item 3"]
    }
  ],
  "overallAssessment": "Brief overall patient status summary"
}

RULES:
1. Organize by active problems/diagnoses
2. Prioritize problems by acuity
3. Include both acute and chronic issues if relevant
4. Make plan items specific and actionable
5. Consider standard ICU bundles and protocols
6. Include monitoring parameters where appropriate
7. Address all organ systems with active issues
8. Only use data explicitly provided; do not invent values or events
9. If data is missing, state that it is missing rather than guessing`,

  clinical_summary: `You are an expert ICU physician. Generate a concise clinical summary from the patient data.

OUTPUT: A well-organized clinical summary including:
- One-liner (age, sex, relevant history, chief complaint/admission diagnosis)
- Brief hospital course
- Current clinical status by system
- Active problems
- Current plan

RULES:
1. Be concise but complete
2. Use standard medical abbreviations appropriately
3. Highlight critical issues
4. Include relevant lab trends
5. Note any recent significant events
6. Only use data explicitly provided; do not invent values or events
7. If data is missing, state that it is missing rather than guessing
8. Label the output as AI-generated`,

  medical_correction: `You are a medical terminology expert. Review and correct the text for medical accuracy.

RULES:
1. Fix spelling of medical terms, drug names, and procedures
2. Correct common transcription errors
3. Standardize abbreviations
4. Fix numerical formatting (doses, vital signs, lab values)
5. Do NOT change clinical meaning
6. Preserve all information
7. Only use data explicitly provided; do not invent values or events

OUTPUT: Return only the corrected text.`,
};

function stripHtml(text: string): string {
  return text?.replace(/<[^>]*>/g, '').trim() || '';
}

function buildContextString(context: ClinicalContext): string {
  const sections: string[] = [];

  if (context.patientName) {
    sections.push(`PATIENT: ${context.patientName}`);
  }

  if (context.clinicalSummary) {
    sections.push(`CLINICAL SUMMARY:\n${stripHtml(context.clinicalSummary)}`);
  }

  if (context.systems) {
    const systemLabels: Record<string, string> = {
      neuro: 'Neuro', cv: 'CV', resp: 'Resp', renalGU: 'Renal/GU',
      gi: 'GI', endo: 'Endo', heme: 'Heme', infectious: 'ID',
      skinLines: 'Skin/Lines', dispo: 'Dispo'
    };

    const systemNotes: string[] = [];
    for (const [key, label] of Object.entries(systemLabels)) {
      const content = context.systems[key];
      if (content && stripHtml(content).trim()) {
        systemNotes.push(`${label}: ${stripHtml(content)}`);
      }
    }
    if (systemNotes.length > 0) {
      sections.push(`SYSTEMS REVIEW:\n${systemNotes.join('\n')}`);
    }
  }

  if (context.labs) {
    sections.push(`LABS:\n${stripHtml(context.labs)}`);
  }

  if (context.imaging) {
    sections.push(`IMAGING:\n${stripHtml(context.imaging)}`);
  }

  if (context.medications) {
    const medNotes: string[] = [];
    if (context.medications.infusions?.length) {
      medNotes.push(`Infusions: ${context.medications.infusions.join(', ')}`);
    }
    if (context.medications.scheduled?.length) {
      medNotes.push(`Scheduled: ${context.medications.scheduled.join(', ')}`);
    }
    if (context.medications.prn?.length) {
      medNotes.push(`PRN: ${context.medications.prn.join(', ')}`);
    }
    if (medNotes.length > 0) {
      sections.push(`MEDICATIONS:\n${medNotes.join('\n')}`);
    }
  }

  if (context.intervalEvents) {
    sections.push(`INTERVAL EVENTS:\n${stripHtml(context.intervalEvents)}`);
  }

  return sections.join('\n\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if ('error' in authResult) {
      return authResult.error;
    }
    const userId = authResult.userId;
    safeLog('info', `Authenticated request from user: ${userId}`);
    
    // Rate limiting check
    const rateLimit = checkRateLimit(req, RATE_LIMITS.ai, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response ?? new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const {
      feature,
      text,
      context,
      customPrompt,
      model: requestedModel,
    }: {
      feature: AIFeature;
      text?: string;
      context?: ClinicalContext;
      customPrompt?: string;
      model?: string;
    } = await req.json();

    if (!feature) {
      throw new Error('Feature type is required');
    }

    // Build the user message
    let userMessage = '';

    if (text) {
      userMessage = text;
    }

    if (context) {
      const contextString = buildContextString(context);
      userMessage = userMessage
        ? `${userMessage}\n\n---\n\nPATIENT CONTEXT:\n${contextString}`
        : contextString;
    }

    if (!userMessage.trim()) {
      throw new Error('No text or context provided for AI processing');
    }

    // Get system prompt
    const systemPrompt = customPrompt || SYSTEM_PROMPTS[feature];
    if (!systemPrompt) {
      throw new Error(`Unknown feature: ${feature}`);
    }

    const temperature = FEATURE_TEMPERATURES[feature] || 0.3;

    safeLog('info', `Processing ${feature} request with ${userMessage.length} chars of input`);

    let result: string | null | undefined = null;
    let modelUsed = '';

    try {
      result = await callLLM(systemPrompt, userMessage, {
        model: requestedModel,
        temperature,
        jsonMode: ['differential_diagnosis', 'documentation_check', 'soap_format', 'assessment_plan'].includes(feature),
      });
      modelUsed = getLLMConfig().provider;
      safeLog('info', `LLM response received: ${result?.length || 0} chars`);
    } catch (err) {
      safeLog('error', `LLM error: ${err}`);
      if (err instanceof MissingAPIKeyError) {
        throw err;
      }
      throw new Error('Failed to get AI response');
    }

    if (!result) {
      throw new Error('No response from AI');
    }

    // Parse JSON response for structured features
    let parsedResult: unknown = result;
    const jsonFeatures: AIFeature[] = ['differential_diagnosis', 'documentation_check', 'soap_format', 'assessment_plan'];

    if (jsonFeatures.includes(feature)) {
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/) || result.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result;
        parsedResult = JSON.parse(jsonStr.trim());
      } catch (parseErr) {
        safeLog('error', `JSON parse error: ${parseErr}`);
        // Return raw text if JSON parsing fails
        parsedResult = result;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: parsedResult,
        model: modelUsed,
        feature,
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    safeLog('error', `AI Clinical Assistant error: ${error}`);
    if (error instanceof MissingAPIKeyError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 503, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    const errorMessage = error instanceof Error ? error.message : 'AI processing failed';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
