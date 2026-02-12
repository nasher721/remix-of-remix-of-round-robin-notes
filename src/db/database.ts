import { createRxDatabase, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { patientSchema, PatientDocType } from './patient.schema';

// Type for patients collection
export type PatientCollection = RxCollection<PatientDocType>;

// Type for the database
export type RoundRobinDatabase = RxDatabase<{
  patients: PatientCollection;
}>;

// Database singleton
let dbPromise: Promise<RoundRobinDatabase> | null = null;

/**
 * Create or get the RxDB database
 */
export async function createDatabase(): Promise<RoundRobinDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    const database = await createRxDatabase<RoundRobinDatabase>({
      name: 'roundrobin',
      storage: getRxStorageDexie(),
      multiInstance: true, // Enable multi-tab support
      eventReduce: true, // Enable event reduce for better performance
    });

    // Add patients collection
    await database.addCollections({
      patients: {
        schema: patientSchema,
      },
    });

    console.log('[RxDB] Database initialized');
    return database;
  })();

  return dbPromise;
}

/**
 * Get the database instance (must call createDatabase first)
 */
export function getDatabase(): Promise<RoundRobinDatabase> {
  if (!dbPromise) {
    return createDatabase();
  }
  return dbPromise;
}

/**
 * Reset the database (for testing/logout)
 */
export async function resetDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.remove();
    dbPromise = null;
    console.log('[RxDB] Database reset');
  }
}

// Re-export types and converters
export { flattenPatient, unflattenPatient } from './patient.schema';
export type { PatientDocType, PatientNested } from './patient.schema';
