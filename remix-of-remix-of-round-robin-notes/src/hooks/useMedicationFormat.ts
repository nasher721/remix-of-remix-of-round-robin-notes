import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PatientMedications } from '@/types/patient';

export const useMedicationFormat = () => {
  const [isFormatting, setIsFormatting] = useState(false);

  const formatMedications = useCallback(async (
    rawText: string
  ): Promise<PatientMedications | null> => {
    if (!rawText.trim()) {
      toast.error('No medication text to format');
      return null;
    }

    setIsFormatting(true);

    try {
      const { data, error } = await supabase.functions.invoke('format-medications', {
        body: { medications: rawText },
      });

      if (error) {
        console.error('Format medications error:', error);
        toast.error(error.message || 'Failed to format medications');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      if (data?.medications) {
        toast.success('Medications formatted successfully');
        return data.medications;
      }

      return null;
    } catch (err) {
      console.error('Format medications error:', err);
      toast.error('Failed to format medications');
      return null;
    } finally {
      setIsFormatting(false);
    }
  }, []);

  return {
    formatMedications,
    isFormatting,
  };
};
