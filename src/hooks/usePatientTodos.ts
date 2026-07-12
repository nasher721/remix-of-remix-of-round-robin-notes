import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PatientTodo, TodoSection } from '@/types/todo';
import { Patient } from '@/types/patient';
import { QUERY_KEYS } from '@/lib/cache/cacheConfig';
import type { PatientTodosMap } from '@/hooks/useAllPatientTodos';
import { useSettings } from '@/contexts/SettingsContext';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

export interface UsePatientTodosOptions {
  /** When provided, use as initial state and skip the initial fetch (avoids duplicate fetches when parent already has todos, e.g. from todosMap). */
  initialTodos?: PatientTodo[];
}

type TodoListUpdater = (todos: PatientTodo[]) => PatientTodo[];

interface OwnedTodoState {
  ownerId: string | null;
  patientId: string | null;
  todos: PatientTodo[];
}

interface OwnedBusyState {
  ownerId: string | null;
  patientId: string | null;
  active: boolean;
}

function mapTodoRecord(
  todo: Record<string, unknown>,
  fallback: {
    patientId: string;
    userId: string;
    section: string | null;
    content: string;
    completed?: boolean;
  },
): PatientTodo {
  const createdAt = String(todo.created_at ?? new Date().toISOString());
  return {
    id: String(todo.id),
    patientId: String(todo.patient_id ?? fallback.patientId),
    userId: String(todo.user_id ?? fallback.userId),
    section: (todo.section as string | null | undefined) ?? fallback.section,
    content: String(todo.content ?? fallback.content),
    completed: Boolean(todo.completed ?? fallback.completed ?? false),
    createdAt,
    updatedAt: String(todo.updated_at ?? createdAt),
  };
}

export function updateTodosMapForPatient(
  currentMap: PatientTodosMap | undefined,
  patientId: string,
  updater: TodoListUpdater,
): PatientTodosMap | undefined {
  if (!currentMap || !Object.prototype.hasOwnProperty.call(currentMap, patientId)) {
    return currentMap;
  }

  return {
    ...currentMap,
    [patientId]: updater(currentMap[patientId] ?? []),
  };
}

function writePatientTodosCache(
  queryClient: QueryClient,
  ownerId: string,
  patientId: string,
  updater: TodoListUpdater,
) {
  const updateOwnedTodos = (currentTodos: PatientTodo[]) => (
    updater(currentTodos.filter((todo) => todo.userId === ownerId && todo.patientId === patientId))
  );
  queryClient.setQueryData<PatientTodo[]>(QUERY_KEYS.patientTodosForOwner(ownerId, patientId), (currentTodos) =>
    updateOwnedTodos(currentTodos ?? []),
  );
  queryClient.setQueriesData<PatientTodosMap>(
    { queryKey: [...QUERY_KEYS.allTodos, ownerId] },
    (currentMap) => updateTodosMapForPatient(currentMap, patientId, updateOwnedTodos),
  );
}

function prependTodos(newTodos: PatientTodo[]): TodoListUpdater {
  return (currentTodos) => {
    const newTodoIds = new Set(newTodos.map((todo) => todo.id));
    return [...newTodos, ...currentTodos.filter((todo) => !newTodoIds.has(todo.id))];
  };
}

