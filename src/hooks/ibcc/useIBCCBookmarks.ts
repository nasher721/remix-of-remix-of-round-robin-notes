/**
 * IBCC Bookmarks Hook
 * Manages bookmarks and recently viewed chapters with localStorage persistence
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { IBCCChapter } from '@/types/ibcc';
import { IBCC_CHAPTERS } from '@/data/ibccContent';

const BOOKMARKS_KEY = 'ibcc_bookmarks';
const RECENT_KEY = 'ibcc_recent';
const MAX_RECENT = 10;

export function useIBCCBookmarks() {
  const [bookmarkIds, setBookmarkIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(BOOKMARKS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist bookmarks
  useEffect(() => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarkIds));
  }, [bookmarkIds]);

  // Persist recently viewed
  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds));
  }, [recentIds]);

  const toggleBookmark = useCallback((chapterId: string) => {
    setBookmarkIds(prev => 
      prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  }, []);

  const addToRecent = useCallback((chapterId: string) => {
    setRecentIds(prev => {
      const filtered = prev.filter(id => id !== chapterId);
      return [chapterId, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  const isBookmarked = useCallback((chapterId: string) => {
    return bookmarkIds.includes(chapterId);
  }, [bookmarkIds]);

  // Memoized chapter lists
  const bookmarkedChapters = useMemo(() => {
    return IBCC_CHAPTERS.filter(c => bookmarkIds.includes(c.id));
  }, [bookmarkIds]);

  const recentChapters = useMemo(() => {
    return recentIds
      .map(id => IBCC_CHAPTERS.find(c => c.id === id))
      .filter((c): c is IBCCChapter => c !== undefined);
  }, [recentIds]);

  const clearRecent = useCallback(() => {
    setRecentIds([]);
  }, []);

  const clearBookmarks = useCallback(() => {
    setBookmarkIds([]);
  }, []);

  return {
    bookmarkIds,
    recentIds,
    bookmarkedChapters,
    recentChapters,
    toggleBookmark,
    addToRecent,
    isBookmarked,
    clearRecent,
    clearBookmarks,
  };
}
