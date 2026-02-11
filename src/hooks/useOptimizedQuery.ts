import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, CACHE_CONFIG } from '@/lib/cache/cacheConfig';
import { cacheInvalidation } from '@/lib/cache/cacheInvalidation';

// Hook for optimized data fetching with caching
export function useOptimizedQuery() {
  const queryClient = useQueryClient();
  
  // Invalidate patient data
  const invalidatePatients = useCallback(async (patientId?: string) => {
    await cacheInvalidation.invalidatePatient(queryClient, patientId);
  }, [queryClient]);
  
  // Invalidate autotexts
  const invalidateAutotexts = useCallback(async () => {
    await cacheInvalidation.invalidateAutotexts(queryClient);
  }, [queryClient]);
  
  // Invalidate phrases
  const invalidatePhrases = useCallback(async (phraseId?: string) => {
    await cacheInvalidation.invalidatePhrases(queryClient, phraseId);
  }, [queryClient]);
  
  // Get optimistic update helpers
  const getOptimisticHelpers = useCallback(<T>(queryKey: readonly unknown[]) => {
    return {
      // Get current data
      getCurrentData: () => queryClient.getQueryData<T>(queryKey),
      
      // Set optimistic data
      setOptimistic: (updater: (old: T | undefined) => T) => {
        queryClient.setQueryData<T>(queryKey, updater);
      },
      
      // Rollback on error
      rollback: (previousData: T | undefined) => {
        if (previousData !== undefined) {
          queryClient.setQueryData(queryKey, previousData);
        }
      },
      
      // Invalidate after mutation
      invalidate: () => queryClient.invalidateQueries({ queryKey }),
    };
  }, [queryClient]);
  
  // Prefetch data
  const prefetch = useCallback(async <T>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    staleTime?: number
  ) => {
    await queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: staleTime || CACHE_CONFIG.staleTime.patients,
    });
  }, [queryClient]);
  
  return {
    invalidatePatients,
    invalidateAutotexts,
    invalidatePhrases,
    getOptimisticHelpers,
    prefetch,
    queryKeys: QUERY_KEYS,
    cacheConfig: CACHE_CONFIG,
  };
}
