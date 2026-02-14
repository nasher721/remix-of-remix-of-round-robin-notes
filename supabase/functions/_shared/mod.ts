export {
  authenticateRequest,
  logAuthEvent,
  verifyUserRole,
  type AuthResult,
} from './auth.ts';

export {
  getCorsHeaders,
  handleOptions,
  jsonResponse,
  errorResponse,
  STANDARD_HEADERS,
} from './cors.ts';

export { getCorsHeaders as corsHeaders } from './cors.ts';
export { errorResponse as createErrorResponse } from './cors.ts';
export { handleOptions as createCorsResponse } from './cors.ts';

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


