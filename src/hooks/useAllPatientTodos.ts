import { useState, useCallback, useEffect } from 'react';
import { hasSupabaseConfig, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PatientTodo } from '@/types/todo';

export interface PatientTodosMap {
  [patientId: string]: PatientTodo[];
}

export function useAllPatientTodos(patientIds: string[]) {
  const [todosMap, setTodosMap] = useState<PatientTodosMap>({});
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchAllTodos = useCallback(async () => {
    if (!user || patientIds.length === 0) {
      setTodosMap({});
      return;
    }

    if (!hasSupabaseConfig) {
      setTodosMap({});
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_todos')
        .select('*')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group todos by patient ID
      const grouped: PatientTodosMap = {};
      patientIds.forEach(id => { grouped[id] = []; });
      
      data?.forEach(todo => {
        const mappedTodo: PatientTodo = {
          id: todo.id,
          patientId: todo.patient_id,
          userId: todo.user_id,
          section: todo.section,
          content: todo.content,
          completed: todo.completed,
          createdAt: todo.created_at,
          updatedAt: todo.updated_at,
        };
        
        if (!grouped[todo.patient_id]) {
          grouped[todo.patient_id] = [];
        }
        grouped[todo.patient_id].push(mappedTodo);
      });

      setTodosMap(grouped);
    } catch (error) {
      console.error('Error fetching all patient todos:', error);
    } finally {
      setLoading(false);
    }
  }, [patientIds, user]);

  useEffect(() => {
    fetchAllTodos();
  }, [fetchAllTodos]);

  return {
    todosMap,
    loading,
    refetch: fetchAllTodos,
  };
}
