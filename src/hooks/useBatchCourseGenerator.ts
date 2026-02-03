import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Patient } from '@/types/patient';

export type BatchGenerationType = 'course' | 'intervalEvents';

export type BatchResult = {
  patientId: string;
  patientName: string;
  content: string | null;
  error?: string;
};

export type BatchProgress = {
  total: number;
  completed: number;
  current: string | null;
  results: BatchResult[];
};

export type UndoEntry = {
  patientId: string;
  field: string;
  previousValue: string;
};

export const useBatchCourseGenerator = () => {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState<BatchProgress>({
    total: 0,
    completed: 0,
    current: null,
    results: [],
  });
  const [undoStack, setUndoStack] = React.useState<UndoEntry[][]>([]);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const generateBatch = React.useCallback(async (
    patients: Patient[],
    type: BatchGenerationType,
    onUpdatePatient?: (id: string, field: string, value: unknown) => void
  ): Promise<BatchResult[]> => {
    // Filter patients with content based on generation type
    const patientsWithContent = patients.filter(patient => {
      if (type === 'intervalEvents') {
        // For interval events, need system notes
        return Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
      } else {
        // For course, need any clinical data
        const hasContent = 
          patient.clinicalSummary?.replace(/<[^>]*>/g, '').trim() ||
          patient.intervalEvents?.replace(/<[^>]*>/g, '').trim() ||
          patient.imaging?.replace(/<[^>]*>/g, '').trim() ||
          patient.labs?.replace(/<[^>]*>/g, '').trim() ||
          Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
        return hasContent;
      }
    });

    if (patientsWithContent.length === 0) {
      const message = type === 'intervalEvents' 
        ? 'No patients with system notes to generate interval events from.'
        : 'No patients with clinical data to generate courses from.';
      toast.error(message);
      return [];
    }

    // Cancel any existing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsGenerating(true);
    
    const results: BatchResult[] = [];
    const undoEntries: UndoEntry[] = [];
    const targetField = type === 'intervalEvents' ? 'intervalEvents' : 'clinicalSummary';

    setProgress({
      total: patientsWithContent.length,
      completed: 0,
      current: patientsWithContent[0]?.name || null,
      results: [],
    });

    for (let i = 0; i < patientsWithContent.length; i++) {
      // Check if cancelled
      if (abortControllerRef.current?.signal.aborted) {
        break;
      }

      const patient = patientsWithContent[i];
      
      setProgress(prev => ({
        ...prev,
        current: patient.name,
      }));

      try {
        let data, error;

        if (type === 'intervalEvents') {
          const response = await supabase.functions.invoke('generate-interval-events', {
            body: { 
              systems: patient.systems,
              existingIntervalEvents: patient.intervalEvents,
              patientName: patient.name,
            },
          });
          data = response.data;
          error = response.error;
        } else {
          const response = await supabase.functions.invoke('generate-patient-course', {
            body: { 
              patientData: {
                name: patient.name,
                clinicalSummary: patient.clinicalSummary,
                intervalEvents: patient.intervalEvents,
                imaging: patient.imaging,
                labs: patient.labs,
                systems: patient.systems,
              },
            },
          });
          data = response.data;
          error = response.error;
        }

        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        if (error || data?.error) {
          results.push({
            patientId: patient.id,
            patientName: patient.name,
            content: null,
            error: error?.message || data?.error || 'Generation failed',
          });
        } else {
          const content = type === 'intervalEvents' ? data.intervalEvents : data.course;
          results.push({
            patientId: patient.id,
            patientName: patient.name,
            content,
          });

          // If auto-insert is enabled, save for undo and update patient
          if (onUpdatePatient && content) {
            const previousValue = type === 'intervalEvents' 
              ? patient.intervalEvents 
              : patient.clinicalSummary;
            
            undoEntries.push({
              patientId: patient.id,
              field: targetField,
              previousValue,
            });

            let newValue: string;
            if (type === 'intervalEvents') {
              newValue = previousValue
                ? `${previousValue}\n\n${content}`
                : content;
            } else {
              newValue = previousValue
                ? `${previousValue}\n\n---\n**Hospital Course:**\n${content}`
                : `**Hospital Course:**\n${content}`;
            }
            
            onUpdatePatient(patient.id, targetField, newValue);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          break;
        }
        results.push({
          patientId: patient.id,
          patientName: patient.name,
          content: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      setProgress(prev => ({
        ...prev,
        completed: i + 1,
        results: [...results],
      }));
    }

    // Save undo entries if any updates were made
    if (undoEntries.length > 0) {
      setUndoStack(prev => [undoEntries, ...prev.slice(0, 4)]); // Keep last 5 batches
    }

    setIsGenerating(false);
    abortControllerRef.current = null;

    const successCount = results.filter(r => r.content).length;
    const failCount = results.filter(r => !r.content).length;
    const label = type === 'intervalEvents' ? 'interval event' : 'course';
    
    if (successCount > 0) {
      toast.success(`Generated ${successCount} ${label}${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to generate ${failCount} ${label}${failCount > 1 ? 's' : ''}`);
    }

    return results;
  }, []);

  // Backwards compatible wrapper for course generation
  const generateBatchCourses = React.useCallback(async (
    patients: Patient[],
    onUpdatePatient?: (id: string, field: string, value: unknown) => void
  ): Promise<BatchResult[]> => {
    return generateBatch(patients, 'course', onUpdatePatient);
  }, [generateBatch]);

  // New method for interval events
  const generateBatchIntervalEvents = React.useCallback(async (
    patients: Patient[],
    onUpdatePatient?: (id: string, field: string, value: unknown) => void
  ): Promise<BatchResult[]> => {
    return generateBatch(patients, 'intervalEvents', onUpdatePatient);
  }, [generateBatch]);

  const undoLastBatch = React.useCallback((
    onUpdatePatient: (id: string, field: string, value: unknown) => void
  ) => {
    if (undoStack.length === 0) return;

    const [lastBatch, ...rest] = undoStack;
    
    // Restore all previous values
    lastBatch.forEach(entry => {
      onUpdatePatient(entry.patientId, entry.field, entry.previousValue);
    });

    setUndoStack(rest);
    toast.success(`Undone ${lastBatch.length} change${lastBatch.length > 1 ? 's' : ''}`);
  }, [undoStack]);

  const cancelGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      toast.info('Batch generation cancelled');
    }
  }, []);

  const canUndo = undoStack.length > 0;

  return {
    generateBatch,
    generateBatchCourses,
    generateBatchIntervalEvents,
    isGenerating,
    progress,
    cancelGeneration,
    undoLastBatch,
    canUndo,
  };
};
