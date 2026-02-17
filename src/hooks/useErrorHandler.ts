import { toast } from "@/hooks/use-toast";

interface ErrorHandlerOptions {
  title?: string;
  description?: string;
  duration?: number;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}

/**
 * Standalone error handler – can be used outside of React components.
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}) {
  const {
    title = 'Something went wrong',
    description = options.description || getErrorMessage(error),
    duration = 5000,
  } = options;

  console.error('[ErrorHandler]', error);

  toast({
    title,
    description,
    variant: "destructive",
    duration,
  });
}

/**
 * React hook version – returns the same handleError function.
 * Prefer this when inside a component for consistency.
 */
export function useErrorHandler() {
  return handleError;
}

export function showSuccess(message: string, title = 'Success') {
  toast({
    title,
    description: message,
    duration: 3000,
  });
}

export function showInfo(message: string, title = 'Notice') {
  toast({
    title,
    description: message,
    duration: 4000,
  });
}
