import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logError, logInfo } from '@/lib/observability/logger';
import type { User } from '@supabase/supabase-js';

/**
 * LayoutContext - Display and layout preferences
 * 
 * Split from SettingsContext for better performance.
 * Components using this context only re-render when layout settings change.
 */

export type SortOption = 'name' | 'bed' | 'acuity' | 'lastModified' | 'createdAt';

export interface SectionVisibility {
  clinicalSummary: boolean;
  intervalEvents: boolean;
  systems: boolean;
  imaging: boolean;
  labs: boolean;
  medications: boolean;
  todos: boolean;
}

export interface LayoutPreferences {
  todosAlwaysVisible: boolean;
  sortBy: SortOption;
  showLabFishbones: boolean;
  sectionVisibility: SectionVisibility;
  selectedSpecialty: string;
}

export interface LayoutContextValue extends LayoutPreferences {
  setTodosAlwaysVisible: (visible: boolean) => void;
  setSortBy: (sortBy: SortOption) => void;
  setShowLabFishbones: (show: boolean) => void;
  setSectionVisibility: (section: keyof SectionVisibility, visible: boolean) => void;
  resetSectionVisibility: () => void;
  setSelectedSpecialty: (specialty: string) => void;
  isFeatureEnabledForRole: (feature: string) => boolean;
  isSyncing: boolean;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

const STORAGE_KEY = 'rr-layout-preferences';

const DEFAULT_SECTION_VISIBILITY: SectionVisibility = {
  clinicalSummary: true,
  intervalEvents: true,
  systems: true,
  imaging: true,
  labs: true,
  medications: true,
  todos: true,
};

const DEFAULT_PREFERENCES: LayoutPreferences = {
  todosAlwaysVisible: true,
  sortBy: 'createdAt',
  showLabFishbones: true,
  sectionVisibility: DEFAULT_SECTION_VISIBILITY,
  selectedSpecialty: 'general',
};

// Feature flags per specialty
const SPECIALTY_FEATURES: Record<string, string[]> = {
  general: ['todos', 'medications', 'labs', 'imaging', 'systems'],
  icu: ['todos', 'medications', 'labs', 'imaging', 'systems', 'vents', 'lines'],
  surgery: ['todos', 'medications', 'labs', 'imaging', 'systems', 'wounds'],
  cardiology: ['todos', 'medications', 'labs', 'imaging', 'systems', 'ecg'],
};

function getInitialPreferences(): LayoutPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        todosAlwaysVisible: parsed.todosAlwaysVisible ?? DEFAULT_PREFERENCES.todosAlwaysVisible,
        sortBy: parsed.sortBy || DEFAULT_PREFERENCES.sortBy,
        showLabFishbones: parsed.showLabFishbones ?? DEFAULT_PREFERENCES.showLabFishbones,
        sectionVisibility: { ...DEFAULT_SECTION_VISIBILITY, ...parsed.sectionVisibility },
        selectedSpecialty: parsed.selectedSpecialty || DEFAULT_PREFERENCES.selectedSpecialty,
      };
    }
  } catch {
    // Ignore parsing errors
  }
  return DEFAULT_PREFERENCES;
}

export function LayoutProvider({ 
  children,
  user,
}: { 
  children: React.ReactNode;
  user: User | null;
}) {
  const [preferences, setPreferences] = useState<LayoutPreferences>(getInitialPreferences);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load from database when user changes
  useEffect(() => {
    if (!user) return;

    const loadFromDB = async () => {
      setIsSyncing(true);
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('todos_always_visible, sort_by, show_lab_fishbones, section_visibility, selected_specialty')
          .eq('user_id', user.id)
          .single();

        if (data && !error) {
          setPreferences(prev => ({
            todosAlwaysVisible: data.todos_always_visible ?? prev.todosAlwaysVisible,
            sortBy: data.sort_by || prev.sortBy,
            showLabFishbones: data.show_lab_fishbones ?? prev.showLabFishbones,
            sectionVisibility: data.section_visibility ? 
              { ...prev.sectionVisibility, ...data.section_visibility } : 
              prev.sectionVisibility,
            selectedSpecialty: data.selected_specialty || prev.selectedSpecialty,
          }));
          logInfo('Loaded layout preferences from database', { source: 'LayoutContext' });
        }
      } catch (err) {
        logError('Failed to load layout preferences', { error: String(err), source: 'LayoutContext' });
      } finally {
        setIsSyncing(false);
      }
    };

    loadFromDB();
  }, [user]);

  // Persist to localStorage immediately
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      logError('Failed to save layout preferences', { source: 'LayoutContext' });
    }
  }, [preferences]);

  const setTodosAlwaysVisible = useCallback((todosAlwaysVisible: boolean) => {
    setPreferences(prev => ({ ...prev, todosAlwaysVisible }));
  }, []);

  const setSortBy = useCallback((sortBy: SortOption) => {
    setPreferences(prev => ({ ...prev, sortBy }));
  }, []);

  const setShowLabFishbones = useCallback((showLabFishbones: boolean) => {
    setPreferences(prev => ({ ...prev, showLabFishbones }));
  }, []);

  const setSectionVisibility = useCallback((section: keyof SectionVisibility, visible: boolean) => {
    setPreferences(prev => ({
      ...prev,
      sectionVisibility: { ...prev.sectionVisibility, [section]: visible },
    }));
  }, []);

  const resetSectionVisibility = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      sectionVisibility: DEFAULT_SECTION_VISIBILITY,
    }));
  }, []);

  const setSelectedSpecialty = useCallback((selectedSpecialty: string) => {
    setPreferences(prev => ({ ...prev, selectedSpecialty }));
  }, []);

  const isFeatureEnabledForRole = useCallback((feature: string): boolean => {
    const features = SPECIALTY_FEATURES[preferences.selectedSpecialty] || SPECIALTY_FEATURES.general;
    return features.includes(feature);
  }, [preferences.selectedSpecialty]);

  const value = useMemo<LayoutContextValue>(() => ({
    ...preferences,
    setTodosAlwaysVisible,
    setSortBy,
    setShowLabFishbones,
    setSectionVisibility,
    resetSectionVisibility,
    setSelectedSpecialty,
    isFeatureEnabledForRole,
    isSyncing,
  }), [
    preferences,
    setTodosAlwaysVisible,
    setSortBy,
    setShowLabFishbones,
    setSectionVisibility,
    resetSectionVisibility,
    setSelectedSpecialty,
    isFeatureEnabledForRole,
    isSyncing,
  ]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

// Convenience hook for sorting
export function useSortPreference() {
  const { sortBy, setSortBy } = useLayout();
  return { sortBy, setSortBy };
}

// Convenience hook for section visibility
export function useSectionVisibility() {
  const { sectionVisibility, setSectionVisibility, resetSectionVisibility } = useLayout();
  return { sectionVisibility, setSectionVisibility, resetSectionVisibility };
}

// Convenience hook for specialty
export function useSpecialty() {
  const { selectedSpecialty, setSelectedSpecialty, isFeatureEnabledForRole } = useLayout();
  return { selectedSpecialty, setSelectedSpecialty, isFeatureEnabledForRole };
}
