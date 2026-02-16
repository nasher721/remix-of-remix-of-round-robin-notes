import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getDatabase, resetDatabase, RoundRobinDatabase } from './database';
import { 
  startReplication, 
  stopReplication, 
  subscribeToReplicationState, 
  forceResync,
  ReplicationState 
} from './replication';
import { useAuth } from '@/hooks/useAuth';

// Database context type
interface DatabaseContextType {
  database: RoundRobinDatabase | null;
  isInitialized: boolean;
  replicationState: ReplicationState;
  resync: () => Promise<void>;
}

// Create context
const DatabaseContext = createContext<DatabaseContextType>({
  database: null,
  isInitialized: false,
  replicationState: {
    isSyncing: false,
    lastSync: null,
    error: null,
    docsProcessed: 0,
  },
  resync: async () => {},
});

// Hook to use database context
export function useDatabase(): DatabaseContextType {
  return useContext(DatabaseContext);
}

// Hook to get database instance (throws if not initialized)
export function useDatabaseRequired(): RoundRobinDatabase {
  const { database, isInitialized } = useDatabase();
  
  if (!isInitialized || !database) {
    throw new Error('Database not initialized. Ensure DatabaseProvider is mounted.');
  }
  
  return database;
}

// Provider component
interface DatabaseProviderProps {
  children: React.ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps): JSX.Element {
  const { user } = useAuth();
  const [database, setDatabase] = useState<RoundRobinDatabase | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [replicationState, setReplicationState] = useState<ReplicationState>({
    isSyncing: false,
    lastSync: null,
    error: null,
    docsProcessed: 0,
  });

  // Initialize database on mount
  useEffect(() => {
    let mounted = true;

    async function initDatabase() {
      try {
        const db = await getDatabase();
        if (mounted) {
          setDatabase(db);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('[DatabaseProvider] Failed to initialize database:', error);
        if (mounted) {
          setReplicationState(prev => ({
            ...prev,
            error: 'Failed to initialize database',
          }));
        }
      }
    }

    initDatabase();

    return () => {
      mounted = false;
    };
  }, []);

  // Start/stop replication based on auth state
  useEffect(() => {
    if (!isInitialized || !user) return;

    // Start replication when user is logged in
    startReplication(user.id);

    // Subscribe to replication state
    const unsubscribe = subscribeToReplicationState(setReplicationState);

    return () => {
      unsubscribe();
      stopReplication();
    };
  }, [isInitialized, user]);

  // Handle logout - reset database
  useEffect(() => {
    if (!user && isInitialized) {
      // User logged out, stop replication and optionally reset
      stopReplication();
      // Don't reset database on logout to allow quick re-login
      // Reset would clear local data
    }
  }, [user, isInitialized]);

  // Manual resync function
  const resync = useCallback(async () => {
    await forceResync();
  }, []);

  const value: DatabaseContextType = {
    database,
    isInitialized,
    replicationState,
    resync,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export default DatabaseProvider;
