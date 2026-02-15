// Local storage keys - centralized to prevent magic strings
export const STORAGE_KEYS = {
  // Settings
  GLOBAL_FONT_SIZE: 'globalFontSize',
  TODOS_ALWAYS_VISIBLE: 'todosAlwaysVisible',
  PATIENT_SORT_BY: 'patientSortBy',
  SHOW_LAB_FISHBONES: 'showLabFishbones',
  SECTION_VISIBILITY: 'sectionVisibility',
  SELECTED_SPECIALTY: 'selectedSpecialty',
  AI_PROVIDER: 'aiProvider',
  AI_MODEL: 'aiModel',
  AI_CREDENTIALS: 'aiCredentials',
  AI_FEATURE_MODELS: 'aiFeatureModels',
  
  // Print preferences
  PRINT_COLUMN_WIDTHS: 'printColumnWidths',
  PRINT_COLUMN_PREFS: 'printColumnPrefs',
  PRINT_FONT_SIZE: 'printFontSize',
  PRINT_FONT_FAMILY: 'printFontFamily',
  PRINT_ONE_PATIENT_PER_PAGE: 'printOnePatientPerPage',
  PRINT_AUTO_FIT_FONT_SIZE: 'printAutoFitFontSize',
  PRINT_COMBINED_COLUMNS: 'printCombinedColumns',
  PRINT_COMBINED_COLUMN_WIDTHS: 'printCombinedColumnWidths',
  PRINT_SYSTEMS_REVIEW_COLUMN_COUNT: 'printSystemsReviewColumnCount',
  PRINT_ORIENTATION: 'printOrientation',
  PRINT_CUSTOM_PRESETS: 'printCustomPresets',
  PRINT_CUSTOM_COMBINATIONS: 'printCustomCombinations',
  PRINT_TEMPLATE_PRESETS: 'printTemplatePresets',
  PRINT_SELECTED_TEMPLATE_ID: 'printSelectedTemplateId',
} as const;

// Clinical section keys for visibility toggles
export const CLINICAL_SECTIONS = [
  { key: 'clinicalSummary', label: 'Clinical Summary', icon: 'FileText' },
  { key: 'intervalEvents', label: 'Interval Events', icon: 'Calendar' },
  { key: 'imaging', label: 'Imaging', icon: 'ImageIcon' },
  { key: 'labs', label: 'Labs', icon: 'TestTube' },
  { key: 'medications', label: 'Medications', icon: 'Pill' },
  { key: 'systemsReview', label: 'Systems Review', icon: 'Activity' },
] as const;

export type ClinicalSectionKey = typeof CLINICAL_SECTIONS[number]['key'];

export type SectionVisibility = Record<ClinicalSectionKey, boolean>;

export const DEFAULT_SECTION_VISIBILITY: SectionVisibility = {
  clinicalSummary: true,
  intervalEvents: true,
  imaging: true,
  labs: true,
  medications: true,
  systemsReview: true,
};

// Default configuration values
export const DEFAULT_CONFIG = {
  GLOBAL_FONT_SIZE: 14,
  PRINT_FONT_SIZE: 9,
  PRINT_FONT_FAMILY: 'system',
  PRINT_ORIENTATION: 'portrait' as const,
  SYSTEMS_REVIEW_COLUMN_COUNT: 2,
  DEFAULT_SORT_BY: 'room' as const,
  DEFAULT_AI_PROVIDER: 'openai' as const,
  DEFAULT_AI_MODEL: 'gpt-4o-mini' as const,
  SHOW_LAB_FISHBONES: true,
  PRINT_MARGINS: 'normal' as const,
  PRINT_HEADER_STYLE: 'standard' as const,
  PRINT_BORDER_STYLE: 'light' as const,
  PRINT_SHOW_PAGE_NUMBERS: true,
  PRINT_SHOW_TIMESTAMP: true,
  PRINT_ALTERNATE_ROW_COLORS: true,
  PRINT_COMPACT_MODE: false,
} as const;

// AI feature categories for per-feature model customization
export const AI_FEATURE_CATEGORIES = [
  { key: 'clinical_assistant', label: 'Clinical Assistant', description: 'Smart expand, DDx, SOAP, A&P' },
  { key: 'interval_events', label: 'Interval Events', description: 'Generate interval event summaries' },
  { key: 'patient_course', label: 'Patient Course', description: 'Generate hospital course' },
  { key: 'daily_summary', label: 'Daily Summary', description: 'Generate daily summaries' },
  { key: 'todos', label: 'Todo Generation', description: 'Generate action items' },
  { key: 'text_transform', label: 'Text Transform', description: 'Shorthand, comma lists, custom' },
  { key: 'transcription', label: 'Transcription Enhancement', description: 'Medical dictation correction' },
  { key: 'medications', label: 'Medication Formatting', description: 'Parse & categorize meds' },
  { key: 'parsing', label: 'Document Parsing', description: 'Handoff & patient import' },
] as const;

export type AIFeatureCategory = typeof AI_FEATURE_CATEGORIES[number]['key'];

export type AIFeatureModels = Partial<Record<AIFeatureCategory, string>>;

// Supported models that can be used in edge functions via OpenAI API
export const GATEWAY_MODELS = [
  { value: '__default__', label: 'Use default' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
  { value: 'gpt-4o', label: 'GPT-4o (balanced)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (high quality)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (economic)' },
] as const;

export const DEFAULT_GATEWAY_MODEL = 'gpt-4o-mini';

// Patient filter state enum
export enum PatientFilterType {
  All = 'all',
  Filled = 'filled',
  Empty = 'empty',
}
