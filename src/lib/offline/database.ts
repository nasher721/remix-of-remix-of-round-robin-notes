/**
 * IndexedDB Database using Dexie.js
 * Replaces localStorage for offline data persistence
 * 
 * Schema:
 * - mutations: Offline mutation queue (replaces localStorage queue)
 * - patients: Cached patient data for offline access
 * - phrases: Cached clinical phrases for offline access
 * - guidelines: Cached clinical guidelines
 * - syncMetadata: Track last sync timestamps and conflict state
 */

import Dexie, { type EntityTable } from 'dexie';

// ============================================
// Type Definitions
// ============================================

export interface QueuedMutationDB {
  id: string;
  type: 'patient' | 'autotext' | 'phrase' | 'todo' | 'template' | 'dictionary';
  operation: 'create' | 'update' | 'delete';
  table: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status?: 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';
  entityId?: string;
  conflictResolution?: 'server-wins' | 'client-wins' | 'manual';
  conflictData?: Record<string, unknown>;
}

export interface CachedPatient {
  id: string;
  data: Record<string, unknown>;
  cachedAt: number;
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
  version: number;
}

export interface CachedPhrase {
  id: string;
  data: Record<string, unknown>;
  cachedAt: number;
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
  version: number;
}

export interface CachedGuideline {
  id: string;
  category: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

export interface SyncMetadata {
  id: string;
  tableName: string;
  lastSyncAt: number;
  lastSuccessfulSyncAt: number;
  pendingChanges: number;
  conflictCount: number;
  checksum?: string;
}

export interface AICacheEntry {
  id: string;
  queryHash: string;
  feature: string;
  query: string;
  response: string;
  model: string;
  cachedAt: number;
  expiresAt: number;
  hitCount: number;
}

// ============================================
// Database Class
// ============================================

class RoundRobinDatabase extends Dexie {
  mutations!: EntityTable<QueuedMutationDB, 'id'>;
  patients!: EntityTable<CachedPatient, 'id'>;
  phrases!: EntityTable<CachedPhrase, 'id'>;
  guidelines!: EntityTable<CachedGuideline, 'id'>;
  syncMetadata!: EntityTable<SyncMetadata, 'id'>;
  aiCache!: EntityTable<AICacheEntry, 'id'>;

  constructor() {
    super('RoundRobinNotesDB');
    
    this.version(2).stores({
      mutations: 'id, type, timestamp, entityId, status, [table+entityId]',
      patients: 'id, cachedAt, lastModified, syncStatus',
      phrases: 'id, cachedAt, lastModified, syncStatus',
      guidelines: 'id, category, cachedAt',
      syncMetadata: 'id, tableName, lastSyncAt',
      aiCache: 'id, queryHash, feature, cachedAt, expiresAt'
    });
  }
}

// ============================================
// Singleton Instance
// ============================================

export const db = new RoundRobinDatabase();

// ============================================
// Helper Functions
// ============================================

/**
 * Initialize database and verify connection
 */
export async function initializeDatabase(): Promise<boolean> {
  try {
    await db.open();
    console.log('[IndexedDB] Database initialized successfully');
    return true;
  } catch (error) {
    console.error('[IndexedDB] Failed to initialize database:', error);
    return false;
  }
}

/**
 * Clear all data from the database (use with caution)
 */
export async function clearAllData(): Promise<void> {
  try {
    await Promise.all([
      db.mutations.clear(),
      db.patients.clear(),
      db.phrases.clear(),
      db.guidelines.clear(),
      db.syncMetadata.clear(),
      db.aiCache.clear()
    ]);
    console.log('[IndexedDB] All data cleared');
  } catch (error) {
    console.error('[IndexedDB] Failed to clear data:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  mutations: number;
  patients: number;
  phrases: number;
  guidelines: number;
  aiCache: number;
}> {
  const [mutations, patients, phrases, guidelines, aiCache] = await Promise.all([
    db.mutations.count(),
    db.patients.count(),
    db.phrases.count(),
    db.guidelines.count(),
    db.aiCache.count()
  ]);
  
  return { mutations, patients, phrases, guidelines, aiCache };
}

/**
 * Export database contents for backup
 */
export async function exportDatabase(): Promise<{
  version: number;
  exportedAt: number;
  data: {
    mutations: QueuedMutationDB[];
    patients: CachedPatient[];
    phrases: CachedPhrase[];
    guidelines: CachedGuideline[];
  };
}> {
  const [mutations, patients, phrases, guidelines] = await Promise.all([
    db.mutations.toArray(),
    db.patients.toArray(),
    db.phrases.toArray(),
    db.guidelines.toArray()
  ]);
  
  return {
    version: 1,
    exportedAt: Date.now(),
    data: { mutations, patients, phrases, guidelines }
  };
}

/**
 * Import database contents from backup
 */
export async function importDatabase(backup: {
  version: number;
  data: {
    mutations: QueuedMutationDB[];
    patients: CachedPatient[];
    phrases: CachedPhrase[];
    guidelines: CachedGuideline[];
  };
}): Promise<void> {
  await db.transaction('rw', [db.mutations, db.patients, db.phrases, db.guidelines], async () => {
    await Promise.all([
      db.mutations.bulkPut(backup.data.mutations),
      db.patients.bulkPut(backup.data.patients),
      db.phrases.bulkPut(backup.data.phrases),
      db.guidelines.bulkPut(backup.data.guidelines)
    ]);
  });
  
  console.log('[IndexedDB] Database restored from backup');
}
