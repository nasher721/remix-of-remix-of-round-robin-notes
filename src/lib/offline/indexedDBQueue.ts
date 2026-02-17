import { db, type QueuedMutationDB } from './database';

export type { QueuedMutationDB };
export type QueuedMutation = QueuedMutationDB;
export type SyncResult = {
  success: boolean;
  mutationId: string;
  error?: string;
  skipped?: boolean;
};

export interface ConflictData {
  id: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  clientData: Record<string, unknown>;
  serverData: Record<string, unknown> | null;
  originalData: Record<string, unknown>;
}

const MAX_RETRIES = 3;

class IndexedDBQueueManager {
  private listeners: Set<(queue: QueuedMutation[]) => void> = new Set();
  private syncInProgress = false;
  private initialized = false;
  
  constructor() {
    this.initialize();
    this.setupOnlineListener();
  }
  
  private async initialize(): Promise<void> {
    try {
      await db.open();
      this.initialized = true;
      const count = await db.mutations.count();
      console.log(`[IndexedDBQueue] Initialized with ${count} pending mutations`);
    } catch (error) {
      console.error('[IndexedDBQueue] Failed to initialize:', error);
      this.fallbackToLocalStorage();
    }
  }
  
  private fallbackToLocalStorage(): void {
    console.warn('[IndexedDBQueue] Falling back to localStorage mode');
    this.initialized = false;
  }
  
  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      console.log('[IndexedDBQueue] Connection restored');
      this.notifyListeners();
    });
    
    window.addEventListener('offline', () => {
      console.log('[IndexedDBQueue] Connection lost');
      this.notifyListeners();
    });
  }
  
  private notifyListeners(): void {
    this.getQueue().then(queue => {
      this.listeners.forEach(callback => callback(queue));
    });
  }
  
  async enqueue(
    mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>
  ): Promise<string> {
    const id = `mutation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };
    
    if (this.initialized) {
      const existingMutation = await db.mutations
        .where('[table+entityId]')
        .equals([mutation.table, mutation.entityId || ''])
        .first();
      
      if (existingMutation) {
        if (mutation.operation === 'update') {
          await db.mutations.update(existingMutation.id, {
            payload: { ...existingMutation.payload, ...mutation.payload },
            timestamp: Date.now(),
          });
        } else if (mutation.operation === 'delete') {
          if (existingMutation.operation === 'create') {
            await db.mutations.delete(existingMutation.id);
          } else {
            await db.mutations.put({ ...existingMutation, ...queuedMutation });
          }
        }
      } else {
        await db.mutations.add(queuedMutation);
      }
    } else {
      this.enqueueToLocalStorage(queuedMutation);
    }
    
    this.notifyListeners();
    console.log(`[IndexedDBQueue] Queued: ${mutation.type}/${mutation.operation}`);
    return id;
  }
  
  private enqueueToLocalStorage(mutation: QueuedMutation): void {
    const stored = localStorage.getItem('offline-mutation-queue');
    const queue: QueuedMutation[] = stored ? JSON.parse(stored) : [];
    queue.push(mutation);
    localStorage.setItem('offline-mutation-queue', JSON.stringify(queue));
  }
  
  async dequeue(mutationId: string): Promise<void> {
    if (this.initialized) {
      await db.mutations.delete(mutationId);
    } else {
      const stored = localStorage.getItem('offline-mutation-queue');
      if (stored) {
        const queue: QueuedMutation[] = JSON.parse(stored);
        const filtered = queue.filter(m => m.id !== mutationId);
        localStorage.setItem('offline-mutation-queue', JSON.stringify(filtered));
      }
    }
    this.notifyListeners();
  }
  
  async markFailed(mutationId: string): Promise<boolean> {
    if (this.initialized) {
      const mutation = await db.mutations.get(mutationId);
      if (mutation) {
        const newRetryCount = mutation.retryCount + 1;
        
        if (newRetryCount >= mutation.maxRetries) {
          console.warn(`[IndexedDBQueue] Mutation ${mutationId} exceeded max retries`);
          await db.mutations.delete(mutationId);
          this.notifyListeners();
          return false;
        }
        
        await db.mutations.update(mutationId, { retryCount: newRetryCount });
        this.notifyListeners();
        return true;
      }
    }
    return false;
  }
  
  async getQueue(): Promise<QueuedMutation[]> {
    if (this.initialized) {
      return db.mutations.orderBy('timestamp').toArray();
    }
    const stored = localStorage.getItem('offline-mutation-queue');
    return stored ? JSON.parse(stored) : [];
  }
  
  async getByType(type: QueuedMutation['type']): Promise<QueuedMutation[]> {
    if (this.initialized) {
      return db.mutations.where('type').equals(type).toArray();
    }
    const queue = await this.getQueue();
    return queue.filter(m => m.type === type);
  }
  
  async getLength(): Promise<number> {
    if (this.initialized) {
      return db.mutations.count();
    }
    return (await this.getQueue()).length;
  }
  
  async hasPendingMutations(): Promise<boolean> {
    const length = await this.getLength();
    return length > 0;
  }
  
  async clear(): Promise<void> {
    if (this.initialized) {
      await db.mutations.clear();
    } else {
      localStorage.removeItem('offline-mutation-queue');
    }
    this.notifyListeners();
  }
  
  subscribe(callback: (queue: QueuedMutation[]) => void): () => void {
    this.listeners.add(callback);
    this.getQueue().then(callback);
    return () => this.listeners.delete(callback);
  }
  
  setSyncInProgress(value: boolean): void {
    this.syncInProgress = value;
  }
  
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }
  
  async migrateFromLocalStorage(): Promise<number> {
    const stored = localStorage.getItem('offline-mutation-queue');
    if (!stored || !this.initialized) return 0;
    
    const oldQueue: QueuedMutation[] = JSON.parse(stored);
    if (oldQueue.length === 0) return 0;
    
    await db.mutations.bulkAdd(oldQueue);
    localStorage.removeItem('offline-mutation-queue');
    
    console.log(`[IndexedDBQueue] Migrated ${oldQueue.length} mutations from localStorage`);
    return oldQueue.length;
  }

  async getQueueSize(): Promise<number> {
    return this.getLength();
  }

  async getPendingBatch(batchSize: number): Promise<QueuedMutation[]> {
    if (this.initialized) {
      return db.mutations
        .where('status')
        .equals('pending')
        .or('status')
        .equals('')
        .limit(batchSize)
        .toArray();
    }
    const queue = await this.getQueue();
    return queue.filter(m => !m.status || m.status === 'pending').slice(0, batchSize);
  }

  async remove(mutationId: string): Promise<void> {
    return this.dequeue(mutationId);
  }

  async updateStatus(mutationId: string, status: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict'): Promise<void> {
    if (this.initialized) {
      await db.mutations.update(mutationId, { status });
    }
    this.notifyListeners();
  }

  async incrementRetry(mutationId: string): Promise<number> {
    if (this.initialized) {
      const mutation = await db.mutations.get(mutationId);
      if (mutation) {
        const newCount = mutation.retryCount + 1;
        await db.mutations.update(mutationId, { retryCount: newCount });
        return newCount;
      }
    }
    return 0;
  }

  async getByStatus(status: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict'): Promise<QueuedMutation[]> {
    if (this.initialized) {
      return db.mutations.where('status').equals(status).toArray();
    }
    const queue = await this.getQueue();
    return queue.filter(m => m.status === status);
  }

  async getPendingCount(): Promise<number> {
    if (this.initialized) {
      return db.mutations.where('status').equals('pending').count();
    }
    const queue = await this.getQueue();
    return queue.filter(m => m.status === 'pending').length;
  }
}

export const indexedDBQueue = new IndexedDBQueueManager();

export async function migrateFromOldQueue(): Promise<void> {
  const count = await indexedDBQueue.migrateFromLocalStorage();
  if (count > 0) {
    console.log(`[Migration] Migrated ${count} mutations to IndexedDB`);
  }
}
