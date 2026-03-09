type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

const APP_NAME = 'round-robin-notes';
const SESSION_STORAGE_KEY = 'observability.sessionId';

function getSessionId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const generated = globalThis.crypto?.randomUUID?.() ?? `session_${Date.now()}`;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `session_${Date.now()}`;
  }
}

function basePayload() {
  return {
    app: APP_NAME,
    env: import.meta.env.MODE ?? 'unknown',
    sessionId: getSessionId(),
  };
}

function emitLog(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...basePayload(),
    context,
  };

  const line = JSON.stringify(payload);

  switch (level) {
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
    default:
      console.log(line);
  }
}

export function logInfo(message: string, context?: LogContext) {
  emitLog('info', message, context);
}

export function logWarn(message: string, context?: LogContext) {
  emitLog('warn', message, context);
}

export function logError(message: string, context?: LogContext) {
  emitLog('error', message, context);
}

export function logMetric(
  name: string,
  value: number,
  unit: string,
  context: LogContext = {}
) {
  emitLog('info', 'metric', {
    metric: { name, value, unit },
    ...context,
    type: 'metric',
  });
}
