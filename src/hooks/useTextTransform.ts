import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';
import { useSettings } from '@/contexts/SettingsContext';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

export type TransformType = 'comma-list' | 'medical-shorthand' | 'custom';

/** Result of a successful transform-text call (for preview + trust UX). */
export type TextTransformResult = {
  text: string
  latencyMs: number
  inputChars: number
  outputChars: number
  /** Rough output size for display (~tokens); not from the model API. */
  approxTokensOut: number
}

export interface CustomPrompt {
  id: string;
  name: string;
  prompt: string;
}

const CUSTOM_PROMPTS_KEY = 'ai-custom-prompts';

export const useTextTransform = () => {
  const { user } = useAuth();
  const { getModelForFeature } = useSettings();
  const [isTransforming, setIsTransforming] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialSyncDone = React.useRef(false);

  const [customPrompts, setCustomPrompts] = React.useState<CustomPrompt[]>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_PROMPTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync custom prompts to database
  const syncPromptsToDb = React.useCallback(async (prompts: CustomPrompt[]) => {
    if (!user) return;

    try {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Cast prompts to Json-compatible type
      const promptsJson = JSON.parse(JSON.stringify(prompts)) as Json;

      if (existing) {
        await supabase
          .from('user_settings')
          .update({ custom_prompts: promptsJson })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_settings')
          .insert([{ user_id: user.id, custom_prompts: promptsJson }]);
      }
    } catch (err) {
      console.error('Failed to sync custom prompts:', err);
    }
  }, [user]);

  // Load prompts from database on login
  React.useEffect(() => {
    const loadFromDb = async () => {
      if (!user || initialSyncDone.current) return;

      try {
        const { data } = await supabase
          .from('user_settings')
          .select('custom_prompts')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.custom_prompts) {
          const dbPrompts = data.custom_prompts as unknown as CustomPrompt[];
          if (Array.isArray(dbPrompts)) {
            setCustomPrompts(dbPrompts);
            localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(dbPrompts));
          }
        } else {
          // No DB settings, sync current local storage to DB
          const localPrompts = localStorage.getItem(CUSTOM_PROMPTS_KEY);
          if (localPrompts) {
            try {
              const parsed = JSON.parse(localPrompts);
              if (Array.isArray(parsed) && parsed.length > 0) {
                await supabase
                  .from('user_settings')
                  .upsert({ user_id: user.id, custom_prompts: parsed }, { onConflict: 'user_id' });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
        initialSyncDone.current = true;
      } catch (err) {
        console.error('Failed to load prompts from DB:', err);
      }
    };

    loadFromDb();
  }, [user]);

  // Reset sync flag on logout
  React.useEffect(() => {
    if (!user) {
      initialSyncDone.current = false;
    }
  }, [user]);

  const saveCustomPrompts = React.useCallback((prompts: CustomPrompt[]) => {
    setCustomPrompts(prompts);
    localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(prompts));
    
    // Debounce DB sync
    if (user && initialSyncDone.current) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      setIsSyncing(true);
      syncTimeoutRef.current = setTimeout(() => {
        syncPromptsToDb(prompts).finally(() => {
          setIsSyncing(false);
        });
      }, 500);
    }
  }, [user, syncPromptsToDb]);

  const addCustomPrompt = React.useCallback((name: string, prompt: string) => {
    const newPrompt: CustomPrompt = {
      id: crypto.randomUUID(),
      name,
      prompt,
    };
    saveCustomPrompts([...customPrompts, newPrompt]);
    toast.success(`Saved prompt: ${name}`);
    return newPrompt;
  }, [customPrompts, saveCustomPrompts]);

  const removeCustomPrompt = React.useCallback((id: string) => {
    saveCustomPrompts(customPrompts.filter(p => p.id !== id));
    toast.success('Prompt deleted');
  }, [customPrompts, saveCustomPrompts]);

  const transformText = React.useCallback(async (
    text: string,
    transformType: TransformType,
    customPrompt?: string
  ): Promise<TextTransformResult | null> => {
    if (!text.trim()) {
      toast.error('No text selected');
      return null;
    }

    setIsTransforming(true);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      const bankId = user ? `clinician:${user.id}` : null;

      let combinedCustomPrompt = customPrompt;

      if (bankId) {
        const recalled = await recallMemories({
          bankId,
          query: `text_transform preferences and style for transform type ${transformType}`,
          filters: {
            feature: 'text_transform',
            transformType,
          },
          limit: 8,
        });

        const styleSummary = recalled?.memories
          ?.map((memory) => memory.content)
          .filter(Boolean)
          .join('\n---\n');

        if (styleSummary) {
          const prefix = `Clinician style and preferences for text transforms:\n${styleSummary}`;
          combinedCustomPrompt = [prefix, customPrompt].filter(Boolean).join('\n\n');
        }
      }

      const { data, error } = await withCategoryTimeout(
        supabase.functions.invoke('transform-text', {
          body: { text, transformType, customPrompt: combinedCustomPrompt, model: getModelForFeature('text_transform') },
        }),
        'textTransform',
        'transform-text',
      );

      if (error) {
        console.error('Transform error:', error);
        toast.error(getUserFacingErrorMessage(error, 'Failed to transform text'));
        return null;
      }

      if (data?.error) {
        toast.error(getUserFacingErrorMessage(data.error, 'Failed to transform text'));
        return null;
      }

      const out = data?.transformedText
      if (typeof out !== 'string' || !out) {
        toast.error('No transformed text returned');
        return null
      }

      if (bankId) {
        const content = [
          `Original text:\n${text}`,
          `Transform type: ${transformType}`,
          combinedCustomPrompt ? `Custom prompt used:\n${combinedCustomPrompt}` : null,
          `Transformed text:\n${out}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature: 'text_transform',
            transformType,
            source: 'transform-text',
          },
        });
      }

      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const latencyMs = Math.round(endedAt - startedAt)
      const outputChars = out.length
      return {
        text: out,
        latencyMs,
        inputChars: text.length,
        outputChars,
        approxTokensOut: Math.max(1, Math.ceil(outputChars / 4)),
      }
    } catch (err) {
      console.error('Transform error:', err);
      toast.error(getUserFacingErrorMessage(err, 'Failed to transform text'));
      return null;
    } finally {
      setIsTransforming(false);
    }
  }, [getModelForFeature, user]);

  return {
    transformText,
    isTransforming,
    isSyncing,
    customPrompts,
    addCustomPrompt,
    removeCustomPrompt,
  };
};
