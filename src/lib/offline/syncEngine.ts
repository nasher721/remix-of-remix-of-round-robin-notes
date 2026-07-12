/**
 * Sync Engine - Background synchronization with conflict resolution
 * 
 * Handles:
 * - Processing queued mutations when online
 * - Exponential backoff retry
 * - Conflict detection and resolution
 * - Background Sync API integration
 * - Sync status events
 */

import { supabase } from '@/integrations/supabase/client';
import { indexedDBQueue, QueuedMutation, ConflictData } from './indexedDBQueue';
import { toast } from 'sonner';
import { logInfo } from '../observability/logger';

// Types
export type ConflictResolution = 'server-wins' | 'client-wins' | 'merge' | 'manual';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  batchSize: number;
  onConflict?: (conflict: ConflictData) => Promise<ConflictResolution>;
  onStatusChange?: (status: SyncStatus) => void;
  onProgress?: (processed: number, total: number) => void;
}

export interface SyncResult {
  success: number;
  failed: number;
  conflicts: ConflictData[];
  duration: number;
}

type SyncEventDataMap = {
  'status-change': SyncStatus;
  progress: { processed: number; total: number };
  conflict: ConflictData;
  complete: SyncResult;
  error: Error;
};

type SyncEventType = keyof SyncEventDataMap;
type SyncEventListener<T extends SyncEventType> = (data: SyncEventDataMap[T]) => void;
type StoredSyncEventListener = (data: unknown) => void;

// Preserve conflicting local work until the user explicitly resolves it.
const defaultConflictResolver = async (_conflict: ConflictData): Promise<ConflictResolution> => {
  return 'manual';
};

// Default sync configuration
const defaultConfig: SyncConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  batchSize: 10,
  onConflict: defaultConflictResolver,
};

/**
 * Sync Engine - Manages offline-to-online synchronization
 */
