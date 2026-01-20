// Local storage keys - centralized to prevent magic strings
export const STORAGE_KEYS = {
  // Settings
  GLOBAL_FONT_SIZE: 'globalFontSize',
  TODOS_ALWAYS_VISIBLE: 'todosAlwaysVisible',
  PATIENT_SORT_BY: 'patientSortBy',
  SHOW_LAB_FISHBONES: 'showLabFishbones',
  
  // Print preferences
  PRINT_COLUMN_WIDTHS: 'printColumnWidths',
  PRINT_COLUMN_PREFS: 'printColumnPrefs',
  PRINT_FONT_SIZE: 'printFontSize',
  PRINT_FONT_FAMILY: 'printFontFamily',
  PRINT_ONE_PATIENT_PER_PAGE: 'printOnePatientPerPage',
  PRINT_AUTO_FIT_FONT_SIZE: 'printAutoFitFontSize',
  PRINT_COMBINED_COLUMNS: 'printCombinedColumns',
  PRINT_SYSTEMS_REVIEW_COLUMN_COUNT: 'printSystemsReviewColumnCount',
  PRINT_ORIENTATION: 'printOrientation',
  PRINT_CUSTOM_PRESETS: 'printCustomPresets',
} as const;

// Default configuration values
export const DEFAULT_CONFIG = {
  GLOBAL_FONT_SIZE: 14,
  PRINT_FONT_SIZE: 9,
  PRINT_FONT_FAMILY: 'system',
  PRINT_ORIENTATION: 'portrait' as const,
  SYSTEMS_REVIEW_COLUMN_COUNT: 2,
  DEFAULT_SORT_BY: 'room' as const,
  SHOW_LAB_FISHBONES: true,
} as const;

// Patient filter state enum
export enum PatientFilterType {
  All = 'all',
  Filled = 'filled',
  Empty = 'empty',
}
