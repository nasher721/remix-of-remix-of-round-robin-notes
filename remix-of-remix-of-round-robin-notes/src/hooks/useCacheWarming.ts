import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cacheWarming, WarmingProgress } from '@/lib/cache/cacheWarming';
import { cacheHydration } from '@/lib/cache/queryClientConfig';
import { useAuth } from '@/hooks/useAuth';

export function useCacheWarming() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isWarming, setIsWarming] = useState(false);
  const [progress, setProgress] = useState<WarmingProgress | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Hydrate cache from localStorage on mount
  useEffect(() => {
    if (!isHydrated) {
      cacheHydration.hydrate(queryClient);
      setIsHydrated(true);
    }
  }, [queryClient, isHydrated]);
  
  // Warm essential caches when user logs in
  useEffect(() => {
    if (user?.id && isHydrated) {
      warmCaches();
    }
  }, [user?.id, isHydrated]);
  
  // Persist cache before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      cacheHydration.persist(queryClient);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Also persist periodically
    const interval = setInterval(() => {
      cacheHydration.persist(queryClient);
    }, 60000); // Every minute
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
    };
  }, [queryClient]);
  
  // Manual cache warming
  const warmCaches = useCallback(async () => {
    if (!user?.id || isWarming) return;
    
    setIsWarming(true);
    setProgress(null);
    
    try {
      await cacheWarming.warmEssential(
        queryClient,
        user.id,
        (p) => setProgress(p)
      );
    } catch (error) {
      console.error('Cache warming failed:', error);
    } finally {
      setIsWarming(false);
    }
  }, [queryClient, user?.id, isWarming]);
  
  // Prefetch patient data on hover
  const prefetchPatient = useCallback(async (patientId: string) => {
    if (!patientId) return;
    await cacheWarming.prefetchPatient(queryClient, patientId);
  }, [queryClient]);
  
  return {
    isWarming,
    progress,
    warmCaches,
    prefetchPatient,
  };
}
