import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasSupabaseConfig, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CACHE_CONFIG, QUERY_KEYS } from '@/lib/cache/cacheConfig';
import { PatientTodo } from '@/types/todo';
import { indexedDBQueue } from '@/lib/offline/indexedDBQueue';
import { applyQueuedTodoMutations } from '@/hooks/usePatientTodos';
import {
  readPatientTodoSnapshot,
  writePatientTodoSnapshot,
} from '@/lib/offline/patientTodoSnapshot';
import { isBrowserKnownOffline } from '@/lib/networkConnectivity';

export interface PatientTodosMap {
  [patientId: string]: PatientTodo[];
}

type PatientTodoRow = {
  id: string;
  patient_id: string;
  user_id: string;
  section: string | null;
  content: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

function mapTodoRow(todo: PatientTodoRow): PatientTodo {
  return {
    id: todo.id,
    patientId: todo.patient_id,
    userId: todo.user_id,
    section: todo.section,
    content: todo.content,
    completed: todo.completed,
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
  };
}

function emptyTodosMap(patientIds: readonly string[]): PatientTodosMap {
  return Object.fromEntries(patientIds.map((patientId) => [patientId, []]));
}

export function applyQueuedTodoMap(
  baseMap: PatientTodosMap | null,
  queue: Awaited<ReturnType<typeof indexedDBQueue.getQueue>>,
  ownerId: string,
  patientIds: readonly string[],
): PatientTodosMap {
  const grouped = emptyTodosMap(patientIds);
  patientIds.forEach((patientId) => {
    const safeBase = (baseMap?.[patientId] ?? []).filter((todo) => (
      todo.userId === ownerId && todo.patientId === patientId
    ));
    grouped[patientId] = applyQueuedTodoMutations(
      safeBase,
      queue,
      ownerId,
      patientId,
    );
  });
  return grouped;
}

async function readOfflineTodoMap(
  ownerId: string,
  patientIds: readonly string[],
  isOwnerActive: () => boolean,
): Promise<PatientTodosMap> {
  const [snapshot, queue] = await Promise.all([
    readPatientTodoSnapshot(ownerId),
    indexedDBQueue.getQueue(),
  ]);
  if (!isOwnerActive()) return emptyTodosMap(patientIds);
  return applyQueuedTodoMap(snapshot, queue, ownerId, patientIds);
}

async function fetchTodosForPatients(
  ownerId: string,
  patientIds: string[],
  isOwnerActive: () => boolean,
): Promise<PatientTodosMap> {
  const grouped = emptyTodosMap(patientIds);

  if (patientIds.length === 0) {
    return grouped;
  }
  if (!hasSupabaseConfig || isBrowserKnownOffline()) {
    return readOfflineTodoMap(ownerId, patientIds, isOwnerActive);
  }

  const { data, error } = await supabase
    .from('patient_todos')
    .select('*')
    .in('patient_id', patientIds)
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false });

  if (!isOwnerActive()) return grouped;
  if (error) {
    if (isBrowserKnownOffline()) {
      return readOfflineTodoMap(ownerId, patientIds, isOwnerActive);
    }
    throw error;
  }

  const requestedPatientIds = new Set(patientIds);
  data?.forEach(todo => {
    const mappedTodo = mapTodoRow(todo as PatientTodoRow);
    if (mappedTodo.userId !== ownerId || !requestedPatientIds.has(mappedTodo.patientId)) return;
    grouped[mappedTodo.patientId].push(mappedTodo);
  });

  const queue = await indexedDBQueue.getQueue();
  if (!isOwnerActive()) return grouped;
  const resolved = applyQueuedTodoMap(grouped, queue, ownerId, patientIds);
  await writePatientTodoSnapshot(ownerId, resolved);

  return resolved;
}

export function useAllPatientTodos(patientIds: string[]) {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const queryClient = useQueryClient();
  const activeOwnerRef = useRef(ownerId);
  const mountedRef = useRef(true);
  activeOwnerRef.current = ownerId;
  const stablePatientIds = useMemo(
    () => Array.from(new Set(patientIds)).sort(),
    [patientIds],
  );
  const patientIdsKey = stablePatientIds.join('|');
  const queryEnabled = hasSupabaseConfig && !!ownerId && stablePatientIds.length > 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const query = useQuery<PatientTodosMap>({
    queryKey: [...QUERY_KEYS.allTodos, ownerId, patientIdsKey],
    queryFn: () => ownerId
      ? fetchTodosForPatients(
        ownerId,
        stablePatientIds,
        () => mountedRef.current && activeOwnerRef.current === ownerId,
      )
      : Promise.resolve({} as PatientTodosMap),
    enabled: queryEnabled,
    staleTime: CACHE_CONFIG.staleTime.todos,
    gcTime: CACHE_CONFIG.queries.todos,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
    networkMode: 'always',
    retry: (failureCount) => !isBrowserKnownOffline() && failureCount < 2,
  });

  useEffect(() => {
    if (!ownerId || activeOwnerRef.current !== ownerId || !query.data) return;

    void writePatientTodoSnapshot(ownerId, query.data);

    Object.entries(query.data).forEach(([patientId, todos]) => {
      if (todos.some((todo) => todo.userId !== ownerId)) return;
      queryClient.setQueryData(QUERY_KEYS.patientTodosForOwner(ownerId, patientId), todos);
    });
  }, [ownerId, query.data, queryClient]);

  useEffect(() => {
    if (ownerId && activeOwnerRef.current === ownerId && query.isError) {
      console.error('Error fetching patient todos');
    }
  }, [ownerId, query.isError]);

  const todosMap = ownerId && query.data
    && Object.values(query.data).every((todos) => todos.every((todo) => todo.userId === ownerId))
    ? query.data
    : {};

  return {
    todosMap,
    loading: Boolean(ownerId) && query.isFetching,
    refetch: async () => {
      if (!queryEnabled) return;
      await query.refetch();
    },
  };
}
