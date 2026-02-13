import * as React from 'react';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_SECTION_VISIBILITY, type SectionVisibility } from '@/constants/config';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { getRoleById, type SpecialtyFeature } from '@/constants/specialties';
import type { LLMProviderName } from '@/services/llm';
import { resetRouter } from '@/services/llm';

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

  // Specialty / medical role
  selectedSpecialty: string | null;
  setSelectedSpecialty: (specialtyId: string | null) => void;
  isFeatureEnabledForRole: (feature: SpecialtyFeature) => boolean;

  aiProvider: LLMProviderName;
  aiModel: string;
  aiCredentials: Partial<Record<LLMProviderName, string>>;
  setAiModel: (provider: LLMProviderName, model: string) => void;
  resetAiModel: () => void;
  setAiCredential: (provider: LLMProviderName, credential: string) => void;

  // Sync status
  isSyncingSettings: boolean;
}

interface AppPreferences {
  globalFontSize: number;
  todosAlwaysVisible: boolean;
  sortBy: SortBy;
  showLabFishbones: boolean;
  selectedSpecialty: string | null;
  aiProvider: LLMProviderName;
  aiModel: string;
  aiCredentials?: Partial<Record<LLMProviderName, string>>;
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

  const [selectedSpecialty, setSelectedSpecialtyState] = React.useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_SPECIALTY) || null;
  });

  const [aiProvider, setAiProviderState] = React.useState<LLMProviderName>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) as LLMProviderName | null;
    return saved || DEFAULT_CONFIG.DEFAULT_AI_PROVIDER;
  });

  const [aiModel, setAiModelState] = React.useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AI_MODEL);
    return saved || DEFAULT_CONFIG.DEFAULT_AI_MODEL;
  });

  const [aiCredentials, setAiCredentialsState] = React.useState<Partial<Record<LLMProviderName, string>>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AI_CREDENTIALS);
    if (!saved) return {};
    try {
      return JSON.parse(saved) as Partial<Record<LLMProviderName, string>>;
    } catch {
      return {};
    }
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
    selectedSpecialty,
    aiProvider,
    aiModel,
    aiCredentials,
  }), [globalFontSize, todosAlwaysVisible, sortBy, showLabFishbones, selectedSpecialty, aiProvider, aiModel, aiCredentials]);

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
    if (prefs.selectedSpecialty !== undefined) {
      setSelectedSpecialtyState(prefs.selectedSpecialty);
      if (prefs.selectedSpecialty) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_SPECIALTY, prefs.selectedSpecialty);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_SPECIALTY);
      }
    }

    if (prefs.aiProvider !== undefined) {
      setAiProviderState(prefs.aiProvider);
      localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, prefs.aiProvider);
    }

    if (prefs.aiModel !== undefined) {
      setAiModelState(prefs.aiModel);
      localStorage.setItem(STORAGE_KEYS.AI_MODEL, prefs.aiModel);
    }

    if (prefs.aiCredentials !== undefined) {
      setAiCredentialsState(prefs.aiCredentials ?? {});
      if (prefs.aiCredentials) {
        localStorage.setItem(STORAGE_KEYS.AI_CREDENTIALS, JSON.stringify(prefs.aiCredentials));
      } else {
        localStorage.removeItem(STORAGE_KEYS.AI_CREDENTIALS);
      }
      resetRouter();
    }
  }, [resetRouter]);

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
                .upsert({
                    user_id: user.id,
                    section_visibility: parsed,
                    app_preferences: localPreferences as unknown as Json,
                  },
                  { onConflict: 'user_id' }
                );
            } catch {
              // Ignore parse errors
            }
          } else {
            await supabase
              .from('user_settings')
              .upsert({
                  user_id: user.id,
                  section_visibility: DEFAULT_SECTION_VISIBILITY as unknown as Json,
                  app_preferences: localPreferences as unknown as Json,
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

  const setSelectedSpecialty = React.useCallback((specialtyId: string | null) => {
    setSelectedSpecialtyState(specialtyId);
    if (specialtyId) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_SPECIALTY, specialtyId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_SPECIALTY);
    }
  }, []);

  const setAiModel = React.useCallback((provider: LLMProviderName, model: string) => {
    setAiProviderState(provider);
    setAiModelState(model);
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
    localStorage.setItem(STORAGE_KEYS.AI_MODEL, model);
  }, []);

  const resetAiModel = React.useCallback(() => {
    setAiProviderState(DEFAULT_CONFIG.DEFAULT_AI_PROVIDER);
    setAiModelState(DEFAULT_CONFIG.DEFAULT_AI_MODEL);
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, DEFAULT_CONFIG.DEFAULT_AI_PROVIDER);
    localStorage.setItem(STORAGE_KEYS.AI_MODEL, DEFAULT_CONFIG.DEFAULT_AI_MODEL);
  }, []);

  const setAiCredential = React.useCallback((provider: LLMProviderName, credential: string) => {
    setAiCredentialsState((prev) => {
      const next = { ...prev } as Partial<Record<LLMProviderName, string>>;
      if (credential) {
        next[provider] = credential;
      } else {
        delete next[provider];
      }
      localStorage.setItem(STORAGE_KEYS.AI_CREDENTIALS, JSON.stringify(next));
      resetRouter();
      return next;
    });
  }, []);

  const isFeatureEnabledForRole = React.useCallback((feature: SpecialtyFeature): boolean => {
    if (!selectedSpecialty) return true; // No role selected = all features enabled
    const role = getRoleById(selectedSpecialty);
    if (!role) return true;
    return role.enabledFeatures.includes(feature);
  }, [selectedSpecialty]);

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
    selectedSpecialty,
    setSelectedSpecialty,
    isFeatureEnabledForRole,
    aiProvider,
    aiModel,
    aiCredentials,
    setAiModel,
    resetAiModel,
    setAiCredential,
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
