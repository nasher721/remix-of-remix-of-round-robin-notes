import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/requestTimeout';

const HEALTH_CHECK_TIMEOUT_MS = 8_000;
const HEALTH_CACHE_TTL_MS = 60_000;

type Cached = { expiresAt: number; result: 'healthy' | 'unhealthy' };

let cache: Cached | null = null;

export function invalidateEdgeHealthCache(): void {
  cache = null;
}

/**
 * Calls `healthcheck` edge function with a short timeout.
 * Results are cached for HEALTH_CACHE_TTL_MS (healthy/unhealthy only; unknown is not cached).
 */
export async function probeEdgeHealth(options?: { force?: boolean }): Promise<'healthy' | 'unhealthy' | 'unknown'> {
  if (!options?.force && cache && Date.now() < cache.expiresAt) {
    return cache.result;
  }

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('healthcheck', { body: {} }),
      HEALTH_CHECK_TIMEOUT_MS,
      'healthcheck',
    );

    if (error) {
      cache = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, result: 'unhealthy' };
      return 'unhealthy';
    }

    const status = data && typeof data === 'object' ? (data as { status?: string }).status : undefined;
    if (status === 'healthy') {
      cache = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, result: 'healthy' };
      return 'healthy';
    }

    cache = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, result: 'unhealthy' };
    return 'unhealthy';
  } catch {
    return 'unknown';
  }
}
