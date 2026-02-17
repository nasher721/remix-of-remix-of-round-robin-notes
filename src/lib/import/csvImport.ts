/**
 * CSV Import Utilities - Bulk patient import with mapping wizard
 * Handles CSV parsing, field mapping, and validation
 */

export interface CSVColumn {
  header: string;
  sampleValues: string[];
}

export interface FieldMapping {
  csvColumn: string;
  targetField: string;
  transform?: 'uppercase' | 'lowercase' | 'titlecase' | 'date' | 'number';
  defaultValue?: string;
}

export interface ImportMapping {
  id: string;
  name: string;
  columns: FieldMapping[];
  createdAt: Date;
  lastUsed?: Date;
}

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  rowCount: number;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: ValidationError[];
}

/**
 * Parse CSV string into structured data
 */
export function parseCSV(csvText: string): CSVParseResult {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCSVLine(line));
  
  return {
    headers,
    rows,
    rowCount: rows.length
  };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Extract sample values from CSV columns
 */
export function extractColumnSamples(csvData: CSVParseResult, header: string): string[] {
  const headerIndex = csvData.headers.indexOf(header);
  if (headerIndex === -1) return [];
  
  return csvData.rows
    .slice(0, 10)
    .map(row => row[headerIndex])
    .filter(val => val && val.length > 0);
}

/**
 * Available target fields for mapping
 */
export const PATIENT_TARGET_FIELDS = [
  { key: 'name', label: 'Patient Name', type: 'string' },
  { key: 'mrn', label: 'MRN', type: 'string' },
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['M', 'F', 'Other'] },
  { key: 'room', label: 'Room', type: 'string' },
  { key: 'bed', label: 'Bed', type: 'string' },
  { key: 'admissionDate', label: 'Admission Date', type: 'date' },
  { key: 'diagnosis', label: 'Diagnosis', type: 'string' },
  { key: 'attending', label: 'Attending Physician', type: 'string' },
  { key: 'service', label: 'Service', type: 'string' },
  { key: 'codeStatus', label: 'Code Status', type: 'select', options: ['Full', 'DNR', 'DNI', 'Comfort'] },
  { key: 'isolation', label: 'Isolation', type: 'select', options: ['None', 'Contact', 'Droplet', 'Airborne'] },
];

/**
 * Auto-map columns based on header name similarity
 */
export function autoMapColumns(csvHeaders: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  
  for (const csvHeader of csvHeaders) {
    const normalizedHeader = csvHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    for (const target of PATIENT_TARGET_FIELDS) {
      const targetKey = target.key.toLowerCase();
      const targetLabel = target.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (normalizedHeader.includes(targetKey) || 
          targetKey.includes(normalizedHeader) ||
          normalizedHeader.includes(targetLabel) ||
          targetLabel.includes(normalizedHeader)) {
        
        mappings.push({
          csvColumn: csvHeader,
          targetField: target.key,
          transform: target.type === 'date' ? 'date' : undefined
        });
        break;
      }
    }
  }
  
  return mappings;
}

/**
 * Apply transformations to a value
 */
export function transformValue(value: string, transform?: string): string {
  if (!value) return value;
  
  switch (transform) {
    case 'uppercase':
      return value.toUpperCase();
    case 'lowercase':
      return value.toLowerCase();
    case 'titlecase':
      return value.replace(/\w\S*/g, txt => 
        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
      );
    case 'date':
      return parseDate(value);
    case 'number':
      return value.replace(/[^0-9.-]/g, '');
    default:
      return value;
  }
}

/**
 * Parse various date formats to ISO
 */
function parseDate(value: string): string {
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  const parts = value.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (parts) {
    const [, m, d, y] = parts;
    const year = y.length === 2 ? (parseInt(y) > 50 ? '19' : '20') + y : y;
    return new Date(parseInt(year), parseInt(m) - 1, parseInt(d)).toISOString();
  }
  
  return value;
}

/**
 * Validate a single row
 */
export function validateRow(
  row: string[], 
  headers: string[], 
  mapping: FieldMapping[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const map of mapping) {
    const colIndex = headers.indexOf(map.csvColumn);
    if (colIndex === -1) continue;
    
    const value = row[colIndex];
    const targetField = PATIENT_TARGET_FIELDS.find(f => f.key === map.targetField);
    
    if (!targetField) continue;
    
    if (!value || value.trim() === '') {
      if (map.defaultValue) continue;
      errors.push({
        row: 0,
        column: map.csvColumn,
        message: `Required field "${targetField.label}" is empty`,
        value: value || '(empty)'
      });
      continue;
    }
    
    if (targetField.type === 'select' && targetField.options) {
      if (!targetField.options.includes(value)) {
        errors.push({
          row: 0,
          column: map.csvColumn,
          message: `Invalid value "${value}". Must be one of: ${targetField.options.join(', ')}`,
          value
        });
      }
    }
    
    if (targetField.type === 'number' && isNaN(parseFloat(value))) {
      errors.push({
        row: 0,
        column: map.csvColumn,
        message: `Invalid number: ${value}`,
        value
      });
    }
  }
  
  return errors;
}

/**
 * Apply mapping and transform to a row
 */
export function mapRowToPatient(
  row: string[],
  headers: string[],
  mapping: FieldMapping[]
): Record<string, string> {
  const patient: Record<string, string> = {};
  
  for (const map of mapping) {
    const colIndex = headers.indexOf(map.csvColumn);
    if (colIndex === -1) continue;
    
    let value = row[colIndex] || map.defaultValue || '';
    value = transformValue(value, map.transform);
    
    patient[map.targetField] = value;
  }
  
  return patient;
}

/**
 * Save mapping preset to localStorage
 */
export function saveMappingPreset(mapping: ImportMapping): void {
  const presets = getMappingPresets();
  const existing = presets.findIndex(p => p.id === mapping.id);
  
  if (existing >= 0) {
    presets[existing] = mapping;
  } else {
    presets.push(mapping);
  }
  
  localStorage.setItem('csvImportPresets', JSON.stringify(presets));
}

/**
 * Get saved mapping presets
 */
export function getMappingPresets(): ImportMapping[] {
  try {
    const stored = localStorage.getItem('csvImportPresets');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Delete a mapping preset
 */
export function deleteMappingPreset(id: string): void {
  const presets = getMappingPresets().filter(p => p.id !== id);
  localStorage.setItem('csvImportPresets', JSON.stringify(presets));
}
