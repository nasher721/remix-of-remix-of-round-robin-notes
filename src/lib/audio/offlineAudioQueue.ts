import { db, isIndexedDBAvailable, type QueuedAudioDictation } from "@/lib/offline/database";
import { logInfo, logWarn } from "@/lib/observability/logger";

export interface EnqueueAudioDictationParams {
  patientId: string;
  systemKey: string;
  transcript: string;
  ownerId?: string;
}

export type DictationSyncHandler = (dictation: QueuedAudioDictation) => Promise<void>;

let activeSyncHandler: DictationSyncHandler | null = null;
let onlineListenerRegistered = false;

/**
 * Register a domain sync handler that applies pending offline dictations
 * to the remote patient record/draft note when connectivity is active.
 */
export function registerDictationSyncHandler(handler: DictationSyncHandler): () => void {
  activeSyncHandler = handler;
  ensureOnlineListener();
  return () => {
    if (activeSyncHandler === handler) {
      activeSyncHandler = null;
    }
  };
}

/**
 * Enqueues a dictated transcript into IndexedDB. If online and a sync handler is registered,
 * flushes immediately; otherwise keeps the record in 'pending' state for auto-reconnect drain.
 */
export async function enqueueOfflineDictation(
  params: EnqueueAudioDictationParams,
): Promise<QueuedAudioDictation> {
  const entry: QueuedAudioDictation = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    patientId: params.patientId,
    systemKey: params.systemKey,
    transcript: params.transcript,
    ownerId: params.ownerId,
    timestamp: Date.now(),
    status: "pending",
    retryCount: 0,
  };

  if (isIndexedDBAvailable()) {
    try {
      await db.audioDictations.put(entry);
    } catch (err) {
      logWarn("Failed to persist audio dictation to IndexedDB", {
        patientId: params.patientId,
        systemKey: params.systemKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // If online, attempt immediate sync
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (isOnline && activeSyncHandler) {
    try {
      await activeSyncHandler(entry);
      if (isIndexedDBAvailable()) {
        await db.audioDictations.update(entry.id, { status: "synced" });
      }
      entry.status = "synced";
    } catch {
      // Retains 'pending' status for subsequent drain
    }
  }

  return entry;
}

/**
 * Get all pending audio dictations from the local offline store.
 */
export async function getPendingAudioDictations(
  patientId?: string,
): Promise<QueuedAudioDictation[]> {
  if (!isIndexedDBAvailable()) return [];

  try {
    const allPending = await db.audioDictations
      .where("status")
      .equals("pending")
      .toArray();

    if (patientId) {
      return allPending.filter((item) => item.patientId === patientId);
    }
    return allPending;
  } catch {
    return [];
  }
}

/**
 * Drains and syncs all pending audio dictations once network connectivity returns.
 */
export async function flushPendingAudioDictations(
  customHandler?: DictationSyncHandler,
): Promise<{ flushed: number; failed: number }> {
  const handler = customHandler || activeSyncHandler;
  const pending = await getPendingAudioDictations();

  if (pending.length === 0) {
    return { flushed: 0, failed: 0 };
  }

  let flushed = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      if (handler) {
        await handler(item);
      }
      if (isIndexedDBAvailable()) {
        await db.audioDictations.update(item.id, { status: "synced" });
      }
      flushed++;
    } catch (err) {
      failed++;
      if (isIndexedDBAvailable()) {
        await db.audioDictations.update(item.id, {
          retryCount: (item.retryCount || 0) + 1,
          status: (item.retryCount || 0) >= 5 ? "failed" : "pending",
        });
      }
      logWarn("Failed to sync queued audio dictation", {
        id: item.id,
        patientId: item.patientId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logInfo("Flushed pending audio dictations", { flushed, failed });
  return { flushed, failed };
}

function ensureOnlineListener(): void {
  if (onlineListenerRegistered || typeof window === "undefined") return;

  window.addEventListener("online", () => {
    logInfo("Network connection restored: draining offline audio dictation buffer");
    void flushPendingAudioDictations();
  });

  onlineListenerRegistered = true;
}
