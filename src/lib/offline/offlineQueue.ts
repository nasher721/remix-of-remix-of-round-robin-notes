// Offline mutation queue with persistence
export interface QueuedMutation {
  id: string;
  type: 'patient' | 'autotext' | 'phrase' | 'todo' | 'template' | 'dictionary';
  operation: 'create' | 'update' | 'delete';
  table: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  entityId?: string;
}

export interface SyncResult {
  success: boolean;
  mutationId: string;
  error?: string;
}

const QUEUE_STORAGE_KEY = 'offline-mutation-queue';
const MAX_RETRIES = 3;

class OfflineQueueManager {
  private queue: QueuedMutation[] = [];
  private listeners: Set<(queue: QueuedMutation[]) => void> = new Set();
  private syncInProgress = false;
  
  constructor() {
    this.loadFromStorage();
    this.setupOnlineListener();
  }
  
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`[OfflineQueue] Loaded ${this.queue.length} pending mutations`);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }
  
  private saveToStorage(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue:', error);
    }
  }
  
  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      console.log('[OfflineQueue] Connection restored, syncing...');
      this.notifyListeners();
    });
    
    window.addEventListener('offline', () => {
      console.log('[OfflineQueue] Connection lost, queuing mutations...');
      this.notifyListeners();
    });
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback([...this.queue]));
  }
  
  // Add mutation to queue
  enqueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): string {
    const id = `mutation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };
    
    // Check for existing mutation on same entity
    const existingIndex = this.queue.findIndex(
      m => m.entityId === mutation.entityId && 
           m.table === mutation.table &&
           m.type === mutation.type
    );
    
    if (existingIndex !== -1) {
      // Merge with existing mutation (last write wins for updates)
      if (mutation.operation === 'update') {
        this.queue[existingIndex] = {
          ...this.queue[existingIndex],
          payload: { ...this.queue[existingIndex].payload, ...mutation.payload },
          timestamp: Date.now(),
        };
      } else if (mutation.operation === 'delete') {
        // If creating and then deleting, remove both
        if (this.queue[existingIndex].operation === 'create') {
          this.queue.splice(existingIndex, 1);
          this.saveToStorage();
          this.notifyListeners();
          return id;
        }
        // Replace update with delete
        this.queue[existingIndex] = queuedMutation;
      }
    } else {
      this.queue.push(queuedMutation);
    }
    
    this.saveToStorage();
    this.notifyListeners();
    
    console.log(`[OfflineQueue] Queued mutation: ${mutation.type}/${mutation.operation}`);
    return id;
  }
  
  // Remove mutation from queue
  dequeue(mutationId: string): void {
    const index = this.queue.findIndex(m => m.id === mutationId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveToStorage();
      this.notifyListeners();
    }
  }
  
  // Mark mutation as failed and increment retry
  markFailed(mutationId: string): boolean {
    const mutation = this.queue.find(m => m.id === mutationId);
    if (mutation) {
      mutation.retryCount++;
      
      if (mutation.retryCount >= mutation.maxRetries) {
        // Move to dead letter queue or remove
        console.warn(`[OfflineQueue] Mutation ${mutationId} exceeded max retries, removing`);
        this.dequeue(mutationId);
        return false;
      }
      
      this.saveToStorage();
      return true;
    }
    return false;
  }
  
  // Get all pending mutations
  getQueue(): QueuedMutation[] {
    return [...this.queue];
  }
  
  // Get mutations by type
  getByType(type: QueuedMutation['type']): QueuedMutation[] {
    return this.queue.filter(m => m.type === type);
  }
  
  // Get queue length
  getLength(): number {
    return this.queue.length;
  }
  
  // Check if sync is needed
  hasPendingMutations(): boolean {
    return this.queue.length > 0;
  }
  
  // Clear all mutations
  clear(): void {
    this.queue = [];
    this.saveToStorage();
    this.notifyListeners();
  }
  
  // Subscribe to queue changes
  subscribe(callback: (queue: QueuedMutation[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  // Lock for sync
  setSyncInProgress(value: boolean): void {
    this.syncInProgress = value;
  }
  
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueueManager();
