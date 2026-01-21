import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_SECTION_VISIBILITY, type SectionVisibility } from '@/constants/config';
import { supabase } from '@/integrations/supabase/client';
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

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const { user } = useAuth();
  const [isSyncingSettings, setIsSyncingSettings] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialSyncDone = useRef(false);

  const [globalFontSize, setGlobalFontSizeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GLOBAL_FONT_SIZE);
    return saved ? parseInt(saved, 10) : DEFAULT_CONFIG.GLOBAL_FONT_SIZE;
  });

  const [todosAlwaysVisible, setTodosAlwaysVisibleState] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.TODOS_ALWAYS_VISIBLE) === 'true';
  });

  const [sortBy, setSortByState] = useState<SortBy>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PATIENT_SORT_BY);
    return (saved as SortBy) || DEFAULT_CONFIG.DEFAULT_SORT_BY;
  });

  const [showLabFishbones, setShowLabFishbonesState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHOW_LAB_FISHBONES);
    return saved !== null ? saved === 'true' : true;
  });

  const [sectionVisibility, setSectionVisibilityState] = useState<SectionVisibility>(() => {
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

  // Sync section visibility to database with debounce
  const syncSectionVisibilityToDb = useCallback(async (visibility: SectionVisibility) => {
    if (!user) return;

    try {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('user_settings')
          .update({ section_visibility: visibility })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_settings')
          .insert({ user_id: user.id, section_visibility: visibility });
      }
    } catch (err) {
      console.error('Failed to sync section visibility:', err);
    }
  }, [user]);

  // Load settings from database on login
  useEffect(() => {
    const loadFromDb = async () => {
      if (!user || initialSyncDone.current) return;

      try {
        const { data } = await supabase
          .from('user_settings')
          .select('section_visibility')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.section_visibility) {
          const dbVisibility = data.section_visibility as unknown as SectionVisibility;
          setSectionVisibilityState(dbVisibility);
          localStorage.setItem(STORAGE_KEYS.SECTION_VISIBILITY, JSON.stringify(dbVisibility));
        } else {
          // No DB settings, sync current local storage to DB
          const localVisibility = localStorage.getItem(STORAGE_KEYS.SECTION_VISIBILITY);
          if (localVisibility) {
            try {
              const parsed = JSON.parse(localVisibility);
              await supabase
                .from('user_settings')
                .insert({ user_id: user.id, section_visibility: parsed });
            } catch {
              // Ignore parse errors
            }
          }
        }
        initialSyncDone.current = true;
      } catch (err) {
        console.error('Failed to load settings from DB:', err);
      }
    };

    loadFromDb();
  }, [user]);

  // Reset sync flag on logout
  useEffect(() => {
    if (!user) {
      initialSyncDone.current = false;
    }
  }, [user]);

  // Persist font size
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_FONT_SIZE, String(globalFontSize));
  }, [globalFontSize]);

  // Persist todos visibility
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TODOS_ALWAYS_VISIBLE, String(todosAlwaysVisible));
  }, [todosAlwaysVisible]);

  // Persist sort preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PATIENT_SORT_BY, sortBy);
  }, [sortBy]);

  // Persist lab fishbones preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_LAB_FISHBONES, String(showLabFishbones));
  }, [showLabFishbones]);

  // Persist section visibility to local storage and sync to DB with debounce
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SECTION_VISIBILITY, JSON.stringify(sectionVisibility));
    
    // Debounce DB sync to avoid too many requests
    if (user && initialSyncDone.current) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      setIsSyncingSettings(true);
      syncTimeoutRef.current = setTimeout(() => {
        syncSectionVisibilityToDb(sectionVisibility).finally(() => {
          setIsSyncingSettings(false);
        });
      }, 1000);
    }
  }, [sectionVisibility, user, syncSectionVisibilityToDb]);

  const setGlobalFontSize = useCallback((size: number) => {
    setGlobalFontSizeState(size);
  }, []);

  const setTodosAlwaysVisible = useCallback((visible: boolean) => {
    setTodosAlwaysVisibleState(visible);
  }, []);

  const setSortBy = useCallback((sort: SortBy) => {
    setSortByState(sort);
  }, []);

  const setShowLabFishbones = useCallback((show: boolean) => {
    setShowLabFishbonesState(show);
  }, []);

  const setSectionVisibility = useCallback((visibility: SectionVisibility) => {
    setSectionVisibilityState(visibility);
  }, []);

  const resetSectionVisibility = useCallback(() => {
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
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
