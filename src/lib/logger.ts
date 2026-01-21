/**
 * Production-Ready Logging Infrastructure
 * 
 * Provides structured logging with different levels,
 * contextual metadata, and environment-aware output.
 * 
 * @module logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
}

interface LoggerOptions {
  /** Context identifier for this logger instance */
  context?: string;
  /** Minimum log level to output */
  minLevel?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if running in development mode
 */
const isDev = import.meta.env.DEV;

/**
 * Storage for log entries (used for debugging and crash reports)
 */
const logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Formats a log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const contextStr = entry.context ? `[${entry.context}]` : '';
  return `${entry.timestamp} ${entry.level.toUpperCase()}${contextStr}: ${entry.message}`;
}

/**
 * Stores log entry in buffer for later retrieval
 */
function bufferLog(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

/**
 * Creates a log entry object
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
  context?: string
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    metadata,
    stack: level === 'error' ? new Error().stack : undefined,
  };
}

/**
 * Main Logger class
 */
class Logger {
  private context?: string;
  private minLevel: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.context = options.context;
    this.minLevel = options.minLevel ?? (isDev ? 'debug' : 'info');
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  /**
   * Output a log entry to the appropriate destination
   */
  private output(entry: LogEntry): void {
    // Always buffer for crash reports
    bufferLog(entry);

    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formatted = formatLogEntry(entry);

    // In development, use colored console output
    if (isDev) {
      const styles: Record<LogLevel, string> = {
        debug: 'color: gray',
        info: 'color: blue',
        warn: 'color: orange',
        error: 'color: red; font-weight: bold',
      };

      console[entry.level](
        `%c${formatted}`,
        styles[entry.level],
        entry.metadata || ''
      );
    } else {
      // In production, use structured JSON logging
      // This can be picked up by monitoring services
      const structuredLog = {
        ...entry,
        environment: 'production',
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      if (entry.level === 'error') {
        console.error(JSON.stringify(structuredLog));
      } else if (entry.level === 'warn') {
        console.warn(JSON.stringify(structuredLog));
      }
      // In production, we only output warn and error to console
    }
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('debug', message, metadata, this.context);
    this.output(entry);
  }

  /**
   * Log an informational message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('info', message, metadata, this.context);
    this.output(entry);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('warn', message, metadata, this.context);
    this.output(entry);
  }

  /**
   * Log an error message
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('error', message, metadata, this.context);
    this.output(entry);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    const parentContext = this.context ? `${this.context}.${context}` : context;
    return new Logger({ context: parentContext, minLevel: this.minLevel });
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a contextual logger for a specific module
 */
export function createLogger(context: string): Logger {
  return new Logger({ context });
}

/**
 * Get buffered logs for crash reports or debugging
 */
export function getLogBuffer(): ReadonlyArray<LogEntry> {
  return [...logBuffer];
}

/**
 * Clear the log buffer
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

/**
 * Track a user action for analytics
 */
export function trackAction(action: string, properties?: Record<string, unknown>): void {
  logger.info(`Action: ${action}`, { action, properties, type: 'user_action' });
}

/**
 * Track a performance metric
 */
export function trackPerformance(
  metric: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  logger.debug(`Performance: ${metric} took ${durationMs}ms`, {
    metric,
    durationMs,
    type: 'performance',
    ...metadata,
  });
}
