import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasSupabaseConfig, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CACHE_CONFIG, QUERY_KEYS } from '@/lib/cache/cacheConfig';
import { PatientTodo } from '@/types/todo';

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

async function fetchTodosForPatients(patientIds: string[]): Promise<PatientTodosMap> {
  const grouped: PatientTodosMap = {};
  patientIds.forEach(id => { grouped[id] = []; });

  if (patientIds.length === 0 || !hasSupabaseConfig) {
    return grouped;
  }

  const { data, error } = await supabase
    .from('patient_todos')
    .select('*')
    .in('patient_id', patientIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  data?.forEach(todo => {
    const mappedTodo = mapTodoRow(todo as PatientTodoRow);
    if (!grouped[mappedTodo.patientId]) {
      grouped[mappedTodo.patientId] = [];
    }
    grouped[mappedTodo.patientId].push(mappedTodo);
  });

  return grouped;
}

export function useAllPatientTodos(patientIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const stablePatientIds = useMemo(
    () => Array.from(new Set(patientIds)).sort(),
    [patientIds],
  );
  const patientIdsKey = stablePatientIds.join('|');
  const queryEnabled = hasSupabaseConfig && !!user && stablePatientIds.length > 0;

  const query = useQuery({
    queryKey: [...QUERY_KEYS.allTodos, user?.id ?? null, patientIdsKey],
    queryFn: () => fetchTodosForPatients(stablePatientIds),
    enabled: queryEnabled,
    staleTime: CACHE_CONFIG.staleTime.todos,
    gcTime: CACHE_CONFIG.queries.todos,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  useEffect(() => {
    if (!query.data) return;

    Object.entries(query.data).forEach(([patientId, todos]) => {
      queryClient.setQueryData(QUERY_KEYS.patientTodos(patientId), todos);
    });
  }, [query.data, queryClient]);

  useEffect(() => {
    if (query.isError) {
      console.error('Error fetching all patient todos:', query.error);
    }
  }, [query.error, query.isError]);

  return {
    todosMap: query.data ?? {},
    loading: query.isFetching,
    refetch: async () => {
      if (!queryEnabled) return;
      await query.refetch();
    },
  };
}
