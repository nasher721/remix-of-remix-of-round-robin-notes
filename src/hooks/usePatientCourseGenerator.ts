import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Patient } from '@/types/patient';
import { ensureString } from '@/lib/ai-response-utils';
import { useSettings } from '@/contexts/SettingsContext';

export const usePatientCourseGenerator = () => {
  const { getModelForFeature } = useSettings();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const generatePatientCourse = React.useCallback(async (
    patient: Patient,
    existingCourse?: string
  ): Promise<string | null> => {
    // Check if there's any content
    const hasContent = 
      patient.clinicalSummary?.replace(/<[^>]*>/g, '').trim() ||
      patient.intervalEvents?.replace(/<[^>]*>/g, '').trim() ||
      patient.imaging?.replace(/<[^>]*>/g, '').trim() ||
      patient.labs?.replace(/<[^>]*>/g, '').trim() ||
      Object.values(patient.systems).some(val => val?.replace(/<[^>]*>/g, '').trim());

    if (!hasContent) {
      toast.error('No patient data to generate course from. Add clinical notes first.');
      return null;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    setIsGenerating(true);

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
          existingCourse,
          model: getModelForFeature('patient_course'),
        },
      });

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      if (error) {
        console.error('Generate patient course error:', error);
        toast.error(error.message || 'Failed to generate patient course');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      toast.success('Patient course generated');
      return ensureString(data.course);
    } catch (err) {
      // Don't show error if it was cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.error('Generate patient course error:', err);
      toast.error('Failed to generate patient course');
      return null;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      toast.info('Generation cancelled');
    }
  }, []);

  return {
    generatePatientCourse,
    isGenerating,
    cancelGeneration,
  };
};
