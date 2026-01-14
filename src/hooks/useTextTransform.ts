import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TransformType = 'comma-list' | 'medical-shorthand' | 'custom';

export interface CustomPrompt {
  id: string;
  name: string;
  prompt: string;
}

const CUSTOM_PROMPTS_KEY = 'ai-custom-prompts';

export const useTextTransform = () => {
  const [isTransforming, setIsTransforming] = useState(false);
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_PROMPTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveCustomPrompts = useCallback((prompts: CustomPrompt[]) => {
    setCustomPrompts(prompts);
    localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(prompts));
  }, []);

  const addCustomPrompt = useCallback((name: string, prompt: string) => {
    const newPrompt: CustomPrompt = {
      id: crypto.randomUUID(),
      name,
      prompt,
    };
    saveCustomPrompts([...customPrompts, newPrompt]);
    toast.success(`Saved prompt: ${name}`);
    return newPrompt;
  }, [customPrompts, saveCustomPrompts]);

  const removeCustomPrompt = useCallback((id: string) => {
    saveCustomPrompts(customPrompts.filter(p => p.id !== id));
    toast.success('Prompt deleted');
  }, [customPrompts, saveCustomPrompts]);

  const transformText = useCallback(async (
    text: string,
    transformType: TransformType,
    customPrompt?: string
  ): Promise<string | null> => {
    if (!text.trim()) {
      toast.error('No text selected');
      return null;
    }

    setIsTransforming(true);

    try {
      const { data, error } = await supabase.functions.invoke('transform-text', {
        body: { text, transformType, customPrompt },
      });

      if (error) {
        console.error('Transform error:', error);
        toast.error(error.message || 'Failed to transform text');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data.transformedText;
    } catch (err) {
      console.error('Transform error:', err);
      toast.error('Failed to transform text');
      return null;
    } finally {
      setIsTransforming(false);
    }
  }, []);

  return {
    transformText,
    isTransforming,
    customPrompts,
    addCustomPrompt,
    removeCustomPrompt,
  };
};
