import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/requestTimeout';

const HEALTH_CHECK_TIMEOUT_MS = 8_000;
const HEALTH_CACHE_TTL_MS = 60_000;
const PROBE_ATTEMPTS = 3;
const PROBE_RETRY_DELAY_MS = 400;

type Cached = { expiresAt: number; result: 'healthy' | 'unhealthy' };

let cache: Cached | null = null;

export function invalidateEdgeHealthCache(): void {
  cache = null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSingleProbe(): Promise<'healthy' | 'unhealthy' | 'unknown'> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('healthcheck', { body: {} }),
      HEALTH_CHECK_TIMEOUT_MS,
      'healthcheck',
    );

    if (error) {
      return 'unhealthy';
    }

    const status = data && typeof data === 'object' ? (data as { status?: string }).status : undefined;
    if (status === 'healthy') {
      return 'healthy';
    }

    return 'unhealthy';
  } catch {
    return 'unknown';
  }
}

/**
 * Calls `healthcheck` edge function with a short timeout.
 * Results are cached for HEALTH_CACHE_TTL_MS (healthy/unhealthy only; unknown is not cached).
 * Retries a few times on unhealthy/unknown to avoid a sticky banner from cold starts or flaky networks.
 */
export async function probeEdgeHealth(options?: { force?: boolean }): Promise<'healthy' | 'unhealthy' | 'unknown'> {
  if (!options?.force && cache && Date.now() < cache.expiresAt) {
    return cache.result;
  }

  let lastNonHealthy: 'unhealthy' | 'unknown' = 'unknown';

  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(PROBE_RETRY_DELAY_MS);
    }
    const result = await runSingleProbe();
    if (result === 'healthy') {
      cache = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, result: 'healthy' };
      return 'healthy';
    }
    lastNonHealthy = result;
  }

  if (lastNonHealthy === 'unhealthy') {
    cache = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, result: 'unhealthy' };
  }
  return lastNonHealthy;
}
