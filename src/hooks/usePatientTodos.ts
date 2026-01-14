import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PatientTodo, TodoSection } from '@/types/todo';
import { Patient } from '@/types/patient';

export function usePatientTodos(patientId: string | null) {
  const [todos, setTodos] = useState<PatientTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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

      setTodos(data?.map(todo => ({
        id: todo.id,
        patientId: todo.patient_id,
        userId: todo.user_id,
        section: todo.section,
        content: todo.content,
        completed: todo.completed,
        createdAt: todo.created_at,
        updatedAt: todo.updated_at,
      })) || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId, user]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

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

      const newTodo: PatientTodo = {
        id: data.id,
        patientId: data.patient_id,
        userId: data.user_id,
        section: data.section,
        content: data.content,
        completed: data.completed,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setTodos(prev => [newTodo, ...prev]);
      return newTodo;
    } catch (error) {
      console.error('Error adding todo:', error);
      toast({
        title: "Error",
        description: "Failed to add todo",
        variant: "destructive",
      });
    }
  }, [patientId, user, toast]);

  const toggleTodo = useCallback(async (todoId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    try {
      const { error } = await supabase
        .from('patient_todos')
        .update({ completed: !todo.completed })
        .eq('id', todoId);

      if (error) throw error;

      setTodos(prev => prev.map(t => 
        t.id === todoId ? { ...t, completed: !t.completed } : t
      ));
    } catch (error) {
      console.error('Error toggling todo:', error);
      toast({
        title: "Error",
        description: "Failed to update todo",
        variant: "destructive",
      });
    }
  }, [todos, toast]);

  const deleteTodo = useCallback(async (todoId: string) => {
    try {
      const { error } = await supabase
        .from('patient_todos')
        .delete()
        .eq('id', todoId);

      if (error) throw error;

      setTodos(prev => prev.filter(t => t.id !== todoId));
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast({
        title: "Error",
        description: "Failed to delete todo",
        variant: "destructive",
      });
    }
  }, [toast]);

  const generateTodos = useCallback(async (patient: Patient, section: TodoSection) => {
    if (!patientId || !user) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-todos', {
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
        },
      });

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

      // Add all generated todos to the database
      const sectionValue = section === 'all' ? null : section;
      
      for (const content of generatedTodos) {
        await addTodo(content, sectionValue);
      }

      toast({
        title: "Todos generated",
        description: `Added ${generatedTodos.length} new todo items.`,
      });
    } catch (error) {
      console.error('Error generating todos:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate todos",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [patientId, user, addTodo, toast]);

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
