import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { offlineQueue, QueuedMutation, SyncResult } from './offlineQueue';
import { toast } from 'sonner';

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  current: string;
  results: SyncResult[];
}

type SyncProgressCallback = (progress: SyncProgress) => void;

// Strictly typed table names from generated Database types
type PublicTableName = keyof Database['public']['Tables'];

// Type helpers for insert/update payloads
type TableInsert<T extends PublicTableName> = Database['public']['Tables'][T]['Insert'];
type TableUpdate<T extends PublicTableName> = Database['public']['Tables'][T]['Update'];
type TableRow<T extends PublicTableName> = Database['public']['Tables'][T]['Row'];

// Tables that support last_modified for conflict resolution
type TimestampedTable = 'patients';

interface ConflictCheckResult {
  hasConflict: boolean;
  serverTimestamp?: string;
  mutationTimestamp?: number;
}

class SyncService {
  private isSyncing = false;
  private progressListeners: Set<SyncProgressCallback> = new Set();
  
  // Check if table has last_modified field for conflict resolution
  private isTimestampedTable(table: string): table is TimestampedTable {
    return table === 'patients';
  }
  
  // Fetch server timestamp for conflict detection
  private async checkConflict(
    table: TimestampedTable,
    entityId: string,
    mutationTimestamp: number
  ): Promise<ConflictCheckResult> {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('last_modified')
        .eq('id', entityId)
        .maybeSingle();
      
      if (error) {
        console.error(`[SyncService] Failed to check conflict for ${table}:`, error);
        return { hasConflict: false };
      }
      
      if (!data) {
        // Record doesn't exist, no conflict
        return { hasConflict: false };
      }
      
      const serverTimestamp = new Date(data.last_modified).getTime();
      const hasConflict = serverTimestamp > mutationTimestamp;
      
      return {
        hasConflict,
        serverTimestamp: data.last_modified,
        mutationTimestamp,
      };
    } catch (error) {
      console.error(`[SyncService] Conflict check error:`, error);
      return { hasConflict: false };
    }
  }
  
  // Type-safe mutation executor
  private async executeMutation(mutation: QueuedMutation): Promise<SyncResult & { skipped?: boolean }> {
    const { table, operation, payload, entityId, timestamp } = mutation;
    
    // Validate table name against known tables
    if (!this.isValidTable(table)) {
      console.error(`[SyncService] Unknown table: ${table}`);
      return {
        success: false,
        mutationId: mutation.id,
        error: `Unknown table: ${table}`,
      };
    }
    
    try {
      switch (operation) {
        case 'create': {
          const insertPayload = payload as TableInsert<typeof table>;
          const { error } = await supabase
            .from(table)
            .insert(insertPayload);
          
          if (error) throw error;
          break;
        }
        
        case 'update': {
          if (!entityId) throw new Error('Missing entityId for update');
          
          // Conflict resolution for timestamped tables
          if (this.isTimestampedTable(table)) {
            const conflict = await this.checkConflict(table, entityId, timestamp);
            
            if (conflict.hasConflict) {
              console.warn(
                `[SyncService] Conflict detected for ${table}/${entityId}: ` +
                `Server timestamp (${conflict.serverTimestamp}) is newer than ` +
                `mutation timestamp (${new Date(conflict.mutationTimestamp!).toISOString()}). ` +
                `Skipping update to avoid overwriting newer data.`
              );
              
              return {
                success: true,
                mutationId: mutation.id,
                skipped: true,
              };
            }
          }
          
          const updatePayload = payload as TableUpdate<typeof table>;
          const { error } = await supabase
            .from(table)
            .update(updatePayload)
            .eq('id', entityId);
          
          if (error) throw error;
          break;
        }
        
        case 'delete': {
          if (!entityId) throw new Error('Missing entityId for delete');
          
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', entityId);
          
          if (error) throw error;
          break;
        }
        
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      return { success: true, mutationId: mutation.id };
    } catch (error) {
      console.error(`[SyncService] Mutation failed:`, error);
      return {
        success: false,
        mutationId: mutation.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // Validate table name is a known public table
  private isValidTable(table: string): table is PublicTableName {
    const validTables: PublicTableName[] = [
      'autotexts',
      'clinical_phrases',
      'learned_phrases',
      'patient_field_history',
      'patient_todos',
      'patients',
      'phrase_fields',
      'phrase_folders',
      'phrase_team_members',
      'phrase_teams',
      'phrase_usage_log',
      'phrase_versions',
      'templates',
      'user_dictionary',
    ];
    return validTables.includes(table as PublicTableName);
  }
  
  // Sync all pending mutations
  async syncAll(onProgress?: SyncProgressCallback): Promise<SyncProgress> {
    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress');
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        current: '',
        results: [],
      };
    }
    
    if (!navigator.onLine) {
      console.log('[SyncService] Offline, skipping sync');
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        current: '',
        results: [],
      };
    }
    
    this.isSyncing = true;
    offlineQueue.setSyncInProgress(true);
    
    const queue = offlineQueue.getQueue();
    const progress: SyncProgress = {
      total: queue.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      current: '',
      results: [],
    };
    
    if (queue.length === 0) {
      this.isSyncing = false;
      offlineQueue.setSyncInProgress(false);
      return progress;
    }
    
    console.log(`[SyncService] Starting sync of ${queue.length} mutations`);
    
    // Sort by timestamp (oldest first)
    const sortedQueue = [...queue].sort((a, b) => a.timestamp - b.timestamp);
    
    for (const mutation of sortedQueue) {
      progress.current = `${mutation.type}/${mutation.operation}`;
      onProgress?.(progress);
      this.notifyProgress(progress);
      
      const result = await this.executeMutation(mutation);
      progress.results.push(result);
      
      if (result.success) {
        if (result.skipped) {
          progress.skipped++;
          console.log(`[SyncService] Skipped conflicting mutation: ${mutation.id}`);
        } else {
          progress.completed++;
        }
        offlineQueue.dequeue(mutation.id);
      } else {
        progress.failed++;
        const shouldRetry = offlineQueue.markFailed(mutation.id);
        
        if (!shouldRetry) {
          console.warn(`[SyncService] Mutation permanently failed: ${mutation.id}`);
        }
      }
      
      onProgress?.(progress);
      this.notifyProgress(progress);
    }
    
    this.isSyncing = false;
    offlineQueue.setSyncInProgress(false);
    
    const summary = [
      `${progress.completed} succeeded`,
      progress.skipped > 0 ? `${progress.skipped} skipped (conflicts)` : null,
      progress.failed > 0 ? `${progress.failed} failed` : null,
    ].filter(Boolean).join(', ');
    
    console.log(`[SyncService] Sync complete: ${summary}`);
    
    return progress;
  }
  
  // Subscribe to progress updates
  subscribeProgress(callback: SyncProgressCallback): () => void {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }
  
  private notifyProgress(progress: SyncProgress): void {
    this.progressListeners.forEach(callback => callback(progress));
  }
  
  // Check if currently syncing
  getIsSyncing(): boolean {
    return this.isSyncing;
  }
}

// Singleton instance
export const syncService = new SyncService();

// Auto-sync when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    if (offlineQueue.hasPendingMutations()) {
      toast.info('Connection restored. Syncing changes...');
      
      const result = await syncService.syncAll();
      
      if (result.failed === 0 && result.completed > 0) {
        const skippedMsg = result.skipped > 0 ? ` (${result.skipped} skipped due to conflicts)` : '';
        toast.success(`Synced ${result.completed} changes successfully${skippedMsg}`);
      } else if (result.failed > 0) {
        toast.warning(`Synced ${result.completed} changes, ${result.failed} failed`);
      } else if (result.skipped > 0 && result.completed === 0) {
        toast.info(`${result.skipped} changes skipped (newer data on server)`);
      }
    }
  });
}
