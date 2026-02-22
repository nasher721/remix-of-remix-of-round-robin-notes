/**
 * IBCC Context Detection Hook
 * Extracts clinical keywords from patient data for context-aware suggestions
 */

import { useMemo } from 'react';
import type { Patient } from '@/types/patient';
import type { IBCCChapter } from '@/types/ibcc';
import { useLazyData } from '@/lib/lazyData';

export function useIBCCContext(currentPatient?: Patient) {
  // Lazy-load IBCC data
  const { data: ibccData } = useLazyData(
    () => import('@/data/ibccContent'),
    (mod) => ({ chapters: mod.IBCC_CHAPTERS, patterns: mod.KEYWORD_PATTERNS }),
  );
  // Memoized context suggestions based on current patient
  const contextSuggestions = useMemo((): IBCCChapter[] => {
    const chapters = ibccData?.chapters ?? [];
    const keywordPatterns = ibccData?.patterns ?? {};
    if (!currentPatient || chapters.length === 0) return [];

    // Combine all patient text
    const allText = [
      currentPatient.clinicalSummary,
      currentPatient.intervalEvents,
      ...Object.values(currentPatient.systems)
    ].join(' ').toLowerCase();

    // Extract keywords from patient data
    const matchedChapterIds: string[] = [];
    Object.entries(keywordPatterns).forEach(([chapterId, patterns]) => {
      const hasMatch = patterns.some(pattern =>
        allText.includes(pattern.toLowerCase())
      );
      if (hasMatch) {
        matchedChapterIds.push(chapterId);
      }
    });

    const suggestions = chapters.filter(chapter =>
      matchedChapterIds.includes(chapter.id) ||
      matchedChapterIds.some(k => chapter.keywords.includes(k))
    );

    return suggestions.slice(0, 5);
  }, [currentPatient, ibccData]);

  const hasContextSuggestions = contextSuggestions.length > 0;

  return {
    contextSuggestions,
    hasContextSuggestions,
  };
}
