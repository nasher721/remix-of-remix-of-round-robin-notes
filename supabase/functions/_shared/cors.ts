/**
 * Secure CORS Configuration for Edge Functions
 * 
 * SECURITY: Uses origin allowlist instead of wildcard (*) to prevent
 * cross-origin PHI exposure. Configure ALLOWED_ORIGINS in Supabase secrets.
 * 
 * For HIPAA compliance, origins must be explicitly whitelisted.
 */

// Default allowed origins - override via ALLOWED_ORIGINS env var (comma-separated)
const DEFAULT_ALLOWED_ORIGINS = [
  // Local development
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  // Production - add your Vercel domain here
  // 'https://your-app.vercel.app',
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
  'x-supabase-client-platform',
  'x-supabase-client-platform-version',
  'x-supabase-client-runtime',
  'x-supabase-client-runtime-version',
].join(', ');

/**
 * Get CORS headers for a specific request
 * Validates the origin against the allowlist
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/');
  const allowedOrigins = getAllowedOrigins();
  
  // Check if origin is allowed
  const isAllowed = origin && (
    // Check explicit allowlist
    allowedOrigins.some(allowed => 
      origin === allowed || origin.startsWith(allowed + '/')
    )
  );
  
  // SECURITY: If origin is not allowed, return NO CORS headers
  // Browser will block the request. This prevents cross-origin PHI exposure.
  if (!isAllowed) {
    return {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      // Intentionally NO Access-Control-Allow-Origin - browser blocks request
    };
  }
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': STANDARD_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
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
 * Create an error response with CORS headers
 */
export function errorResponse(
  request: Request,
  message: string,
  status = 500
): Response {
  return jsonResponse(request, { error: message, success: false }, status);
}
