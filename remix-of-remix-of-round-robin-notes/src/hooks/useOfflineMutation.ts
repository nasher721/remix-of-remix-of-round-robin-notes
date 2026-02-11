import { useCallback } from 'react';
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineMode } from './useOfflineMode';
import { QueuedMutation } from '@/lib/offline/offlineQueue';
import { QUERY_KEYS } from '@/lib/cache/cacheConfig';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type MutationType = QueuedMutation['type'];
type MutationOperation = QueuedMutation['operation'];

interface MutationContext {
  previousData: unknown[] | undefined;
}

interface OfflineMutationConfig<TData, TVariables> {
  type: MutationType;
  table: string;
  queryKey: readonly unknown[];
  mutationFn: (variables: TVariables) => Promise<TData>;
  getEntityId?: (variables: TVariables) => string | undefined;
  getPayload?: (variables: TVariables) => Record<string, unknown>;
  operation: MutationOperation;
  optimisticUpdate?: (old: TData[] | undefined, variables: TVariables) => TData[];
  rollback?: (context: MutationContext) => void;
}

export function useOfflineMutation<TData, TVariables>(
  config: OfflineMutationConfig<TData, TVariables>,
  options?: Omit<UseMutationOptions<TData, Error, TVariables, MutationContext>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const { isOnline, queueMutation } = useOfflineMode();
  
  return useMutation<TData, Error, TVariables, MutationContext>({
    mutationFn: async (variables: TVariables) => {
      // If online, execute immediately
      if (isOnline) {
        return config.mutationFn(variables);
      }
      
      // If offline, queue the mutation
      const entityId = config.getEntityId?.(variables);
      const payload = config.getPayload?.(variables) || (variables as Record<string, unknown>);
      
      queueMutation({
        type: config.type,
        operation: config.operation,
        table: config.table,
        payload,
        entityId,
      });
      
      toast.info('Offline: Change saved locally');
      
      // Return optimistic data
      return payload as TData;
    },
    
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: config.queryKey });
      
      // Snapshot previous data
      const previousData = queryClient.getQueryData<TData[]>(config.queryKey);
      
      // Optimistically update
      if (config.optimisticUpdate) {
        queryClient.setQueryData<TData[]>(
          config.queryKey,
          (old) => config.optimisticUpdate!(old, variables)
        );
      }
      
      return { previousData: previousData as unknown[] | undefined };
    },
    
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(config.queryKey, context.previousData);
      }
      
      if (config.rollback && context) {
        config.rollback(context);
      }
      
      options?.onError?.(error, variables, context);
    },
    
    onSettled: (data, error, variables, context) => {
      // Refetch after mutation settles (only if online)
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: config.queryKey });
      }
      
      options?.onSettled?.(data, error, variables, context);
    },
    
    ...options,
  });
}

// Define types for patient/todo data
type PatientRow = Database['public']['Tables']['patients']['Row'];
type PatientInsert = Database['public']['Tables']['patients']['Insert'];
type TodoRow = Database['public']['Tables']['patient_todos']['Row'];
type TodoInsert = Database['public']['Tables']['patient_todos']['Insert'];

// Convenience hooks for common entities
export function useOfflinePatientMutation() {
  const { isOnline, queueMutation } = useOfflineMode();
  const queryClient = useQueryClient();
  
  const updatePatient = useCallback(async (
    patientId: string,
    updates: Partial<PatientRow>
  ) => {
    if (isOnline) {
      const { error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', patientId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patients });
    } else {
      queueMutation({
        type: 'patient',
        operation: 'update',
        table: 'patients',
        payload: updates as Record<string, unknown>,
        entityId: patientId,
      });
      
      // Optimistic update
      queryClient.setQueryData<PatientRow[]>(QUERY_KEYS.patients, (old) => {
        if (!old) return old;
        return old.map((p) => p.id === patientId ? { ...p, ...updates } : p);
      });
      
      toast.info('Offline: Patient update saved locally');
    }
  }, [isOnline, queueMutation, queryClient]);
  
  const createPatient = useCallback(async (
    patient: PatientInsert
  ) => {
    const tempId = `temp_${Date.now()}`;
    
    if (isOnline) {
      const { data, error } = await supabase
        .from('patients')
        .insert(patient)
        .select()
        .single();
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patients });
      return data;
    } else {
      const offlinePatient = { 
        ...patient, 
        id: tempId,
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString(),
      } as PatientRow;
      
      queueMutation({
        type: 'patient',
        operation: 'create',
        table: 'patients',
        payload: patient as Record<string, unknown>,
        entityId: tempId,
      });
      
      // Optimistic update
      queryClient.setQueryData<PatientRow[]>(QUERY_KEYS.patients, (old) => {
        return [...(old || []), offlinePatient];
      });
      
      toast.info('Offline: Patient created locally');
      return offlinePatient;
    }
  }, [isOnline, queueMutation, queryClient]);
  
  const deletePatient = useCallback(async (patientId: string) => {
    if (isOnline) {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patients });
    } else {
      queueMutation({
        type: 'patient',
        operation: 'delete',
        table: 'patients',
        payload: {},
        entityId: patientId,
      });
      
      // Optimistic update
      queryClient.setQueryData<PatientRow[]>(QUERY_KEYS.patients, (old) => {
        if (!old) return old;
        return old.filter((p) => p.id !== patientId);
      });
      
      toast.info('Offline: Patient deletion saved locally');
    }
  }, [isOnline, queueMutation, queryClient]);
  
  return { updatePatient, createPatient, deletePatient };
}

export function useOfflineTodoMutation() {
  const { isOnline, queueMutation } = useOfflineMode();
  const queryClient = useQueryClient();
  
  const updateTodo = useCallback(async (
    todoId: string,
    updates: Partial<TodoRow>
  ) => {
    if (isOnline) {
      const { error } = await supabase
        .from('patient_todos')
        .update(updates)
        .eq('id', todoId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos });
    } else {
      queueMutation({
        type: 'todo',
        operation: 'update',
        table: 'patient_todos',
        payload: updates as Record<string, unknown>,
        entityId: todoId,
      });
      
      toast.info('Offline: Todo update saved locally');
    }
  }, [isOnline, queueMutation, queryClient]);
  
  const createTodo = useCallback(async (
    todo: TodoInsert
  ) => {
    const tempId = `temp_${Date.now()}`;
    
    if (isOnline) {
      const { data, error } = await supabase
        .from('patient_todos')
        .insert(todo)
        .select()
        .single();
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos });
      return data;
    } else {
      const offlineTodo = { 
        ...todo, 
        id: tempId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed: todo.completed ?? false,
      } as TodoRow;
      
      queueMutation({
        type: 'todo',
        operation: 'create',
        table: 'patient_todos',
        payload: todo as Record<string, unknown>,
        entityId: tempId,
      });
      
      toast.info('Offline: Todo created locally');
      return offlineTodo;
    }
  }, [isOnline, queueMutation, queryClient]);
  
  const deleteTodo = useCallback(async (todoId: string) => {
    if (isOnline) {
      const { error } = await supabase
        .from('patient_todos')
        .delete()
        .eq('id', todoId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.todos });
    } else {
      queueMutation({
        type: 'todo',
        operation: 'delete',
        table: 'patient_todos',
        payload: {},
        entityId: todoId,
      });
      
      toast.info('Offline: Todo deletion saved locally');
    }
  }, [isOnline, queueMutation, queryClient]);
  
  return { updateTodo, createTodo, deleteTodo };
}
