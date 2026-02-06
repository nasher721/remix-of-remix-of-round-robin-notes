// Local storage keys - centralized to prevent magic strings
export const STORAGE_KEYS = {
  // Settings
  GLOBAL_FONT_SIZE: 'globalFontSize',
  TODOS_ALWAYS_VISIBLE: 'todosAlwaysVisible',
  PATIENT_SORT_BY: 'patientSortBy',
  SHOW_LAB_FISHBONES: 'showLabFishbones',
  SECTION_VISIBILITY: 'sectionVisibility',
  DESIGN_THEME: 'designTheme',
  
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
  SHOW_LAB_FISHBONES: true,
  PRINT_MARGINS: 'normal' as const,
  PRINT_HEADER_STYLE: 'standard' as const,
  PRINT_BORDER_STYLE: 'light' as const,
  PRINT_SHOW_PAGE_NUMBERS: true,
  PRINT_SHOW_TIMESTAMP: true,
  PRINT_ALTERNATE_ROW_COLORS: true,
  PRINT_COMPACT_MODE: false,
} as const;

// Patient filter state enum
export enum PatientFilterType {
  All = 'all',
  Filled = 'filled',
  Empty = 'empty',
}
