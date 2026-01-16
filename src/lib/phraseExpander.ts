/**
 * Clinical Phrase Expander - Handles dynamic field expansion and calculations
 */

import type { 
  ClinicalPhrase, 
  PhraseField, 
  ExpandedPhrase,
  ConditionalLogic,
  PatientDataSource 
} from '@/types/phrases';
import type { Patient } from '@/types/patient';

// Extract all field keys from content template
export const extractFieldKeys = (content: string): string[] => {
  const regex = /\{\{(\w+)\}\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1]);
  }
  return [...new Set(matches)];
};

// Evaluate conditional logic
export const evaluateCondition = (
  condition: ConditionalLogic['if'],
  values: Record<string, unknown>
): boolean => {
  const fieldValue = values[condition.field];
  const compareValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === compareValue;
    case 'not_equals':
      return fieldValue !== compareValue;
    case 'contains':
      return typeof fieldValue === 'string' && 
             typeof compareValue === 'string' && 
             fieldValue.toLowerCase().includes(compareValue.toLowerCase());
    case 'greater_than':
      return Number(fieldValue) > Number(compareValue);
    case 'less_than':
      return Number(fieldValue) < Number(compareValue);
    case 'is_empty':
      return fieldValue === '' || fieldValue === null || fieldValue === undefined;
    case 'is_not_empty':
      return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
    default:
      return false;
  }
};

// Get patient data value by path
export const getPatientDataValue = (
  patient: Patient | undefined,
  source: PatientDataSource
): string => {
  if (!patient) return '';

  const path = source.source;
  const parts = path.split('.');

  // Handle simple properties
  switch (parts[0]) {
    case 'name':
      return patient.name || '';
    case 'bed':
      return patient.bed || '';
    case 'clinical_summary':
      return patient.clinicalSummary || '';
    case 'labs':
      return patient.labs || '';
    case 'imaging':
      return patient.imaging || '';
    case 'interval_events':
      return patient.intervalEvents || '';
    case 'hospital_day':
      // Calculate hospital days from created_at
      if (patient.createdAt) {
        const created = new Date(patient.createdAt);
        const now = new Date();
        const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return `Hospital Day #${days}`;
      }
      return 'Hospital Day #1';
    case 'systems':
      if (parts.length > 1 && patient.systems) {
        const systemKey = parts[1] as keyof typeof patient.systems;
        return patient.systems[systemKey] || '';
      }
      return '';
    default:
      return '';
  }
};

// Calculate formula result
export const calculateFormula = (
  formula: string,
  values: Record<string, unknown>
): number | null => {
  try {
    // Replace field references with values
    let expression = formula;
    
    // Extract the expression part (after = if present)
    if (formula.includes('=')) {
      expression = formula.split('=')[1].trim();
    }

    // Replace variable names with values
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expression = expression.replace(regex, String(Number(value) || 0));
    }

    // Safe evaluation (only allow math operations)
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      console.warn('Invalid formula expression:', expression);
      return null;
    }

    // eslint-disable-next-line no-eval
    const result = eval(expression);
    return typeof result === 'number' && !isNaN(result) ? Math.round(result * 100) / 100 : null;
  } catch (error) {
    console.error('Formula calculation error:', error);
    return null;
  }
};

// Generate grammatically correct sentence from checkbox selections
export const generateSentenceFromSelections = (
  selections: string[],
  positivePrefix = 'Patient reports ',
  negativePrefix = 'Patient denies ',
  conjunction = ' and '
): string => {
  if (selections.length === 0) return '';
  
  const positives = selections.filter(s => !s.startsWith('no_') && !s.startsWith('denies_'));
  const negatives = selections.filter(s => s.startsWith('no_') || s.startsWith('denies_'))
    .map(s => s.replace(/^(no_|denies_)/, ''));

  const parts: string[] = [];
  
  if (positives.length > 0) {
    const formatted = formatList(positives, conjunction);
    parts.push(`${positivePrefix}${formatted}.`);
  }
  
  if (negatives.length > 0) {
    const formatted = formatList(negatives, conjunction);
    parts.push(`${negativePrefix}${formatted}.`);
  }

  return parts.join(' ');
};

// Format list with proper grammar
const formatList = (items: string[], conjunction: string): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(conjunction);
  
  const last = items.pop();
  return `${items.join(', ')},${conjunction}${last}`;
};

