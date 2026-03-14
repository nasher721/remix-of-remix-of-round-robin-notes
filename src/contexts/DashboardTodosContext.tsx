/**
 * Separate context for per-patient todos map.
 * Splitting this from DashboardContext avoids re-rendering all dashboard consumers
 * when only todosMap changes (e.g. after refetch or todo mutations).
 */
import React, { createContext, useContext, ReactNode } from "react";
import type { PatientTodo } from "@/types/todo";

export type TodosMap = Record<string, PatientTodo[]>;

interface DashboardTodosContextType {
  todosMap: TodosMap;
}

const DashboardTodosContext = createContext<DashboardTodosContextType | undefined>(undefined);

export function useDashboardTodos(): TodosMap {
  const context = useContext(DashboardTodosContext);
  if (context === undefined) {
    throw new Error("useDashboardTodos must be used within a DashboardTodosProvider");
  }
  return context.todosMap;
}

interface DashboardTodosProviderProps {
  todosMap: TodosMap;
  children: ReactNode;
}

export function DashboardTodosProvider({ todosMap, children }: DashboardTodosProviderProps) {
  const value = React.useMemo(() => ({ todosMap }), [todosMap]);
  return (
    <DashboardTodosContext.Provider value={value}>
      {children}
    </DashboardTodosContext.Provider>
  );
}
