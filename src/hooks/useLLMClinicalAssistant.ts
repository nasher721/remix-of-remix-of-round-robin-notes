/**
 * useLLMClinicalAssistant
 *
 * Drop-in replacement for useAIClinicalAssistant that uses the new
 * multi-provider LLM system.
 *
 * This hook maintains the same API surface as the original hook but
 * routes requests through the LLMRouter instead of directly calling
 * a single Supabase edge function.
 *
 * When the LLM router has no providers configured (no API keys),
 * it falls back to the original Supabase edge function path.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeClinicalContext } from '@/lib/piiSanitizer';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';
import type { Patient } from '@/types/patient';
import type {
  AIFeature,
  DDxResponse,
  DocumentationCheckResponse,
  SOAPNote,
  AssessmentPlanResponse,
  ClinicalContext,
} from '@/lib/openai-config';
import { stripHtml, buildClinicalContextString } from '@/lib/openai-config';
import { getLLMRouter } from '@/services/llm';
import type { LLMProviderName, TaskCategory } from '@/services/llm';
import { ConsensusEngine } from '@/services/llm/ConsensusEngine';

// ---------------------------------------------------------------------------
// Feature → task category mapping
// ---------------------------------------------------------------------------

const FEATURE_TASK_MAP: Record<AIFeature, TaskCategory> = {
  transcription: 'transcription',
  clinical_summary: 'clinical_note',
  differential_diagnosis: 'reasoning',
  documentation_check: 'reasoning',
  soap_format: 'clinical_note',
  assessment_plan: 'clinical_note',
  smart_expand: 'fast_query',
  medical_correction: 'fast_query',
  system_based_rounds: 'clinical_note',
  date_organizer: 'summarization',
  problem_list: 'clinical_note',
  icu_boards_explainer: 'reasoning',
  interval_events_generator: 'summarization',
  neuro_icu_hpi: 'clinical_note',
  smart_draft: 'clinical_note',
};

// ---------------------------------------------------------------------------
// NEXUS-Full Mode Configuration
// ---------------------------------------------------------------------------

const NEXUS_CONFIG: Record<string, { writer: { provider: LLMProviderName, model: string }, critic: { provider: LLMProviderName, model: string }, synthesizer: { provider: LLMProviderName, model: string } }> = {
  clinical_note: {
    writer: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    critic: { provider: 'openai', model: 'gpt-4o' },
    synthesizer: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
  },
  reasoning: {
    writer: { provider: 'openai', model: 'gpt-4o' },
    critic: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    synthesizer: { provider: 'openai', model: 'gpt-4o' }
  },
  summarization: {
    writer: { provider: 'gemini', model: 'gemini-2.5-pro' },
    critic: { provider: 'openai', model: 'gpt-4o-mini' },
    synthesizer: { provider: 'gemini', model: 'gemini-2.5-pro' }
  }
};

// System prompts matching the edge function's prompts
const SYSTEM_PROMPTS: Record<string, string> = {
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
1. Clinical summary completeness
2. Systems review coverage
3. Lab and imaging interpretation documented
4. Medication reconciliation
5. Assessment and plan clarity
6. Only use data explicitly provided; do not invent values or events`,

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
4. Do not add information not present in the source data`,

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
3. Make plan items specific and actionable
4. Only use data explicitly provided; do not invent values or events`,

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
4. Do NOT change clinical meaning
5. Only use data explicitly provided; do not invent values or events

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
  smart_draft: `You are an expert ICU physician assistant. Your task is to generate a comprehensive, professional clinical draft based on the provided context. 

Structure the draft logically:
1. Patient Identification & Context
2. Key Clinical Findings
3. Assessment of current status
4. Proposed plan or next steps

Rules:
- Professional, academic tone.
- Use standard ICU terminology.
- Be concise but thorough.
- Base everything strictly on the provided context.`,
};

const FEATURE_TEMPERATURES: Record<string, number> = {
  smart_expand: 0.2,
  differential_diagnosis: 0.3,
  documentation_check: 0.2,
  soap_format: 0.1,
  assessment_plan: 0.3,
  clinical_summary: 0.3,
  medical_correction: 0.1,
  system_based_rounds: 0.2,
  date_organizer: 0.1,
  problem_list: 0.2,
  icu_boards_explainer: 0.2,
  interval_events_generator: 0.1,
  neuro_icu_hpi: 0.2,
  smart_draft: 0.3,
};

// ---------------------------------------------------------------------------
// Hook interface (matches original)
// ---------------------------------------------------------------------------

interface UseLLMClinicalAssistantOptions {
  onSuccess?: (result: unknown, feature: AIFeature) => void;
  onError?: (error: string) => void;
  /** Override provider for all requests */
  provider?: LLMProviderName;
  /** Override model for all requests */
  model?: string;
}

