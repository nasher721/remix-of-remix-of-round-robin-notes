import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CACHE_CONFIG } from './cacheConfig';
import { cacheMetrics } from './performanceMonitor';

// Create optimized query client with caching strategies
export function createOptimizedQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only show error toast for user-initiated queries
        if (query.state.data !== undefined) {
          toast.error(`Error: ${error instanceof Error ? error.message : 'Something went wrong'}`);
        }
        cacheMetrics.recordError(query.queryKey.toString());
      },
      onSuccess: (data, query) => {
        cacheMetrics.recordHit(query.queryKey.toString());
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        toast.error(`Error: ${error instanceof Error ? error.message : 'Failed to save'}`);
      },
    }),
    defaultOptions: {
      queries: {
        // Default stale time - 1 minute
        staleTime: 60 * 1000,
        // Cache time - 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry configuration
        retry: CACHE_CONFIG.retry.count,
        retryDelay: (attemptIndex) => 
          Math.min(
            CACHE_CONFIG.retry.delay * Math.pow(CACHE_CONFIG.retry.backoffMultiplier, attemptIndex),
            30000
          ),
        // Refetch behavior
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
        // Network mode
        networkMode: 'offlineFirst',
        // Structural sharing for performance
        structuralSharing: true,
      },
      mutations: {
        retry: 1,
        networkMode: 'offlineFirst',
      },
    },
  });
}

// Hydration utilities for persisting cache
export const cacheHydration = {
  // Save cache to localStorage
  persist: (queryClient: QueryClient) => {
    try {
      const cache = queryClient.getQueryCache().getAll();
      const serializable = cache
        .filter(query => query.state.status === 'success')
        .map(query => ({
          queryKey: query.queryKey,
          data: query.state.data,
          dataUpdatedAt: query.state.dataUpdatedAt,
        }))
        .slice(0, CACHE_CONFIG.memory.maxEntries);
      
      localStorage.setItem(
        CACHE_CONFIG.storageKeys.queryCache,
        JSON.stringify(serializable)
      );
      localStorage.setItem(
        CACHE_CONFIG.storageKeys.lastSync,
        Date.now().toString()
      );
    } catch (error) {
      console.warn('Failed to persist cache:', error);
    }
  },
  
  // Restore cache from localStorage
  hydrate: (queryClient: QueryClient) => {
    try {
      const cached = localStorage.getItem(CACHE_CONFIG.storageKeys.queryCache);
      const lastSync = localStorage.getItem(CACHE_CONFIG.storageKeys.lastSync);
      
      if (!cached || !lastSync) return;
      
      const age = Date.now() - parseInt(lastSync, 10);
      if (age > CACHE_CONFIG.memory.maxAge) {
        // Cache too old, clear it
        localStorage.removeItem(CACHE_CONFIG.storageKeys.queryCache);
        return;
      }
      
      const entries = JSON.parse(cached);
      entries.forEach((entry: { queryKey: unknown[]; data: unknown; dataUpdatedAt: number }) => {
        queryClient.setQueryData(entry.queryKey, entry.data, {
          updatedAt: entry.dataUpdatedAt,
        });
      });
      
      console.log(`[Cache] Hydrated ${entries.length} queries from storage`);
    } catch (error) {
      console.warn('Failed to hydrate cache:', error);
    }
  },
  
  // Clear persisted cache
  clear: () => {
    localStorage.removeItem(CACHE_CONFIG.storageKeys.queryCache);
    localStorage.removeItem(CACHE_CONFIG.storageKeys.lastSync);
  },
};
