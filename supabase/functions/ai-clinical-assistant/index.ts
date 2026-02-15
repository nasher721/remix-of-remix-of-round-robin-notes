import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createErrorResponse, checkRateLimit, createCorsResponse, safeLog, RATE_LIMITS } from '../_shared/mod.ts';

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

// Temperature settings for each feature
const FEATURE_TEMPERATURES: Record<AIFeature, number> = {
  smart_expand: 0.2,
  differential_diagnosis: 0.3,
  documentation_check: 0.2,
  soap_format: 0.1,
  assessment_plan: 0.3,
  clinical_summary: 0.3,
  medical_correction: 0.1,
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

    // Get API keys
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error('No AI API keys configured. Please set OPENAI_API_KEY or LOVABLE_API_KEY.');
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

    // Determine which model to use
    const defaultGatewayModel = requestedModel || 'google/gemini-3-flash-preview';
    const isGatewayModel = requestedModel && (requestedModel.startsWith('google/') || requestedModel.startsWith('openai/'));

    // Try OpenAI GPT-4 first (preferred for clinical reasoning) - only if no gateway model requested
    if (OPENAI_API_KEY && !isGatewayModel) {
      try {
        // Use GPT-4o for complex tasks, GPT-4o-mini for simpler ones
        const isComplexTask = ['differential_diagnosis', 'assessment_plan', 'documentation_check'].includes(feature);
        const model = isComplexTask ? 'gpt-4o' : 'gpt-4o-mini';

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            temperature,
            max_completion_tokens: 4000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          result = data.choices?.[0]?.message?.content;
          modelUsed = model;
          safeLog('info', `GPT response received: ${result?.length || 0} chars`);
        } else {
          const errorText = await response.text();
          safeLog('error', `OpenAI API error: ${response.status} - ${errorText}`);

          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
              { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (err) {
        safeLog('error', `OpenAI API error: ${err}`);
      }
    }

    // Fallback to Lovable AI if GPT didn't work
    if (!result && LOVABLE_API_KEY) {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: defaultGatewayModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            temperature,
            max_completion_tokens: 4000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          result = data.choices?.[0]?.message?.content;
          modelUsed = 'gemini-3-flash';
          safeLog('info', `Lovable AI response received: ${result?.length || 0} chars`);
        } else {
          const errorText = await response.text();
          safeLog('error', `Lovable AI error: ${response.status} - ${errorText}`);

          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
              { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
              { status: 402, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (err) {
        safeLog('error', `Lovable AI error: ${err}`);
      }
    }

    if (!result) {
      throw new Error('Failed to get AI response from any provider');
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
    const errorMessage = error instanceof Error ? error.message : 'AI processing failed';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
