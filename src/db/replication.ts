import { replicateSupabase } from 'rxdb/plugins/replication-supabase';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getDatabase, PatientDocType } from './database';

// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Replication state for UI
export interface ReplicationState {
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;
  docsProcessed: number;
}

// Replication state change handler
type ReplicationStateHandler = (state: ReplicationState) => void;
const stateHandlers: Set<ReplicationStateHandler> = new Set();
let currentState: ReplicationState = {
  isSyncing: false,
  lastSync: null,
  error: null,
  docsProcessed: 0,
};

/**
 * Subscribe to replication state changes
 */
export function subscribeToReplicationState(handler: ReplicationStateHandler): () => void {
  stateHandlers.add(handler);
  handler(currentState); // Immediately call with current state
  return () => stateHandlers.delete(handler);
}

/**
 * Update and broadcast replication state
 */
function updateState(updates: Partial<ReplicationState>): void {
  currentState = { ...currentState, ...updates };
  stateHandlers.forEach(handler => handler(currentState));
}

// Active replication instances (using any to avoid generic type issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activeReplications: Map<string, any> = new Map();

/**
 * Start Supabase replication for a user
 */
export async function startReplication(userId: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[RxDB] Missing Supabase configuration');
    return;
  }

  // Stop existing replication if any
  await stopReplication();

  const db = await getDatabase();
  
  // Create Supabase client
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Create replication
  const replication = replicateSupabase<PatientDocType>({
    collection: db.patients,
    client: supabaseClient as SupabaseClient,
    tableName: 'patients',
    replicationIdentifier: `patients-${SUPABASE_URL}`,
    live: true,
    pull: {
      batchSize: 100,
    },
    push: {
      batchSize: 50,
    },
  });

  activeReplications.set(userId, replication);

  // Set up event handlers
  replication.active$.subscribe((isActive) => {
    if (isActive) {
      updateState({ isSyncing: true });
    }
  });

  replication.active$.subscribe((isActive) => {
    updateState({ isSyncing: isActive });
    if (!isActive) {
      updateState({ lastSync: Date.now() });
    }
  });

  replication.error$.subscribe((error) => {
    console.error('[RxDB] Replication error:', error);
    updateState({ error: error.message || 'Replication error' });
  });

  replication.received$.subscribe((doc) => {
    updateState({ docsProcessed: currentState.docsProcessed + 1 });
  });

  replication.sent$.subscribe(() => {
    console.log('[RxDB] Pushed document to server');
  });

  console.log('[RxDB] Replication started for user:', userId);
}

/**
 * Stop active replication
 */
export async function stopReplication(): Promise<void> {
  for (const [userId, replication] of activeReplications) {
    await replication.cancel();
    activeReplications.delete(userId);
    console.log('[RxDB] Replication stopped for user:', userId);
  }
  updateState({ isSyncing: false });
}

/**
 * Force re-sync (e.g., after coming back online)
 */
export async function forceResync(): Promise<void> {
  for (const replication of activeReplications.values()) {
    await replication.reSync();
  }
  console.log('[RxDB] Forced re-sync');
}

/**
 * Get current replication state
 */
export function getReplicationState(): ReplicationState {
  return currentState;
}

// Set up online/offline handlers
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[RxDB] Back online, forcing re-sync');
    forceResync();
    updateState({ error: null });
  });

  window.addEventListener('offline', () => {
    console.log('[RxDB] Gone offline');
    updateState({ error: 'Offline - changes will sync when back online' });
  });
}
