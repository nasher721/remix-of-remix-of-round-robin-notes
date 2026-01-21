/**
 * Rate Limiting Utility
 * 
 * Provides client-side rate limiting for API calls to prevent abuse
 * and protect against accidental flooding.
 * 
 * @module rate-limiter
 */

import { logger } from './logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitState {
  requests: number[];
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

/**
 * Simple token bucket rate limiter
 */
class RateLimiter {
  private buckets: Map<string, RateLimitState> = new Map();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a request is allowed under the rate limit
   */
  isAllowed(key: string = 'default'): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key) || { requests: [] };

    // Remove expired requests
    bucket.requests = bucket.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    if (bucket.requests.length >= this.config.maxRequests) {
      logger.warn('Rate limit exceeded', { key, requests: bucket.requests.length });
      return false;
    }

    bucket.requests.push(now);
    this.buckets.set(key, bucket);
    return true;
  }

  /**
   * Get remaining requests in the current window
   */
  getRemaining(key: string = 'default'): number {
    const now = Date.now();
    const bucket = this.buckets.get(key) || { requests: [] };
    
    const validRequests = bucket.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    return Math.max(0, this.config.maxRequests - validRequests.length);
  }

  /**
   * Get time until the rate limit resets (in ms)
   */
  getResetTime(key: string = 'default'): number {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.requests.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...bucket.requests);
    const resetTime = oldestRequest + this.config.windowMs - Date.now();
    return Math.max(0, resetTime);
  }

  /**
   * Reset the rate limit for a key
   */
  reset(key: string = 'default'): void {
    this.buckets.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.buckets.clear();
  }
}

// Pre-configured rate limiters for different use cases
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 100 requests per minute
});

export const authRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000, // 5 auth attempts per minute
});

export const mutationRateLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60000, // 30 mutations per minute
});

/**
 * Wrapper function that enforces rate limiting
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  limiter: RateLimiter = apiRateLimiter,
  key: string = 'default'
): Promise<T> {
  if (!limiter.isAllowed(key)) {
    const resetTime = limiter.getResetTime(key);
    throw new Error(
      `Rate limit exceeded. Please wait ${Math.ceil(resetTime / 1000)} seconds.`
    );
  }

  return fn();
}

/**
 * Create a rate-limited version of a function
 */
export function createRateLimitedFn<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  limiter: RateLimiter = apiRateLimiter,
  key?: string
): T {
  return ((...args: Parameters<T>) => {
    const limitKey = key || fn.name || 'anonymous';
    return withRateLimit(() => fn(...args), limiter, limitKey);
  }) as T;
}

export { RateLimiter };
export type { RateLimitConfig };
