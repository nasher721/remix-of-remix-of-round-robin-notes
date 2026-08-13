import type { Patient } from '@/types/patient';
import { logInfo } from '@/lib/observability/logger';
import {
  AUTH_OWNER_METADATA_ID,
  db,
  type CachedPatient,
  type SyncMetadata,
} from './database';
import { offlineOwnerTransitionBarrier } from './ownerTransitionBarrier';

const PATIENT_ROSTER_SNAPSHOT_ID = '__patient_roster_snapshot__';
let rosterWriteTail: Promise<void> = Promise.resolve();

function lastModifiedEpoch(patient: Patient): number {
  const parsed = Date.parse(patient.lastModified);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildCachedPatientRows(
  patients: readonly Patient[],
  cachedAt: number,
): CachedPatient[] {
  return patients.map((patient) => ({
    id: patient.id,
    data: patient as unknown as Record<string, unknown>,
    cachedAt,
    lastModified: lastModifiedEpoch(patient),
    syncStatus: 'synced',
    version: patient.revision ?? 0,
  }));
}

function isPatient(value: unknown): value is Patient {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Patient>;
  return typeof candidate.id === 'string'
    && typeof candidate.patientNumber === 'number'
    && typeof candidate.name === 'string'
    && typeof candidate.clinicalSummary === 'string'
    && typeof candidate.systems === 'object'
    && candidate.systems !== null;
}

/**
 * Persist the last owner-scoped server/UI roster atomically. The database is
 * globally bound to one authenticated owner; the metadata check prevents a
 * stale async write from crossing an auth transition.
 */
export async function writePatientRosterSnapshot(
  ownerId: string,
  patients: readonly Patient[],
): Promise<boolean> {
  if (typeof globalThis.indexedDB === 'undefined') return false;

  try {
    const write = rosterWriteTail.then(() => (
      offlineOwnerTransitionBarrier.runOperation(async () => {
        await db.open();
        return db.transaction('rw', db.patients, db.syncMetadata, async () => {
          const owner = await db.syncMetadata.get(AUTH_OWNER_METADATA_ID);
          if (owner?.ownerId !== ownerId) return false;

          const cachedAt = Date.now();
          const rows = buildCachedPatientRows(patients, cachedAt);
          const snapshotMetadata: SyncMetadata = {
            id: PATIENT_ROSTER_SNAPSHOT_ID,
            tableName: 'patients',
            lastSyncAt: cachedAt,
            lastSuccessfulSyncAt: cachedAt,
            pendingChanges: 0,
            conflictCount: 0,
            ownerId,
          };

          await db.patients.clear();
          if (rows.length > 0) await db.patients.bulkPut(rows);
          await db.syncMetadata.put(snapshotMetadata);
          return true;
        });
      })
    ));
    rosterWriteTail = write.then(() => undefined, () => undefined);
    return await write;
  } catch (error) {
    logInfo(`[PatientRosterCache] Snapshot unavailable: ${error instanceof Error ? error.name : 'storage_error'}`);
    return false;
  }
}

/** Return null when no trustworthy snapshot exists; [] is a valid empty roster. */
export async function readPatientRosterSnapshot(ownerId: string): Promise<Patient[] | null> {
  if (typeof globalThis.indexedDB === 'undefined') return null;

  try {
    return await offlineOwnerTransitionBarrier.runOperation(async () => {
      await db.open();
      return db.transaction('r', db.patients, db.syncMetadata, async () => {
        const [owner, snapshot, rows] = await Promise.all([
          db.syncMetadata.get(AUTH_OWNER_METADATA_ID),
          db.syncMetadata.get(PATIENT_ROSTER_SNAPSHOT_ID),
          db.patients.toArray(),
        ]);
        if (owner?.ownerId !== ownerId || snapshot?.ownerId !== ownerId) return null;

        return rows
          .map((row): unknown => row.data)
          .filter(isPatient)
          .sort((left, right) => left.patientNumber - right.patientNumber);
      });
    });
  } catch (error) {
    logInfo(`[PatientRosterCache] Restore unavailable: ${error instanceof Error ? error.name : 'storage_error'}`);
    return null;
  }
}
