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
  patientId: string,
  updater: TodoListUpdater,
) {
  queryClient.setQueryData<PatientTodo[]>(QUERY_KEYS.patientTodos(patientId), (currentTodos) =>
    updater(currentTodos ?? []),
  );
  queryClient.setQueriesData<PatientTodosMap>(
    { queryKey: QUERY_KEYS.allTodos },
    (currentMap) => updateTodosMapForPatient(currentMap, patientId, updater),
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
  const [todos, setTodos] = useState<PatientTodo[]>(() => initialTodos ?? []);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { getModelForFeature } = useSettings();
  const latestInitialTodos = useRef(initialTodos);
  const initialTodosKey = useMemo(() => {
    if (initialTodos === undefined) return null;
    const todoKey = initialTodos
      .map((todo) => `${todo.id}:${todo.updatedAt}:${todo.completed}:${todo.content}`)
      .join('|');
    return `${patientId ?? ''}:${todoKey}`;
  }, [initialTodos, patientId]);

  useEffect(() => {
    latestInitialTodos.current = initialTodos;
  }, [initialTodos]);

  const fetchTodos = useCallback(async () => {
    if (!patientId || !user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_todos')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const nextTodos = data?.map(todo => mapTodoRecord(todo, {
        patientId,
        userId: user.id,
        section: null,
        content: '',
      })) || [];
      setTodos(nextTodos);
      writePatientTodosCache(queryClient, patientId, () => nextTodos);
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId, queryClient, user]);

  useEffect(() => {
    if (initialTodos !== undefined) return;
    fetchTodos();
  }, [fetchTodos, initialTodos]);

  useEffect(() => {
    if (initialTodosKey === null) return;
    setTodos(latestInitialTodos.current ?? []);
    setLoading(false);
  }, [initialTodosKey]);

  const addTodo = useCallback(async (content: string, section: string | null = null) => {
    if (!patientId || !user) return;

    try {
      const { data, error } = await supabase
        .from('patient_todos')
        .insert({
          patient_id: patientId,
          user_id: user.id,
          section,
          content,
          completed: false,
        })
        .select()
        .single();

      if (error) throw error;
      if (data == null) {
        toast({ title: "Error", description: "No data returned from insert", variant: "destructive" });
        return;
      }

      const newTodo = mapTodoRecord(data, {
        patientId,
        userId: user.id,
        section,
        content,
      });

      const applyAddedTodo = prependTodos([newTodo]);
      setTodos(applyAddedTodo);
      writePatientTodosCache(queryClient, patientId, applyAddedTodo);
      return newTodo;
    } catch (error) {
      console.error('Error adding todo:', error);
      toast({
        title: "Error",
        description: "Failed to add todo",
        variant: "destructive",
      });
    }
  }, [patientId, queryClient, user, toast]);

  const toggleTodo = useCallback(async (todoId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    const nextCompleted = !todo.completed;

    try {
      const { error } = await supabase
        .from('patient_todos')
        .update({ completed: nextCompleted })
        .eq('id', todoId);

      if (error) throw error;

      const applyToggle = (currentTodos: PatientTodo[]) => currentTodos.map(t =>
        t.id === todoId ? { ...t, completed: nextCompleted } : t
      );

      setTodos(applyToggle);
      writePatientTodosCache(queryClient, todo.patientId, applyToggle);
    } catch (error) {
      console.error('Error toggling todo:', error);
      toast({
        title: "Error",
        description: "Failed to update todo",
        variant: "destructive",
      });
    }
  }, [queryClient, todos, toast]);

  const deleteTodo = useCallback(async (todoId: string) => {
    const todo = todos.find(t => t.id === todoId);
    const targetPatientId = todo?.patientId ?? patientId;

    try {
      const { error } = await supabase
        .from('patient_todos')
        .delete()
        .eq('id', todoId);

      if (error) throw error;

      const applyDelete = (currentTodos: PatientTodo[]) => currentTodos.filter(t => t.id !== todoId);
      setTodos(applyDelete);
      if (targetPatientId) {
        writePatientTodosCache(queryClient, targetPatientId, applyDelete);
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast({
        title: "Error",
        description: "Failed to delete todo",
        variant: "destructive",
      });
    }
  }, [patientId, queryClient, todos, toast]);

  const generateTodos = useCallback(async (patient: Patient, section: TodoSection) => {
    if (!patientId || !user) return;

    setGenerating(true);
    try {
      const bankId = `clinician:${user.id}`;

      const recalled = await recallMemories({
        bankId,
        query: 'todo preferences and style',
        filters: {
          feature: 'todos',
          section,
        },
        limit: 6,
      });

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
        patient_id: patientId,
        user_id: user.id,
        section: sectionValue,
        content,
        completed: false,
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from('patient_todos')
        .insert(todosToInsert)
        .select();

      if (insertError) throw insertError;

      // Map inserted data to PatientTodo format and add to state
      const newTodos: PatientTodo[] = (insertedData || []).map((todo, index) => mapTodoRecord(todo, {
        patientId,
        userId: user.id,
        section: sectionValue,
        content: generatedTodos[index] ?? '',
      }));
      const orderedNewTodos = [...newTodos].reverse();
      const applyGeneratedTodos = prependTodos(orderedNewTodos);

      setTodos(applyGeneratedTodos);
      writePatientTodosCache(queryClient, patientId, applyGeneratedTodos);

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
      console.error('Error generating todos:', error);
      toast({
        title: "Error",
        description: getUserFacingErrorMessage(error, 'Failed to generate todos'),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [patientId, queryClient, user, toast, getModelForFeature]);

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
