/**
 * Clinical Guidelines Bookmarks Hook
 * Manages bookmarked and recently viewed guidelines with localStorage persistence
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ClinicalGuideline } from '@/types/clinicalGuidelines';
import { CLINICAL_GUIDELINES } from '@/data/clinicalGuidelinesData';

const BOOKMARKS_KEY = 'clinical-guidelines-bookmarks';
const RECENT_KEY = 'clinical-guidelines-recent';
const MAX_RECENT = 10;

interface UseGuidelinesBookmarksReturn {
  bookmarks: string[];
  recentlyViewed: string[];
  bookmarkedGuidelines: ClinicalGuideline[];
  recentGuidelines: ClinicalGuideline[];
  toggleBookmark: (guidelineId: string) => void;
  isBookmarked: (guidelineId: string) => boolean;
  addToRecent: (guidelineId: string) => void;
  clearRecent: () => void;
}

export function useGuidelinesBookmarks(): UseGuidelinesBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(BOOKMARKS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist bookmarks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.warn('Failed to save guidelines bookmarks:', e);
    }
  }, [bookmarks]);

  // Persist recent to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyViewed));
    } catch (e) {
      console.warn('Failed to save recent guidelines:', e);
    }
  }, [recentlyViewed]);

  const toggleBookmark = useCallback((guidelineId: string) => {
    setBookmarks(prev => {
      if (prev.includes(guidelineId)) {
        return prev.filter(id => id !== guidelineId);
      } else {
        return [...prev, guidelineId];
      }
    });
  }, []);

  const isBookmarked = useCallback((guidelineId: string) => {
    return bookmarks.includes(guidelineId);
  }, [bookmarks]);

  const addToRecent = useCallback((guidelineId: string) => {
    setRecentlyViewed(prev => {
      // Remove if already in list
      const filtered = prev.filter(id => id !== guidelineId);
      // Add to front
      const updated = [guidelineId, ...filtered];
      // Limit to MAX_RECENT
      return updated.slice(0, MAX_RECENT);
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentlyViewed([]);
  }, []);

  // Get full guideline objects for bookmarked IDs
  const bookmarkedGuidelines = useMemo(() => {
    return bookmarks
      .map(id => CLINICAL_GUIDELINES.find(g => g.id === id))
      .filter((g): g is ClinicalGuideline => g !== undefined);
  }, [bookmarks]);

  // Get full guideline objects for recent IDs
  const recentGuidelines = useMemo(() => {
    return recentlyViewed
      .map(id => CLINICAL_GUIDELINES.find(g => g.id === id))
      .filter((g): g is ClinicalGuideline => g !== undefined);
  }, [recentlyViewed]);

  return {
    bookmarks,
    recentlyViewed,
    bookmarkedGuidelines,
    recentGuidelines,
    toggleBookmark,
    isBookmarked,
    addToRecent,
    clearRecent
  };
}
