import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act } from "@testing-library/react";
import type { Patient } from "@/types/patient";
import { defaultSystemsValue, defaultMedicationsValue } from "@/services/patientService";
import { AuthProvider } from "@/hooks/useAuth";
import { usePatientImport } from "@/hooks/patients/usePatientImport";

const authWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

function setupAuthMock() {
  (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: { getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }> } }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
  };
}

test("usePatientImport addPatientWithData calls supabase insert and maps correctly", async () => {
  setupAuthMock();
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") (fn as (prev: Patient[]) => Patient[])([]);
  };
  const setPatientCounter = () => {};

  const { result } = renderHook(
    () =>
      usePatientImport({
        patientCounter: 1,
        setPatients,
        setPatientCounter,
      }),
    { wrapper: authWrapper }
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    await result.current.addPatientWithData({
      name: "FHIR Patient",
      bed: "B2",
      clinicalSummary: "Summary",
      intervalEvents: "Events",
      imaging: "CXR",
      labs: "CBC",
      systems: defaultSystemsValue,
      medications: defaultMedicationsValue,
    });
  });

  const capture = (globalThis as unknown as { __supabaseInsertCapture?: { table: string; rows: unknown[] }[] }).__supabaseInsertCapture;
  assert.ok(capture, "insert capture should exist");
  assert.ok(capture.length >= 1, "insert should have been called");
  const lastInsert = capture[capture.length - 1];
  assert.equal(lastInsert.table, "patients");
  assert.equal(lastInsert.rows.length, 1);
  const payload = lastInsert.rows[0] as Record<string, unknown>;
  assert.equal(payload.user_id, "test-user-id");
  assert.equal(payload.name, "FHIR Patient");
  assert.equal(payload.bed, "B2");
  assert.equal(payload.clinical_summary, "Summary");
  assert.equal(payload.interval_events, "Events");
  assert.equal(payload.imaging, "CXR");
  assert.equal(payload.labs, "CBC");
  assert.equal(payload.patient_number, 1);
});

test("usePatientImport importPatients calls supabase insert per patient and maps correctly", async () => {
  setupAuthMock();
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") (fn as (prev: Patient[]) => Patient[])([]);
  };
  const setPatientCounter = () => {};

  const { result } = renderHook(
    () =>
      usePatientImport({
        patientCounter: 1,
        setPatients,
        setPatientCounter,
      }),
    { wrapper: authWrapper }
  );

  const initialCaptureLen = ((globalThis as unknown as { __supabaseInsertCapture?: unknown[] }).__supabaseInsertCapture || []).length;

  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  await act(async () => {
    await result.current.importPatients([
      { name: "Imported One", bed: "C1", clinicalSummary: "S1", intervalEvents: "" },
      { name: "Imported Two", bed: "C2", clinicalSummary: "S2", intervalEvents: "" },
    ]);
  });

  const capture = (globalThis as unknown as { __supabaseInsertCapture?: { table: string; rows: unknown[] }[] }).__supabaseInsertCapture;
  assert.ok(capture, "insert capture should exist");
  assert.equal(capture.length - initialCaptureLen, 2, "insert should have been called twice");
  const firstPayload = (capture[initialCaptureLen].rows[0] as Record<string, unknown>);
  const secondPayload = (capture[initialCaptureLen + 1].rows[0] as Record<string, unknown>);
  assert.equal(firstPayload.name, "Imported One");
  assert.equal(firstPayload.bed, "C1");
  assert.equal(firstPayload.patient_number, 1);
  assert.equal(secondPayload.name, "Imported Two");
  assert.equal(secondPayload.bed, "C2");
  assert.equal(secondPayload.patient_number, 2);
});

test("usePatientImport returns importPatients and addPatientWithData", () => {
  setupAuthMock();
  const setPatients = () => {};
  const setPatientCounter = () => {};

  const { result } = renderHook(
    () =>
      usePatientImport({
        patientCounter: 1,
        setPatients,
        setPatientCounter,
      }),
    { wrapper: authWrapper }
  );

  assert.equal(typeof result.current.importPatients, "function");
  assert.equal(typeof result.current.addPatientWithData, "function");
});
