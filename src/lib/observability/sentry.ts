import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Call this once at app startup.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking is disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || 'development',

    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Error sampling
    sampleRate: 1.0,

    // Enable debug mode in development
    debug: import.meta.env.DEV,

    // Before sending, sanitize any potential PHI
    beforeSend(event, hint) {
      // Filter out specific errors that aren't actionable
      if (shouldIgnoreError(event)) {
        return null;
      }

      // Sanitize sensitive data
      return sanitizeEvent(event);
    },

    // Configure which integrations to enable
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Replay sampling
    replaysSessionSampleRate: 0.0, // Disabled by default
    replaysOnErrorSampleRate: 0.1, // Sample 10% of errors
  });
}

/**
 * Determine if an error should be ignored (not sent to Sentry)
 */
function shouldIgnoreError(event: Sentry.ErrorEvent): boolean {
  const errorMessage = event.exception?.values?.[0]?.value || '';

  // Ignore common non-actionable errors
  const ignoredPatterns = [
    /ResizeObserver loop limit exceeded/i,
    /Network request failed/i,
    /Failed to fetch/i,
    /AbortError/i,
    /The operation was aborted/i,
  ];

  return ignoredPatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Sanitize event data to remove potential PHI
 */
function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const sanitized = { ...event };

  // Sanitize request URL
  if (sanitized.request?.url) {
    sanitized.request.url = sanitizeUrl(sanitized.request.url);
  }

  // Sanitize breadcrumbs
  if (sanitized.breadcrumbs) {
    sanitized.breadcrumbs = sanitized.breadcrumbs.map(crumb => ({
      ...crumb,
      message: crumb.message ? sanitizeString(crumb.message) : undefined,
      data: crumb.data ? sanitizeObject(crumb.data) : undefined,
    }));
  }

  // Sanitize extra context
  if (sanitized.extra) {
    sanitized.extra = sanitizeObject(sanitized.extra);
  }

  return sanitized;
}

/**
 * Sanitize a URL by removing potential patient identifiers
 */
function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove query parameters that might contain PHI
    const sensitiveParams = ['patient_id', 'mrn', 'name', 'email'];
    sensitiveParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Sanitize a string by removing potential PHI patterns
 */
function sanitizeString(str: string): string {
  // Remove MRN patterns (common formats)
  let sanitized = str.replace(/\bMRN\d{6,10}\b/gi, '[REDACTED_MRN]');

  // Remove email addresses
  sanitized = sanitized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[REDACTED_EMAIL]');

  // Remove phone numbers
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED_PHONE]');

  return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  const MAX_DEPTH = 10;
  if (depth >= MAX_DEPTH) {
    return { _truncated: '[max depth reached]' };
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys entirely
    const sensitiveKeys = ['password', 'token', 'ssn', 'mrn', 'dob', 'birthdate'];
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Set user context for Sentry (with PII stripped)
 */
export function setSentryUser(user: { id: string; email?: string } | null) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    // Don't include email to avoid PII issues
    // segment users by hash of ID for analytics
    segment: hashUserId(user.id),
  });
}

/**
 * Create a simple hash of user ID for segmentation
 */
function hashUserId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `segment_${Math.abs(hash) % 10}`;
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data: data ? sanitizeObject(data) : undefined,
  });
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
) {
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra ? sanitizeObject(context.extra) : undefined,
  });
}

/**
 * Start a performance span
 */
export function startTransaction(name: string, op: string) {
  // In Sentry v8+, startTransaction is replaced with startInactiveSpan
  return Sentry.startInactiveSpan({ name, op });
}
