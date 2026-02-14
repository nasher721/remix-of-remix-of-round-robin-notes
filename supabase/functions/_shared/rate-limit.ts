/**
 * Simple In-Memory Rate Limiting for Edge Functions
 * 
 * Provides basic rate limiting to prevent abuse.
 * Note: This is per-instance rate limiting. For production-scale
 * distributed rate limiting, consider using Redis or Supabase Edge Config.
 * 
 * Usage:
 *   import { checkRateLimit, RateLimitConfig } from '../_shared/rate-limit.ts';
 *   
 *   const rateLimitResult = await checkRateLimit(req, rateLimits.ai);
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response;
 *   }
 */

import { errorResponse } from "./cors.ts";

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Prefix for rate limit key
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  // AI endpoints are expensive - stricter limits
  ai: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 20,          // 20 requests per minute
    keyPrefix: 'ai',
  } as RateLimitConfig,
  
  // Transcription is very expensive
  transcription: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 10,          // 10 transcriptions per minute
    keyPrefix: 'transcribe',
  } as RateLimitConfig,
  
  // Standard endpoints
  standard: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 60,          // 60 requests per minute
    keyPrefix: 'std',
  } as RateLimitConfig,
  
  // Parse operations (can be expensive)
  parse: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 15,          // 15 parse operations per minute
    keyPrefix: 'parse',
  } as RateLimitConfig,
};

// In-memory store for rate limiting
// Note: Each Edge Function instance has its own memory
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Get client identifier for rate limiting
 * Uses user ID if authenticated, otherwise IP address
 */
function getClientIdentifier(req: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  
  // Try various headers for client IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return `ip:${forwardedFor.split(',')[0].trim()}`;
  }
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return `ip:${realIp}`;
  }
  
  // Fallback to connection info
  return 'ip:unknown';
}

export interface RateLimitResult {
  allowed: boolean;
  response?: Response;
  remaining?: number;
  resetTime?: number;
}

/**
 * Check if request should be rate limited
 * 
 * @param req - The incoming Request
 * @param config - Rate limit configuration
 * @param userId - Optional authenticated user ID
 * @returns RateLimitResult indicating if allowed and remaining quota
 */
export function checkRateLimit(
  req: Request,
  config: RateLimitConfig,
  userId?: string
): RateLimitResult {
  const clientId = getClientIdentifier(req, userId);
  const key = `${config.keyPrefix || 'default'}:${clientId}`;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  // Check if window has expired or no entry exists
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter,
          success: false,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        }
      ),
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Higher-order function to wrap Edge Function handlers with rate limiting
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const rateLimitResult = checkRateLimit(req, config);
    
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }
    
    return handler(req);
  };
}