interface UseLLMClinicalAssistantReturn {
  isProcessing: boolean;
  lastResult: unknown | null;
  lastFeature: AIFeature | null;
  lastModel: string | null;
  error: string | null;

  processWithAI: <T = string>(
    feature: AIFeature,
    options: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    }
  ) => Promise<T | null>;

  smartExpand: (text: string) => Promise<string | null>;
  getDifferentialDiagnosis: (patient: Patient) => Promise<DDxResponse | null>;
  checkDocumentation: (patient: Patient) => Promise<DocumentationCheckResponse | null>;
  formatAsSOAP: (patient: Patient) => Promise<SOAPNote | null>;
  generateAssessmentPlan: (patient: Patient) => Promise<AssessmentPlanResponse | null>;
  generateClinicalSummary: (patient: Patient) => Promise<string | null>;
  correctMedicalText: (text: string) => Promise<string | null>;

  cancel: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Patient → context converter
// ---------------------------------------------------------------------------

function patientToContext(patient: Patient): ClinicalContext {
  return {
    patientName: patient.name,
    clinicalSummary: patient.clinicalSummary,
    intervalEvents: patient.intervalEvents,
    imaging: patient.imaging,
    labs: patient.labs,
    systems: patient.systems,
    medications: patient.medications,
  };
}

// ---------------------------------------------------------------------------
// Standalone request functions (outside the hook for stable references)
// ---------------------------------------------------------------------------

const JSON_FEATURES = ['differential_diagnosis', 'documentation_check', 'soap_format', 'assessment_plan'];

async function doRouterRequest<T>(
  router: ReturnType<typeof getLLMRouter>,
  feature: AIFeature,
  text?: string,
  context?: ClinicalContext,
  customPrompt?: string,
  signal?: AbortSignal,
  overrideProvider?: LLMProviderName,
  overrideModel?: string,
  setLastModel?: (m: string) => void,
  setLastResult?: (r: unknown) => void,
  onSuccess?: (result: unknown, feature: AIFeature) => void,
): Promise<T | null> {
  const systemPrompt = customPrompt || SYSTEM_PROMPTS[feature] || '';
  const temperature = FEATURE_TEMPERATURES[feature] || 0.3;
  const task = FEATURE_TASK_MAP[feature] || 'general';

  let userPrompt = text || '';
  if (context) {
    const contextString = buildClinicalContextString(context);
    userPrompt = userPrompt
      ? `${userPrompt}\n\n---\n\nPATIENT CONTEXT:\n${contextString}`
      : contextString;
  }

  const responseFormat = JSON_FEATURES.includes(feature) ? 'json' as const : 'text' as const;

  const response = await router.request(
    {
      model: overrideModel || '',
      systemPrompt,
      userPrompt,
      temperature,
      responseFormat,
      maxTokens: 4000,
      signal,
      patientContext: context as unknown as Record<string, unknown>,
    },
    {
      task,
      feature,
      provider: overrideProvider,
      model: overrideModel,
    },
  );

  if (!response.success) {
    throw new Error(response.error || 'AI processing failed');
  }

  setLastModel?.(`${response.provider}/${response.model}`);

  let result: unknown = response.content;
  if (JSON_FEATURES.includes(feature)) {
    try {
      const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        response.content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response.content;
      result = JSON.parse(jsonStr.trim());
    } catch {
      result = response.content;
    }
  }

  setLastResult?.(result);
  onSuccess?.(result, feature);
  return result as T;
}

