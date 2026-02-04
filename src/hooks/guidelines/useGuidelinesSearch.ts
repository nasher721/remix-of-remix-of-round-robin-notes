/**
 * Clinical Guidelines Search Hook
 * Provides debounced search functionality across guidelines
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ClinicalGuideline, GuidelineSearchResult, MedicalSpecialty } from '@/types/clinicalGuidelines';
import { CLINICAL_GUIDELINES, GUIDELINE_KEYWORD_MAP } from '@/data/clinicalGuidelinesData';

interface UseGuidelinesSearchOptions {
  debounceMs?: number;
}

interface UseGuidelinesSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: GuidelineSearchResult[];
  isSearching: boolean;
  clearSearch: () => void;
}

export function useGuidelinesSearch({ debounceMs = 150 }: UseGuidelinesSearchOptions = {}): UseGuidelinesSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debounce the search query
  useEffect(() => {
    if (searchQuery.length === 0) {
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];

    const query = debouncedQuery.toLowerCase().trim();
    const queryWords = query.split(/\s+/);

    // Expand query with keyword mappings
    const expandedTerms = new Set<string>(queryWords);
    Object.entries(GUIDELINE_KEYWORD_MAP).forEach(([key, synonyms]) => {
      if (queryWords.some(w => key.toLowerCase().includes(w) || synonyms.some(s => s.toLowerCase().includes(w)))) {
        expandedTerms.add(key.toLowerCase());
        synonyms.forEach(s => expandedTerms.add(s.toLowerCase()));
      }
    });

    const results: GuidelineSearchResult[] = [];

    CLINICAL_GUIDELINES.forEach(guideline => {
      let score = 0;
      const matchedKeywords: string[] = [];
      let matchedInTitle = false;
      let matchedInSummary = false;

      // Check title
      const titleLower = guideline.title.toLowerCase();
      const shortTitleLower = guideline.shortTitle.toLowerCase();
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 10;
          matchedInTitle = true;
        }
        if (shortTitleLower.includes(word)) {
          score += 8;
          matchedInTitle = true;
        }
      });

      // Check condition
      const conditionLower = guideline.condition.toLowerCase();
      queryWords.forEach(word => {
        if (conditionLower.includes(word)) {
          score += 12;
        }
      });

      // Check keywords
      guideline.keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (Array.from(expandedTerms).some(term => keywordLower.includes(term) || term.includes(keywordLower))) {
          score += 5;
          matchedKeywords.push(keyword);
        }
      });

      // Check summary
      const summaryLower = guideline.summary.toLowerCase();
      queryWords.forEach(word => {
        if (summaryLower.includes(word)) {
          score += 2;
          matchedInSummary = true;
        }
      });

      // Check organization
      if (guideline.organization.name.toLowerCase().includes(query) ||
          guideline.organization.abbreviation.toLowerCase().includes(query)) {
        score += 6;
      }

      // Check specialty
      if (guideline.specialty.toLowerCase().includes(query)) {
        score += 4;
      }

      if (score > 0) {
        results.push({
          guideline,
          relevanceScore: score,
          matchedKeywords: [...new Set(matchedKeywords)],
          matchedInTitle,
          matchedInSummary
        });
      }
    });

    // Sort by relevance score descending
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [debouncedQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    clearSearch
  };
}
