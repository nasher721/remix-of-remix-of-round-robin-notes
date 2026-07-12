import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act } from "@testing-library/react";
import type { Patient } from "@/types/patient";
import { defaultSystemsValue, defaultMedicationsValue } from "@/services/patientService";
import { AuthProvider } from "@/hooks/useAuth";
import { usePatientImport } from "@/hooks/patients/usePatientImport";
import { supabase } from "@/integrations/supabase/client";

const authWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

function setupAuthMock() {
  (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: { getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }> } }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
  };
}

function setupAuthTransitionMock(initialUserId = "user-a") {
  let authStateCallback: ((event: string, session: { user: { id: string } }) => void) | undefined;
  (globalThis as unknown as {
    __SUPABASE_AUTH_MOCK__?: {
      getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }>;
      onAuthStateChange: (callback: typeof authStateCallback) => { unsubscribe: () => void };
    };
  }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: initialUserId } } }, error: null }),
    onAuthStateChange: (callback) => {
      authStateCallback = callback;
      return { unsubscribe: () => {} };
    },
  };

  return async (nextUserId: string) => {
    assert.ok(authStateCallback, "auth listener should be registered");
    await act(async () => {
      authStateCallback!("SIGNED_IN", { user: { id: nextUserId } });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  };
}

function makeExistingPatient(patientNumber: number): Patient {
  return {
    id: `existing-${patientNumber}`,
    patientNumber,
    name: `Existing ${patientNumber}`,
    mrn: "",
    bed: `A${patientNumber}`,
    clinicalSummary: "",
    intervalEvents: "",
    imaging: "",
    labs: "",
    systems: defaultSystemsValue,
    medications: defaultMedicationsValue,
    fieldTimestamps: {},
    collapsed: false,
    createdAt: "2024-01-01T00:00:00Z",
    lastModified: "",
  };
}

function rowFromPayload(payload: Record<string, unknown>, id: string) {
  return {
    id,
    user_id: payload.user_id,
    patient_number: payload.patient_number,
    name: payload.name ?? "",
    mrn: payload.mrn ?? "",
    bed: payload.bed ?? "",
    clinical_summary: payload.clinical_summary ?? "",
    interval_events: payload.interval_events ?? "",
    imaging: payload.imaging ?? "",
    labs: payload.labs ?? "",
    systems: payload.systems ?? {},
    medications: payload.medications ?? {},
    field_timestamps: {},
    collapsed: payload.collapsed ?? false,
    created_at: "2024-01-01T00:00:00Z",
    last_modified: null,
  };
}

function installPatientImportSupabaseMock(options: {
  latestPatientNumber?: number;
  conflictNumbers?: number[];
} = {}) {
  const supabaseWithMutableFrom = supabase as unknown as { from: (table: string) => unknown };
  const originalFrom = supabaseWithMutableFrom.from.bind(supabase);
  const insertPayloads: Record<string, unknown>[] = [];
  const latestNumberSelects: unknown[] = [];
  const conflictedNumbers = new Set(options.conflictNumbers ?? []);

  supabaseWithMutableFrom.from = (table: string) => {
    if (table !== "patients") return originalFrom(table);

    return {
      select(columns = "*") {
        const query = { table, columns, orders: [] as unknown[], limitCount: null as number | null };
        const result = () => {
          latestNumberSelects.push(query);
          return Promise.resolve({
            data: [{ patient_number: options.latestPatientNumber ?? 0 }],
            error: null,
          });
        };
        const builder = {
          order(column: string, orderOptions: unknown) {
            query.orders.push({ column, options: orderOptions });
            return builder;
          },
          limit(count: number) {
            query.limitCount = count;
            return result();
          },
          then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
            return result().then(resolve, reject);
          },
        };
        return builder;
      },
      insert(rows: unknown[]) {
        const payload = rows[0] as Record<string, unknown>;
        insertPayloads.push(payload);
        const shouldConflict = conflictedNumbers.delete(Number(payload.patient_number));

        return {
          select: () => ({
            single: async () => {
              if (shouldConflict) {
                return {
                  data: null,
                  error: {
                    code: "23505",
                    details: "Key (patient_number) already exists.",
                    message: "duplicate key value violates unique constraint patients_patient_number_key",
                  },
                };
              }

              return {
                data: rowFromPayload(payload, `inserted-${payload.patient_number}`),
                error: null,
              };
            },
          }),
        };
      },
    };
  };

  return {
    insertPayloads,
    latestNumberSelects,
    restore() {
      supabaseWithMutableFrom.from = originalFrom;
    },
  };
}