async function doConsensusRequest<T>(
  router: ReturnType<typeof getLLMRouter>,
  feature: AIFeature,
  text?: string,
  context?: ClinicalContext,
  customPrompt?: string,
  signal?: AbortSignal,
  setLastModel?: (m: string) => void,
  setLastResult?: (r: unknown) => void,
  onSuccess?: (result: unknown, feature: AIFeature) => void,
): Promise<T | null> {
  const engine = new ConsensusEngine(router);
  const task = FEATURE_TASK_MAP[feature] || 'general';
  const config = NEXUS_CONFIG[task];

  if (!config) {
    // Fall back to single model if no NEXUS config for this task
    return doRouterRequest<T>(router, feature, text, context, customPrompt, signal, undefined, undefined, setLastModel, setLastResult, onSuccess);
  }

  const systemPrompt = customPrompt || SYSTEM_PROMPTS[feature] || '';
  const temperature = FEATURE_TEMPERATURES[feature] || 0.3;

  let userPrompt = text || '';
  if (context) {
    const contextString = buildClinicalContextString(context);
    userPrompt = userPrompt
      ? `${userPrompt}\n\n---\n\nPATIENT CONTEXT:\n${contextString}`
      : contextString;
  }

  const responseFormat = JSON_FEATURES.includes(feature) ? 'json' as const : 'text' as const;

  const result = await engine.runConsensus({
    task,
    request: {
      model: config.writer.model, // Initially writer's model, engine handles switches
      systemPrompt,
      userPrompt,
      temperature,
      responseFormat,
      maxTokens: 4000,
      signal,
      patientContext: context as unknown as Record<string, unknown>,
    },
    models: [config.writer, config.critic, config.synthesizer],
  });

  const finalOutput = result.finalContent;
  setLastModel?.(`NEXUS/${config.writer.model}+${config.critic.model}`);

  let parsed: unknown = finalOutput;
  if (JSON_FEATURES.includes(feature)) {
    try {
      const jsonMatch = finalOutput.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        finalOutput.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : finalOutput;
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      parsed = finalOutput;
    }
  }

  setLastResult?.(parsed);
  onSuccess?.(parsed, feature);
  return parsed as T;
}

