/**
 * IBCC Context Provider
 * Centralized state management for IBCC clinical reference
 * Eliminates prop drilling and enables lazy loading
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { IBCCChapter, MedicalSystem } from '@/types/ibcc';
import type { Patient } from '@/types/patient';
import { IBCC_CHAPTERS, CLINICAL_CALCULATORS, PROTOCOL_CHECKLISTS } from '@/data/ibccContent';
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
  getCalculatorsForChapter: (chapterId: string) => typeof CLINICAL_CALCULATORS;
  getChecklistsForChapter: (chapterId: string) => typeof PROTOCOL_CHECKLISTS;
  
  // Static data
  allChapters: typeof IBCC_CHAPTERS;
}

const IBCCContext = createContext<IBCCContextValue | null>(null);

interface IBCCProviderProps {
  children: ReactNode;
}

export function IBCCProvider({ children }: IBCCProviderProps) {
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
    let chapters = IBCC_CHAPTERS;
    if (activeCategory) {
      chapters = chapters.filter(c => c.category.id === activeCategory);
    }
    if (activeSystem) {
      chapters = chapters.filter(c => c.system === activeSystem);
    }
    return chapters;
  }, [activeCategory, activeSystem]);

  // Data accessors
  const getCalculatorsForChapter = useCallback((chapterId: string) => {
    return CLINICAL_CALCULATORS.filter(c => c.chapterId === chapterId);
  }, []);

  const getChecklistsForChapter = useCallback((chapterId: string) => {
    return PROTOCOL_CHECKLISTS.filter(c => c.chapterId === chapterId);
  }, []);

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
    allChapters: IBCC_CHAPTERS,
  }), [
    isOpen, togglePanel, openPanel, closePanel,
    activeChapter, viewChapter, closeChapter,
    search.searchQuery, search.setSearchQuery, search.searchResults, search.isSearching, search.clearSearch,
    activeCategory, activeSystem, handleSetActiveCategory, handleSetActiveSystem, filteredChapters,
    bookmarks.bookmarkedChapters, bookmarks.recentChapters, bookmarks.toggleBookmark, bookmarks.isBookmarked,
    context.contextSuggestions, context.hasContextSuggestions,
    getCalculatorsForChapter, getChecklistsForChapter,
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
