import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Patient } from '@/types/patient';

interface FieldChange {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

interface Todo {
  content: string;
  completed: boolean;
  section?: string;
}

export const useDailySummaryGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateDailySummary = useCallback(async (
    patient: Patient,
    onUpdate?: (intervalEvents: string) => void
  ): Promise<string | null> => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsGenerating(true);

    try {
      // Fetch today's field changes for this patient
      const today = new Date().toISOString().split('T')[0];
      const { data: fieldChanges, error: changesError } = await supabase
        .from('patient_field_history')
        .select('field_name, old_value, new_value, changed_at')
        .eq('patient_id', patient.id)
        .gte('changed_at', `${today}T00:00:00.000Z`)
        .order('changed_at', { ascending: true });

      if (changesError) {
        console.error('Error fetching field history:', changesError);
      }

      // Fetch todos for this patient
      const { data: todos, error: todosError } = await supabase
        .from('patient_todos')
        .select('content, completed, section')
        .eq('patient_id', patient.id);

      if (todosError) {
        console.error('Error fetching todos:', todosError);
      }

      // Check if there's anything to summarize
      const hasChanges = (fieldChanges?.length ?? 0) > 0;
      const hasTodos = (todos?.length ?? 0) > 0;

      if (!hasChanges && !hasTodos) {
        toast.error('No changes or todos to summarize for today.');
        return null;
      }

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('generate-daily-summary', {
        body: {
          patientName: patient.name || `Bed ${patient.bed}`,
          fieldChanges: fieldChanges || [],
          todos: todos || [],
          existingIntervalEvents: patient.intervalEvents,
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
      if (onUpdate && data.summary) {
        onUpdate(data.summary);
      }

      toast.success('Daily summary generated');
      return data.summary;
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
  }, []);

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
