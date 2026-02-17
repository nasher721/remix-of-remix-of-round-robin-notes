import { useState, useCallback, useRef } from 'react';

export type AIWorkflowStep = {
  id: string;
  functionName: string;
  input: Record<string, unknown>;
  dependsOn?: string[];
};

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface AIWorkflowResult {
  stepId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export interface UseAIWorkflowReturn {
  runWorkflow: (steps: AIWorkflowStep[]) => Promise<AIWorkflowResult[]>;
  status: WorkflowStatus;
  progress: number;
  results: AIWorkflowResult[];
  currentStep: string | null;
  error: string | null;
  cancel: () => void;
}

export function useAIWorkflow(): UseAIWorkflowReturn {
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<AIWorkflowResult[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const callEdgeFunction = useCallback(async (
    functionName: string,
    input: Record<string, unknown>
  ): Promise<{ data?: unknown; error?: string }> => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: errorText || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  }, []);

  const runWorkflow = useCallback(async (steps: AIWorkflowStep[]): Promise<AIWorkflowResult[]> => {
    setStatus('running');
    setProgress(0);
    setResults([]);
    setError(null);
    cancelledRef.current = false;

    const stepResults: Map<string, AIWorkflowResult> = new Map();
    const completedSteps: Set<string> = new Set();

    for (let i = 0; i < steps.length; i++) {
      if (cancelledRef.current) {
        setStatus('failed');
        setError('Workflow cancelled');
        break;
      }

      const step = steps[i];
      setCurrentStep(step.id);
      setProgress(Math.round((i / steps.length) * 100));

      const startTime = Date.now();

      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!completedSteps.has(depId)) {
            const result: AIWorkflowResult = {
              stepId: step.id,
              success: false,
              error: `Dependency ${depId} not completed`,
              duration: 0,
            };
            stepResults.set(step.id, result);
            setResults(Array.from(stepResults.values()));
            setStatus('failed');
            setError(`Step ${step.id} failed: dependency ${depId} not satisfied`);
            return Array.from(stepResults.values());
          }
        }

        for (const depId of step.dependsOn) {
          const depResult = stepResults.get(depId);
          if (depResult && !depResult.success) {
            const result: AIWorkflowResult = {
              stepId: step.id,
              success: false,
              error: `Dependency ${depId} failed`,
              duration: 0,
            };
            stepResults.set(step.id, result);
            setResults(Array.from(stepResults.values()));
            setStatus('failed');
            setError(`Step ${step.id} failed: dependency ${depId} failed`);
            return Array.from(stepResults.values());
          }
        }

        const enrichedInput = { ...step.input };
        for (const depId of step.dependsOn) {
          const depResult = stepResults.get(depId);
          if (depResult?.data) {
            enrichedInput[`${depId}Result`] = depResult.data;
          }
        }

        const { data, error: fnError } = await callEdgeFunction(step.functionName, enrichedInput);
        const duration = Date.now() - startTime;

        const result: AIWorkflowResult = {
          stepId: step.id,
          success: !fnError,
          data,
          error: fnError,
          duration,
        };

        stepResults.set(step.id, result);
        if (fnError) {
          setStatus('failed');
          setError(`Step ${step.id} failed: ${fnError}`);
          setResults(Array.from(stepResults.values()));
          return Array.from(stepResults.values());
        }
        completedSteps.add(step.id);
      } else {
        const { data, error: fnError } = await callEdgeFunction(step.functionName, step.input);
        const duration = Date.now() - startTime;

        const result: AIWorkflowResult = {
          stepId: step.id,
          success: !fnError,
          data,
          error: fnError,
          duration,
        };

        stepResults.set(step.id, result);
        if (fnError) {
          setStatus('failed');
          setError(`Step ${step.id} failed: ${fnError}`);
          setResults(Array.from(stepResults.values()));
          return Array.from(stepResults.values());
        }
        completedSteps.add(step.id);
      }

      setResults(Array.from(stepResults.values()));
    }

    setProgress(100);
    setCurrentStep(null);
    setStatus('completed');
    return Array.from(stepResults.values());
  }, [callEdgeFunction]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return {
    runWorkflow,
    status,
    progress,
    results,
    currentStep,
    error,
    cancel,
  };
}

export default useAIWorkflow;
