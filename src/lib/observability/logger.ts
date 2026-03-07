import { captureException, addBreadcrumb } from './sentry';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext extends Record<string, unknown> {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  source: string;
}

const APP_NAME = 'round-robin-notes';
const SESSION_STORAGE_KEY = 'observability.sessionId';
const CORRELATION_ID_KEY = 'observability.correlationId';

// In-memory log buffer for recent logs (useful for debugging)
const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

/**
 * Get or generate a session ID for the current browser session
 */
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const generated = generateId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `session_${Date.now()}`;
  }
}

/**
 * Generate a correlation ID for tracking requests across components
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the current correlation ID or generate a new one
 */
export function getCorrelationId(): string {
  if (typeof window === 'undefined') {
    return generateCorrelationId();
  }

  try {
    const existing = window.sessionStorage.getItem(CORRELATION_ID_KEY);
    if (existing) return existing;

    const generated = generateCorrelationId();
    window.sessionStorage.setItem(CORRELATION_ID_KEY, generated);
    return generated;
  } catch {
    return generateCorrelationId();
  }
}

/**
 * Set a correlation ID for the current operation
 */
export function setCorrelationId(id: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(CORRELATION_ID_KEY, id);
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Clear the current correlation ID
 */
export function clearCorrelationId(): void {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(CORRELATION_ID_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create the base payload for all log entries
 */
function createBasePayload(): Omit<LogEntry, 'level' | 'message' | 'context'> {
  return {
    timestamp: new Date().toISOString(),
    source: APP_NAME,
  };
}

/**
 * Enrich context with standard fields
 */
function enrichContext(context: LogContext = {}): LogContext {
  return {
    ...context,
    correlationId: context.correlationId || getCorrelationId(),
    sessionId: getSessionId(),
    env: import.meta.env.MODE ?? 'unknown',
    version: import.meta.env.VITE_APP_VERSION ?? 'unknown',
  };
}

/**
 * Emit a log entry to all configured destinations
 */
function emitLog(level: LogLevel, message: string, context: LogContext = {}): void {
  const enrichedContext = enrichContext(context);
  const entry: LogEntry = {
    ...createBasePayload(),
    level,
    message,
    context: enrichedContext,
  };

  // Add to buffer
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Format for console output
  const formattedMessage = formatLogEntry(entry);

  // Output to console
  switch (level) {
    case 'fatal':
    case 'error':
      console.error(formattedMessage, context);
      break;
    case 'warn':
      console.warn(formattedMessage, context);
      break;
    case 'debug':
      if (import.meta.env.DEV) {
        console.debug(formattedMessage, context);
      }
      break;
    default:
      console.log(formattedMessage, context);
  }

  // Send to Sentry for error levels
  if (level === 'error' || level === 'fatal') {
    addBreadcrumb(message, context.component, 'error', context);
  }

  // Could also send to external logging service here
  // sendToLogService(entry);
}

/**
 * Format a log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, message, source, context } = entry;
  const correlationId = context.correlationId?.slice(-8) ?? 'none';
  return `[${timestamp}] [${level.toUpperCase()}] [${source}] [${correlationId}] ${message}`;
}

/**
 * Get recent logs from the buffer (useful for debugging)
 */
export function getRecentLogs(count = 50): LogEntry[] {
  return logBuffer.slice(-count);
}

/**
 * Clear the log buffer
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

// Public logging functions

export function logDebug(message: string, context?: LogContext): void {
  emitLog('debug', message, context);
}

export function logInfo(message: string, context?: LogContext): void {
  emitLog('info', message, context);
}

export function logWarn(message: string, context?: LogContext): void {
  emitLog('warn', message, context);
}

export function logError(message: string, context?: LogContext): void {
  emitLog('error', message, context);
  
  // Also capture in Sentry with more context
  if (context?.error instanceof Error) {
    captureException(context.error, {
      tags: { component: context.component, action: context.action },
      extra: context,
    });
  }
}

export function logFatal(message: string, context?: LogContext): void {
  emitLog('fatal', message, context);
  
  // Fatal errors should always go to Sentry
  const error = context?.error instanceof Error 
    ? context.error 
    : new Error(message);
  captureException(error, {
    tags: { level: 'fatal', component: context?.component },
    extra: context,
  });
}

/**
 * Log a metric with optional context
 */
export function logMetric(
  name: string,
  value: number,
  unit: string,
  context?: Omit<LogContext, 'metric'>
): void {
  emitLog('info', `Metric: ${name}`, {
    ...context,
    metric: { name, value, unit },
    type: 'metric',
  });
}

/**
 * Log an API call with timing
 */
export function logApiCall(
  endpoint: string,
  method: string,
  duration: number,
  statusCode?: number,
  error?: Error,
  context?: LogContext
): void {
  const level = error ? 'error' : statusCode && statusCode >= 400 ? 'warn' : 'info';
  
  emitLog(level, `API ${method} ${endpoint}`, {
    ...context,
    api: { endpoint, method, duration, statusCode },
    error: error?.message,
    type: 'api_call',
  });
}

/**
 * Log a user action for analytics
 */
export function logUserAction(
  action: string,
  category: string,
  context?: LogContext
): void {
  emitLog('info', `User Action: ${action}`, {
    ...context,
    action,
    category,
    type: 'user_action',
  });
}

/**
 * Create a child logger with preset context
 */
export function createLogger(component: string, baseContext?: LogContext) {
  return {
    debug: (message: string, context?: LogContext) => 
      logDebug(message, { ...baseContext, ...context, component }),
    info: (message: string, context?: LogContext) => 
      logInfo(message, { ...baseContext, ...context, component }),
    warn: (message: string, context?: LogContext) => 
      logWarn(message, { ...baseContext, ...context, component }),
    error: (message: string, context?: LogContext) => 
      logError(message, { ...baseContext, ...context, component }),
    fatal: (message: string, context?: LogContext) => 
      logFatal(message, { ...baseContext, ...context, component }),
    metric: (name: string, value: number, unit: string, context?: LogContext) => 
      logMetric(name, value, unit, { ...baseContext, ...context, component }),
    apiCall: (endpoint: string, method: string, duration: number, statusCode?: number, error?: Error, context?: LogContext) =>
      logApiCall(endpoint, method, duration, statusCode, error, { ...baseContext, ...context, component }),
    userAction: (action: string, category: string, context?: LogContext) =>
      logUserAction(action, category, { ...baseContext, ...context, component }),
  };
}

// Re-export Sentry functions for convenience
export { captureException, addBreadcrumb };
