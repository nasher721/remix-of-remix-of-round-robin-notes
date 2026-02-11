/**
 * IBCC Context Detection Hook
 * Extracts clinical keywords from patient data for context-aware suggestions
 */

import { useMemo } from 'react';
import type { Patient } from '@/types/patient';
import type { IBCCChapter } from '@/types/ibcc';
import { IBCC_CHAPTERS, KEYWORD_PATTERNS } from '@/data/ibccContent';

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

export function useIBCCContext(currentPatient?: Patient) {
  // Memoized context suggestions based on current patient
  const contextSuggestions = useMemo((): IBCCChapter[] => {
    if (!currentPatient) return [];

    const keywords = extractPatientKeywords(currentPatient);
    
    const suggestions = IBCC_CHAPTERS.filter(chapter => 
      keywords.includes(chapter.id) ||
      keywords.some(k => chapter.keywords.includes(k))
    );

    return suggestions.slice(0, 5);
  }, [currentPatient]);

  const hasContextSuggestions = contextSuggestions.length > 0;

  return {
    contextSuggestions,
    hasContextSuggestions,
  };
}
