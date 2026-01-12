/**
 * IBCC Hook
 * Manages clinical reference state and context detection
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { IBCCChapter, IBCCSearchResult, IBCCState, MedicalSystem } from '@/types/ibcc';
import type { Patient } from '@/types/patient';
import { IBCC_CHAPTERS, KEYWORD_PATTERNS, CLINICAL_CALCULATORS, PROTOCOL_CHECKLISTS } from '@/data/ibccContent';

const STORAGE_KEY = 'ibcc_state';
const BOOKMARKS_KEY = 'ibcc_bookmarks';
const RECENT_KEY = 'ibcc_recent';

// Fuzzy match score calculation
function fuzzyMatch(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match
  if (textLower.includes(queryLower)) return 1;
  
  // Word match
  const queryWords = queryLower.split(/\s+/);
  const matchedWords = queryWords.filter(w => textLower.includes(w));
  if (matchedWords.length > 0) return matchedWords.length / queryWords.length;
  
  // Character sequence match
  let score = 0;
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      score++;
      queryIndex++;
    }
  }
  return queryIndex === queryLower.length ? score / textLower.length : 0;
}

// Extract clinical keywords from patient data
function extractPatientKeywords(patient: Patient): string[] {
  const keywords: string[] = [];
  
  // Combine all patient text
  const allText = [
    patient.clinicalSummary,
    patient.intervalEvents,
    ...Object.values(patient.systems)
  ].join(' ').toLowerCase();
  
  // Match against known patterns
  Object.entries(KEYWORD_PATTERNS).forEach(([chapterId, patterns]) => {
    const hasMatch = patterns.some(pattern => 
      allText.includes(pattern.toLowerCase())
    );
    if (hasMatch) {
      keywords.push(chapterId);
    }
  });
  
  return keywords;
}

export function useIBCC(currentPatient?: Patient) {
  const [state, setState] = useState<IBCCState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const bookmarks = localStorage.getItem(BOOKMARKS_KEY);
      const recent = localStorage.getItem(RECENT_KEY);
      return {
        isOpen: false,
        activeChapter: null,
        searchQuery: '',
        activeCategory: null,
        activeSystem: null,
        bookmarks: bookmarks ? JSON.parse(bookmarks) : [],
        recentlyViewed: recent ? JSON.parse(recent) : [],
      };
    } catch {
      return {
        isOpen: false,
        activeChapter: null,
        searchQuery: '',
        activeCategory: null,
        activeSystem: null,
        bookmarks: [],
        recentlyViewed: [],
      };
    }
  });

  // Save bookmarks and recent to localStorage
  useEffect(() => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(state.bookmarks));
  }, [state.bookmarks]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(state.recentlyViewed));
  }, [state.recentlyViewed]);

  // Toggle panel open/close
  const togglePanel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const openPanel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }));
  }, []);

  const closePanel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, activeChapter: null }));
  }, []);

  // Search chapters
  const searchChapters = useCallback((query: string): IBCCSearchResult[] => {
    if (!query.trim()) return [];

    const results: IBCCSearchResult[] = [];
    const queryLower = query.toLowerCase();

    IBCC_CHAPTERS.forEach(chapter => {
      let relevanceScore = 0;
      const matchedKeywords: string[] = [];

      // Title match (highest weight)
      const titleScore = fuzzyMatch(chapter.title, query);
      if (titleScore > 0) relevanceScore += titleScore * 3;

      // Keyword match
      chapter.keywords.forEach(keyword => {
        if (keyword.toLowerCase().includes(queryLower) || queryLower.includes(keyword.toLowerCase())) {
          relevanceScore += 1;
          matchedKeywords.push(keyword);
        }
      });

      // Summary match
      const summaryScore = fuzzyMatch(chapter.summary, query);
      if (summaryScore > 0) relevanceScore += summaryScore;

      // Category match
      if (chapter.category.name.toLowerCase().includes(queryLower)) {
        relevanceScore += 0.5;
      }

      if (relevanceScore > 0) {
        results.push({ chapter, relevanceScore, matchedKeywords });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 15);
  }, []);

  // Set search query
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  // Get chapters filtered by current filters
  const filteredChapters = useMemo(() => {
    let chapters = IBCC_CHAPTERS;

    if (state.activeCategory) {
      chapters = chapters.filter(c => c.category.id === state.activeCategory);
    }

    if (state.activeSystem) {
      chapters = chapters.filter(c => c.system === state.activeSystem);
    }

    return chapters;
  }, [state.activeCategory, state.activeSystem]);

  // Get context-aware suggestions based on current patient
  const contextSuggestions = useMemo(() => {
    if (!currentPatient) return [];

    const keywords = extractPatientKeywords(currentPatient);
    
    const suggestions = IBCC_CHAPTERS.filter(chapter => 
      keywords.includes(chapter.id) ||
      keywords.some(k => chapter.keywords.includes(k))
    );

    return suggestions.slice(0, 5);
  }, [currentPatient]);

  // View a chapter
  const viewChapter = useCallback((chapter: IBCCChapter) => {
    setState(prev => {
      const recentlyViewed = [
        chapter.id,
        ...prev.recentlyViewed.filter(id => id !== chapter.id)
      ].slice(0, 10);

      return {
        ...prev,
        activeChapter: chapter,
        recentlyViewed,
      };
    });
  }, []);

  // Close chapter view
  const closeChapter = useCallback(() => {
    setState(prev => ({ ...prev, activeChapter: null }));
  }, []);

  // Toggle bookmark
  const toggleBookmark = useCallback((chapterId: string) => {
    setState(prev => {
      const isBookmarked = prev.bookmarks.includes(chapterId);
      return {
        ...prev,
        bookmarks: isBookmarked
          ? prev.bookmarks.filter(id => id !== chapterId)
          : [...prev.bookmarks, chapterId],
      };
    });
  }, []);

  // Get bookmarked chapters
  const bookmarkedChapters = useMemo(() => {
    return IBCC_CHAPTERS.filter(c => state.bookmarks.includes(c.id));
  }, [state.bookmarks]);

  // Get recently viewed chapters
  const recentChapters = useMemo(() => {
    return state.recentlyViewed
      .map(id => IBCC_CHAPTERS.find(c => c.id === id))
      .filter((c): c is IBCCChapter => c !== undefined);
  }, [state.recentlyViewed]);

  // Set active category filter
  const setActiveCategory = useCallback((categoryId: string | null) => {
    setState(prev => ({ ...prev, activeCategory: categoryId, activeSystem: null }));
  }, []);

  // Set active system filter
  const setActiveSystem = useCallback((system: MedicalSystem | null) => {
    setState(prev => ({ ...prev, activeSystem: system, activeCategory: null }));
  }, []);

  // Get calculators for a chapter
  const getCalculatorsForChapter = useCallback((chapterId: string) => {
    return CLINICAL_CALCULATORS.filter(c => c.chapterId === chapterId);
  }, []);

  // Get checklists for a chapter
  const getChecklistsForChapter = useCallback((chapterId: string) => {
    return PROTOCOL_CHECKLISTS.filter(c => c.chapterId === chapterId);
  }, []);

  // Search results when there's a query
  const searchResults = useMemo(() => {
    if (!state.searchQuery.trim()) return null;
    return searchChapters(state.searchQuery);
  }, [state.searchQuery, searchChapters]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+I or Cmd+I to toggle IBCC panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        togglePanel();
      }
      // Escape to close
      if (e.key === 'Escape' && state.isOpen) {
        if (state.activeChapter) {
          closeChapter();
        } else {
          closePanel();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel, closePanel, closeChapter, state.isOpen, state.activeChapter]);

  return {
    // State
    isOpen: state.isOpen,
    activeChapter: state.activeChapter,
    searchQuery: state.searchQuery,
    searchResults,
    filteredChapters,
    contextSuggestions,
    bookmarkedChapters,
    recentChapters,
    activeCategory: state.activeCategory,
    activeSystem: state.activeSystem,
    
    // Actions
    togglePanel,
    openPanel,
    closePanel,
    setSearchQuery,
    viewChapter,
    closeChapter,
    toggleBookmark,
    setActiveCategory,
    setActiveSystem,
    getCalculatorsForChapter,
    getChecklistsForChapter,
    
    // Data
    allChapters: IBCC_CHAPTERS,
    allCalculators: CLINICAL_CALCULATORS,
    allChecklists: PROTOCOL_CHECKLISTS,
    isBookmarked: (id: string) => state.bookmarks.includes(id),
  };
}
