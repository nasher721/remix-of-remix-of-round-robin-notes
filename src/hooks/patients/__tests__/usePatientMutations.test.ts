import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { cleanup, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Patient } from "@/types/patient";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import { defaultSystemsValue, defaultMedicationsValue } from "@/services/patientService";
import { AuthProvider } from "@/hooks/useAuth";
import { usePatientMutations } from "@/hooks/patients/usePatientMutations";

const queryClients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((queryClient) => queryClient.clear());
  delete (globalThis as unknown as { __SUPABASE_UPDATE_MOCK__?: unknown }).__SUPABASE_UPDATE_MOCK__;
});

function createAuthQueryWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  queryClients.push(queryClient);
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(AuthProvider, null, children),
      ),
  };
}

function setupAuthMock() {
  (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: { getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }> } }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
  };
}

const mockPatient: Patient = {
  id: "existing-id",
  patientNumber: 1,
  name: "Existing",
  mrn: "MRN-1",
  bed: "A1",
  clinicalSummary: "",
  intervalEvents: "",
  imaging: "",
  labs: "",
  systems: defaultSystemsValue,
  medications: defaultMedicationsValue,
  fieldTimestamps: {},
  collapsed: false,
  createdAt: "2024-01-01T00:00:00Z",
  lastModified: "2024-01-01T00:00:00Z",
};

test("usePatientMutations addPatient calls supabase insert with expected payload", async () => {
  setupAuthMock();
  const patientsRef = { current: [] as Patient[] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
  };
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};
  const { wrapper } = createAuthQueryWrapper();

  const { result } = renderHook(
    () =>
      usePatientMutations({
        patientsRef,
        setPatients,
        patientCounter: 1,
        setPatientCounter,
        fetchPatients,
      }),
    { wrapper }
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    await result.current.addPatient();
  });

  const capture = (globalThis as unknown as { __supabaseInsertCapture?: { table: string; rows: unknown[] }[] }).__supabaseInsertCapture;
  assert.ok(capture, "insert capture should exist");
  assert.ok(capture.length >= 1, "insert should have been called");
  const lastInsert = capture[capture.length - 1];
  assert.equal(lastInsert.table, "patients");
  assert.equal(lastInsert.rows.length, 1);
  const payload = lastInsert.rows[0] as Record<string, unknown>;
  assert.equal(payload.user_id, "test-user-id");
  assert.equal(typeof payload.patient_number, "number");
  assert.equal(payload.name, "");
  assert.equal(payload.bed, "");
});

test("usePatientMutations updatePatient calls supabase update", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient }] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
    else patientsRef.current = fn as Patient[];
  };
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};
  const { queryClient, wrapper } = createAuthQueryWrapper();
  queryClient.setQueryData(QUERY_KEYS.patients, [{ ...mockPatient }]);
  queryClient.setQueryData(QUERY_KEYS.patient(mockPatient.id), { ...mockPatient });

  const { result } = renderHook(() =>
    usePatientMutations({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter,
      fetchPatients,
      }),
    { wrapper }
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    await result.current.updatePatient("existing-id", "name", "Updated Name");
  });

  const capture = (globalThis as unknown as { __supabaseUpdateCapture?: { table: string; data: unknown }[] }).__supabaseUpdateCapture;
  assert.ok(capture, "update capture should exist");
  assert.ok(capture.length >= 1, "update should have been called");
  const lastUpdate = capture[capture.length - 1];
  assert.equal(lastUpdate.table, "patients");
  assert.ok((lastUpdate.data as Record<string, unknown>).name === "Updated Name" || (lastUpdate.data as Record<string, unknown>).last_modified);
  assert.equal(queryClient.getQueryData<Patient[]>(QUERY_KEYS.patients)?.[0]?.name, "Updated Name");
  assert.equal(queryClient.getQueryData<Patient>(QUERY_KEYS.patient("existing-id"))?.name, "Updated Name");
});

