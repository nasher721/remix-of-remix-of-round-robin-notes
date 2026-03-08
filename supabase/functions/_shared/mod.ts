export {
  authenticateRequest,
  logAuthEvent,
  verifyUserRole,
  type AuthResult,
} from './auth.ts';

export {
  getCorsHeaders,
  corsHeaders,
  handleOptions,
  handlePreflight,
  jsonResponse,
  successResponse,
  errorResponse,
  forbiddenResponse,
  STANDARD_HEADERS,
  EXPOSED_HEADERS,
} from './cors.ts';

export {
  MissingAPIKeyError,
  LLMProviderError,
} from './llm-client.ts';

export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
  const sanitizedData = data ? sanitizeForLogging(data) : undefined;
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(sanitizedData && { data: sanitizedData }),
  }));
}

function sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
  const redactedKeys = ['password', 'token', 'secret', 'ssn', 'dob', 'mrn', 'patient_name', 'diagnosis', 'transcript'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (redactedKeys.some(k => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export {
  checkRateLimit,
  withRateLimit,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limit.ts';

export {
  parseAndValidateBody,
  requireString,
  optionalString,
  requireEnum,
  validateStringArray,
  validateImageArray,
  safeErrorMessage,
  requireMethod,
  ALLOWED_TRANSFORM_TYPES,
  ALLOWED_TODO_SECTIONS,
  MAX_JSON_PAYLOAD_BYTES,
  MAX_MEDIA_PAYLOAD_BYTES,
  type ValidationResult,
} from './input-validation.ts';

// Backward-compatible aliases (deprecated, use direct exports)
/** @deprecated Use handleOptions directly */
export { handleOptions as createCorsResponse } from './cors.ts';

export {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  createUnauthorizedResponse,
  createRateLimitResponse,
  parseBody,
  createPaginationInfo,
  generateRequestId,
  getApiVersion,
  isApiError,
  isApiSuccess,
  type ApiResponse,
  type ApiError,
  type ApiMetadata,
  type PaginationInfo,
  type ErrorCode,
} from './api-response.ts';

export {
  validateString,
  validateEnum,
  validateBoolean,
  validateNumber,
  validateObject,
  validateArray,
  validateOptional,
  validateSchema,
  formatValidationErrors,
  ClinicalContextSchema,
  AIClinicalAssistantSchema,
  TranscriptionRequestSchema,
  AI_FEATURES,
  type AIFeature,
  type ValidationError,
  type ValidationResult,
  type ObjectSchema,
  type Validator,
} from './validation.ts';
