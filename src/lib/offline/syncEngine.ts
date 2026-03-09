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

type SyncEventType = 'status-change' | 'progress' | 'conflict' | 'complete' | 'error';
type SyncEventListener = (data: unknown) => void;

// Default conflict resolver - server wins
const defaultConflictResolver = async (_conflict: ConflictData): Promise<ConflictResolution> => {
  return 'server-wins';
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
  private syncInProgress = false;
  private listeners: Map<SyncEventType, Set<SyncEventListener>> = new Map();
  private abortController: AbortController | null = null;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.setupNetworkListeners();
    this.setupBackgroundSync();
  }

  // Event handling
  on(event: SyncEventType, listener: SyncEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  private emit(event: SyncEventType, data: unknown): void {
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
      console.log('[SyncEngine] Back online, starting sync...');
      this.sync();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncEngine] Gone offline');
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
        console.log('[SyncEngine] Background Sync not available:', err);
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
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log('[SyncEngine] Sync already in progress');
      return { success: 0, failed: 0, conflicts: [], duration: 0 };
    }

    if (!navigator.onLine) {
      console.log('[SyncEngine] Offline, skipping sync');
      this.setStatus('offline');
      return { success: 0, failed: 0, conflicts: [], duration: 0 };
    }

    this.syncInProgress = true;
    this.abortController = new AbortController();
    this.setStatus('syncing');

    const startTime = Date.now();
    const result: SyncResult = { success: 0, failed: 0, conflicts: [], duration: 0 };

    try {
      const queueSize = await indexedDBQueue.getQueueSize();
      if (queueSize === 0) {
        console.log('[SyncEngine] Queue empty');
        this.setStatus('idle');
        return { ...result, duration: Date.now() - startTime };
      }

      console.log(`[SyncEngine] Starting sync of ${queueSize} mutations`);
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

          try {
            const conflict = await this.processMutation(mutation);
            
            if (conflict) {
              result.conflicts.push(conflict);
              const resolution = await this.config.onConflict!(conflict);
              await this.resolveConflict(mutation, conflict, resolution);
            }
            
            await indexedDBQueue.remove(mutation.id);
            result.success++;
          } catch (error) {
            console.error(`[SyncEngine] Mutation ${mutation.id} failed:`, error);
            
            if (mutation.retryCount >= this.config.maxRetries) {
              await indexedDBQueue.updateStatus(mutation.id, 'failed');
              result.failed++;
            } else {
              const delay = this.getBackoffDelay(mutation.retryCount);
              await indexedDBQueue.incrementRetry(mutation.id);
              // Re-queue for later processing
              await new Promise(resolve => setTimeout(resolve, Math.min(delay, 100)));
            }
          }

          processed++;
          this.emit('progress', { processed, total: queueSize });
          this.config.onProgress?.(processed, queueSize);
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
      this.emit('error', error);
      return { ...result, duration: Date.now() - startTime };
    } finally {
      this.syncInProgress = false;
      this.abortController = null;
    }
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

      if (mutation.conflictData && this.hasConflict(mutation.conflictData, serverData)) {
        return {
          id: entityId,
          table,
          operation,
          clientData: payload,
          serverData,
          originalData: mutation.conflictData,
        };
      }
    }

    let error: { code?: string; message: string } | null = null;

    switch (operation) {
      case 'create':
        ({ error } = await supabase.from(table as 'patients').insert(payload as never));
        break;
      case 'update':
        ({ error } = await supabase.from(table as 'patients').update(payload as never).eq('id', entityId));
        break;
      case 'delete':
        ({ error } = await supabase.from(table as 'patients').delete().eq('id', entityId));
        break;
    }

    if (error) {
      throw new Error(error.message);
    }

    return null;
  }

  // Detect if data has changed on server
  private hasConflict(original: Record<string, unknown>, server: Record<string, unknown>): boolean {
    const originalUpdate = (original as { updated_at?: string }).updated_at;
    const serverUpdate = (server as { updated_at?: string }).updated_at;
    
    if (originalUpdate && serverUpdate) {
      return new Date(originalUpdate) < new Date(serverUpdate);
    }
    
    // Fallback: compare all fields
    return JSON.stringify(original) !== JSON.stringify(server);
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
        console.log(`[SyncEngine] Conflict ${conflict.id}: server wins`);
        break;

      case 'client-wins':
        await supabase
          .from(conflict.table as 'patients')
          .update(conflict.clientData as never)
          .eq('id', conflict.id);
        console.log(`[SyncEngine] Conflict ${conflict.id}: client wins`);
        break;

      case 'merge': {
        const merged = { ...conflict.serverData, ...conflict.clientData };
        await supabase
          .from(conflict.table as 'patients')
          .update(merged as never)
          .eq('id', conflict.id);
        console.log(`[SyncEngine] Conflict ${conflict.id}: merged`);
        break;
      }

      case 'manual':
        // Keep in queue for manual resolution
        await indexedDBQueue.updateStatus(mutation.id, 'conflict');
        console.log(`[SyncEngine] Conflict ${conflict.id}: requires manual resolution`);
        break;
    }
  }

  // Abort ongoing sync
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.syncInProgress = false;
      this.setStatus('idle');
    }
  }

  // Get current status
  getStatus(): SyncStatus {
    return this.status;
  }

  // Force retry failed mutations
  async retryFailed(): Promise<void> {
    const failed = await indexedDBQueue.getByStatus('failed');
    for (const mutation of failed) {
      await indexedDBQueue.updateStatus(mutation.id, 'pending');
    }
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
