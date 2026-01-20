/**
 * Lab Value Types for Fishbone Display
 * Supports structured lab data with trending capabilities
 */

// Individual lab value with trending support
export interface LabValue {
  value: number | null;
  previousValue?: number | null;
  unit?: string;
  timestamp?: string;
  previousTimestamp?: string;
}

// Basic Metabolic Panel (BMP) structure
export interface BMPLabs {
  na?: LabValue;    // Sodium
  k?: LabValue;     // Potassium
  cl?: LabValue;    // Chloride
  co2?: LabValue;   // Bicarbonate
  bun?: LabValue;   // Blood Urea Nitrogen
  cr?: LabValue;    // Creatinine
  glu?: LabValue;   // Glucose
}

// Complete Blood Count (CBC) structure
export interface CBCLabs {
  wbc?: LabValue;   // White Blood Cells
  hgb?: LabValue;   // Hemoglobin
  hct?: LabValue;   // Hematocrit
  plt?: LabValue;   // Platelets
}

// Combined structured labs
export interface StructuredLabs {
  bmp?: BMPLabs;
  cbc?: CBCLabs;
  rawText?: string; // Fallback for unstructured text
}

// Normal ranges for lab values (adult ranges)
export const LAB_NORMAL_RANGES: Record<string, { low: number; high: number; unit: string }> = {
  // BMP
  na: { low: 135, high: 145, unit: 'mEq/L' },
  k: { low: 3.5, high: 5.0, unit: 'mEq/L' },
  cl: { low: 98, high: 106, unit: 'mEq/L' },
  co2: { low: 22, high: 29, unit: 'mEq/L' },
  bun: { low: 7, high: 20, unit: 'mg/dL' },
  cr: { low: 0.7, high: 1.3, unit: 'mg/dL' },
  glu: { low: 70, high: 100, unit: 'mg/dL' },
  // CBC
  wbc: { low: 4.5, high: 11.0, unit: 'K/uL' },
  hgb: { low: 12.0, high: 17.5, unit: 'g/dL' },
  hct: { low: 36, high: 50, unit: '%' },
  plt: { low: 150, high: 400, unit: 'K/uL' },
};

// Helper to determine if a value is high, low, or normal
export type LabStatus = 'high' | 'low' | 'normal' | 'unknown';

export const getLabStatus = (labKey: string, value: number | null | undefined): LabStatus => {
  if (value === null || value === undefined) return 'unknown';
  const range = LAB_NORMAL_RANGES[labKey];
  if (!range) return 'unknown';
  if (value > range.high) return 'high';
  if (value < range.low) return 'low';
  return 'normal';
};

// Helper to calculate delta between current and previous value
export const getLabDelta = (current: number | null | undefined, previous: number | null | undefined): number | null => {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null;
  }
  return Number((current - previous).toFixed(2));
};

// Parse raw lab text to structured format (basic parsing)
export const parseLabText = (text: string): StructuredLabs => {
  if (!text || text.trim() === '') {
    return { rawText: '' };
  }
  
  const result: StructuredLabs = {
    bmp: {},
    cbc: {},
    rawText: text,
  };
  
  // Common lab patterns (case insensitive)
  const patterns: Record<string, { target: 'bmp' | 'cbc'; key: keyof BMPLabs | keyof CBCLabs }> = {
    'na[:\\s]+([\\d.]+)': { target: 'bmp', key: 'na' },
    'sodium[:\\s]+([\\d.]+)': { target: 'bmp', key: 'na' },
    'k[:\\s]+([\\d.]+)': { target: 'bmp', key: 'k' },
    'potassium[:\\s]+([\\d.]+)': { target: 'bmp', key: 'k' },
    'cl[:\\s]+([\\d.]+)': { target: 'bmp', key: 'cl' },
    'chloride[:\\s]+([\\d.]+)': { target: 'bmp', key: 'cl' },
    'co2[:\\s]+([\\d.]+)': { target: 'bmp', key: 'co2' },
    'bicarb[:\\s]+([\\d.]+)': { target: 'bmp', key: 'co2' },
    'hco3[:\\s]+([\\d.]+)': { target: 'bmp', key: 'co2' },
    'bun[:\\s]+([\\d.]+)': { target: 'bmp', key: 'bun' },
    'cr[:\\s]+([\\d.]+)': { target: 'bmp', key: 'cr' },
    'creatinine[:\\s]+([\\d.]+)': { target: 'bmp', key: 'cr' },
    'glu[:\\s]+([\\d.]+)': { target: 'bmp', key: 'glu' },
    'glucose[:\\s]+([\\d.]+)': { target: 'bmp', key: 'glu' },
    'wbc[:\\s]+([\\d.]+)': { target: 'cbc', key: 'wbc' },
    'hgb[:\\s]+([\\d.]+)': { target: 'cbc', key: 'hgb' },
    'hemoglobin[:\\s]+([\\d.]+)': { target: 'cbc', key: 'hgb' },
    'hct[:\\s]+([\\d.]+)': { target: 'cbc', key: 'hct' },
    'hematocrit[:\\s]+([\\d.]+)': { target: 'cbc', key: 'hct' },
    'plt[:\\s]+([\\d.]+)': { target: 'cbc', key: 'plt' },
    'platelets[:\\s]+([\\d.]+)': { target: 'cbc', key: 'plt' },
  };
  
  const normalizedText = text.toLowerCase();
  
  for (const [pattern, { target, key }] of Object.entries(patterns)) {
    const regex = new RegExp(pattern, 'i');
    const match = normalizedText.match(regex);
    if (match && match[1]) {
      const value = parseFloat(match[1]);
      if (!isNaN(value)) {
        if (target === 'bmp') {
          result.bmp![key as keyof BMPLabs] = { value };
        } else {
          result.cbc![key as keyof CBCLabs] = { value };
        }
      }
    }
  }
  
  return result;
};
