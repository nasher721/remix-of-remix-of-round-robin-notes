import { TimeoutError } from '@/lib/requestTimeout';

/**
 * Normalize technical/runtime errors into user-actionable messages.
 */
export function getUserFacingErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof TimeoutError) {
    return 'This request is taking longer than expected. Please try again.';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Network error. Check your connection and try again.';
    }

    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'You do not have permission to perform this action.';
    }

    if (error.message.trim().length > 0) {
      return error.message;
    }
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

