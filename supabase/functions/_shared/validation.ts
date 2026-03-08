/**
 * Lightweight validation utilities for Edge Functions
 * 
 * Since we can't easily import Zod in Deno without complex imports,
 * we provide simple validation functions here.
 */

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface SchemaValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: ValidationError[];
}

/**
 * Validate that a value is a non-empty string
 */
export function validateString(
  value: unknown,
  field: string,
  options?: { minLength?: number; maxLength?: number }
): ValidationError | null {
  if (typeof value !== 'string') {
    return { field, message: 'Must be a string', value };
  }
  
  if (value.length === 0) {
    return { field, message: 'Cannot be empty', value };
  }
  
  if (options?.minLength && value.length < options.minLength) {
    return { field, message: `Must be at least ${options.minLength} characters`, value };
  }
  
  if (options?.maxLength && value.length > options.maxLength) {
    return { field, message: `Must be at most ${options.maxLength} characters`, value };
  }
  
  return null;
}

/**
 * Validate that a value is one of the allowed enum values
 */
export function validateEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): ValidationError | null {
  if (typeof value !== 'string') {
    return { field, message: 'Must be a string', value };
  }
  
  if (!allowed.includes(value as T)) {
    return { field, message: `Must be one of: ${allowed.join(', ')}`, value };
  }
  
  return null;
}

/**
 * Validate that a value is a boolean
 */
export function validateBoolean(
  value: unknown,
  field: string
): ValidationError | null {
  if (typeof value !== 'boolean') {
    return { field, message: 'Must be a boolean', value };
  }
  return null;
}

/**
 * Validate that a value is a number
 */
export function validateNumber(
  value: unknown,
  field: string,
  options?: { min?: number; max?: number; integer?: boolean }
): ValidationError | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { field, message: 'Must be a number', value };
  }
  
  if (options?.integer && !Number.isInteger(value)) {
    return { field, message: 'Must be an integer', value };
  }
  
  if (options?.min !== undefined && value < options.min) {
    return { field, message: `Must be at least ${options.min}`, value };
  }
  
  if (options?.max !== undefined && value > options.max) {
    return { field, message: `Must be at most ${options.max}`, value };
  }
  
  return null;
}

/**
 * Validate that a value is an object
 */
export function validateObject(
  value: unknown,
  field: string
): ValidationError | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { field, message: 'Must be an object', value };
  }
  return null;
}

/**
 * Validate that a value is an array
 */
export function validateArray(
  value: unknown,
  field: string,
  options?: { minLength?: number; maxLength?: number }
): ValidationError | null {
  if (!Array.isArray(value)) {
    return { field, message: 'Must be an array', value };
  }
  
  if (options?.minLength !== undefined && value.length < options.minLength) {
    return { field, message: `Must have at least ${options.minLength} items`, value };
  }
  
  if (options?.maxLength !== undefined && value.length > options.maxLength) {
    return { field, message: `Must have at most ${options.maxLength} items`, value };
  }
  
  return null;
}

/**
 * Validate an optional field (null or undefined is allowed)
 */
export function validateOptional<T>(
  value: unknown,
  field: string,
  validator: (v: unknown, f: string) => ValidationError | null
): ValidationError | null {
  if (value === undefined || value === null) {
    return null;
  }
  return validator(value, field);
}

/**
 * Schema-based validator
 * Define a schema and validate data against it
 */
export type Validator = (value: unknown, field: string) => ValidationError | null;

export interface ObjectSchema {
  [key: string]: Validator | { validator: Validator; required: boolean };
}

/**
 * Validate an object against a schema
 */
export function validateSchema<T extends Record<string, unknown>>(
  data: unknown,
  schema: ObjectSchema,
  rootField = 'root'
): SchemaValidationResult<T> {
  const errors: ValidationError[] = [];
  
  const objectError = validateObject(data, rootField);
  if (objectError) {
    return { valid: false, errors: [objectError] };
  }
  
  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  
  for (const [key, validatorConfig] of Object.entries(schema)) {
    const value = obj[key];
    const isRequired = typeof validatorConfig === 'object' && 'required' in validatorConfig
      ? validatorConfig.required
      : true;
    const validator = typeof validatorConfig === 'object' && 'validator' in validatorConfig
      ? validatorConfig.validator
      : validatorConfig as Validator;
    
    if ((value === undefined || value === null) && !isRequired) {
      continue;
    }
    
    if ((value === undefined || value === null) && isRequired) {
      errors.push({ field: key, message: 'Required field missing' });
      continue;
    }
    
    const error = validator(value, key);
    if (error) {
      errors.push(error);
    } else {
      result[key] = value;
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, data: result as T, errors: [] };
}

/**
 * Common validation schemas
 */

// Clinical context validation
export const ClinicalContextSchema: ObjectSchema = {
  patientName: { validator: (v, f) => validateOptional(v, f, validateString), required: false },
  clinicalSummary: { validator: (v, f) => validateOptional(v, f, validateString), required: false },
  intervalEvents: { validator: (v, f) => validateOptional(v, f, validateString), required: false },
  imaging: { validator: (v, f) => validateOptional(v, f, validateString), required: false },
  labs: { validator: (v, f) => validateOptional(v, f, validateString), required: false },
  systems: { validator: (v, f) => validateOptional(v, f, validateObject), required: false },
};

// AI Feature types
export const AI_FEATURES = [
  'smart_expand',
  'differential_diagnosis',
  'documentation_check',
  'soap_format',
  'assessment_plan',
  'clinical_summary',
  'medical_correction',
  'system_based_rounds',
  'date_organizer',
  'problem_list',
  'icu_boards_explainer',
  'interval_events_generator',
  'neuro_icu_hpi',
] as const;

export type AIFeature = typeof AI_FEATURES[number];

// AI Clinical Assistant request validation
export const AIClinicalAssistantSchema: ObjectSchema = {
  feature: (v, f) => validateEnum(v, f, AI_FEATURES),
  text: { validator: (v, f) => validateOptional(v, f, validateString), required: false },
  context: { validator: (v, f) => validateOptional(v, f, validateObject), required: false },
  customPrompt: { validator: (v, f) => validateOptional(v, f, validateString), required: false },
  model: { validator: (v, f) => validateOptional(v, f, validateString), required: false },
  stream: { validator: (v, f) => validateOptional(v, f, validateBoolean), required: false },
};

// Transcription request validation
export const TranscriptionRequestSchema: ObjectSchema = {
  audio: (v, f) => validateString(v, f),
  language: { validator: (v, f) => validateOptional(v, f, (val, fld) => validateString(val, fld)), required: false },
};

// Helper to format validation errors for API response
export function formatValidationErrors(errors: ValidationError[]): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  
  for (const error of errors) {
    if (!formatted[error.field]) {
      formatted[error.field] = [];
    }
    formatted[error.field].push(error.message);
  }
  
  return formatted;
}