// Main phrase expansion function
export const expandPhrase = (
  phrase: ClinicalPhrase,
  fields: PhraseField[],
  values: Record<string, unknown>,
  patient?: Patient
): ExpandedPhrase => {
  let content = phrase.content;
  const usedFields: string[] = [];
  const calculatedValues: Record<string, number> = {};

  // Sort fields by sort order
  const sortedFields = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);

  // Process each field
  for (const field of sortedFields) {
    // Check conditional logic
    if (field.conditionalLogic) {
      const shouldShow = evaluateCondition(field.conditionalLogic.if, values);
      
      if (field.conditionalLogic.then === 'hide' && shouldShow) {
        // Replace with empty string
        content = content.replace(new RegExp(`\\{\\{${field.fieldKey}\\}\\}`, 'g'), '');
        continue;
      }
      
      if (field.conditionalLogic.then === 'show' && !shouldShow) {
        content = content.replace(new RegExp(`\\{\\{${field.fieldKey}\\}\\}`, 'g'), '');
        continue;
      }

      if (field.conditionalLogic.then === 'set_value' && shouldShow && field.conditionalLogic.thenValue) {
        values[field.fieldKey] = field.conditionalLogic.thenValue;
      }
    }

    let fieldValue: string;

    switch (field.fieldType) {
      case 'patient_data': {
        const source = field.options as PatientDataSource;
        fieldValue = getPatientDataValue(patient, source);
        break;
      }

      case 'calculation': {
        if (field.calculationFormula) {
          const result = calculateFormula(field.calculationFormula, values);
          if (result !== null) {
            calculatedValues[field.fieldKey] = result;
            fieldValue = String(result);
          } else {
            fieldValue = field.defaultValue || '';
          }
        } else {
          fieldValue = field.defaultValue || '';
        }
        break;
      }

      case 'checkbox': {
        const selectedItems = values[field.fieldKey];
        if (Array.isArray(selectedItems)) {
          fieldValue = generateSentenceFromSelections(selectedItems);
        } else {
          fieldValue = String(values[field.fieldKey] ?? field.defaultValue ?? '');
        }
        break;
      }

      case 'date': {
        const dateValue = values[field.fieldKey];
        if (dateValue) {
          const date = new Date(dateValue as string);
          fieldValue = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } else {
          fieldValue = field.defaultValue || new Date().toLocaleDateString();
        }
        break;
      }

      default:
        fieldValue = String(values[field.fieldKey] ?? field.defaultValue ?? '');
    }

    // Replace placeholder in content
    const placeholder = `{{${field.fieldKey}}}`;
    if (content.includes(placeholder)) {
      content = content.replace(new RegExp(placeholder, 'g'), fieldValue);
      usedFields.push(field.fieldKey);
    }
  }

  // Handle any remaining placeholders with empty string
  content = content.replace(/\{\{\w+\}\}/g, '');

  // Clean up extra whitespace and newlines
  content = content.replace(/\n{3,}/g, '\n\n').trim();

  return {
    content,
    usedFields,
    calculatedValues,
  };
};

// Validate field values
export const validateFieldValues = (
  fields: PhraseField[],
  values: Record<string, unknown>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.fieldKey];
    const validation = field.validation;

    if (!validation) continue;

    // Required check
    if (validation.required && (value === '' || value === null || value === undefined)) {
      errors[field.fieldKey] = validation.message || `${field.label} is required`;
      continue;
    }

    // Number validations
    if (field.fieldType === 'number' && value !== '' && value !== null && value !== undefined) {
      const numValue = Number(value);
      if (validation.min !== undefined && numValue < validation.min) {
        errors[field.fieldKey] = validation.message || `${field.label} must be at least ${validation.min}`;
      }
      if (validation.max !== undefined && numValue > validation.max) {
        errors[field.fieldKey] = validation.message || `${field.label} must be at most ${validation.max}`;
      }
    }

    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors[field.fieldKey] = validation.message || `${field.label} has invalid format`;
      }
    }
  }

  return errors;
};

// Search phrases by text
export const searchPhrases = (
  phrases: ClinicalPhrase[],
  query: string
): ClinicalPhrase[] => {
  const lowerQuery = query.toLowerCase();
  return phrases.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.content.toLowerCase().includes(lowerQuery) ||
    p.shortcut?.toLowerCase().includes(lowerQuery) ||
    p.description?.toLowerCase().includes(lowerQuery)
  );
};
