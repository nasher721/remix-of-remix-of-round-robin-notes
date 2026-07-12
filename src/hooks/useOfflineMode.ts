import { useState, useEffect, useCallback, useRef } from 'react';
import {
  indexedDBQueue,
  type QueuedMutation,
  type QueuedMutationInput,
} from '@/lib/offline/indexedDBQueue';
import { syncEngine } from '@/lib/offline/syncEngine';
import { useOnlineStatus } from './useOnlineStatus';

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  current: string;
}

interface SkippedMutation {
  id: string;
  mutation: QueuedMutation;
  reason: string;
  serverTimestamp?: string;
}

export interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  pendingMutations: QueuedMutation[];
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  lastSyncTime: number | null;
  skippedMutations: SkippedMutation[];
}

function getRetainedConflicts(queue: QueuedMutation[]): SkippedMutation[] {
  return queue
    .filter(mutation => mutation.status === 'conflict')
    .map(mutation => ({
      id: mutation.id,
      mutation,
      reason: 'Conflict detected - manual review required',
    }));
}

export function useOfflineMode() {
  const isOnline = useOnlineStatus();
  const [pendingMutations, setPendingMutations] = useState<QueuedMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [skippedMutations, setSkippedMutations] = useState<SkippedMutation[]>([]);
  const syncInProgressRef = useRef(false);

  const updateQueueState = useCallback((queue: QueuedMutation[]) => {
    setPendingMutations(queue);
    setSkippedMutations(getRetainedConflicts(queue));
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || syncInProgressRef.current) return;

    const queuedBeforeSync = await indexedDBQueue.getQueue();
    const pendingBeforeSync = queuedBeforeSync.filter(
      mutation => !mutation.status || mutation.status === 'pending',
    );
    if (pendingBeforeSync.length === 0) {
      updateQueueState(queuedBeforeSync);
      return;
    }

    syncInProgressRef.current = true;
    setIsSyncing(true);
    setSyncProgress({
      total: pendingBeforeSync.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      current: 'Preparing queued changes',
    });

    try {
      const result = await syncEngine.sync();
      const queuedAfterSync = await indexedDBQueue.getQueue();
      updateQueueState(queuedAfterSync);
      setSyncProgress({
        total: pendingBeforeSync.length,
        completed: result.success,
        failed: result.failed,
        skipped: result.conflicts.length,
        current: '',
      });
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error('[OfflineSync] Sync failed:', error);
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
    }
  }, [updateQueueState]);

  // Sync persisted same-user work after reload and on later reconnections.
  useEffect(() => {
    if (!isOnline) return;
    const timeout = setTimeout(() => {
      void triggerSync();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [isOnline, triggerSync]);

  useEffect(() => {
    const unsubscribeQueue = indexedDBQueue.subscribe(updateQueueState);
    const unsubscribeStatus = syncEngine.on('status-change', status => {
      const syncing = status === 'syncing';
      syncInProgressRef.current = syncing;
      setIsSyncing(syncing);
    });
    const unsubscribeProgress = syncEngine.on('progress', ({ processed, total }) => {
      setSyncProgress(previous => ({
        total,
        completed: processed,
        failed: previous?.failed ?? 0,
        skipped: previous?.skipped ?? 0,
        current: processed < total ? 'Processing queued changes' : '',
      }));
    });
    const unsubscribeComplete = syncEngine.on('complete', result => {
      setLastSyncTime(Date.now());
      setSyncProgress(previous => ({
        total: previous?.total ?? result.success + result.failed + result.conflicts.length,
        completed: result.success,
        failed: result.failed,
        skipped: result.conflicts.length,
        current: '',
      }));
    });

    return () => {
      unsubscribeQueue();
      unsubscribeStatus();
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, [updateQueueState]);

  const queueMutation = useCallback((mutation: QueuedMutationInput): Promise<string> => {
    return indexedDBQueue.enqueue(mutation);
  }, []);

  const clearQueue = useCallback(async (): Promise<void> => {
    await indexedDBQueue.clear();
  }, []);

  const hasPendingChanges = useCallback((entityId: string, table: string): boolean => {
    return pendingMutations.some(
      mutation => mutation.entityId === entityId && mutation.table === table,
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
