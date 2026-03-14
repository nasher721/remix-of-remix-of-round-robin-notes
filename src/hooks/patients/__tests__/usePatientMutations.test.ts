import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act } from "@testing-library/react";
import type { Patient } from "@/types/patient";
import { defaultSystemsValue, defaultMedicationsValue } from "@/services/patientService";
import { AuthProvider } from "@/hooks/useAuth";
import { usePatientMutations } from "@/hooks/patients/usePatientMutations";

const authWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

function setupAuthMock() {
  (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: { getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }> } }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
  };
}

const mockPatient: Patient = {
  id: "existing-id",
  patientNumber: 1,
  name: "Existing",
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
  lastModified: null,
};

test("usePatientMutations addPatient calls supabase insert with expected payload", async () => {
  setupAuthMock();
  const patientsRef = { current: [] as Patient[] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") patientsRef.current = (fn as (prev: Patient[]) => Patient[])(patientsRef.current);
  };
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};

  const { result } = renderHook(
    () =>
      usePatientMutations({
        patientsRef,
        setPatients,
        patientCounter: 1,
        setPatientCounter,
        fetchPatients,
      }),
    { wrapper: authWrapper }
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

  const { result } = renderHook(() =>
    usePatientMutations({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter,
      fetchPatients,
      }),
    { wrapper: authWrapper }
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
});

test("usePatientMutations returns addPatient, updatePatient, removePatient, duplicatePatient, toggleCollapse, collapseAll, clearAll", () => {
  setupAuthMock();
  const patientsRef = { current: [] as Patient[] };
  const setPatients = () => {};
  const setPatientCounter = () => {};
  const fetchPatients = async () => {};

  const { result } = renderHook(() =>
    usePatientMutations({
      patientsRef,
      setPatients,
      patientCounter: 1,
      setPatientCounter,
      fetchPatients,
      }),
    { wrapper: authWrapper }
  );

  assert.equal(typeof result.current.addPatient, "function");
  assert.equal(typeof result.current.updatePatient, "function");
  assert.equal(typeof result.current.removePatient, "function");
  assert.equal(typeof result.current.duplicatePatient, "function");
  assert.equal(typeof result.current.toggleCollapse, "function");
  assert.equal(typeof result.current.collapseAll, "function");
  assert.equal(typeof result.current.clearAll, "function");
});
