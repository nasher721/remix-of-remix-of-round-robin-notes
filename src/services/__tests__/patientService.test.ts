import { test, expect } from "vitest";
import {
  buildPatientInsertPayload,
  defaultMedicationsValue,
  defaultSystemsValue,
  getNextPatientCounter,
  mapPatientRecord,
  shouldTrackTimestamp,
} from "@/services/patientService";

test("maps patient records with safe defaults", () => {
  const mapped = mapPatientRecord({
    id: "id-1",
    patient_number: 1,
    name: "Test",
    bed: "A1",
    clinical_summary: "Summary",
    interval_events: "Events",
    imaging: null,
    labs: null,
    systems: null,
    medications: null,
    field_timestamps: null,
    collapsed: false,
    created_at: "2024-01-01T00:00:00Z",
    last_modified: "",
  });

  expect(mapped.imaging).toBe("");
  expect(mapped.labs).toBe("");
  expect(mapped.systems).toEqual(defaultSystemsValue);
  expect(mapped.medications).toEqual(defaultMedicationsValue);
});

test("builds patient insert payload with defaults", () => {
  const payload = buildPatientInsertPayload({
    userId: "user-1",
    patientNumber: 3,
    name: "Jane",
    bed: "B2",
  });

  expect(payload.user_id).toBe("user-1");
  expect(payload.patient_number).toBe(3);
  expect(payload.name).toBe("Jane");
  expect(payload.bed).toBe("B2");
  expect(payload.systems).toEqual(defaultSystemsValue);
});

test("tracks all major field types", () => {
  expect(shouldTrackTimestamp("clinicalSummary")).toBe(true);
  expect(shouldTrackTimestamp("medications")).toBe(true);
  expect(shouldTrackTimestamp("labs")).toBe(true);
  expect(shouldTrackTimestamp("imaging")).toBe(true);
  expect(shouldTrackTimestamp("intervalEvents")).toBe(true);
  // systems is tracked via nested fields (e.g., systems.neuro)
  expect(shouldTrackTimestamp("systems.neuro")).toBe(true);
  expect(shouldTrackTimestamp("systems.cardiovascular")).toBe(true);
  // non-trackable fields
  expect(shouldTrackTimestamp("name")).toBe(false);
  expect(shouldTrackTimestamp("bed")).toBe(false);
});

test("computes next patient counter correctly", () => {
  const mockPatient = {
    id: "test-id",
    patientNumber: 7,
    name: "",
    bed: "",
    clinicalSummary: "",
    intervalEvents: "",
    imaging: "",
    labs: "",
    systems: defaultSystemsValue,
    medications: defaultMedicationsValue,
    fieldTimestamps: {},
    collapsed: false,
    createdAt: "",
    lastModified: "",
  };
  expect(getNextPatientCounter([mockPatient])).toBe(8);
  expect(getNextPatientCounter([])).toBe(1);

  const unsorted = [
    { ...{ patientNumber: 3 }, id: "3", name: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "" },
    { ...{ patientNumber: 1 }, id: "1", name: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "" },
    { ...{ patientNumber: 5 }, id: "5", name: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "" },
  ];
  expect(getNextPatientCounter(unsorted)).toBe(6);
});

test("maps patient with existing data preserves values", () => {
  const mapped = mapPatientRecord({
    id: "id-2",
    patient_number: 2,
    name: "Existing",
    bed: "C3",
    clinical_summary: "Custom summary",
    interval_events: "Custom events",
    imaging: "Chest X-ray",
    labs: "CBC, BMP",
    systems: { neuro: "Alert", cv: "Stable" },
    medications: { infusions: ["Propofol"], scheduled: [], prn: [] },
    field_timestamps: { clinicalSummary: "2024-01-01" },
    collapsed: true,
    created_at: "2024-01-01T00:00:00Z",
    last_modified: "2024-01-02T00:00:00Z",
  });

  expect(mapped.imaging).toBe("Chest X-ray");
  expect(mapped.labs).toBe("CBC, BMP");
  expect(mapped.clinicalSummary).toBe("Custom summary");
  expect(mapped.intervalEvents).toBe("Custom events");
  expect(mapped.collapsed).toBe(true);
  expect(mapped.lastModified).toBe("2024-01-02T00:00:00Z");
});