async function doEdgeFunctionRequest<T>(
  feature: AIFeature,
  text?: string,
  context?: ClinicalContext,
  customPrompt?: string,
  setLastResult?: (r: unknown) => void,
  setLastModel?: (m: string | null) => void,
  onSuccess?: (result: unknown, feature: AIFeature) => void,
  model?: string,
): Promise<T | null> {
  const { data, error: fnError } = await supabase.functions.invoke('ai-clinical-assistant', {
    body: { feature, text, context, customPrompt, model },
  });

  if (fnError) throw new Error(fnError.message || 'AI processing failed');
  if (!data?.success) throw new Error(data?.error || 'AI processing failed');

  const result = data.result as T;
  setLastResult?.(result);
  setLastModel?.(data.model || null);
  onSuccess?.(result, feature);
  return result;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export const useLLMClinicalAssistant = (
  options: UseLLMClinicalAssistantOptions = {}
): UseLLMClinicalAssistantReturn => {
  const { onSuccess, onError } = options;
  const { aiProvider, aiModel, getModelForFeature, nexusMode } = useSettings();

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<unknown | null>(null);
  const [lastFeature, setLastFeature] = useState<AIFeature | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const reset = useCallback(() => {
    setLastResult(null);
    setLastFeature(null);
    setLastModel(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
  }, []);

  const processWithAI = useCallback(async <T = string>(
    feature: AIFeature,
    {
      text,
      context,
      patient,
      customPrompt,
    }: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    }
  ): Promise<T | null> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsProcessing(true);
    setError(null);
    setLastFeature(feature);

    try {
      const rawContext = patient ? patientToContext(patient) : context;

      if (!text && !rawContext) {
        throw new Error('No text or patient data provided');
      }

      if (rawContext && !text) {
        const hasContent =
          rawContext.clinicalSummary ||
          rawContext.intervalEvents ||
          rawContext.labs ||
          rawContext.imaging ||
          Object.values(rawContext.systems || {}).some((v) => v && stripHtml(v).trim());

        if (!hasContent) {
          throw new Error('No clinical data available. Please add patient information first.');
        }
      }

      // Sanitize PII before sending to AI providers
      const finalContext = rawContext
        ? sanitizeClinicalContext(rawContext as Record<string, unknown>).sanitized as ClinicalContext
        : undefined;

      // Try the new LLM router first
      const router = getLLMRouter();
      const availableProviders = router.listProviders();
      const hasProviders = availableProviders.length > 0;
      const resolvedProvider = options.provider ?? aiProvider;
      const resolvedModel = options.model ?? aiModel;
      const overrideProvider = availableProviders.includes(resolvedProvider) ? resolvedProvider : undefined;
      const overrideModel = overrideProvider ? resolvedModel : undefined;

      let result: T | null;
      if (hasProviders) {
        if (nexusMode && NEXUS_CONFIG[FEATURE_TASK_MAP[feature] || '']) {
          result = await doConsensusRequest<T>(
            router, feature, text, finalContext, customPrompt,
            abortControllerRef.current.signal,
            setLastModel, setLastResult, onSuccess
          );
        } else {
          result = await doRouterRequest<T>(
            router, feature, text, finalContext, customPrompt,
            abortControllerRef.current.signal,
            overrideProvider, overrideModel,
            setLastModel, setLastResult, onSuccess,
          );
        }
      } else {
        // Fallback: use original Supabase edge function
        result = await doEdgeFunctionRequest<T>(
          feature, text, finalContext, customPrompt,
          setLastResult, setLastModel, onSuccess,
          getModelForFeature('clinical_assistant'),
        );
      }

      return result;

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;

      const message = err instanceof Error ? err.message : 'AI processing failed';
      setError(message);
      onError?.(message);

      toast({
        title: 'AI Processing Failed',
        description: message,
        variant: 'destructive',
      });

      return null;
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [onSuccess, onError, toast, options.provider, options.model, aiProvider, aiModel, getModelForFeature, nexusMode]);

  // -----------------------------------------------------------------------
  // Convenience methods
  // -----------------------------------------------------------------------

  const smartExpand = useCallback(
    (text: string) => processWithAI<string>('smart_expand', { text }),
    [processWithAI]
  );

  const getDifferentialDiagnosis = useCallback(
    (patient: Patient) => processWithAI<DDxResponse>('differential_diagnosis', { patient }),
    [processWithAI]
  );

  const checkDocumentation = useCallback(
    (patient: Patient) => processWithAI<DocumentationCheckResponse>('documentation_check', { patient }),
    [processWithAI]
  );

  const formatAsSOAP = useCallback(
    (patient: Patient) => processWithAI<SOAPNote>('soap_format', { patient }),
    [processWithAI]
  );

  const generateAssessmentPlan = useCallback(
    (patient: Patient) => processWithAI<AssessmentPlanResponse>('assessment_plan', { patient }),
    [processWithAI]
  );

  const generateClinicalSummary = useCallback(
    (patient: Patient) => processWithAI<string>('clinical_summary', { patient }),
    [processWithAI]
  );

  const correctMedicalText = useCallback(
    (text: string) => processWithAI<string>('medical_correction', { text }),
    [processWithAI]
  );

  return {
    isProcessing,
    lastResult,
    lastFeature,
    lastModel,
    error,
    processWithAI,
    smartExpand,
    getDifferentialDiagnosis,
    checkDocumentation,
    formatAsSOAP,
    generateAssessmentPlan,
    generateClinicalSummary,
    correctMedicalText,
    cancel,
    reset,
  };
};
