import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { cleanup, renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, timeoutManager } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePatientFetch } from "@/hooks/patients/usePatientFetch";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
  var __SUPABASE_SELECT_MOCK__: unknown;
}

const queryClients: QueryClient[] = [];

timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    return timer;
  },
  clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout> | undefined),
  setInterval: (callback, delay) => {
    const timer = setInterval(callback, delay);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    return timer;
  },
  clearInterval: (timer) => clearInterval(timer as ReturnType<typeof setInterval> | undefined),
});

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((queryClient) => queryClient.clear());
  delete globalThis.__SUPABASE_AUTH_MOCK__;
  delete globalThis.__SUPABASE_SELECT_MOCK__;
});

function patientRow(id: string, userId: string, name: string) {
  return {
    id,
    user_id: userId,
    patient_number: 1,
    name,
    mrn: "",
    bed: "",
    clinical_summary: "",
    interval_events: "",
    imaging: "",
    labs: "",
    systems: {},
    medications: {},
    field_timestamps: {},
    collapsed: false,
    created_at: "2024-01-01T00:00:00Z",
    last_modified: null,
  };
}

test("usePatientFetch keeps a deferred user-A response out of user B's patient cache", async () => {
  const userARow = patientRow("patient-a", "user-a", "User A");
  const userBRow = patientRow("patient-b", "user-b", "User B");
  let authStateCallback: ((event: string, session: { user: { id: string } }) => void) | undefined;
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "user-a" } } }, error: null }),
    onAuthStateChange: (callback: typeof authStateCallback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };

  let patientFetchCount = 0;
  let resolveUserAFetch!: (result: { data: unknown[]; error: null }) => void;
  globalThis.__SUPABASE_SELECT_MOCK__ = (query: { table: string }) => {
    if (query.table !== "patients") return { data: [], error: null };
    patientFetchCount += 1;
    if (patientFetchCount === 1) {
      return new Promise((resolve) => {
        resolveUserAFetch = resolve;
      });
    }
    return { data: [userBRow], error: null };
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClients.push(queryClient);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider onAuthBoundary={() => queryClient.clear()}>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () => ({ auth: useAuth(), patientState: usePatientFetch() }),
    { wrapper },
  );

  await waitFor(() => {
    assert.equal(result.current.auth.user?.id, "user-a");
    assert.equal(patientFetchCount, 1);
  });
  assert.ok(authStateCallback, "auth listener should be registered");

  await act(async () => {
    authStateCallback!("SIGNED_IN", { user: { id: "user-b" } });
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  await waitFor(() => assert.equal(result.current.auth.user?.id, "user-b"));
  await waitFor(() => assert.equal(patientFetchCount, 2));
  await waitFor(() => assert.equal(result.current.patientState.patients[0]?.name, "User B"));

  await act(async () => {
    resolveUserAFetch({ data: [userARow], error: null });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  assert.equal(result.current.patientState.patients[0]?.name, "User B");
  assert.deepEqual(
    queryClient.getQueryData(QUERY_KEYS.patientList("user-b")),
    result.current.patientState.patients,
  );
  unmount();
  queryClient.clear();
});
