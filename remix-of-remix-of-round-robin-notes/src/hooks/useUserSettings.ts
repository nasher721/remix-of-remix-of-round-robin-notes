import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { DEFAULT_SECTION_VISIBILITY, STORAGE_KEYS } from '@/constants/config';
import type { SectionVisibility } from '@/constants/config';
import type { CustomPrompt } from './useTextTransform';

interface UserSettings {
  sectionVisibility: SectionVisibility;
  customPrompts: CustomPrompt[];
}

const CUSTOM_PROMPTS_KEY = 'ai-custom-prompts';

export const useUserSettings = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load settings from database
  const loadSettings = useCallback(async (): Promise<UserSettings | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('section_visibility, custom_prompts')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to load user settings:', error);
        return null;
      }

      if (data) {
        return {
          sectionVisibility: data.section_visibility as unknown as SectionVisibility,
          customPrompts: data.custom_prompts as unknown as CustomPrompt[],
        };
      }

      return null;
    } catch (err) {
      console.error('Error loading settings:', err);
      return null;
    }
  }, [user]);

  // Save settings to database
  const saveSettings = useCallback(async (settings: Partial<UserSettings>): Promise<boolean> => {
    if (!user) return false;

    setIsSyncing(true);
    try {
      const updateData: Record<string, unknown> = {};
      
      if (settings.sectionVisibility !== undefined) {
        updateData.section_visibility = settings.sectionVisibility;
      }
      if (settings.customPrompts !== undefined) {
        updateData.custom_prompts = settings.customPrompts;
      }

      // Try to update first
      const { data: existingData } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingData) {
        // Update existing record
        const { error } = await supabase
          .from('user_settings')
          .update(updateData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            ...updateData,
          });

        if (error) throw error;
      }

      return true;
    } catch (err) {
      console.error('Error saving settings:', err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  // Sync local storage to database on login
  const syncLocalToDatabase = useCallback(async () => {
    if (!user) return;

    try {
      // Check if user already has settings in database
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSettings) {
        // User has settings in DB, load them to local storage
        const dbSettings = await loadSettings();
        if (dbSettings) {
          localStorage.setItem(
            STORAGE_KEYS.SECTION_VISIBILITY,
            JSON.stringify(dbSettings.sectionVisibility)
          );
          localStorage.setItem(
            CUSTOM_PROMPTS_KEY,
            JSON.stringify(dbSettings.customPrompts)
          );
        }
      } else {
        // No DB settings, sync local storage to database
        const localVisibility = localStorage.getItem(STORAGE_KEYS.SECTION_VISIBILITY);
        const localPrompts = localStorage.getItem(CUSTOM_PROMPTS_KEY);

        const settings: Partial<UserSettings> = {};
        
        if (localVisibility) {
          try {
            settings.sectionVisibility = JSON.parse(localVisibility);
          } catch {
            settings.sectionVisibility = DEFAULT_SECTION_VISIBILITY;
          }
        }
        
        if (localPrompts) {
          try {
            settings.customPrompts = JSON.parse(localPrompts);
          } catch {
            settings.customPrompts = [];
          }
        }

        if (Object.keys(settings).length > 0) {
          await saveSettings(settings);
        }
      }
    } catch (err) {
      console.error('Error syncing settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, loadSettings, saveSettings]);

  // Sync on user login
  useEffect(() => {
    if (user) {
      syncLocalToDatabase();
    } else {
      setIsLoading(false);
    }
  }, [user, syncLocalToDatabase]);

  return {
    isLoading,
    isSyncing,
    loadSettings,
    saveSettings,
  };
};
