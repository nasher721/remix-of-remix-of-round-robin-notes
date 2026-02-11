import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineQueue, QueuedMutation } from '@/lib/offline/offlineQueue';
import { syncService, SyncProgress } from '@/lib/offline/syncService';

export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  pendingMutations: QueuedMutation[];
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  lastSyncTime: number | null;
}

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingMutations, setPendingMutations] = useState<QueuedMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Debounce sync to avoid rapid reconnection issues
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        triggerSync();
      }, 1000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);
  
  // Subscribe to queue changes
  useEffect(() => {
    // Initial load
    setPendingMutations(offlineQueue.getQueue());
    
    const unsubscribe = offlineQueue.subscribe((queue) => {
      setPendingMutations(queue);
    });
    
    return unsubscribe;
  }, []);
  
  // Subscribe to sync progress
  useEffect(() => {
    const unsubscribe = syncService.subscribeProgress((progress) => {
      setSyncProgress(progress);
    });
    
    return unsubscribe;
  }, []);
  
  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    setSyncProgress(null);
    
    try {
      const result = await syncService.syncAll((progress) => {
        setSyncProgress(progress);
      });
      
      if (result.completed > 0) {
        setLastSyncTime(Date.now());
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);
  
  // Queue a mutation
  const queueMutation = useCallback((
    mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>
  ): string => {
    return offlineQueue.enqueue(mutation);
  }, []);
  
  // Clear pending mutations
  const clearQueue = useCallback(() => {
    offlineQueue.clear();
  }, []);
  
  // Check if a specific entity has pending changes
  const hasPendingChanges = useCallback((entityId: string, table: string): boolean => {
    return pendingMutations.some(
      m => m.entityId === entityId && m.table === table
    );
  }, [pendingMutations]);
  
  return {
    isOnline,
    pendingCount: pendingMutations.length,
    pendingMutations,
    isSyncing,
    syncProgress,
    lastSyncTime,
    triggerSync,
    queueMutation,
    clearQueue,
    hasPendingChanges,
  };
}
