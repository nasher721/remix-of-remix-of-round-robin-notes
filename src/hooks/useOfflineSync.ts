import { useState, useEffect, useCallback } from 'react';
import { indexedDBQueue, type ConflictData } from '@/lib/offline/indexedDBQueue';
import { getSyncEngine, type SyncResult } from '@/lib/offline/syncEngine';

interface OfflineSyncState {
  isOnline: boolean;
  queueSize: number;
  isSyncing: boolean;
  conflicts: ConflictData[];
  lastSyncAt: Date | null;
  syncError: string | null;
  syncProgress: { current: number; total: number } | null;
}

interface UseOfflineSyncReturn extends OfflineSyncState {
  sync: () => Promise<SyncResult>;
  clearQueue: () => Promise<void>;
  getQueuedMutations: () => Promise<import('@/lib/offline/database').QueuedMutationDB[]>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: navigator.onLine,
    queueSize: 0,
    isSyncing: false,
    conflicts: [],
    lastSyncAt: null,
    syncError: null,
    syncProgress: null,
  });

  useEffect(() => {
    const syncEngine = getSyncEngine();

    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      setState((prev) => ({ ...prev, isOnline }));
      if (isOnline) {
        syncEngine.sync().catch(console.error);
      }
    };

    const updateQueueSize = async () => {
      const size = await indexedDBQueue.getQueueSize();
      setState((prev) => ({ ...prev, queueSize: size }));
    };

    const unsubscribers: (() => void)[] = [];

    const unsubStatus = syncEngine.on('status-change', (status: string) => {
      setState((prev) => ({ ...prev, isSyncing: status === 'syncing' }));
    });
    unsubscribers.push(unsubStatus);

    const unsubProgress = syncEngine.on('progress', (data: { current: number; total: number }) => {
      setState((prev) => ({ ...prev, syncProgress: data }));
    });
    unsubscribers.push(unsubProgress);

    const unsubConflict = syncEngine.on('conflict', (conflicts: ConflictData[]) => {
      setState((prev) => ({ ...prev, conflicts }));
    });
    unsubscribers.push(unsubConflict);

    const unsubComplete = syncEngine.on('complete', () => {
      updateQueueSize();
      setState((prev) => ({
        ...prev,
        lastSyncAt: new Date(),
        syncProgress: null,
      }));
    });
    unsubscribers.push(unsubComplete);

    const unsubError = syncEngine.on('error', (error: Error) => {
      setState((prev) => ({
        ...prev,
        syncError: error.message,
        isSyncing: false,
      }));
    });
    unsubscribers.push(unsubError);

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateQueueSize();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  const sync = useCallback(async () => {
    const syncEngine = getSyncEngine();

    if (!navigator.onLine || state.isSyncing) {
      return { success: 0, processed: 0, succeeded: 0, failed: 0, conflicts: [], duration: 0 };
    }

    setState((prev) => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      const result = await syncEngine.sync();
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        conflicts: result.conflicts,
        lastSyncAt: new Date(),
        syncProgress: null,
      }));
      return result;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Sync failed',
      }));
      return { success: 0, processed: 0, succeeded: 0, failed: 0, conflicts: [], duration: 0 };
    }
  }, [state.isSyncing]);

  const clearQueue = useCallback(async () => {
    await indexedDBQueue.clear();
    setState((prev) => ({ ...prev, queueSize: 0, conflicts: [] }));
  }, []);

  const getQueuedMutations = useCallback(() => {
    return indexedDBQueue.getQueue();
  }, []);

  return {
    ...state,
    sync,
    clearQueue,
    getQueuedMutations,
  };
}