test("usePatientMutations forces a server refresh after failed optimistic patient updates", async () => {
  setupAuthMock();
  const patientsRef = { current: [{ ...mockPatient }] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
    else patientsRef.current = fn as Patient[];
  };
  const setPatientCounter = () => {};
  const fetchCalls: Array<{ force?: boolean } | undefined> = [];
  const fetchPatients = async (options?: { force?: boolean }) => {
    fetchCalls.push(options);
  };
  const { queryClient, wrapper } = createAuthQueryWrapper();
  queryClient.setQueryData(QUERY_KEYS.patients, [{ ...mockPatient }]);
  queryClient.setQueryData(QUERY_KEYS.patient(mockPatient.id), { ...mockPatient });
  (globalThis as unknown as { __SUPABASE_UPDATE_MOCK__?: () => { error: Error } }).__SUPABASE_UPDATE_MOCK__ = () => ({
    error: new Error("forced update failure"),
  });

  const { result } = renderHook(() =>
    usePatientMutations({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter,
      fetchPatients,
    }),
    { wrapper }
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    await result.current.updatePatient("existing-id", "name", "Failed Update");
  });

  assert.equal(patientsRef.current[0]?.name, "Existing");
  assert.equal(queryClient.getQueryData<Patient[]>(QUERY_KEYS.patients)?.[0]?.name, "Existing");
  assert.equal(queryClient.getQueryData<Patient>(QUERY_KEYS.patient("existing-id"))?.name, "Existing");
  assert.deepEqual(fetchCalls, [{ force: true }]);
});

test("usePatientMutations removePatient scopes patient and todo cache updates to the removed patient", async () => {
  setupAuthMock();
  const remainingPatient = { ...mockPatient, id: "remaining-id", name: "Remaining", patientNumber: 2 };
  const patientsRef = { current: [{ ...mockPatient }, remainingPatient] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
    else patientsRef.current = fn as Patient[];
  };
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};
  const { queryClient, wrapper } = createAuthQueryWrapper();
  queryClient.setQueryData(QUERY_KEYS.patients, patientsRef.current);
  queryClient.setQueryData(QUERY_KEYS.patient("existing-id"), mockPatient);
  queryClient.setQueryData(QUERY_KEYS.patientTodos("existing-id"), [
    {
      id: "todo-1",
      patientId: "existing-id",
      userId: "test-user-id",
      section: null,
      content: "Removed patient todo",
      completed: false,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ]);
  queryClient.setQueryData([...QUERY_KEYS.allTodos, "test-user-id", "existing-id|remaining-id"], {
    "existing-id": [],
    "remaining-id": [],
  });

  const { result } = renderHook(() =>
    usePatientMutations({
      patientsRef,
      setPatients,
      patientCounter: 2,
      setPatientCounter,
      fetchPatients,
    }),
    { wrapper }
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    await result.current.removePatient("existing-id");
  });

  assert.deepEqual(queryClient.getQueryData<Patient[]>(QUERY_KEYS.patients)?.map((patient) => patient.id), ["remaining-id"]);
  assert.equal(queryClient.getQueryData(QUERY_KEYS.patient("existing-id")), undefined);
  assert.equal(queryClient.getQueryData(QUERY_KEYS.patientTodos("existing-id")), undefined);
  assert.deepEqual(
    queryClient.getQueryData([...QUERY_KEYS.allTodos, "test-user-id", "existing-id|remaining-id"]),
    { "remaining-id": [] },
  );
});

test("usePatientMutations returns addPatient, updatePatient, removePatient, duplicatePatient, toggleCollapse, collapseAll, clearAll", () => {
  setupAuthMock();
  const patientsRef = { current: [] as Patient[] };
  const setPatients = () => {};
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};
  const { wrapper } = createAuthQueryWrapper();

  const { result } = renderHook(() =>
    usePatientMutations({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter,
      fetchPatients,
      }),
    { wrapper }
  );

  assert.equal(typeof result.current.addPatient, "function");
  assert.equal(typeof result.current.updatePatient, "function");
  assert.equal(typeof result.current.removePatient, "function");
  assert.equal(typeof result.current.duplicatePatient, "function");
  assert.equal(typeof result.current.toggleCollapse, "function");
  assert.equal(typeof result.current.collapseAll, "function");
  assert.equal(typeof result.current.clearAll, "function");
});
