import { cacheHydration } from '@/lib/cache/queryClientConfig';
import { reconcileFHIRStateForAuthOwner } from '@/integrations/fhir/client';
import { clearTelemetry } from '@/lib/observability/telemetry';
import {
  decideDataOwnerAction,
  getDatabaseOwner,
  transitionDatabaseOwner,
} from '@/lib/offline/database';
import { indexedDBQueue } from '@/lib/offline/indexedDBQueue';
import { syncEngine } from '@/lib/offline/syncEngine';

type EnumerableIDBFactory = IDBFactory & {
  databases?: () => Promise<Array<{ name?: string }>>;
};

function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${name}`));
    request.onblocked = () => reject(new Error(`Deletion of ${name} was blocked`));
  });
}

/** Delete Yjs persistence stores that live outside RoundRobinNotesDB. */
export async function clearCrdtDatabases(
  factory: EnumerableIDBFactory | undefined = globalThis.indexedDB,
): Promise<void> {
  if (!factory) return;
  if (typeof factory.databases !== 'function') {
    throw new Error(
      'This browser cannot enumerate offline collaboration databases; refusing an unsafe auth transition.',
    );
  }

  const databaseNames = (await factory.databases())
    .map(database => database.name)
    .filter((name): name is string => Boolean(name?.startsWith('crdt-')));
  await Promise.all(databaseNames.map(name => deleteDatabase(factory, name)));
}

/**
 * Prepare local data for exactly one authenticated identity. Same-user reloads
 * preserve owned IndexedDB work; sign-out, user changes, and unowned legacy
 * data are purged before the new identity is published to React.
 */
export async function prepareSensitiveClientState(ownerId: string | null): Promise<void> {
  let resumeSync: (() => void) | undefined;

  try {
    await indexedDBQueue.transitionOwner(ownerId, async () => {
      resumeSync = await syncEngine.pauseForAuthTransition();
      cacheHydration.clear();
      reconcileFHIRStateForAuthOwner(ownerId);

      if (typeof globalThis.indexedDB !== 'undefined') {
        const currentOwnerId = await getDatabaseOwner();
        if (decideDataOwnerAction(currentOwnerId, ownerId) !== 'preserve') {
          await clearCrdtDatabases();
        }
        await transitionDatabaseOwner(ownerId);
      }

      await clearTelemetry();
    });
  } finally {
    resumeSync?.();
  }
}

export async function clearSensitiveClientState(): Promise<void> {
  await prepareSensitiveClientState(null);
}
