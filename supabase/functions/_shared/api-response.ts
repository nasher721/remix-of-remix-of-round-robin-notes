/**
 * Standardized API Response Utilities for Edge Functions
 * 
 * Provides consistent response formatting across all Edge Functions.
 */

// Error codes
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'PATIENT_NOT_FOUND'
  | 'INVALID_PHRASE'
  | 'AI_PROCESSING_ERROR'
  | 'FHIR_CONNECTION_ERROR';

// HTTP status mapping
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
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

// API error structure
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

// Pagination info
export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// API metadata
export interface ApiMetadata {
  timestamp: string;
  version: string;
  requestId: string;
  pagination?: PaginationInfo;
  duration?: number;
}

// Standard API response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ApiMetadata;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the API version from environment
 */
export function getApiVersion(): string {
  return Deno.env.get('API_VERSION') || '1.0.0';
}

/**
 * Create metadata for a response
 */
export function createMetadata(
  requestId: string,
  options?: { pagination?: PaginationInfo; duration?: number }
): ApiMetadata {
  return {
    timestamp: new Date().toISOString(),
    version: getApiVersion(),
    requestId,
    ...(options?.pagination && { pagination: options.pagination }),
    ...(options?.duration && { duration: options.duration }),
  };
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  request: Request,
  data: T,
  options?: { 
    pagination?: PaginationInfo; 
    duration?: number;
    status?: number;
    headers?: Record<string, string>;
  }
): Response {
  const requestId = request.headers.get('x-request-id') || generateRequestId();
  
  const body: ApiResponse<T> = {
    success: true,
    data,
    meta: createMetadata(requestId, options),
  };

  return new Response(JSON.stringify(body), {
    status: options?.status || 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...options?.headers,
    },
  });
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  request: Request,
  code: ErrorCode,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    headers?: Record<string, string>;
  }
): Response {
  const requestId = request.headers.get('x-request-id') || generateRequestId();
  const status = ERROR_STATUS_MAP[code] || 500;
  
  const body: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
      requestId,
      ...options?.details && { details: options.details },
    },
    meta: createMetadata(requestId),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...options?.headers,
    },
  });
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  request: Request,
  errors: Record<string, string[]>
): Response {
  return createErrorResponse(request, 'VALIDATION_ERROR', 'Validation failed', {
    details: { errors },
  });
}

/**
 * Create a not found error response
 */
export function createNotFoundResponse(
  request: Request,
  resource: string,
  id?: string
): Response {
  return createErrorResponse(
    request,
    'NOT_FOUND',
    id ? `${resource} with id '${id}' not found` : `${resource} not found`
  );
}

/**
 * Create an unauthorized error response
 */
export function createUnauthorizedResponse(
  request: Request,
  message = 'Authentication required'
): Response {
  return createErrorResponse(request, 'UNAUTHORIZED', message);
}

/**
 * Create a rate limit error response
 */
export function createRateLimitResponse(
  request: Request,
  retryAfter: number
): Response {
  return createErrorResponse(request, 'RATE_LIMITED', 'Rate limit exceeded', {
    headers: { 'Retry-After': String(retryAfter) },
    details: { retryAfter },
  });
}

/**
 * Create pagination info from query results
 */
export function createPaginationInfo(
  page: number,
  perPage: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / perPage);
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Parse and validate request body
 */
export async function parseBody<T>(
  request: Request
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
  try {
    const contentType = request.headers.get('content-type');
    
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        response: createErrorResponse(
          request,
          'BAD_REQUEST',
          'Content-Type must be application/json'
        ),
      };
    }

    const text = await request.text();
    
    if (!text) {
      return {
        success: false,
        response: createErrorResponse(
          request,
          'BAD_REQUEST',
          'Request body is required'
        ),
      };
    }

    try {
      const data = JSON.parse(text);
      return { success: true, data: data as T };
    } catch {
      return {
        success: false,
        response: createErrorResponse(
          request,
          'BAD_REQUEST',
          'Invalid JSON in request body'
        ),
      };
    }
  } catch (error) {
    return {
      success: false,
      response: createErrorResponse(
        request,
        'BAD_REQUEST',
        `Failed to parse request body: ${error instanceof Error ? error.message : 'Unknown error'}`
      ),
    };
  }
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