test("usePatientImport addPatientWithData calls supabase insert and maps correctly", async () => {
  setupAuthMock();
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") (fn as (prev: Patient[]) => Patient[])([]);
  };

  const { result } = renderHook(
    () =>
      usePatientImport({
        patientsRef,
        setPatients,
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
  assert.equal(payload.mrn, "");
});

test("usePatientImport importPatients calls supabase insert per patient and maps correctly", async () => {
  setupAuthMock();
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    if (typeof fn === "function") (fn as (prev: Patient[]) => Patient[])([]);
  };

  const { result } = renderHook(
    () =>
      usePatientImport({
        patientsRef,
        setPatients,
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

test("usePatientImport importPatients commits a multi-patient roster once with immediate cache visibility", async () => {
  setupAuthMock();
  const supabaseMock = installPatientImportSupabaseMock();
  const initialPatients = [1, 2, 3].map(makeExistingPatient);
  const patientsRef: React.MutableRefObject<Patient[]> = { current: initialPatients };
  let cachedPatients = initialPatients;
  let setPatientsCalls = 0;
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    setPatientsCalls += 1;
    cachedPatients = typeof fn === "function" ? (fn as (prev: Patient[]) => Patient[])(cachedPatients) : fn;
  };

  try {
    const { result } = renderHook(
      () =>
        usePatientImport({
          patientsRef,
          setPatients,
        }),
      { wrapper: authWrapper }
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    await act(async () => {
      await result.current.importPatients(
        [4, 5, 6, 7, 8].map((patientNumber) => ({
          name: `Imported ${patientNumber}`,
          bed: `B${patientNumber}`,
          clinicalSummary: `Summary ${patientNumber}`,
          intervalEvents: "",
        }))
      );
    });

    assert.equal(setPatientsCalls, 1, "multi-patient import should make one consolidated cache update");
    assert.equal(cachedPatients.length, 8, "cache should expose at least eight patients immediately");
    assert.equal(patientsRef.current.length, 8, "patientsRef should be immediately current for follow-on actions");
    assert.deepEqual(cachedPatients.slice(-5).map((patient) => patient.patientNumber), [4, 5, 6, 7, 8]);
    assert.equal(supabaseMock.latestNumberSelects.length, 0, "successful imports should not perform conflict/latest-number selects");
  } finally {
    supabaseMock.restore();
  }
});

test("usePatientImport importPatients preserves patient-number conflict retry without reloading between rows", async () => {
  setupAuthMock();
  const supabaseMock = installPatientImportSupabaseMock({
    latestPatientNumber: 42,
    conflictNumbers: [1],
  });
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  let cachedPatients: Patient[] = [];
  let setPatientsCalls = 0;
  const setPatients = (fn: React.SetStateAction<Patient[]>) => {
    setPatientsCalls += 1;
    cachedPatients = typeof fn === "function" ? (fn as (prev: Patient[]) => Patient[])(cachedPatients) : fn;
  };

  try {
    const { result } = renderHook(
      () =>
        usePatientImport({
          patientsRef,
          setPatients,
        }),
      { wrapper: authWrapper }
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    await act(async () => {
      await result.current.importPatients([
        { name: "Conflict Then Retry", bed: "C1", clinicalSummary: "S1", intervalEvents: "" },
        { name: "Next Patient", bed: "C2", clinicalSummary: "S2", intervalEvents: "" },
      ]);
    });

    assert.deepEqual(
      supabaseMock.insertPayloads.map((payload) => payload.patient_number),
      [1, 43, 44],
      "conflict retry should use latest patient number and continue sequentially"
    );
    assert.equal(supabaseMock.latestNumberSelects.length, 1, "latest-number lookup should run only for the conflict");
    assert.equal(setPatientsCalls, 1, "conflict recovery should still consolidate the cache update");
    assert.deepEqual(cachedPatients.map((patient) => patient.patientNumber), [43, 44]);
    assert.deepEqual(patientsRef.current.map((patient) => patient.patientNumber), [43, 44]);
  } finally {
    supabaseMock.restore();
  }
});

test("usePatientImport ignores a deferred user-A insert after switching to user B", async () => {
  const transitionTo = setupAuthTransitionMock();
  const userAPatient = makeExistingPatient(1);
  userAPatient.id = "patient-a";
  userAPatient.name = "User A";
  const userBPatient = makeExistingPatient(2);
  userBPatient.id = "patient-b";
  userBPatient.name = "User B";
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [userAPatient] };
  let renderedPatients = patientsRef.current;
  const setPatients = (action: React.SetStateAction<Patient[]>) => {
    renderedPatients = typeof action === "function"
      ? (action as (prev: Patient[]) => Patient[])(renderedPatients)
      : action;
    patientsRef.current = renderedPatients;
  };

  const supabaseWithMutableFrom = supabase as unknown as { from: (table: string) => unknown };
  const originalFrom = supabaseWithMutableFrom.from.bind(supabase);
  let resolveInsert!: (result: { data: unknown; error: null }) => void;
  let insertedPayload: Record<string, unknown> | undefined;
  supabaseWithMutableFrom.from = (table: string) => {
    if (table !== "patients") return originalFrom(table);
    return {
      insert(rows: unknown[]) {
        insertedPayload = rows[0] as Record<string, unknown>;
        return {
          select: () => ({
            single: () => new Promise((resolve) => {
              resolveInsert = resolve;
            }),
          }),
        };
      },
    };
  };

  try {
    const { result } = renderHook(
      () => usePatientImport({ patientsRef, setPatients }),
      { wrapper: authWrapper },
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    let pendingInsert!: Promise<void>;
    await act(async () => {
      pendingInsert = result.current.addPatientWithData({
        name: "Late User A",
        bed: "A1",
        clinicalSummary: "A-only summary",
        intervalEvents: "",
        imaging: "",
        labs: "",
        systems: defaultSystemsValue,
      });
      await Promise.resolve();
    });
    assert.ok(insertedPayload, "user-A insert should be in flight");

    await transitionTo("user-b");
    renderedPatients = [userBPatient];
    patientsRef.current = renderedPatients;

    await act(async () => {
      resolveInsert({ data: rowFromPayload(insertedPayload!, "late-patient-a"), error: null });
      await pendingInsert;
    });

    assert.deepEqual(renderedPatients, [userBPatient]);
    assert.deepEqual(patientsRef.current, [userBPatient]);
  } finally {
    supabaseWithMutableFrom.from = originalFrom;
  }
});

test("usePatientImport returns importPatients and addPatientWithData", () => {
  setupAuthMock();
  const patientsRef: React.MutableRefObject<Patient[]> = { current: [] };
  const setPatients = () => {};

  const { result } = renderHook(
    () =>
      usePatientImport({
        patientsRef,
        setPatients,
      }),
    { wrapper: authWrapper }
  );

  assert.equal(typeof result.current.importPatients, "function");
  assert.equal(typeof result.current.addPatientWithData, "function");
});
