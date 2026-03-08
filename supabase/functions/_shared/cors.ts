/**
 * Secure CORS Configuration for Edge Functions
 * 
 * SECURITY: Uses origin allowlist instead of wildcard (*) to prevent
 * cross-origin PHI exposure. Configure ALLOWED_ORIGINS in Supabase secrets.
 * 
 * For HIPAA compliance, origins must be explicitly whitelisted.
 * 
 * Best Practices Implemented:
 * - Specific origins only (no wildcard with credentials)
 * - Vary: Origin header for caching correctness
 * - Proper preflight handling with 204 status
 * - Security headers on all responses
 * - Environment-based origin configuration
 */

// Default allowed origins - override via ALLOWED_ORIGINS env var (comma-separated)
const DEFAULT_ALLOWED_ORIGINS = [
  // Local development
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
  // Production Vercel deployments
  'https://remix-of-remix-of-round-robin-notes.vercel.app',
  // Supabase dashboard (for testing)
  'https://supabase.com',
];

/**
 * Get allowed origins from environment or defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Standard CORS headers for all responses
 */
export const STANDARD_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-request-id',
  'x-supabase-client-platform',
  'x-supabase-client-platform-version',
  'x-supabase-client-runtime',
  'x-supabase-client-runtime-version',
].join(', ');

/**
 * Exposed headers that clients can access
 */
export const EXPOSED_HEADERS = [
  'x-request-id',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
].join(', ');

/**
 * Check if an origin is allowed
 * Supports exact matches, patterns, and subdomain wildcards
 */
function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();

  // Check explicit allowlist (exact match or prefix)
  if (allowedOrigins.some(allowed =>
    origin === allowed || origin.startsWith(allowed + '/')
  )) {
    return true;
  }

  // Check Vercel preview deployment patterns
  if (/^https:\/\/[a-z0-9-]+-nasher721(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) {
    return true;
  }
  if (/^https:\/\/remix-of-remix-of-round-robin-notes-.*\.vercel\.app$/.test(origin)) {
    return true;
  }

  // Check local development patterns (only in non-production)
  const isProduction = Deno.env.get('SUPABASE_URL')?.includes('qrlonfgafvyfqqtsasfc') ?? false;
  if (!isProduction) {
    if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
    if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  }

  return false;
}

/**
 * Get CORS headers for a specific request
 * Validates the origin against the allowlist
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/');

  // SECURITY: If origin is not allowed, return minimal headers
  // The browser will block the request due to missing Access-Control-Allow-Origin
  if (!origin || !isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      // Security headers still apply even for blocked origins
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Cache-Control': 'no-store',
      // IMPORTANT: Vary header ensures caches don't share responses across origins
      'Vary': 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': STANDARD_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': EXPOSED_HEADERS,
    'Access-Control-Max-Age': '86400', // 24 hours
    // Credentials support (required for cookies/auth headers)
    'Access-Control-Allow-Credentials': 'true',
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // IMPORTANT: Vary header ensures caches don't share responses across origins
    'Vary': 'Origin',
  };
}

/**
 * Handle OPTIONS preflight requests
 * Returns 204 No Content with CORS headers
 */
export function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

/**
 * Handle OPTIONS preflight with custom status code
 * Use for stricter preflight responses
 */
export function handlePreflight(request: Request, status: 204 | 200 = 204): Response {
  return new Response(null, {
    status,
    headers: getCorsHeaders(request),
  });
}

/**
 * Create a JSON response with CORS headers
 * Use this for all Edge Function responses
 */
export function jsonResponse(
  request: Request,
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a success JSON response
 */
export function successResponse<T>(
  request: Request,
  data: T,
  status = 200
): Response {
  return jsonResponse(request, { success: true, data }, status);
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  request: Request,
  message: string,
  status = 500,
  code?: string
): Response {
  return jsonResponse(request, { 
    error: message, 
    success: false,
    ...(code && { code }),
  }, status);
}

/**
 * Create a 403 Forbidden response for disallowed origins
 */
export function forbiddenResponse(request: Request): Response {
  return new Response(
    JSON.stringify({ error: 'Origin not allowed', success: false, code: 'FORBIDDEN_ORIGIN' }),
    {
      status: 403,
      headers: {
        ...getCorsHeaders(request),
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Backward-compatible alias for getCorsHeaders
 * @deprecated Use getCorsHeaders directly
 */
export { getCorsHeaders as corsHeaders };
