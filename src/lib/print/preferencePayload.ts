import type { PrintSettings as PrintSettingsType, CustomCombination } from './types';
import type { PrintTemplatePreset, PrintTemplateType } from '@/types/printTemplates';
import { defaultColumnWidths, defaultColumns, defaultCombinedColumnWidths } from '@/components/print/constants';
import { DEFAULT_ROUNDS_SINGLE, normalizeRoundsSettings, type RoundsSettings } from './roundsTypes';
import { DEFAULT_PAPER_SIZE, normalizePrintSectionSpacing } from './layout';
import { STORAGE_KEYS } from '@/constants/config';
import type { StorageLike } from '@/utils/safeStorage';

export interface PrintPreferencePayload {
  settings: PrintSettingsType;
  customCombinations: CustomCombination[];
  templatePresets: PrintTemplatePreset[];
  selectedTemplateId: PrintTemplateType;
}

export const createDefaultPrintSettings = (): PrintSettingsType => ({
  columns: defaultColumns.map(column => ({ ...column })),
  combinedColumns: [],
  printOrientation: 'portrait',
  paperSize: 'a4' as const,
  printFontSize: 9,
  printFontFamily: 'system',
  onePatientPerPage: false,
  autoFitFontSize: false,
  columnWidths: { ...defaultColumnWidths },
  combinedColumnWidths: { ...defaultCombinedColumnWidths },
  margins: 'normal',
  headerStyle: 'standard',
  borderStyle: 'light',
  showPageNumbers: true,
  showTimestamp: true,
  alternateRowColors: true,
  compactMode: false,
  sectionSpacing: normalizePrintSectionSpacing(undefined),
  activeTab: 'table',
  showNotesColumn: false,
  showTodosColumn: true,
  rounds: normalizeRoundsSettings(DEFAULT_ROUNDS_SINGLE, 'single'),
});

export const mergeStoredPrintSettings = (stored?: Partial<PrintSettingsType>): PrintSettingsType => {
  const defaultSettings = createDefaultPrintSettings();
  const fontSize = stored?.printFontSize;
  return ({
    ...defaultSettings,
    ...stored,
    columns: Array.isArray(stored?.columns) ? stored.columns : defaultSettings.columns,
    combinedColumns: Array.isArray(stored?.combinedColumns) ? stored.combinedColumns : [],
    paperSize: stored?.paperSize === 'letter' ? 'letter' : DEFAULT_PAPER_SIZE,
    printFontSize: typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize > 0
      ? fontSize : defaultSettings.printFontSize,
    columnWidths: { ...defaultColumnWidths, ...(stored?.columnWidths ?? {}) },
    combinedColumnWidths: { ...defaultCombinedColumnWidths, ...(stored?.combinedColumnWidths ?? {}) },
    sectionSpacing: normalizePrintSectionSpacing(stored?.sectionSpacing),
    rounds: normalizeRoundsSettings(stored?.rounds, stored?.rounds?.variant ?? 'single'),
  });
};

export const writePrintPreferenceCache = (printStorage: StorageLike, payload: PrintPreferencePayload): void => {
  const nextSettings = payload.settings;
  printStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_PREFS, JSON.stringify(nextSettings.columns));
  printStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS, JSON.stringify(nextSettings.columnWidths));
  printStorage.setItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS, JSON.stringify(nextSettings.combinedColumns));
  printStorage.setItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS, JSON.stringify(nextSettings.combinedColumnWidths));
  printStorage.setItem(STORAGE_KEYS.PRINT_ORIENTATION, nextSettings.printOrientation);
  printStorage.setItem(
    STORAGE_KEYS.PRINT_PAPER_SIZE,
    nextSettings.paperSize ?? DEFAULT_PAPER_SIZE,
  );
  printStorage.setItem(STORAGE_KEYS.PRINT_FONT_SIZE, nextSettings.printFontSize.toString());
  printStorage.setItem(STORAGE_KEYS.PRINT_FONT_FAMILY, nextSettings.printFontFamily);
  printStorage.setItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE, nextSettings.onePatientPerPage.toString());
  printStorage.setItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE, nextSettings.autoFitFontSize.toString());
  printStorage.setItem('printMargins', nextSettings.margins);
  printStorage.setItem('printHeaderStyle', nextSettings.headerStyle);
  printStorage.setItem('printBorderStyle', nextSettings.borderStyle);
  printStorage.setItem('printShowPageNumbers', nextSettings.showPageNumbers.toString());
  printStorage.setItem('printShowTimestamp', nextSettings.showTimestamp.toString());
  printStorage.setItem('printAlternateRowColors', nextSettings.alternateRowColors.toString());
  printStorage.setItem('printCompactMode', nextSettings.compactMode.toString());
  printStorage.setItem(
    STORAGE_KEYS.PRINT_SECTION_SPACING,
    String(normalizePrintSectionSpacing(nextSettings.sectionSpacing)),
  );
  printStorage.setItem(STORAGE_KEYS.PRINT_FORMAT, nextSettings.activeTab);
  printStorage.setItem(STORAGE_KEYS.PRINT_ROUNDS_SETTINGS, JSON.stringify(nextSettings.rounds));
  printStorage.setItem(STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS, JSON.stringify(payload.customCombinations));
  printStorage.setItem(STORAGE_KEYS.PRINT_TEMPLATE_PRESETS, JSON.stringify(payload.templatePresets));
  printStorage.setItem(STORAGE_KEYS.PRINT_SELECTED_TEMPLATE_ID, payload.selectedTemplateId);
  // A complete payload also retains newer settings not represented by legacy keys.
  printStorage.setItem('payload', JSON.stringify(payload));
};

const parseStoredJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const readAnonymousPrintPreferences = (printStorage: StorageLike): PrintPreferencePayload => {
  const defaultSettings = createDefaultPrintSettings();
  const defaultPayload = createDefaultPrintPreferences();
  const complete = parseStoredJson<PrintPreferencePayload | null>(printStorage.getItem('payload'), null);
  if (complete) return normalizePrintPreferences(complete);
  const savedCols = printStorage.getItem(STORAGE_KEYS.PRINT_COLUMN_PREFS);
  const savedWidths = printStorage.getItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS);
  const savedCombined = printStorage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS);
  const savedCombinedWidths = printStorage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS);

  return normalizePrintPreferences({
    settings: mergeStoredPrintSettings({
      columns: parseStoredJson(savedCols, defaultSettings.columns),
      columnWidths: parseStoredJson(savedWidths, defaultSettings.columnWidths),
      combinedColumns: parseStoredJson(savedCombined, defaultSettings.combinedColumns),
      combinedColumnWidths: parseStoredJson(savedCombinedWidths, defaultSettings.combinedColumnWidths),
      printOrientation: (printStorage.getItem(STORAGE_KEYS.PRINT_ORIENTATION) as 'portrait' | 'landscape') || defaultSettings.printOrientation,
      paperSize: (printStorage.getItem(STORAGE_KEYS.PRINT_PAPER_SIZE) as 'a4' | 'letter') || defaultSettings.paperSize,
      printFontSize: parseInt(printStorage.getItem(STORAGE_KEYS.PRINT_FONT_SIZE) || `${defaultSettings.printFontSize}`, 10),
      printFontFamily: printStorage.getItem(STORAGE_KEYS.PRINT_FONT_FAMILY) || defaultSettings.printFontFamily,
      onePatientPerPage: printStorage.getItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE) === 'true',
      autoFitFontSize: printStorage.getItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE) === 'true',
      margins: (printStorage.getItem('printMargins') as 'narrow' | 'normal' | 'wide') || defaultSettings.margins,
      headerStyle: (printStorage.getItem('printHeaderStyle') as 'minimal' | 'standard' | 'detailed') || defaultSettings.headerStyle,
      borderStyle: (printStorage.getItem('printBorderStyle') as 'none' | 'light' | 'medium' | 'heavy') || defaultSettings.borderStyle,
      showPageNumbers: printStorage.getItem('printShowPageNumbers') !== 'false',
      showTimestamp: printStorage.getItem('printShowTimestamp') !== 'false',
      alternateRowColors: printStorage.getItem('printAlternateRowColors') !== 'false',
      compactMode: printStorage.getItem('printCompactMode') === 'true',
      sectionSpacing: normalizePrintSectionSpacing(
        printStorage.getItem(STORAGE_KEYS.PRINT_SECTION_SPACING),
      ),
      activeTab: printStorage.getItem(STORAGE_KEYS.PRINT_FORMAT) || defaultSettings.activeTab,
      rounds: parseStoredJson<RoundsSettings | undefined>(
        printStorage.getItem(STORAGE_KEYS.PRINT_ROUNDS_SETTINGS),
        undefined,
      ),
    }),
    customCombinations: parseStoredJson<CustomCombination[]>(
      printStorage.getItem(STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS),
      [],
    ),
    templatePresets: parseStoredJson<PrintTemplatePreset[]>(
      printStorage.getItem(STORAGE_KEYS.PRINT_TEMPLATE_PRESETS),
      [],
    ),
    selectedTemplateId:
      (printStorage.getItem(STORAGE_KEYS.PRINT_SELECTED_TEMPLATE_ID) as PrintTemplateType | null) ??
      defaultPayload.selectedTemplateId,
  });
};

export const createDefaultPrintPreferences = (): PrintPreferencePayload => ({
  settings: createDefaultPrintSettings(),
  customCombinations: [],
  templatePresets: [],
  selectedTemplateId: 'standard',
});

export const normalizePrintPreferences = (value: unknown): PrintPreferencePayload => {
  const payload = value && typeof value === 'object' ? value as Partial<PrintPreferencePayload> : {};
  return {
    settings: mergeStoredPrintSettings(payload.settings),
    customCombinations: Array.isArray(payload.customCombinations) ? payload.customCombinations : [],
    templatePresets: Array.isArray(payload.templatePresets) ? payload.templatePresets : [],
    selectedTemplateId: payload.selectedTemplateId || 'standard',
  };
};