export function usePatientTodos(patientId: string | null, options?: UsePatientTodosOptions) {
  const initialTodos = options?.initialTodos;
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [todoState, setTodoState] = useState<OwnedTodoState>(() => ({
    ownerId,
    patientId,
    todos: ownerId && patientId
      ? (initialTodos ?? []).filter((todo) => todo.userId === ownerId && todo.patientId === patientId)
      : [],
  }));
  const [loadingState, setLoadingState] = useState<OwnedBusyState>({
    ownerId: null,
    patientId: null,
    active: false,
  });
  const [generatingState, setGeneratingState] = useState<OwnedBusyState>({
    ownerId: null,
    patientId: null,
    active: false,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getModelForFeature } = useSettings();
  const mountedRef = useRef(true);
  const activeIdentityRef = useRef({ ownerId, patientId });
  activeIdentityRef.current = { ownerId, patientId };
  const latestInitialTodos = useRef(initialTodos);
  const initialTodosKey = useMemo(() => {
    if (initialTodos === undefined) return null;
    const todoKey = initialTodos
      .map((todo) => `${todo.id}:${todo.updatedAt}:${todo.completed}:${todo.content}`)
      .join('|');
    return `${ownerId ?? ''}:${patientId ?? ''}:${todoKey}`;
  }, [initialTodos, ownerId, patientId]);

  const isActiveRequest = useCallback((requestOwnerId: string, requestPatientId: string) => {
    const activeIdentity = activeIdentityRef.current;
    return mountedRef.current
      && activeIdentity.ownerId === requestOwnerId
      && activeIdentity.patientId === requestPatientId;
  }, []);

  const commitTodos = useCallback((
    requestOwnerId: string,
    requestPatientId: string,
    updater: TodoListUpdater,
  ) => {
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return false;

    setTodoState((currentState) => {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return currentState;
      const currentTodos = currentState.ownerId === requestOwnerId
        && currentState.patientId === requestPatientId
        ? currentState.todos
        : [];
      return {
        ownerId: requestOwnerId,
        patientId: requestPatientId,
        todos: updater(currentTodos),
      };
    });
    return true;
  }, [isActiveRequest]);

  const todos = useMemo(
    () => todoState.ownerId === ownerId && todoState.patientId === patientId
      ? todoState.todos
      : [],
    [ownerId, patientId, todoState],
  );
  const loading = loadingState.ownerId === ownerId
    && loadingState.patientId === patientId
    && loadingState.active;
  const generating = generatingState.ownerId === ownerId
    && generatingState.patientId === patientId
    && generatingState.active;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestInitialTodos.current = initialTodos;
  }, [initialTodos]);

  const fetchTodos = useCallback(async () => {
    if (!patientId || !ownerId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;

    setLoadingState({
      ownerId: requestOwnerId,
      patientId: requestPatientId,
      active: true,
    });
    try {
      const { data, error } = await supabase
        .from('patient_todos')
        .select('*')
        .eq('patient_id', requestPatientId)
        .eq('user_id', requestOwnerId)
        .order('created_at', { ascending: false });

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;

      const nextTodos = data?.map(todo => mapTodoRecord(todo, {
        patientId: requestPatientId,
        userId: requestOwnerId,
        section: null,
        content: '',
      })).filter((todo) => (
        todo.userId === requestOwnerId && todo.patientId === requestPatientId
      )) || [];
      if (!commitTodos(requestOwnerId, requestPatientId, () => nextTodos)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, () => nextTodos);
    } catch {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      console.error('Error fetching patient todos');
    } finally {
      if (isActiveRequest(requestOwnerId, requestPatientId)) {
        setLoadingState({
          ownerId: requestOwnerId,
          patientId: requestPatientId,
          active: false,
        });
      }
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient]);

  useEffect(() => {
    if (initialTodos !== undefined) return;
    fetchTodos();
  }, [fetchTodos, initialTodos]);

  useEffect(() => {
    if (initialTodosKey === null) return;
    if (!ownerId || !patientId || !isActiveRequest(ownerId, patientId)) return;
    const safeInitialTodos = (latestInitialTodos.current ?? []).filter((todo) => (
      todo.userId === ownerId && todo.patientId === patientId
    ));
    commitTodos(ownerId, patientId, () => safeInitialTodos);
    setLoadingState({ ownerId, patientId, active: false });
  }, [commitTodos, initialTodosKey, isActiveRequest, ownerId, patientId]);

  const addTodo = useCallback(async (content: string, section: string | null = null) => {
    if (!patientId || !ownerId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;

    try {
      const { data, error } = await supabase
        .from('patient_todos')
        .insert({
          patient_id: requestPatientId,
          user_id: requestOwnerId,
          section,
          content,
          completed: false,
        })
        .select()
        .single();

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;
      if (data == null) {
        toast({ title: "Error", description: "No data returned from insert", variant: "destructive" });
        return;
      }

      const newTodo = mapTodoRecord(data, {
        patientId: requestPatientId,
        userId: requestOwnerId,
        section,
        content,
      });
      if (newTodo.userId !== requestOwnerId || newTodo.patientId !== requestPatientId) {
        throw new Error('Todo insert returned data for a different owner');
      }

      const applyAddedTodo = prependTodos([newTodo]);
      if (!commitTodos(requestOwnerId, requestPatientId, applyAddedTodo)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyAddedTodo);
      return newTodo;
    } catch {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      console.error('Error adding patient todo');
      toast({
        title: "Error",
        description: "Failed to add todo",
        variant: "destructive",
      });
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient, toast]);

  const toggleTodo = useCallback(async (todoId: string) => {
    if (!ownerId || !patientId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.userId !== requestOwnerId || todo.patientId !== requestPatientId) return;
    const nextCompleted = !todo.completed;

    try {
      const { error } = await supabase
        .from('patient_todos')
        .update({ completed: nextCompleted })
        .eq('id', todoId);

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;

      const applyToggle = (currentTodos: PatientTodo[]) => currentTodos.map(t =>
        t.id === todoId ? { ...t, completed: nextCompleted } : t
      );

      if (!commitTodos(requestOwnerId, requestPatientId, applyToggle)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyToggle);
    } catch {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      console.error('Error toggling patient todo');
      toast({
        title: "Error",
        description: "Failed to update todo",
        variant: "destructive",
      });
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient, todos, toast]);

  const deleteTodo = useCallback(async (todoId: string) => {
    if (!ownerId || !patientId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
    const todo = todos.find(t => t.id === todoId);
    if (todo && (todo.userId !== requestOwnerId || todo.patientId !== requestPatientId)) return;

    try {
      const { error } = await supabase
        .from('patient_todos')
        .delete()
        .eq('id', todoId);

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;

      const applyDelete = (currentTodos: PatientTodo[]) => currentTodos.filter(t => t.id !== todoId);
      if (!commitTodos(requestOwnerId, requestPatientId, applyDelete)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyDelete);
    } catch {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      console.error('Error deleting patient todo');
      toast({
        title: "Error",
        description: "Failed to delete todo",
        variant: "destructive",
      });
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient, todos, toast]);

  const generateTodos = useCallback(async (patient: Patient, section: TodoSection) => {
    if (!patientId || !ownerId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;

    setGeneratingState({
      ownerId: requestOwnerId,
      patientId: requestPatientId,
      active: true,
    });
    try {
      const bankId = `clinician:${requestOwnerId}`;

      const recalled = await recallMemories({
        bankId,
        query: 'todo preferences and style',
        filters: {
          feature: 'todos',
          section,
        },
        limit: 6,
      });
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;

      const styleSummary = recalled?.memories
        ?.map((memory) => memory.content)
        .filter(Boolean)
        .join('\n---\n');

      const { data, error } = await withCategoryTimeout(
        supabase.functions.invoke('generate-todos', {
          body: {
            patientData: {
              name: patient.name,
              bed: patient.bed,
              clinicalSummary: patient.clinicalSummary,
              intervalEvents: patient.intervalEvents,
              imaging: patient.imaging,
              labs: patient.labs,
              systems: patient.systems,
            },
            section,
            styleSummary,
            model: getModelForFeature('todos'),
          },
        }),
        'aiEdgeFunction',
        'generate-todos',
      );

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const generatedTodos: string[] = data.todos || [];

      if (generatedTodos.length === 0) {
        toast({
          title: "No todos generated",
          description: "Add more content to generate relevant todos.",
        });
        return;
      }

      // Batch insert all generated todos for better performance
      const sectionValue = section === 'all' ? null : section;

      const todosToInsert = generatedTodos.map(content => ({
        patient_id: requestPatientId,
        user_id: requestOwnerId,
        section: sectionValue,
        content,
        completed: false,
      }));

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      const { data: insertedData, error: insertError } = await supabase
        .from('patient_todos')
        .insert(todosToInsert)
        .select();

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (insertError) throw insertError;

      // Map inserted data to PatientTodo format and add to state
      const newTodos: PatientTodo[] = (insertedData || []).map((todo, index) => mapTodoRecord(todo, {
        patientId: requestPatientId,
        userId: requestOwnerId,
        section: sectionValue,
        content: generatedTodos[index] ?? '',
      })).filter((todo) => (
        todo.userId === requestOwnerId && todo.patientId === requestPatientId
      ));
      const orderedNewTodos = [...newTodos].reverse();
      const applyGeneratedTodos = prependTodos(orderedNewTodos);

      if (!commitTodos(requestOwnerId, requestPatientId, applyGeneratedTodos)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyGeneratedTodos);

      toast({
        title: "Todos generated",
        description: `Added ${newTodos.length} new todo items.`,
      });

      if (newTodos.length > 0) {
        const content = [
          `Patient: ${patient.name || `Bed ${patient.bed}`}`,
          `Section: ${section}`,
          `Generated todos:\n${newTodos.map((t) => `- ${t.content}`).join('\n')}`,
        ].join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature: 'todos',
            section,
            source: 'generate-todos',
          },
        });
      }
    } catch (error) {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      console.error('Error generating patient todos');
      toast({
        title: "Error",
        description: getUserFacingErrorMessage(error, 'Failed to generate todos'),
        variant: "destructive",
      });
    } finally {
      if (isActiveRequest(requestOwnerId, requestPatientId)) {
        setGeneratingState({
          ownerId: requestOwnerId,
          patientId: requestPatientId,
          active: false,
        });
      }
    }
  }, [commitTodos, getModelForFeature, isActiveRequest, ownerId, patientId, queryClient, toast]);

  const getTodosBySection = useCallback((section: string | null) => {
    return todos.filter(t => t.section === section);
  }, [todos]);

  const getPatientWideTodos = useCallback(() => {
    return todos.filter(t => t.section === null);
  }, [todos]);

  return {
    todos,
    loading,
    generating,
    addTodo,
    toggleTodo,
    deleteTodo,
    generateTodos,
    getTodosBySection,
    getPatientWideTodos,
    refetch: fetchTodos,
  };
}

/** Lifted state shape for desktop tasks rail + PatientCard sharing one todo source. */
export type PatientTodosApi = ReturnType<typeof usePatientTodos>;