class SyncEngine {
  private config: SyncConfig;
  private status: SyncStatus = 'idle';
  private activeSync: Promise<SyncResult> | null = null;
  private activeAuxiliaryOperations = new Set<Promise<unknown>>();
  private authTransitionPauses = 0;
  private listeners: Map<SyncEventType, Set<StoredSyncEventListener>> = new Map();
  private abortController: AbortController | null = null;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.setupNetworkListeners();
    this.setupBackgroundSync();
  }

  // Event handling
  on<T extends SyncEventType>(event: T, listener: SyncEventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const storedListener: StoredSyncEventListener = (data) => {
      listener(data as SyncEventDataMap[T]);
    };
    this.listeners.get(event)!.add(storedListener);
    return () => {
      this.listeners.get(event)?.delete(storedListener);
    };
  }

  private emit<T extends SyncEventType>(event: T, data: SyncEventDataMap[T]): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('[SyncEngine] Listener error:', error);
      }
    });
  }

  private setStatus(newStatus: SyncStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.emit('status-change', newStatus);
      this.config.onStatusChange?.(newStatus);
    }
  }

  // Network listeners
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      logInfo('[SyncEngine] Back online, starting sync...');
      this.sync();
    });

    window.addEventListener('offline', () => {
      logInfo('[SyncEngine] Gone offline');
      this.setStatus('offline');
      this.abort();
    });
  }

  // Background Sync API
  private setupBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        return (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('offline-mutations');
      }).catch(err => {
        logInfo('[SyncEngine] Background Sync not available: ' + String(err));
      });
    }
  }

  // Calculate backoff delay with exponential increase
  private getBackoffDelay(attempt: number): number {
    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(2, attempt),
      this.config.maxDelayMs
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  // Main sync method
  sync(): Promise<SyncResult> {
    if (this.authTransitionPauses > 0) {
      logInfo('[SyncEngine] Auth transition in progress, skipping sync');
      return Promise.resolve({ success: 0, failed: 0, conflicts: [], duration: 0 });
    }

    if (this.activeSync) {
      logInfo('[SyncEngine] Sync already in progress');
      return this.activeSync;
    }

    const operation = this.runSync();
    this.activeSync = operation;
    const clearActiveSync = () => {
      if (this.activeSync === operation) {
        this.activeSync = null;
      }
    };
    void operation.then(clearActiveSync, clearActiveSync);
    return operation;
  }

  private async runSync(): Promise<SyncResult> {
    if (!navigator.onLine) {
      logInfo('[SyncEngine] Offline, skipping sync');
      this.setStatus('offline');
      return { success: 0, failed: 0, conflicts: [], duration: 0 };
    }

    this.abortController = new AbortController();
    this.setStatus('syncing');

    const startTime = Date.now();
    const result: SyncResult = { success: 0, failed: 0, conflicts: [], duration: 0 };

    try {
      const queueSize = await indexedDBQueue.getPendingCount();
      if (queueSize === 0) {
        logInfo('[SyncEngine] Queue empty');
        this.setStatus('idle');
        return { ...result, duration: Date.now() - startTime };
      }

      logInfo(`[SyncEngine] Starting sync of ${queueSize} mutations`);
      this.emit('progress', { processed: 0, total: queueSize });

      let processed = 0;
      let hasMore = true;

      while (hasMore && !this.abortController.signal.aborted) {
        const batch = await indexedDBQueue.getPendingBatch(this.config.batchSize);
        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const mutation of batch) {
          if (this.abortController.signal.aborted) break;

          let mutationCompleted = false;
          try {
            const conflict = await this.processMutation(mutation);
            if (this.abortController.signal.aborted) break;
            let shouldRemoveMutation = true;
            
            if (conflict) {
              result.conflicts.push(conflict);
              const resolution = await this.config.onConflict!(conflict);
              if (this.abortController.signal.aborted) break;
              await this.resolveConflict(mutation, conflict, resolution);
              shouldRemoveMutation = resolution !== 'manual';
              if (resolution === 'manual') {
                this.emit('conflict', conflict);
              }
            }

            if (shouldRemoveMutation) {
              await indexedDBQueue.remove(mutation.id);
              result.success++;
            }
            mutationCompleted = true;
          } catch (error) {
            if (this.abortController.signal.aborted) break;
            console.error(`[SyncEngine] Mutation ${mutation.id} failed:`, error);
            
            const shouldRetry = await indexedDBQueue.markFailed(
              mutation.id,
              this.config.maxRetries,
            );
            if (!shouldRetry) {
              result.failed++;
              mutationCompleted = true;
            } else {
              const delay = this.getBackoffDelay(mutation.retryCount);
              // Re-queue for later processing
              await new Promise(resolve => setTimeout(resolve, Math.min(delay, 100)));
            }
          }

          if (mutationCompleted) {
            processed++;
            this.emit('progress', { processed, total: queueSize });
            this.config.onProgress?.(processed, queueSize);
          }
        }
      }

      result.duration = Date.now() - startTime;
      this.setStatus('idle');
      this.emit('complete', result);

      if (result.failed > 0) {
        toast.error(`${result.failed} mutations failed to sync`);
      } else if (result.success > 0) {
        toast.success(`Synced ${result.success} changes`);
      }

      return result;
    } catch (error) {
      console.error('[SyncEngine] Sync error:', error);
      this.setStatus('error');
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return { ...result, duration: Date.now() - startTime };
    } finally {
      this.abortController = null;
    }
  }

  private runAuxiliaryOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.authTransitionPauses > 0) {
      return Promise.reject(new Error('Offline sync is paused for an auth transition'));
    }

    const trackedOperation = Promise.resolve().then(operation);
    this.activeAuxiliaryOperations.add(trackedOperation);
    return trackedOperation.finally(() => {
      this.activeAuxiliaryOperations.delete(trackedOperation);
    });
  }

  // Process single mutation
  private async processMutation(mutation: QueuedMutation): Promise<ConflictData | null> {
    const { table, operation, payload, entityId } = mutation;

    // For updates, check for conflicts
    if (operation === 'update' && entityId) {
      const { data: serverData, error } = await supabase
        .from(table as 'patients')
        .select('*')
        .eq('id', entityId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            id: entityId,
            table,
            operation,
            clientData: payload,
            serverData: null,
            originalData: mutation.conflictData || payload,
          };
        }
        throw error;
      }

      if (this.abortController?.signal.aborted) {
        throw new DOMException('Offline sync aborted', 'AbortError');
      }

      const originalData = mutation.conflictData ?? mutation.payload;
      if (this.hasConflict(originalData, serverData, mutation.timestamp)) {
        return {
          id: entityId,
          table,
          operation,
          clientData: payload,
          serverData,
          originalData,
        };
      }
    }

    let error: { code?: string; message: string } | null = null;

    switch (operation) {
      case 'create':
        ({ error } = await supabase.from(table as 'patients').insert(payload as never));
        break;
      case 'update':
        if (!entityId) throw new Error('Missing entityId for update');
        ({ error } = await supabase.from(table as 'patients').update(payload as never).eq('id', entityId));
        break;
      case 'delete':
        if (!entityId) throw new Error('Missing entityId for delete');
        ({ error } = await supabase.from(table as 'patients').delete().eq('id', entityId));
        break;
    }

    if (error) {
      throw new Error(error.message);
    }

    return null;
  }

  // Detect if data has changed on server
  private hasConflict(
    original: Record<string, unknown>,
    server: Record<string, unknown>,
    queuedAt: number,
  ): boolean {
    const originalUpdate = this.getRecordTimestamp(original);
    const serverUpdate = this.getRecordTimestamp(server);

    if (serverUpdate !== null) {
      return serverUpdate > (originalUpdate ?? queuedAt);
    }

    // Without version timestamps, retain the mutation when any field captured
    // in the original snapshot changed. Extra server fields are irrelevant.
    return Object.entries(original).some(([key, value]) => (
      JSON.stringify(server[key]) !== JSON.stringify(value)
    ));
  }

  private getRecordTimestamp(record: Record<string, unknown>): number | null {
    const value = record.last_modified ?? record.updated_at;
    if (typeof value !== 'string') return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  // Resolve conflict based on strategy
  private async resolveConflict(
    mutation: QueuedMutation,
    conflict: ConflictData,
    resolution: ConflictResolution
  ): Promise<void> {
    switch (resolution) {
      case 'server-wins':
        // Do nothing - server data is already correct
        logInfo(`[SyncEngine] Conflict ${conflict.id}: server wins`);
        break;

      case 'client-wins': {
        const { error } = await supabase
          .from(conflict.table as 'patients')
          .update(conflict.clientData as never)
          .eq('id', conflict.id);
        if (error) throw new Error(error.message);
        logInfo(`[SyncEngine] Conflict ${conflict.id}: client wins`);
        break;
      }

      case 'merge': {
        const merged = { ...conflict.serverData, ...conflict.clientData };
        const { error } = await supabase
          .from(conflict.table as 'patients')
          .update(merged as never)
          .eq('id', conflict.id);
        if (error) throw new Error(error.message);
        logInfo(`[SyncEngine] Conflict ${conflict.id}: merged`);
        break;
      }

      case 'manual':
        // Keep in queue for manual resolution
        await indexedDBQueue.updateStatus(mutation.id, 'conflict');
        logInfo(`[SyncEngine] Conflict ${conflict.id}: requires manual resolution`);
        break;
    }
  }

  // Abort ongoing sync
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.setStatus('idle');
    }
  }

  /**
   * Stop accepting sync requests and wait until the active request chain has
   * observed cancellation. The returned release function is idempotent.
   */
  async pauseForAuthTransition(): Promise<() => void> {
    this.authTransitionPauses += 1;
    this.abort();

    const activeSync = this.activeSync;
    await Promise.allSettled([
      ...(activeSync ? [activeSync] : []),
      ...this.activeAuxiliaryOperations,
    ]);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.authTransitionPauses = Math.max(0, this.authTransitionPauses - 1);
    };
  }

  // Get current status
  getStatus(): SyncStatus {
    return this.status;
  }

  resolvePendingConflict(
    conflict: ConflictData,
    resolution: 'server-wins' | 'client-wins'
  ): Promise<boolean> {
    return this.runAuxiliaryOperation(() => this.runResolvePendingConflict(conflict, resolution));
  }

  private async runResolvePendingConflict(
    conflict: ConflictData,
    resolution: 'server-wins' | 'client-wins'
  ): Promise<boolean> {
    const queue = await indexedDBQueue.getQueue();
    if (this.authTransitionPauses > 0) return false;
    const mutation = queue.find((item) => (
      item.table === conflict.table
      && item.operation === conflict.operation
      && item.entityId === conflict.id
    ));
    if (!mutation) return false;

    await this.resolveConflict(mutation, conflict, resolution);
    await indexedDBQueue.remove(mutation.id);
    return true;
  }

  // Force retry failed mutations
  retryFailed(): Promise<void> {
    return this.runAuxiliaryOperation(() => this.runRetryFailed());
  }

  private async runRetryFailed(): Promise<void> {
    const failed = await indexedDBQueue.getByStatus('failed');
    for (const mutation of failed) {
      if (this.authTransitionPauses > 0) return;
      await indexedDBQueue.updateStatus(mutation.id, 'pending');
    }
    if (this.authTransitionPauses > 0) return;
    await this.sync();
  }

  // Update configuration
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Singleton instance
let syncEngineInstance: SyncEngine | null = null;

export function getSyncEngine(config?: Partial<SyncConfig>): SyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new SyncEngine(config);
  }
  return syncEngineInstance;
}

export { SyncEngine };

export const syncEngine = getSyncEngine();
