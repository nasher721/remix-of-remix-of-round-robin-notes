import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import { usePatientTodos, updateTodosMapForPatient } from "@/hooks/usePatientTodos";
import type { PatientTodo } from "@/types/todo";
import type { PatientTodosMap } from "@/hooks/useAllPatientTodos";

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
}

const queryClients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((queryClient) => queryClient.clear());
  delete globalThis.__SUPABASE_AUTH_MOCK__;
});

function setupAuthMock() {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
}

function createQueryWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  queryClients.push(queryClient);
  function AuthReadyGate({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    return user ? <>{children}</> : null;
  }

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthReadyGate>
            <SettingsProvider>{children}</SettingsProvider>
          </AuthReadyGate>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
}

const initialTodo: PatientTodo = {
  id: "todo-1",
  patientId: "patient-1",
  userId: "test-user-id",
  section: null,
  content: "Review active plan",
  completed: false,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("usePatientTodos mutation cache updates", { concurrency: false }, () => {
  it("keeps selected todos and dashboard todo-map cache aligned after add, toggle, and delete", async () => {
    setupAuthMock();
    const { queryClient, wrapper } = createQueryWrapper();
    const allTodosKey = [...QUERY_KEYS.allTodos, "test-user-id", "patient-1|patient-2"] as const;

    const patientTodosKey = QUERY_KEYS.patientTodosForOwner("test-user-id", "patient-1");
    queryClient.setQueryData<PatientTodo[]>(patientTodosKey, [initialTodo]);
    queryClient.setQueryData<PatientTodosMap>(allTodosKey, {
      "patient-1": [initialTodo],
      "patient-2": [],
    });

    const { result } = renderHook(
      () => usePatientTodos("patient-1", { initialTodos: [initialTodo] }),
      { wrapper },
    );

    await waitFor(() => assert.equal(result.current.todos.length, 1));

    let addedTodo: PatientTodo | undefined;
    await act(async () => {
      addedTodo = await result.current.addTodo("Call family", "clinical_summary");
    });

    assert.equal(addedTodo?.content, "Call family");
    await waitFor(() => assert.equal(result.current.todos[0]?.content, "Call family", "selected todo state should prepend added todo"));
    assert.equal(
      queryClient.getQueryData<PatientTodo[]>(patientTodosKey)?.[0]?.content,
      "Call family",
      "patient todo cache should prepend added todo",
    );
    assert.equal(
      queryClient.getQueryData<PatientTodosMap>(allTodosKey)?.["patient-1"]?.[0]?.content,
      "Call family",
      "dashboard todo-map cache should prepend added todo",
    );

    await act(async () => {
      await result.current.toggleTodo("todo-1");
    });

    const toggledSelectedTodo = result.current.todos.find((todo) => todo.id === "todo-1");
    const toggledPatientCacheTodo = queryClient
      .getQueryData<PatientTodo[]>(patientTodosKey)
      ?.find((todo) => todo.id === "todo-1");
    const toggledDashboardTodo = queryClient
      .getQueryData<PatientTodosMap>(allTodosKey)
      ?.["patient-1"]?.find((todo) => todo.id === "todo-1");

    assert.equal(toggledSelectedTodo?.completed, true);
    assert.equal(toggledPatientCacheTodo?.completed, true);
    assert.equal(toggledDashboardTodo?.completed, true);

    await act(async () => {
      await result.current.deleteTodo("todo-1");
    });

    assert.equal(result.current.todos.some((todo) => todo.id === "todo-1"), false);
    assert.equal(
      queryClient.getQueryData<PatientTodo[]>(patientTodosKey)?.some((todo) => todo.id === "todo-1"),
      false,
    );
    assert.equal(
      queryClient.getQueryData<PatientTodosMap>(allTodosKey)?.["patient-1"]?.some((todo) => todo.id === "todo-1"),
      false,
    );
    assert.equal(
      queryClient.getQueryData(["todos", "patient-1"]),
      undefined,
      "todo mutations must not populate the legacy ownerless cache key",
    );
  });

  it("updates only todo maps that already contain the affected patient", () => {
    const generatedTodo: PatientTodo = {
      ...initialTodo,
      id: "generated-1",
      content: "Generated follow-up",
    };
    const currentMap: PatientTodosMap = {
      "patient-1": [initialTodo],
      "patient-2": [],
    };

    const nextMap = updateTodosMapForPatient(currentMap, "patient-1", (todos) => [generatedTodo, ...todos]);
    const untouchedMap = updateTodosMapForPatient(currentMap, "missing-patient", (todos) => [generatedTodo, ...todos]);

    assert.deepEqual(nextMap?.["patient-1"].map((todo) => todo.id), ["generated-1", "todo-1"]);
    assert.equal(nextMap?.["patient-2"], currentMap["patient-2"]);
    assert.equal(untouchedMap, currentMap);
  });
});
