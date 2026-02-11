import { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, INVALIDATION_PATTERNS } from './cacheConfig';

// Cache invalidation utilities
export const cacheInvalidation = {
  // Invalidate patient-related caches
  async invalidatePatient(queryClient: QueryClient, patientId?: string): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patients });
    
    if (patientId) {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patient(patientId) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patientTodos(patientId) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fieldHistory(patientId) });
    }
    
    // Clear service worker API cache for patients
    await this.clearServiceWorkerApiCache();
  },
  
  // Invalidate autotext caches
  async invalidateAutotexts(queryClient: QueryClient): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.autotexts });
  },
  
  // Invalidate clinical phrases caches
  async invalidatePhrases(queryClient: QueryClient, phraseId?: string): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clinicalPhrases });
    
    if (phraseId) {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.phrase(phraseId) });
    }
  },
  
  // Invalidate templates caches
  async invalidateTemplates(queryClient: QueryClient): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.templates });
  },
  
  // Invalidate all caches
  async invalidateAll(queryClient: QueryClient): Promise<void> {
    await queryClient.invalidateQueries();
    await this.clearServiceWorkerCache();
  },
  
  // Clear service worker API cache
  async clearServiceWorkerApiCache(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return false;
    }
    
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data?.success || false);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_API_CACHE' },
        [channel.port2]
      );
      
      setTimeout(() => resolve(false), 3000);
    });
  },
  
  // Clear all service worker caches
  async clearServiceWorkerCache(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return false;
    }
    
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data?.success || false);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [channel.port2]
      );
      
      setTimeout(() => resolve(false), 3000);
    });
  },
  
  // Smart invalidation based on patterns
  async smartInvalidate(
    queryClient: QueryClient,
    entityType: keyof typeof INVALIDATION_PATTERNS,
    entityId?: string
  ): Promise<void> {
    const pattern = INVALIDATION_PATTERNS[entityType];
    
    // Invalidate main queries
    for (const queryKey of pattern.invalidates) {
      await queryClient.invalidateQueries({ queryKey });
    }
    
    // Handle related queries if entity ID provided
    if (entityId && pattern.related.length > 0) {
      for (const related of pattern.related) {
        if (related === 'fieldHistory') {
          await queryClient.invalidateQueries({ 
            queryKey: QUERY_KEYS.fieldHistory(entityId) 
          });
        } else if (related === 'todos') {
          await queryClient.invalidateQueries({ 
            queryKey: QUERY_KEYS.patientTodos(entityId) 
          });
        }
      }
    }
  },
};

// Batch invalidation for multiple entities
export async function batchInvalidate(
  queryClient: QueryClient,
  operations: Array<{
    type: keyof typeof INVALIDATION_PATTERNS;
    id?: string;
  }>
): Promise<void> {
  const uniqueKeys = new Set<string>();
  
  // Collect unique query keys to invalidate
  for (const op of operations) {
    const pattern = INVALIDATION_PATTERNS[op.type];
    pattern.invalidates.forEach(key => uniqueKeys.add(JSON.stringify(key)));
  }
  
  // Invalidate all collected keys
  await Promise.all(
    Array.from(uniqueKeys).map(keyStr => 
      queryClient.invalidateQueries({ queryKey: JSON.parse(keyStr) })
    )
  );
}
