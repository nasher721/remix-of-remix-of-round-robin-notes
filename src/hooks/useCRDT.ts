import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface CRDTDoc {
  id: string;
  content: string;
  lastModified: Date;
  version: number;
}

export interface CRDTObserver {
  onSync: (content: string) => void;
  onConflict?: (localContent: string, remoteContent: string) => void;
  onError?: (error: Error) => void;
}

export interface UseCRDTOptions {
  tableName: string;
  idField: string;
  contentField: string;
  supabase: SupabaseClient;
  autoSync?: boolean;
  syncInterval?: number;
}

export interface UseCRDTReturn {
  content: string;
  isSyncing: boolean;
  isDirty: boolean;
  lastSynced: Date | null;
  version: number;
  update: (newContent: string) => void;
  sync: () => Promise<void>;
  reset: () => void;
  destroy: () => void;
}

export function useCRDT(
  docId: string,
  initialContent: string,
  options: CRDTObserver,
  crdtOptions: UseCRDTOptions
): UseCRDTReturn {
  const { onSync, onConflict, onError } = options;
  const { tableName, idField, contentField, supabase, autoSync = true, syncInterval = 5000 } = crdtOptions;

  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const providerRef = useRef<RealtimeChannel | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const isRemoteUpdate = useRef(false);
  const isLocalUpdate = useRef(false);

  const [content, setContent] = useState(initialContent);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    ydocRef.current = new Y.Doc();
    ytextRef.current = ydocRef.current.getText('content');

    persistenceRef.current = new IndexeddbPersistence(`crdt-${tableName}-${docId}`, ydocRef.current);
    persistenceRef.current.on('synced', () => {
      setContent(ytextRef.current?.toString() || '');
      setIsDirty(false);
    });

    const handleLocalChange = () => {
      if (!isRemoteUpdate.current && ytextRef.current) {
        isLocalUpdate.current = true;
        const newContent = ytextRef.current.toString();
        setContent(newContent);
        setIsDirty(true);
        onSync(newContent);
        isLocalUpdate.current = false;
      }
    };

    ytextRef.current.observe(handleLocalChange);

    const channel = supabase.channel(`crdt-${tableName}-${docId}`, {
      config: {
        presence: { key: docId },
        broadcast: { self: false },
      },
    });

    channel.on('broadcast', { event: 'crdt-update' }, (payload) => {
      if (ydocRef.current && payload.payload) {
        isRemoteUpdate.current = true;
        try {
          const update = new Uint8Array(payload.payload.update);
          Y.applyUpdate(ydocRef.current, update);
          setContent(ytextRef.current?.toString() || '');
          setIsDirty(false);
          setLastSynced(new Date());
          setVersion((v) => v + 1);
        } catch (err) {
          onError?.(err as Error);
        }
        isRemoteUpdate.current = false;
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        if (autoSync) {
          await syncFromServer();
        }
      }
    });

    providerRef.current = channel;

    const syncIntervalId = autoSync
      ? setInterval(() => {
          if (isDirty) {
            syncToServer();
          }
        }, syncInterval)
      : null;

    return () => {
      if (syncIntervalId) clearInterval(syncIntervalId);
      channel.unsubscribe();
      ytextRef.current?.unobserve(handleLocalChange);
      persistenceRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  }, [docId, tableName]);

  const syncFromServer = useCallback(async () => {
    if (!docId || !supabase) return;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select(`${idField}, ${contentField}, updated_at`)
        .eq(idField, docId)
        .single();

      if (error) throw error;

      if (data && ydocRef.current && ytextRef.current) {
        const remoteContent = data[contentField];
        const localContent = ytextRef.current.toString();

        if (remoteContent !== localContent) {
          if (onConflict && remoteContent) {
            onConflict(localContent, remoteContent);
          }

          ydocRef.current.transact(() => {
            ytextRef.current?.delete(0, ytextRef.current.length);
            ytextRef.current?.insert(0, remoteContent);
          });

          setContent(remoteContent);
          setVersion((v) => v + 1);
        }

        setLastSynced(new Date());
      }
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsSyncing(false);
    }
  }, [docId, tableName, idField, contentField, supabase, onConflict, onError]);

  const syncToServer = useCallback(async () => {
    if (!docId || !supabase || !isDirty) return;

    setIsSyncing(true);
    try {
      const currentContent = ytextRef.current?.toString() || '';

      const { error } = await supabase
        .from(tableName)
        .update({
          [contentField]: currentContent,
          updated_at: new Date().toISOString(),
        })
        .eq(idField, docId);

      if (error) throw error;

      if (providerRef.current) {
        const stateVector = Y.encodeStateVector(ydocRef.current);
        providerRef.current.send({
          type: 'broadcast',
          event: 'crdt-update',
          payload: { update: Array.from(stateVector) },
        });
      }

      setIsDirty(false);
      setLastSynced(new Date());
    } catch (err) {
      onError?.(err as Error);
    } finally {
      setIsSyncing(false);
    }
  }, [docId, tableName, idField, contentField, supabase, isDirty, onError]);

  const update = useCallback(
    (newContent: string) => {
      if (ytextRef.current && ydocRef.current && !isRemoteUpdate.current) {
        ydocRef.current.transact(() => {
          ytextRef.current?.delete(0, ytextRef.current.length);
          ytextRef.current?.insert(0, newContent);
        });
        setContent(newContent);
        setIsDirty(true);
        setVersion((v) => v + 1);
      }
    },
    []
  );

  const sync = useCallback(async () => {
    await syncToServer();
    await syncFromServer();
  }, [syncToServer, syncFromServer]);

  const reset = useCallback(() => {
    if (ytextRef.current && ydocRef.current) {
      ydocRef.current.transact(() => {
        ytextRef.current?.delete(0, ytextRef.current.length);
        ytextRef.current?.insert(0, initialContent);
      });
      setContent(initialContent);
      setIsDirty(false);
    }
  }, [initialContent]);

  const destroy = useCallback(() => {
    providerRef.current?.unsubscribe();
    persistenceRef.current?.destroy();
    ydocRef.current?.destroy();
  }, []);

  return {
    content,
    isSyncing,
    isDirty,
    lastSynced,
    version,
    update,
    sync,
    reset,
    destroy,
  };
}
