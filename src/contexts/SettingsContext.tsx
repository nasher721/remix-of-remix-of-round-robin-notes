import * as React from 'react';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_SECTION_VISIBILITY, type SectionVisibility } from '@/constants/config';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

export type SortBy = 'number' | 'room' | 'name';

interface SettingsContextType {
  // Font size
  globalFontSize: number;
  setGlobalFontSize: (size: number) => void;
  
  // Todos visibility
  todosAlwaysVisible: boolean;
  setTodosAlwaysVisible: (visible: boolean) => void;
  
  // Sort preferences
  sortBy: SortBy;
  setSortBy: (sort: SortBy) => void;
  
  // Lab Fishbone toggle
  showLabFishbones: boolean;
  setShowLabFishbones: (show: boolean) => void;

  // Section visibility
  sectionVisibility: SectionVisibility;
  setSectionVisibility: (visibility: SectionVisibility) => void;
  resetSectionVisibility: () => void;
  
  // Sync status
  isSyncingSettings: boolean;
}

interface AppPreferences {
  globalFontSize: number;
  todosAlwaysVisible: boolean;
  sortBy: SortBy;
  showLabFishbones: boolean;
}

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const { user } = useAuth();
  const [isSyncingSettings, setIsSyncingSettings] = React.useState(false);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialSyncDone = React.useRef(false);

  const [globalFontSize, setGlobalFontSizeState] = React.useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GLOBAL_FONT_SIZE);
    return saved ? parseInt(saved, 10) : DEFAULT_CONFIG.GLOBAL_FONT_SIZE;
  });

  const [todosAlwaysVisible, setTodosAlwaysVisibleState] = React.useState(() => {
    return localStorage.getItem(STORAGE_KEYS.TODOS_ALWAYS_VISIBLE) === 'true';
  });

  const [sortBy, setSortByState] = React.useState<SortBy>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PATIENT_SORT_BY);
    return (saved as SortBy) || DEFAULT_CONFIG.DEFAULT_SORT_BY;
  });

  const [showLabFishbones, setShowLabFishbonesState] = React.useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHOW_LAB_FISHBONES);
    return saved !== null ? saved === 'true' : true;
  });

  const [sectionVisibility, setSectionVisibilityState] = React.useState<SectionVisibility>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SECTION_VISIBILITY);
    if (saved) {
      try {
        return { ...DEFAULT_SECTION_VISIBILITY, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SECTION_VISIBILITY;
      }
    }
    return DEFAULT_SECTION_VISIBILITY;
  });

  const buildAppPreferences = React.useCallback((): AppPreferences => ({
    globalFontSize,
    todosAlwaysVisible,
    sortBy,
    showLabFishbones,
  }), [globalFontSize, todosAlwaysVisible, sortBy, showLabFishbones]);

  const applyAppPreferences = React.useCallback((prefs: Partial<AppPreferences>) => {
    if (prefs.globalFontSize !== undefined) {
      setGlobalFontSizeState(prefs.globalFontSize);
      localStorage.setItem(STORAGE_KEYS.GLOBAL_FONT_SIZE, String(prefs.globalFontSize));
    }
    if (prefs.todosAlwaysVisible !== undefined) {
      setTodosAlwaysVisibleState(prefs.todosAlwaysVisible);
      localStorage.setItem(STORAGE_KEYS.TODOS_ALWAYS_VISIBLE, String(prefs.todosAlwaysVisible));
    }
    if (prefs.sortBy !== undefined) {
      setSortByState(prefs.sortBy);
      localStorage.setItem(STORAGE_KEYS.PATIENT_SORT_BY, prefs.sortBy);
    }
    if (prefs.showLabFishbones !== undefined) {
      setShowLabFishbonesState(prefs.showLabFishbones);
      localStorage.setItem(STORAGE_KEYS.SHOW_LAB_FISHBONES, String(prefs.showLabFishbones));
    }
  }, []);

  // Sync settings to database with debounce
  const syncSettingsToDb = React.useCallback(async (visibility: SectionVisibility, appPreferences: AppPreferences) => {
    if (!user) return;

    try {
      const appPreferencesJson = JSON.parse(JSON.stringify(appPreferences)) as Json;
      const sectionVisibilityJson = JSON.parse(JSON.stringify(visibility)) as Json;
      await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            section_visibility: sectionVisibilityJson,
            app_preferences: appPreferencesJson,
          },
          { onConflict: 'user_id' }
        );
    } catch (err) {
      console.error('Failed to sync settings:', err);
    }
  }, [user]);

  // Load settings from database on login
  React.useEffect(() => {
    const loadFromDb = async () => {
      if (!user || initialSyncDone.current) return;

      try {
        const { data } = await supabase
          .from('user_settings')
          .select('section_visibility, app_preferences')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.section_visibility) {
          const dbVisibility = data.section_visibility as unknown as SectionVisibility;
          setSectionVisibilityState(dbVisibility);
          localStorage.setItem(STORAGE_KEYS.SECTION_VISIBILITY, JSON.stringify(dbVisibility));
        }

        if (data?.app_preferences) {
          const dbPreferences = data.app_preferences as unknown as AppPreferences;
          applyAppPreferences(dbPreferences);
        }

        if (!data?.section_visibility || !data?.app_preferences) {
          // No DB settings, sync current local storage to DB
          const localVisibility = localStorage.getItem(STORAGE_KEYS.SECTION_VISIBILITY);
          const localPreferences = buildAppPreferences();
          if (localVisibility) {
            try {
              const parsed = JSON.parse(localVisibility);
              await supabase
                .from('user_settings')
                .upsert(
                  {
                    user_id: user.id,
                    section_visibility: parsed,
                    app_preferences: localPreferences,
                  },
                  { onConflict: 'user_id' }
                );
            } catch {
              // Ignore parse errors
            }
          } else {
            await supabase
              .from('user_settings')
              .upsert(
                {
                  user_id: user.id,
                  section_visibility: DEFAULT_SECTION_VISIBILITY,
                  app_preferences: localPreferences,
                },
                { onConflict: 'user_id' }
              );
          }
        }
        initialSyncDone.current = true;
      } catch (err) {
        console.error('Failed to load settings from DB:', err);
      }
    };

    loadFromDb();
  }, [user, applyAppPreferences, buildAppPreferences]);

  // Reset sync flag on logout
  React.useEffect(() => {
    if (!user) {
      initialSyncDone.current = false;
    }
  }, [user]);

  // Cleanup timeout on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Persist font size
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_FONT_SIZE, String(globalFontSize));
  }, [globalFontSize]);

  // Persist todos visibility
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TODOS_ALWAYS_VISIBLE, String(todosAlwaysVisible));
  }, [todosAlwaysVisible]);

  // Persist sort preference
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PATIENT_SORT_BY, sortBy);
  }, [sortBy]);

  // Persist lab fishbones preference
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_LAB_FISHBONES, String(showLabFishbones));
  }, [showLabFishbones]);

  // Persist section visibility to local storage and sync to DB with debounce
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SECTION_VISIBILITY, JSON.stringify(sectionVisibility));
    
    // Debounce DB sync to avoid too many requests
    if (user && initialSyncDone.current) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      setIsSyncingSettings(true);
      syncTimeoutRef.current = setTimeout(() => {
        syncSettingsToDb(sectionVisibility, buildAppPreferences()).finally(() => {
          setIsSyncingSettings(false);
        });
      }, 1000);
    }
  }, [sectionVisibility, user, buildAppPreferences, syncSettingsToDb]);

  const setGlobalFontSize = React.useCallback((size: number) => {
    setGlobalFontSizeState(size);
  }, []);

  const setTodosAlwaysVisible = React.useCallback((visible: boolean) => {
    setTodosAlwaysVisibleState(visible);
  }, []);

  const setSortBy = React.useCallback((sort: SortBy) => {
    setSortByState(sort);
  }, []);

  const setShowLabFishbones = React.useCallback((show: boolean) => {
    setShowLabFishbonesState(show);
  }, []);

  const setSectionVisibility = React.useCallback((visibility: SectionVisibility) => {
    setSectionVisibilityState(visibility);
  }, []);

  const resetSectionVisibility = React.useCallback(() => {
    setSectionVisibilityState(DEFAULT_SECTION_VISIBILITY);
  }, []);

  const value: SettingsContextType = {
    globalFontSize,
    setGlobalFontSize,
    todosAlwaysVisible,
    setTodosAlwaysVisible,
    sortBy,
    setSortBy,
    showLabFishbones,
    setShowLabFishbones,
    sectionVisibility,
    setSectionVisibility,
    resetSectionVisibility,
    isSyncingSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = React.useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
