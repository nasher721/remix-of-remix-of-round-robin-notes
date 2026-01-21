import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_SECTION_VISIBILITY, type SectionVisibility } from '@/constants/config';

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
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
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
    return saved !== null ? saved === 'true' : true; // Default to true
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

  // Persist section visibility
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SECTION_VISIBILITY, JSON.stringify(sectionVisibility));
  }, [sectionVisibility]);

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
