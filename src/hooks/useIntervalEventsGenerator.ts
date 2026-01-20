import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PatientSystems } from '@/types/patient';

export const useIntervalEventsGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateIntervalEvents = useCallback(async (
    systems: PatientSystems,
    existingIntervalEvents?: string,
    patientName?: string
  ): Promise<string | null> => {
    // Check if there's any content in systems
    const hasContent = Object.values(systems).some(
      (val) => val && val.replace(/<[^>]*>/g, '').trim()
    );

    if (!hasContent) {
      toast.error('No system data to summarize. Add content to system reviews first.');
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
      const { data, error } = await supabase.functions.invoke('generate-interval-events', {
        body: { systems, existingIntervalEvents, patientName },
      });

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      if (error) {
        console.error('Generate interval events error:', error);
        toast.error(error.message || 'Failed to generate interval events');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      toast.success('Interval events generated');
      return data.intervalEvents;
    } catch (err) {
      // Don't show error if it was cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.error('Generate interval events error:', err);
      toast.error('Failed to generate interval events');
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
    generateIntervalEvents,
    isGenerating,
    cancelGeneration,
  };
};
