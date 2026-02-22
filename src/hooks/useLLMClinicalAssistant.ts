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
3. Only use data explicitly provided; do not invent values or events
4. Label the output as AI-generated`,

  medical_correction: `You are a medical terminology expert. Review and correct the text for medical accuracy.

RULES:
1. Fix spelling of medical terms, drug names, and procedures
2. Correct common transcription errors
3. Standardize abbreviations
4. Do NOT change clinical meaning
5. Only use data explicitly provided; do not invent values or events

OUTPUT: Return only the corrected text.`,
};

const FEATURE_TEMPERATURES: Record<string, number> = {
  smart_expand: 0.2,
  differential_diagnosis: 0.3,
  documentation_check: 0.2,
  soap_format: 0.1,
  assessment_plan: 0.3,
  clinical_summary: 0.3,
  medical_correction: 0.1,
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
  const { aiProvider, aiModel, getModelForFeature } = useSettings();

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
        result = await doRouterRequest<T>(
          router, feature, text, finalContext, customPrompt,
          abortControllerRef.current.signal,
          overrideProvider, overrideModel,
          setLastModel, setLastResult, onSuccess,
        );
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
  }, [onSuccess, onError, toast, options.provider, options.model, aiProvider, aiModel, getModelForFeature]);

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
