/**
 * Centralized API Error Handler
 * 
 * Provides consistent error handling, user-friendly messages,
 * retry logic, and proper logging for all API operations.
 * 
 * @module api-error-handler
 */

import { toast } from 'sonner';
import { logger } from './logger';

/**
 * Standard API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
  retryable: boolean;
}

/**
 * Supabase error codes mapped to user-friendly messages
 */
const SUPABASE_ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  'invalid_credentials': 'Invalid email or password. Please try again.',
  'email_not_confirmed': 'Please verify your email address before signing in.',
  'user_not_found': 'No account found with this email address.',
  'invalid_grant': 'Your session has expired. Please sign in again.',
  'signup_disabled': 'New account registration is currently disabled.',
  'email_exists': 'An account with this email already exists.',
  'weak_password': 'Password is too weak. Please use a stronger password.',
  
  // Database errors
  'PGRST116': 'No data found.',
  'PGRST301': 'Connection failed. Please check your internet connection.',
  '23505': 'This record already exists.',
  '23503': 'Cannot complete this action due to related data.',
  '42501': 'You do not have permission to perform this action.',
  '42P01': 'The requested resource does not exist.',
  
  // Network errors
  'NETWORK_ERROR': 'Network connection failed. Please check your internet.',
  'TIMEOUT': 'Request timed out. Please try again.',
  'RATE_LIMITED': 'Too many requests. Please wait a moment and try again.',
  
  // Row Level Security
  'new row violates row-level security': 'You do not have permission to create this record.',
  'violates row-level security': 'You do not have permission to access this record.',
};

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('fetch failed')
    );
  }
  return false;
}

/**
 * Extracts error code from various error formats
 */
function extractErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    return (
      (err.code as string) ||
      (err.error_code as string) ||
      (err.status as string) ||
      'UNKNOWN_ERROR'
    );
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Gets a user-friendly message for an error
 */
function getUserFriendlyMessage(error: unknown): string {
  const code = extractErrorCode(error);
  
  // Check for exact code match
  if (SUPABASE_ERROR_MESSAGES[code]) {
    return SUPABASE_ERROR_MESSAGES[code];
  }
  
  // Check error message for partial matches
  if (error instanceof Error) {
    for (const [key, message] of Object.entries(SUPABASE_ERROR_MESSAGES)) {
      if (error.message.includes(key)) {
        return message;
      }
    }
  }
  
  // Default message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Parses any error into a standardized ApiError
 */
export function parseApiError(error: unknown): ApiError {
  const code = extractErrorCode(error);
  const message = getUserFriendlyMessage(error);
  const retryable = isRetryableError(error);
  
  let status: number | undefined;
  let details: unknown;
  
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    status = typeof err.status === 'number' ? err.status : undefined;
    details = err.details || err.hint || err.message;
  }
  
  return { code, message, details, status, retryable };
}

/**
 * Options for API error handling
 */
export interface HandleApiErrorOptions {
  /** Show toast notification to user */
  showToast?: boolean;
  /** Custom error message to show */
  customMessage?: string;
  /** Context for logging (e.g., 'patient.create') */
  context?: string;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    delayMs: number;
    onRetry?: (attempt: number) => void;
  };
}

/**
 * Main error handler for API operations
 */
export function handleApiError(
  error: unknown,
  options: HandleApiErrorOptions = {}
): ApiError {
  const { showToast = true, customMessage, context = 'api' } = options;
  
  const apiError = parseApiError(error);
  
  // Log the error
  logger.error(`API Error [${context}]`, {
    code: apiError.code,
    message: apiError.message,
    details: apiError.details,
    status: apiError.status,
    retryable: apiError.retryable,
  });
  
  // Show toast notification
  if (showToast) {
    toast.error(customMessage || apiError.message, {
      description: apiError.retryable ? 'You can try again.' : undefined,
    });
  }
  
  return apiError;
}

/**
 * Wraps an async function with automatic error handling and retry logic
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: HandleApiErrorOptions = {}
): Promise<T> {
  const { retry } = options;
  let lastError: unknown;
  
  const maxAttempts = retry?.maxAttempts ?? 1;
  const delayMs = retry?.delayMs ?? 1000;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const apiError = parseApiError(error);
      
      // Only retry if error is retryable and we have attempts left
      if (apiError.retryable && attempt < maxAttempts) {
        logger.warn(`Retrying request (attempt ${attempt + 1}/${maxAttempts})`, {
          context: options.context,
        });
        
        retry?.onRetry?.(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      
      // No more retries, handle the error
      handleApiError(error, options);
      throw error;
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Creates a typed error handler for specific API operations
 */
export function createApiErrorHandler(defaultContext: string) {
  return {
    handle: (error: unknown, options?: Omit<HandleApiErrorOptions, 'context'>) =>
      handleApiError(error, { ...options, context: defaultContext }),
    
    wrap: <T>(fn: () => Promise<T>, options?: Omit<HandleApiErrorOptions, 'context'>) =>
      withErrorHandling(fn, { ...options, context: defaultContext }),
  };
}

// Pre-configured error handlers for common operations
export const patientErrorHandler = createApiErrorHandler('patient');
export const autotextErrorHandler = createApiErrorHandler('autotext');
export const phraseErrorHandler = createApiErrorHandler('phrase');
export const authErrorHandler = createApiErrorHandler('auth');
