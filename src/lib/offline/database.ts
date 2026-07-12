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
import { logInfo } from '../observability/logger';

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
  /** The authenticated user that owns this mutation. */
  ownerId?: string;
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
  ownerId?: string;
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

    // Raw AI prompts and responses were cached by older builds. The cache is
    // unused and can contain clinical text, so remove its object store.
    this.version(3).stores({
      aiCache: null,
    });
  }
}

// ============================================
// Singleton Instance
// ============================================

export const db = new RoundRobinDatabase();

const AUTH_OWNER_METADATA_ID = '__auth_owner__';

export type DataOwnerTransition = 'preserved' | 'cleared' | 'claimed';
export type DataOwnerAction = 'preserve' | 'clear' | 'clear-and-claim';

export function decideDataOwnerAction(
  currentOwnerId: string | null,
  nextOwnerId: string | null,
): DataOwnerAction {
  if (nextOwnerId !== null && currentOwnerId === nextOwnerId) return 'preserve';
  return nextOwnerId === null ? 'clear' : 'clear-and-claim';
}

const allDataTables = () => [
  db.mutations,
  db.patients,
  db.phrases,
  db.guidelines,
  db.syncMetadata,
];

async function clearAllTables(): Promise<void> {
  await Promise.all([
    db.mutations.clear(),
    db.patients.clear(),
    db.phrases.clear(),
    db.guidelines.clear(),
    db.syncMetadata.clear(),
  ]);
}

/**
 * Keep the browser database bound to exactly one authenticated user.
 *
 * The ownership check, purge, and claim run in one IndexedDB transaction, so a
 * crash cannot leave another user's records associated with the new identity.
 * Data created before ownership markers existed is deliberately quarantined by
 * clearing it before the first user claims the database.
 */
export async function transitionDatabaseOwner(
  nextOwnerId: string | null,
): Promise<DataOwnerTransition> {
  await db.open();

  return db.transaction('rw', allDataTables(), async (): Promise<DataOwnerTransition> => {
    const ownerRecord = await db.syncMetadata.get(AUTH_OWNER_METADATA_ID);
    const currentOwnerId = ownerRecord?.ownerId ?? null;
    const action = decideDataOwnerAction(currentOwnerId, nextOwnerId);

    if (action === 'preserve') {
      return 'preserved';
    }

    await clearAllTables();

    if (nextOwnerId === null) {
      return 'cleared';
    }

    await db.syncMetadata.put({
      id: AUTH_OWNER_METADATA_ID,
      tableName: AUTH_OWNER_METADATA_ID,
      lastSyncAt: Date.now(),
      lastSuccessfulSyncAt: Date.now(),
      pendingChanges: 0,
      conflictCount: 0,
      ownerId: nextOwnerId,
    });

    return 'claimed';
  });
}

export async function getDatabaseOwner(): Promise<string | null> {
  await db.open();
  return (await db.syncMetadata.get(AUTH_OWNER_METADATA_ID))?.ownerId ?? null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Initialize database and verify connection
 */
export async function initializeDatabase(): Promise<boolean> {
  try {
    await db.open();
    logInfo('[IndexedDB] Database initialized successfully');
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
    await db.transaction('rw', allDataTables(), clearAllTables);
    logInfo('[IndexedDB] All data cleared');
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
}> {
  const [mutations, patients, phrases, guidelines] = await Promise.all([
    db.mutations.count(),
    db.patients.count(),
    db.phrases.count(),
    db.guidelines.count(),
  ]);
  
  return { mutations, patients, phrases, guidelines };
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
  
  logInfo('[IndexedDB] Database restored from backup');
}
