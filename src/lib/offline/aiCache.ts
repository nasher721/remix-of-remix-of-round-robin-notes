/**
 * AI Response Caching Service
 * Caches AI responses in IndexedDB to reduce redundant API calls
 * 
 * Features:
 * - Query hashing for cache keys
 * - TTL-based expiration
 * - Hit count tracking for cache analytics
 * - Feature-based cache invalidation
 */

import { db, type AICacheEntry } from './database';
import { logInfo, logError } from '@/lib/observability/logger';
// Configuration
// ============================================

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_SIZE = 500;

/**
 * Cache configuration by feature
 */
const CACHE_CONFIG: Record<string, { ttl: number; enabled: boolean }> = {
  'clinical-assistant': { ttl: DEFAULT_TTL_MS, enabled: true },
  'transform-text': { ttl: 5 * 60 * 1000, enabled: true }, // 5 min for text transforms
  'format-medications': { ttl: 30 * 60 * 1000, enabled: true }, // 30 min for meds
  'generate-todos': { ttl: 10 * 60 * 1000, enabled: true }, // 10 min for todos
  'generate-daily-summary': { ttl: 30 * 60 * 1000, enabled: true },
  'generate-interval-events': { ttl: 15 * 60 * 1000, enabled: true },
  'generate-patient-course': { ttl: 60 * 60 * 1000, enabled: true }, // 1 hour
  'parse-handoff': { ttl: 10 * 60 * 1000, enabled: true },
  'parse-single-patient': { ttl: 15 * 60 * 1000, enabled: true },
  'transcribe-audio': { ttl: 0, enabled: false }, // Don't cache transcriptions
};

// ============================================
// Hash Functions
// ============================================

/**
 * Generate a deterministic hash for a query
 * Uses a simple but effective hashing approach
 */
function generateQueryHash(query: string, context?: Record<string, unknown>): string {
  const normalized = JSON.stringify({ q: query.toLowerCase().trim(), c: context || {} });
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate full cache key
 */
function generateCacheKey(feature: string, query: string, context?: Record<string, unknown>): string {
  const hash = generateQueryHash(query, context);
  return `${feature}:${hash}`;
}

// ============================================
// Cache Operations
// ============================================

/**
 * Get cached response if available and not expired
 */
export async function getCachedResponse(
  feature: string,
  query: string,
  context?: Record<string, unknown>
): Promise<string | null> {
  const config = CACHE_CONFIG[feature];
  
  // Check if caching is enabled for this feature
  if (!config?.enabled) {
    return null;
  }
  
  const cacheKey = generateCacheKey(feature, query, context);
  
  try {
    const cached = await db.aiCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      // Clean up expired entry
      await db.aiCache.delete(cacheKey);
      logInfo('Expired entry removed', { feature, source: 'AICache' });
      return null;
    }
    
    // Increment hit count
    await db.aiCache.update(cacheKey, { hitCount: cached.hitCount + 1 });
    
    logInfo('Cache HIT', { feature, hits: cached.hitCount + 1, source: 'AICache' });
    return cached.response;
  } catch (error) {
    logError('Error getting cached response', { error, source: 'AICache' });
    return null;
  }
}

/**
 * Store AI response in cache
 */
export async function cacheResponse(
  feature: string,
  query: string,
  response: string,
  model: string,
  context?: Record<string, unknown>
): Promise<void> {
  const config = CACHE_CONFIG[feature];
  
  // Check if caching is enabled for this feature
  if (!config?.enabled) {
    return;
  }
  
  const cacheKey = generateCacheKey(feature, query, context);
  const ttl = config.ttl || DEFAULT_TTL_MS;
  const now = Date.now();
  
  try {
    // Check cache size and evict if needed
    const count = await db.aiCache.count();
    if (count >= MAX_CACHE_SIZE) {
      await evictLeastUsedEntries(50); // Evict 50 least used
    }
    
    await db.aiCache.put({
      id: cacheKey,
      queryHash: cacheKey,
      feature,
      query: query.substring(0, 500), // Store truncated query for debugging
      response,
      model,
      cachedAt: now,
      expiresAt: now + ttl,
      hitCount: 0
    });
    
    logInfo('Cache stored', { feature, ttl, source: 'AICache' });
  } catch (error) {
    logError('Error caching response', { error, source: 'AICache' });
  }
}

/**
 * Invalidate cache entries for a specific feature
 */
export async function invalidateFeatureCache(feature: string): Promise<void> {
  try {
    await db.aiCache.where('feature').equals(feature).delete();
    logInfo('Cache invalidated', { feature, source: 'AICache' });
  } catch (error) {
    logError('Error invalidating feature cache', { error, source: 'AICache' });
  }
}

/**
 * Invalidate all AI cache
 */
export async function invalidateAllCache(): Promise<void> {
  try {
    await db.aiCache.clear();
    logInfo('All cache cleared', { source: 'AICache' });
  } catch (error) {
    logError('Error clearing all cache', { error, source: 'AICache' });
  }
}

/**
 * Evict least used cache entries
 */
async function evictLeastUsedEntries(count: number): Promise<void> {
  const entries = await db.aiCache
    .orderBy('hitCount')
    .limit(count)
    .toArray();
  
  const ids = entries.map(e => e.id);
  await db.aiCache.bulkDelete(ids);
  
  logInfo('Evicted least used entries', { count: ids.length, source: 'AICache' });
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalHits: number;
  byFeature: Record<string, { count: number; hits: number }>;
}> {
  const entries = await db.aiCache.toArray();
  
  const byFeature: Record<string, { count: number; hits: number }> = {};
  let totalHits = 0;
  
  for (const entry of entries) {
    totalHits += entry.hitCount;
    
    if (!byFeature[entry.feature]) {
      byFeature[entry.feature] = { count: 0, hits: 0 };
    }
    byFeature[entry.feature].count++;
    byFeature[entry.feature].hits += entry.hitCount;
  }
  
  return {
    totalEntries: entries.length,
    totalHits,
    byFeature
  };
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  const now = Date.now();
  
  const expiredIds = await db.aiCache
    .where('expiresAt')
    .below(now)
    .primaryKeys();
  
  if (expiredIds.length > 0) {
    await db.aiCache.bulkDelete(expiredIds);
    logInfo('Cleaned up expired entries', { count: expiredIds.length, source: 'AICache' });
  }
  
  return expiredIds.length;
}
