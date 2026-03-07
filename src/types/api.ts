/**
 * Standardized API Types and Contracts
 * 
 * This file defines the standard response formats for all API endpoints
 * to ensure consistency across the application.
 */

import { z } from 'zod';

// ============================================================================
// Base Response Types
// ============================================================================

/**
 * Standard API response envelope
 * All API responses should follow this structure
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean;
  /** The response data (only present when success is true) */
  data?: T;
  /** Error information (only present when success is false) */
  error?: ApiError;
  /** Metadata about the request/response */
  meta?: ApiMetadata;
}

/**
 * Standardized error structure
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Request ID for tracking */
  requestId?: string;
}

/**
 * API response metadata
 */
export interface ApiMetadata {
  /** Timestamp of the response */
  timestamp: string;
  /** API version */
  version: string;
  /** Request ID for correlation */
  requestId: string;
  /** Pagination info (if applicable) */
  pagination?: PaginationInfo;
  /** Processing time in milliseconds */
  duration?: number;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
}

// ============================================================================
// Error Codes
// ============================================================================

export type ErrorCode =
  // Client errors (4xx)
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  // Server errors (5xx)
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  // Business logic errors
  | 'PATIENT_NOT_FOUND'
  | 'INVALID_PHRASE'
  | 'AI_PROCESSING_ERROR'
  | 'FHIR_CONNECTION_ERROR';

// ============================================================================
// HTTP Status Mapping
// ============================================================================

export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
  PATIENT_NOT_FOUND: 404,
  INVALID_PHRASE: 400,
  AI_PROCESSING_ERROR: 500,
  FHIR_CONNECTION_ERROR: 502,
};

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

/**
 * Schema for API error
 */
export const ApiErrorSchema = z.object({
  code: z.enum([
    'BAD_REQUEST',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'VALIDATION_ERROR',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
    'TIMEOUT',
    'PATIENT_NOT_FOUND',
    'INVALID_PHRASE',
    'AI_PROCESSING_ERROR',
    'FHIR_CONNECTION_ERROR',
  ]),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  requestId: z.string().optional(),
});

/**
 * Schema for pagination info
 */
export const PaginationInfoSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

/**
 * Schema for API metadata
 */
export const ApiMetadataSchema = z.object({
  timestamp: z.string().datetime(),
  version: z.string(),
  requestId: z.string(),
  pagination: PaginationInfoSchema.optional(),
  duration: z.number().optional(),
});

/**
 * Generic API response schema factory
 */
export function createApiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: ApiMetadataSchema,
  });
}

/**
 * Error response schema
 */
export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: ApiErrorSchema,
  meta: ApiMetadataSchema,
});

/**
 * Union schema for any API response
 */
export function createApiResponseUnionSchema<T extends z.ZodType>(dataSchema: T) {
  return z.union([
    createApiResponseSchema(dataSchema),
    ApiErrorResponseSchema,
  ]);
}

// ============================================================================
// Specific Endpoint Schemas
// ============================================================================

// AI Clinical Assistant
export const AIClinicalAssistantRequestSchema = z.object({
  feature: z.enum([
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
  ]),
  text: z.string().optional(),
  context: z.object({
    patientName: z.string().optional(),
    clinicalSummary: z.string().optional(),
    intervalEvents: z.string().optional(),
    imaging: z.string().optional(),
    labs: z.string().optional(),
    systems: z.record(z.string()).optional(),
    medications: z.object({
      infusions: z.array(z.string()).optional(),
      scheduled: z.array(z.string()).optional(),
      prn: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
  customPrompt: z.string().optional(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

export const AIClinicalAssistantResponseSchema = z.object({
  result: z.union([z.string(), z.record(z.unknown())]),
  model: z.string(),
  feature: z.string(),
});

// Transcription
export const TranscriptionRequestSchema = z.object({
  audio: z.string(), // base64 encoded audio
  language: z.string().default('en'),
});

export const TranscriptionResponseSchema = z.object({
  text: z.string(),
  confidence: z.number().optional(),
  language: z.string(),
});

// Medication Formatting
export const MedicationFormatRequestSchema = z.object({
  medications: z.array(z.object({
    name: z.string(),
    dose: z.string().optional(),
    frequency: z.string().optional(),
    route: z.string().optional(),
  })),
  format: z.enum(['list', 'table', 'summary']).default('list'),
});

export const MedicationFormatResponseSchema = z.object({
  formatted: z.string(),
  categorized: z.object({
    infusions: z.array(z.string()),
    scheduled: z.array(z.string()),
    prn: z.array(z.string()),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type AIClinicalAssistantRequest = z.infer<typeof AIClinicalAssistantRequestSchema>;
export type AIClinicalAssistantResponse = z.infer<typeof AIClinicalAssistantResponseSchema>;
export type TranscriptionRequest = z.infer<typeof TranscriptionRequestSchema>;
export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;
export type MedicationFormatRequest = z.infer<typeof MedicationFormatRequestSchema>;
export type MedicationFormatResponse = z.infer<typeof MedicationFormatResponseSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  options?: { pagination?: PaginationInfo; duration?: number }
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: import.meta.env.VITE_API_VERSION || '1.0.0',
      requestId,
      ...(options?.pagination && { pagination: options.pagination }),
      ...(options?.duration && { duration: options.duration }),
    },
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      requestId,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: import.meta.env.VITE_API_VERSION || '1.0.0',
      requestId,
    },
  };
}

/**
 * Type guard for checking if response is an error
 */
export function isApiError<T>(response: ApiResponse<T>): response is ApiResponse<never> & { error: ApiError } {
  return !response.success && response.error !== undefined;
}

/**
 * Type guard for checking if response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
  return response.success && response.data !== undefined;
}
