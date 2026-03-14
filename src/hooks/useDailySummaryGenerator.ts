import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import { ensureString } from '@/lib/ai-response-utils';
import { useSettings } from '@/contexts/SettingsContext';

export const useDailySummaryGenerator = () => {
  const { getModelForFeature } = useSettings();
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  type TodoRow = { content: string | null; completed: boolean; section: string | null; created_at: string };

  const toTodoRow = (t: PatientTodo): TodoRow => ({
    content: t.content ?? null,
    completed: t.completed,
    section: t.section,
    created_at: t.createdAt,
  });

  const generateDailySummary = useCallback(async (
    patient: Patient,
    onUpdate?: (intervalEvents: string) => void,
    existingTodos?: PatientTodo[] | TodoRow[]
  ): Promise<string | null> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsGenerating(true);

    try {
      let todos: TodoRow[] | null = null;
      if (existingTodos?.length) {
        todos = 'created_at' in existingTodos[0] ? (existingTodos as TodoRow[]) : (existingTodos as PatientTodo[]).map(toTodoRow);
      }
      if (todos === null) {
        const { data, error: todosError } = await supabase
          .from('patient_todos')
          .select('content, completed, section, created_at')
          .eq('patient_id', patient.id);
        if (todosError) console.error('Error fetching todos:', todosError);
        todos = data;
      }

      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      // Send all patient data to the edge function
      const { data, error } = await supabase.functions.invoke('generate-daily-summary', {
        body: {
          patientName: patient.name || `Bed ${patient.bed}`,
          clinicalSummary: patient.clinicalSummary,
          intervalEvents: patient.intervalEvents,
          imaging: patient.imaging,
          labs: patient.labs,
          systems: patient.systems,
          medications: patient.medications,
          todos: todos ?? [],
          existingIntervalEvents: patient.intervalEvents,
          model: getModelForFeature('daily_summary'),
        },
      });

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      if (error) {
        console.error('Generate daily summary error:', error);
        toast.error(error.message || 'Failed to generate daily summary');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      // Auto-update if callback provided
      const summary = ensureString(data.summary);
      if (onUpdate && summary) {
        onUpdate(summary);
      }

      toast.success('Daily summary generated');
      return summary;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.error('Generate daily summary error:', err);
      toast.error('Failed to generate daily summary');
      return null;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [getModelForFeature]);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      toast.info('Generation cancelled');
    }
  }, []);

  return {
    generateDailySummary,
    isGenerating,
    cancelGeneration,
  };
};
