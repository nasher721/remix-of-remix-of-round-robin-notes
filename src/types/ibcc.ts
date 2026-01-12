/**
 * IBCC (Internet Book of Critical Care) Types
 * Type definitions for clinical reference integration
 */

export interface IBCCChapter {
  id: string;
  title: string;
  slug: string;
  url: string;
  category: IBCCCategory;
  system: MedicalSystem;
  keywords: string[];
  summary: string;
  lastUpdated?: string;
  isBookmarked?: boolean;
}

export interface IBCCCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export type MedicalSystem = 
  | 'cardiology'
  | 'pulmonology'
  | 'nephrology'
  | 'neurology'
  | 'infectious'
  | 'endocrine'
  | 'hematology'
  | 'gi'
  | 'toxicology'
  | 'resuscitation'
  | 'procedures'
  | 'general';

export interface IBCCSearchResult {
  chapter: IBCCChapter;
  relevanceScore: number;
  matchedKeywords: string[];
}

export interface PatientContextMatch {
  patientId: string;
  suggestedChapters: IBCCChapter[];
  matchReason: string[];
}

export interface IBCCBookmark {
  chapterId: string;
  userId: string;
  createdAt: string;
  notes?: string;
}

export interface ClinicalCalculator {
  id: string;
  name: string;
  description: string;
  chapterId: string;
  inputs: CalculatorInput[];
  formula: (inputs: Record<string, number | string>) => CalculatorResult;
}

export interface CalculatorInput {
  id: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  options?: { value: string | number; label: string }[];
  unit?: string;
  min?: number;
  max?: number;
  defaultValue?: number | string;
}

export interface CalculatorResult {
  value: number | string;
  interpretation: string;
  risk?: 'low' | 'moderate' | 'high' | 'critical';
}

export interface ProtocolChecklist {
  id: string;
  name: string;
  chapterId: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted?: boolean;
  category?: string;
  timeframe?: string;
}

export interface IBCCState {
  isOpen: boolean;
  activeChapter: IBCCChapter | null;
  searchQuery: string;
  activeCategory: string | null;
  activeSystem: MedicalSystem | null;
  bookmarks: string[];
  recentlyViewed: string[];
}
