import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/types/patient';
import { useSettings } from '@/contexts/SettingsContext';
import type {
  AIFeature,
  ClinicalContext,
} from '@/lib/openai-config';
import { stripHtml } from '@/lib/openai-config';

export interface StreamingChunk {
  chunk: string;
  isComplete: boolean;
  error?: string;
}

interface UseStreamingAIOptions {
  onChunk?: (chunk: string, accumulated: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

interface UseStreamingAIReturn {
  isStreaming: boolean;
  accumulatedResponse: string;
  error: string | null;

  streamWithAI: (
    feature: AIFeature,
    options: {
      text?: string;
      context?: ClinicalContext;
      patient?: Patient;
      customPrompt?: string;
    }
  ) => Promise<string | null>;

  cancel: () => void;
  reset: () => void;
}

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

export const useStreamingAI = (
  options: UseStreamingAIOptions = {}
): UseStreamingAIReturn => {
  const { onChunk, onComplete, onError } = options;
  const { getModelForFeature } = useSettings();

  const [isStreaming, setIsStreaming] = useState(false);
  const [accumulatedResponse, setAccumulatedResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const reset = useCallback(() => {
    setAccumulatedResponse('');
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const streamWithAI = useCallback(async (
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
  ): Promise<string | null> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsStreaming(true);
    setError(null);
    setAccumulatedResponse('');

    try {
      const finalContext = patient ? patientToContext(patient) : context;

      if (!text && !finalContext) {
        throw new Error('No text or patient data provided');
      }

      if (finalContext && !text) {
        const hasContent =
          finalContext.clinicalSummary ||
          finalContext.intervalEvents ||
          finalContext.labs ||
          finalContext.imaging ||
          Object.values(finalContext.systems || {}).some((v) => v && stripHtml(v).trim());

        if (!hasContent) {
          throw new Error('No clinical data available. Please add patient information first.');
        }
      }

      // Use direct fetch for streaming - supabase.functions.invoke doesn't support streaming
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-clinical-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          feature,
          text,
          context: finalContext,
          customPrompt,
          model: getModelForFeature('clinical_assistant'),
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `AI processing failed: ${response.statusText}`);
      }

      // Check if response is SSE stream or JSON
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // Handle SSE streaming response

        if (!response.ok) {
          throw new Error(`Streaming failed: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let done = false;

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  done = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.chunk) {
                    accumulated += parsed.chunk;
                    setAccumulatedResponse(accumulated);
                    onChunk?.(parsed.chunk, accumulated);
                  } else if (parsed.error) {
                    throw new Error(parsed.error);
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        }

        setIsStreaming(false);
        onComplete?.(accumulated);
        return accumulated;
      }

      // Handle non-streaming JSON response
      const jsonData = await response.json();
      if (!jsonData.success) {
        throw new Error(jsonData.error || 'AI processing failed');
      }

      const result = jsonData.result as string;
      setAccumulatedResponse(result);
      onComplete?.(result);
      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }

      const message = err instanceof Error ? err.message : 'AI streaming failed';
      setError(message);
      onError?.(message);

      toast({
        title: 'AI Streaming Failed',
        description: message,
        variant: 'destructive',
      });

      return null;
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [onChunk, onComplete, onError, toast, getModelForFeature]);

  return {
    isStreaming,
    accumulatedResponse,
    error,
    streamWithAI,
    cancel,
    reset,
  };
};
