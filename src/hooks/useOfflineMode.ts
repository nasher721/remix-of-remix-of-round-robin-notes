import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineQueue, QueuedMutation } from '@/lib/offline/offlineQueue';
import { syncService, SyncProgress } from '@/lib/offline/syncService';
import { useOnlineStatus } from './useOnlineStatus';

export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  pendingMutations: QueuedMutation[];
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  lastSyncTime: number | null;
  skippedMutations: Array<{
    id: string;
    mutation: QueuedMutation;
    reason: string;
    serverTimestamp?: string;
  }>;
}

export function useOfflineMode() {
  const isOnline = useOnlineStatus();
  const [pendingMutations, setPendingMutations] = useState<QueuedMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [skippedMutations, setSkippedMutations] = useState<Array<{
    id: string;
    mutation: QueuedMutation;
    reason: string;
    serverTimestamp?: string;
  }>>([]);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger manual sync (declared before useEffect that references it)
  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncProgress(null);
    // Clear skipped mutations on new sync attempt
    setSkippedMutations([]);

    try {
      const result = await syncService.syncAll((progress) => {
        setSyncProgress(progress);
      });

      if (result.completed > 0) {
        setLastSyncTime(Date.now());
      }

      // Capture skipped/conflicted mutations from sync results
      const skipped = result.results
        .filter(r => r.skipped)
        .map(r => {
          const mutation = pendingMutations.find(m => m.id === r.mutationId);
          return {
            id: r.mutationId,
            mutation: mutation!,
            reason: 'Conflict detected - server data is newer',
          };
        })
        .filter(s => s.mutation);

      if (skipped.length > 0) {
        setSkippedMutations(skipped);
      }
    } catch (err) {
      console.error('[OfflineSync] Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, pendingMutations]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      // Debounce sync to avoid rapid reconnection issues
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        triggerSync();
      }, 1000);
    } else {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isOnline, triggerSync]);

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
    skippedMutations,
    triggerSync,
    queueMutation,
    clearQueue,
    hasPendingChanges,
  };
}
