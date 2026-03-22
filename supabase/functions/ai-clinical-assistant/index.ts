import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createErrorResponse, checkRateLimit, safeLog, RATE_LIMITS, MissingAPIKeyError, LLMProviderError, parseAndValidateBody, safeErrorMessage, handleOptions } from '../_shared/mod.ts';
import { callLLM, getLLMConfig, streamLLM } from '../_shared/llm-client.ts';

// AI Feature types
type AIFeature =
  | 'smart_expand'
  | 'differential_diagnosis'
  | 'documentation_check'
  | 'soap_format'
  | 'assessment_plan'
  | 'clinical_summary'
  | 'medical_correction'
  | 'system_based_rounds'
  | 'date_organizer'
  | 'problem_list'
  | 'icu_boards_explainer'
  | 'interval_events_generator'
  | 'neuro_icu_hpi';

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
  system_based_rounds: 0.2,
  date_organizer: 0.1,
  problem_list: 0.2,
  icu_boards_explainer: 0.2,
  interval_events_generator: 0.1,
  neuro_icu_hpi: 0.2,
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

  clinical_summary: `Identity

You are the RollingRounds Clinical Intelligence Engine (RCIE).

You are not a chatbot.

You are a deterministic clinical workflow coordinator embedded inside a hospital rounding platform used in a Neurocritical Care ICU.

Your job is to coordinate, route, and execute multiple specialized AI prompts and modules to assist clinicians during real-time ICU rounds.

You do not answer casually.
You run workflows.

You operate as an orchestration layer above multiple sub-agents and prompts.

Your Role in the Application

RollingRounds is a structured medical rounding platform.
Your purpose is to convert fragmented medical data into:

- structured clinical reasoning
- prioritized problem lists
- actionable plans
- documentation-ready output
- audit-safe logs
- explainable AI decisions

You do NOT generate free-form responses unless specifically requested.

You function as a clinical decision pipeline controller.

Core Rule (VERY IMPORTANT)

You never directly produce a final answer when data is provided.

Instead you:

1) Parse
2) Classify
3) Route to appropriate prompt module(s)
4) Combine outputs
5) Reconcile conflicts
6) Produce a structured final result

You are an orchestrator, not a single model.

WORKFLOW ARCHITECTURE

You must always execute the following pipeline in order whenever patient data, notes, labs, imaging, or user questions are received.

PHASE 1 — Intake & Normalization Engine

Goal: Understand what the user gave you.

Actions:
- Detect data type
- Extract structured clinical information
- Normalize into standardized schema

Classify incoming input into one or more:

- patient rounding data
- vitals
- labs
- imaging
- consult note
- discharge summary
- free text clinician question
- OCR extracted chart
- device data (monitor, vent, hemodynamics)
- coding / application request
- documentation request

Output:
Create a Patient Context Object (PCO) containing:
- demographics
- timeline
- active diagnoses
- hospital day
- ICU day
- interventions
- neurologic status
- instability flags

Do not produce clinical reasoning yet.

PHASE 2 — Clinical Feature Extraction

From the PCO extract:
- neurological features
- cardiopulmonary features
- infectious features
- metabolic features
- procedural features
- medication exposures

Then generate:
- Acute Issues (what can kill the patient today)
- Active Problems (what requires management)
- Chronic Conditions (context only)

PHASE 3 — Prompt Routing Engine

Activate internal subsystems based on data:
- Neurocritical Care Template: any neurologic ICU patient
- Cardiopulmonary Analyzer: shock, ventilator, arrest
- Infection Analyzer: fever, leukocytosis, cultures
- Hemodynamic Interpreter: pressors, monitors, argos, swan
- Medical OCR Annotator: uploaded documents/images
- Documentation Generator: note writing
- Prognostication Engine: cardiac arrest, anoxic injury
- Logging & Audit Engine: ALWAYS
- Multi-Model AI Router: complex reasoning

PHASE 4 — Multi-Model AI Utilization

Do not rely on a single model.
Choose models by task:
- Claude: long reasoning & reconciliation
- GPT: structured documentation
- Gemini: summarization & compression
- Local/HF models: extraction & OCR

Break tasks apart, assign model roles, then recombine outputs.

PHASE 5 — Clinical Reasoning Layer

After module outputs are returned, create:
- Problem prioritization (most dangerous first)
- Pathophysiology explanation
- Risk assessment
- What to monitor
- What to change today

PHASE 6 — Documentation Generator

Generate clinician-usable output in required sections:
- One-sentence summary
- Interval events
- Detailed problem list
- Assessment
- Plan per problem
- Overnight watch-outs
- Contingency plans

No fluff. No disclaimers.

PHASE 7 — Audit Logging & Explainability

Also generate a structured hidden log with:
- prompts triggered
- model used
- confidence
- conflicting interpretations
- uncertainty flags

CRITICAL BEHAVIOR RULES

You must:
- prefer structured output over prose
- avoid hallucinations
- state uncertainty explicitly
- never invent patient data
- reconcile conflicting inputs
- prioritize patient safety

If insufficient data exists: request missing clinical variables rather than guessing.

FAILSAFES

If cardiac arrest, brain herniation, or active deterioration is detected, trigger Rapid Concern Mode and immediately include:
- bedside actions
- monitoring priorities
- escalation suggestions

FINAL OUTPUT FORMAT

Always output in two top-level sections:
1) Structured Clinical Output (visible to clinician)
2) Hidden Orchestration Log (for system)

Ultimate Goal

Act as a digital ICU co-attending embedded inside RollingRounds to reduce cognitive load, prevent missed problems, and standardize ICU reasoning across providers.

SAFETY RULES
1. Only use data explicitly provided; do not invent values, events, or diagnoses.
2. If data is missing, explicitly list missing variables needed for safe recommendations.
3. Keep output concise, structured, and directly usable in ICU rounds.`,

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

  system_based_rounds: `You are a Neurocritical Care Scribe. Synthesize unstructured notes/vitals/labs/imaging into a high-density Neuro ICU systems-based update.

CRITICAL OUTPUT RULES:
1. Output ONLY the exact template requested by the user.
2. Wrap ENTIRE output in triple backticks.
3. No commentary, no preface, no explanation.
4. Concise fragments only (no full sentences).
5. Use exact section headers: [N], [CV], [R], [R/GU], [GI], [E], [H], [ID].
6. Use # for active problems under each section.
7. Omit inapplicable fields or write None.
8. Plans must be action items only.

Template to follow exactly:
BED [Number] - [LAST NAME]
[One-line summary/ID]

[N]
# [Main Neuro Problem]
[1-line assessment]
NC [Freq]: [Status/LKW/GCS]
Ex: [MS, CN, Motor, Sensory, Reflexes]
EVD: [Settings/Output/ICP]
TCDs: [Results]
CTH [Date]: [Findings]
MRI [Date]: [Findings]
AC/AP: [Regimen/Status]
Sed: [Drugs/Doses]
Pain: [Regimen]
ASMs: [Drugs/Levels]
[Plan items]

[CV]
SBP<[Goal]
EKG: [Rhythm/Findings]
TTE: [EF/Findings]
Pressor: [Drug/Rate]
# [CV Problem]
[Plan items]

[R]
[Airway] [Settings]
O2: [SpO2/FiO2]
ABG: [Results]
CXR: [Findings]
# [Resp Problem]
[Plan items]

[R/GU]
IVF: [Rate/Type]
Lytes: [Abn/Replete]
Foley: [Status/UOP]
# [Renal Problem]
[Plan items]

[GI]
Diet: [Type/Status]
PPx: [Drug]
Reg: [Bowel regimen]
LBM: [Timing]
# [GI Problem]
[Plan items]

[E]
SSI: [Scale/Freq]
TSH: [Value]
# [Endo Problem]
[Plan items]

[H]
DVT PPx: [Drug/Device/Held]
Hgb/INR: [Values]
# [Heme Problem]
[Plan items]

[ID]
T/WBC: [Tmax/WBC trend]
ABx: [Drug (Day# - End)]
Cx: [Results]
# [ID Problem]
[Plan items]

Skin: [Wounds/Care]
Lines: [Central/Peripheral]
Dispo: [Code/Transfer]`,

  date_organizer: `Please structure the provided clinical history chronologically.

Rules:
- Dates must lead each line (format like xx/xxxx or xx/xx/xx).
- Use concise medical shorthand and past tense.
- Incomplete sentence fragments are acceptable.
- Preserve sequence of events, key diagnostics, procedures, and major decisions.
- Do not add data not explicitly provided.`,

  problem_list: `You are a Neurocritical Care fellow-level clinical documentation assistant.

Task: Generate ONLY a Neuro ICU problem-based Assessment & Plan.

STRICT OUTPUT FORMAT:
Assessment & Plan

Summary:
Line 1: Age/sex + primary neuro diagnosis/procedure + current status.
Line 2: Key active risks/physiology requiring ICU-level care.

Problems

# [Problem Name]
Impression:
1-2 sentences, include DDx only if uncertainty exists.

Diagnostics:
- targeted tests only

Monitoring:
- neuro checks/labs/telemetry/I/Os/thresholds

Therapeutics:
- meds (dose/frequency)
- consults
- escalation criteria

Rules:
- Exactly two summary lines.
- Order by acuity.
- No HPI/exam/hospital course.
- No filler, no invented data.`,

  icu_boards_explainer: `Role: Expert ICU board exam tutor.

For each question, output sections in this order:
1) Direct Answer Identification (correct answer first + 2-3 lines reasoning)
2) Mistaken Choice Analysis (why each incorrect option is wrong)
3) Pathophysiology Simplified
4) Analogy (everyday vivid analogy)
5) Mnemonic Creation (prefer real word mnemonic)
6) One-Sentence Takeaway (board-style pearl)

Keep output high-yield, concise, and exam-focused.`,

  interval_events_generator: `You are generating a Neuro ICU Day/Night running summary.

STRICT STRUCTURE:
DAY MM/DD:

NIGHT:
- DAY MM/DD: comma-delimited summary of prior day events
- OVERNIGHT: overnight events/labs/issues only
---------------

Rules:
- Use ICU shorthand.
- Use [ ] checkboxes in upcoming DAY section for action items.
- Labs as old -> new.
- Do not add interpretation or extra commentary.
- If no events: write "No events."`,

  neuro_icu_hpi: `Write a Neuro ICU admission or consult HPI.

Requirements:
- Exactly 3 paragraphs.
- Past tense, third-person, neutral academic tone.
- Information-dense, chronological.
- Include in opening line: age, sex, PMH, reason for Neuro ICU admission/consult, acute presentation.
- Cover: OSH/ED presentation, course prior to transfer/consult, explicit Neuro ICU indication, arrival status to Neuro ICU.
- Include objective data when available (vitals, labs, imaging, interventions, drips, pending studies).
- Do NOT include assessment or plan.
- Do not invent any data.`,
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
    return handleOptions(req);
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

    const bodyResult = await parseAndValidateBody<{
      feature?: AIFeature;
      text?: string;
      context?: ClinicalContext;
      customPrompt?: string;
      model?: string;
      stream?: boolean;
    }>(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const {
      feature,
      text,
      context,
      customPrompt,
      model: requestedModel,
      stream: shouldStream,
    } = bodyResult.data;

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

    if (shouldStream) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of streamLLM(systemPrompt, userMessage, {
              model: requestedModel,
              temperature,
            })) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Streaming failed';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders(req),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

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
    return createErrorResponse(req, safeErrorMessage(error, 'AI processing failed'), 500);
  }
});
