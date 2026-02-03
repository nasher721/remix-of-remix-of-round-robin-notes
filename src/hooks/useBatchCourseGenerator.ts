import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Patient } from '@/types/patient';

export type BatchResult = {
  patientId: string;
  patientName: string;
  course: string | null;
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

  const generateBatchCourses = React.useCallback(async (
    patients: Patient[],
    onUpdatePatient?: (id: string, field: string, value: unknown) => void
  ): Promise<BatchResult[]> => {
    // Filter patients with content
    const patientsWithContent = patients.filter(patient => {
      const hasContent = 
        patient.clinicalSummary?.replace(/<[^>]*>/g, '').trim() ||
        patient.intervalEvents?.replace(/<[^>]*>/g, '').trim() ||
        patient.imaging?.replace(/<[^>]*>/g, '').trim() ||
        patient.labs?.replace(/<[^>]*>/g, '').trim() ||
        Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());
      return hasContent;
    });

    if (patientsWithContent.length === 0) {
      toast.error('No patients with clinical data to generate courses from.');
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
        const { data, error } = await supabase.functions.invoke('generate-patient-course', {
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

        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        if (error || data?.error) {
          results.push({
            patientId: patient.id,
            patientName: patient.name,
            course: null,
            error: error?.message || data?.error || 'Generation failed',
          });
        } else {
          const course = data.course;
          results.push({
            patientId: patient.id,
            patientName: patient.name,
            course,
          });

          // If auto-insert is enabled, save for undo and update patient
          if (onUpdatePatient && course) {
            undoEntries.push({
              patientId: patient.id,
              field: 'clinicalSummary',
              previousValue: patient.clinicalSummary,
            });

            const newValue = patient.clinicalSummary
              ? `${patient.clinicalSummary}\n\n---\n**Hospital Course:**\n${course}`
              : `**Hospital Course:**\n${course}`;
            
            onUpdatePatient(patient.id, 'clinicalSummary', newValue);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          break;
        }
        results.push({
          patientId: patient.id,
          patientName: patient.name,
          course: null,
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

    const successCount = results.filter(r => r.course).length;
    const failCount = results.filter(r => !r.course).length;
    
    if (successCount > 0) {
      toast.success(`Generated ${successCount} patient course${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to generate ${failCount} course${failCount > 1 ? 's' : ''}`);
    }

    return results;
  }, []);

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
    toast.success(`Undone ${lastBatch.length} patient course${lastBatch.length > 1 ? 's' : ''}`);
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
    generateBatchCourses,
    isGenerating,
    progress,
    cancelGeneration,
    undoLastBatch,
    canUndo,
  };
};
