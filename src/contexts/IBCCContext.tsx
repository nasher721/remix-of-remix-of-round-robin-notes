/**
 * IBCC Context Provider
 * Centralized state management for IBCC clinical reference
 * Uses lazy loading for large data files to reduce initial bundle size
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { IBCCChapter, MedicalSystem, ClinicalCalculator, ProtocolChecklist } from '@/types/ibcc';
import type { Patient } from '@/types/patient';
import { loadIBCCData } from '@/lib/lazyData';
import { useIBCCSearch, useIBCCBookmarks, useIBCCContext, useIBCCKeyboard } from '@/hooks/ibcc';

interface IBCCContextValue {
  // Panel state
  isOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;

  // Chapter state
  activeChapter: IBCCChapter | null;
  viewChapter: (chapter: IBCCChapter) => void;
  closeChapter: () => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: ReturnType<typeof useIBCCSearch>['searchResults'];
  isSearching: boolean;
  clearSearch: () => void;

  // Filters
  activeCategory: string | null;
  activeSystem: MedicalSystem | null;
  setActiveCategory: (categoryId: string | null) => void;
  setActiveSystem: (system: MedicalSystem | null) => void;
  filteredChapters: IBCCChapter[];

  // Bookmarks & Recent
  bookmarkedChapters: IBCCChapter[];
  recentChapters: IBCCChapter[];
  toggleBookmark: (chapterId: string) => void;
  isBookmarked: (chapterId: string) => boolean;

  // Context suggestions
  contextSuggestions: IBCCChapter[];
  hasContextSuggestions: boolean;
  setCurrentPatient: (patient: Patient | undefined) => void;

  // Data accessors
  getCalculatorsForChapter: (chapterId: string) => ClinicalCalculator[];
  getChecklistsForChapter: (chapterId: string) => ProtocolChecklist[];

  // Static data
  allChapters: IBCCChapter[];

  // Loading state for lazy data
  isDataLoaded: boolean;
}

const IBCCContext = createContext<IBCCContextValue | null>(null);

interface IBCCProviderProps {
  children: ReactNode;
}

export function IBCCProvider({ children }: IBCCProviderProps) {
  // Lazy-loaded data
  const [chapters, setChapters] = useState<IBCCChapter[]>([]);
  const [calculators, setCalculators] = useState<ClinicalCalculator[]>([]);
  const [checklists, setChecklists] = useState<ProtocolChecklist[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    loadIBCCData().then((mod) => {
      setChapters(mod.IBCC_CHAPTERS);
      setCalculators(mod.CLINICAL_CALCULATORS);
      setChecklists(mod.PROTOCOL_CHECKLISTS);
      setIsDataLoaded(true);
    }).catch((err) => {
      console.error('[IBCCProvider] Failed to load IBCC data:', err);
      setIsDataLoaded(true); // Allow app to continue even if data fails
    });
  }, []);

  // Panel visibility
  const [isOpen, setIsOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState<IBCCChapter | null>(null);

  // Current patient for context-aware suggestions
  const [currentPatient, setCurrentPatient] = useState<Patient | undefined>(undefined);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSystem, setActiveSystem] = useState<MedicalSystem | null>(null);

  // Composable hooks
  const search = useIBCCSearch({ debounceMs: 150 });
  const bookmarks = useIBCCBookmarks();
  const context = useIBCCContext(currentPatient);

  // Panel actions
  const togglePanel = useCallback(() => setIsOpen(prev => !prev), []);
  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => {
    setIsOpen(false);
    setActiveChapter(null);
  }, []);

  // Chapter actions
  const viewChapter = useCallback((chapter: IBCCChapter) => {
    setActiveChapter(chapter);
    bookmarks.addToRecent(chapter.id);
  }, [bookmarks]);

  const closeChapter = useCallback(() => {
    setActiveChapter(null);
  }, []);

  // Filter actions with mutual exclusivity
  const handleSetActiveCategory = useCallback((categoryId: string | null) => {
    setActiveCategory(categoryId);
    setActiveSystem(null);
  }, []);

  const handleSetActiveSystem = useCallback((system: MedicalSystem | null) => {
    setActiveSystem(system);
    setActiveCategory(null);
  }, []);

  // Keyboard shortcuts
  useIBCCKeyboard({
    isOpen,
    hasActiveChapter: activeChapter !== null,
    onTogglePanel: togglePanel,
    onClosePanel: closePanel,
    onCloseChapter: closeChapter,
  });

  // Memoized filtered chapters
  const filteredChapters = useMemo(() => {
    let filtered = chapters;
    if (activeCategory) {
      filtered = filtered.filter(c => c.category.id === activeCategory);
    }
    if (activeSystem) {
      filtered = filtered.filter(c => c.system === activeSystem);
    }
    return filtered;
  }, [chapters, activeCategory, activeSystem]);

  // Data accessors
  const getCalculatorsForChapter = useCallback((chapterId: string) => {
    return calculators.filter(c => c.chapterId === chapterId);
  }, [calculators]);

  const getChecklistsForChapter = useCallback((chapterId: string) => {
    return checklists.filter(c => c.chapterId === chapterId);
  }, [checklists]);

  const value: IBCCContextValue = useMemo(() => ({
    // Panel state
    isOpen,
    togglePanel,
    openPanel,
    closePanel,

    // Chapter state
    activeChapter,
    viewChapter,
    closeChapter,

    // Search (from hook)
    searchQuery: search.searchQuery,
    setSearchQuery: search.setSearchQuery,
    searchResults: search.searchResults,
    isSearching: search.isSearching,
    clearSearch: search.clearSearch,

    // Filters
    activeCategory,
    activeSystem,
    setActiveCategory: handleSetActiveCategory,
    setActiveSystem: handleSetActiveSystem,
    filteredChapters,

    // Bookmarks & Recent (from hook)
    bookmarkedChapters: bookmarks.bookmarkedChapters,
    recentChapters: bookmarks.recentChapters,
    toggleBookmark: bookmarks.toggleBookmark,
    isBookmarked: bookmarks.isBookmarked,

    // Context suggestions (from hook)
    contextSuggestions: context.contextSuggestions,
    hasContextSuggestions: context.hasContextSuggestions,
    setCurrentPatient,

    // Data accessors
    getCalculatorsForChapter,
    getChecklistsForChapter,

    // Static data
    allChapters: chapters,
    isDataLoaded,
  }), [
    isOpen, togglePanel, openPanel, closePanel,
    activeChapter, viewChapter, closeChapter,
    search.searchQuery, search.setSearchQuery, search.searchResults, search.isSearching, search.clearSearch,
    activeCategory, activeSystem, handleSetActiveCategory, handleSetActiveSystem, filteredChapters,
    bookmarks.bookmarkedChapters, bookmarks.recentChapters, bookmarks.toggleBookmark, bookmarks.isBookmarked,
    context.contextSuggestions, context.hasContextSuggestions,
    getCalculatorsForChapter, getChecklistsForChapter,
    chapters, isDataLoaded,
  ]);

  return (
    <IBCCContext.Provider value={value}>
      {children}
    </IBCCContext.Provider>
  );
}

export function useIBCCState() {
  const context = useContext(IBCCContext);
  if (!context) {
    throw new Error('useIBCCState must be used within an IBCCProvider');
  }
  return context;
}
