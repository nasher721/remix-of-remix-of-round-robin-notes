import test from "node:test";
import assert from "node:assert/strict";
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
      last_modified: null,
    });

    assert.equal(mapped.imaging, "");
    assert.equal(mapped.labs, "");
    assert.deepEqual(mapped.systems, defaultSystemsValue);
    assert.deepEqual(mapped.medications, defaultMedicationsValue);
  });

test("builds patient insert payload with defaults", () => {
    const payload = buildPatientInsertPayload({
      userId: "user-1",
      patientNumber: 3,
      name: "Jane",
      bed: "B2",
    });

    assert.equal(payload.user_id, "user-1");
    assert.equal(payload.patient_number, 3);
    assert.equal(payload.name, "Jane");
    assert.equal(payload.bed, "B2");
    assert.deepEqual(payload.systems, defaultSystemsValue);
  });

test("flags trackable fields and computes next counter", () => {
  assert.equal(shouldTrackTimestamp("clinicalSummary"), true);
  assert.equal(shouldTrackTimestamp("systems.neuro"), true);
  assert.equal(shouldTrackTimestamp("nonTracked"), false);
  
  // Create a minimal Patient-like object for testing getNextPatientCounter
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
    lastModified: null,
  };
  assert.equal(getNextPatientCounter([mockPatient]), 8);
});

test("handles empty and unsorted arrays", () => {
  assert.equal(getNextPatientCounter([]), 1);
  
  const unsorted = [
    { ...{ patientNumber: 3 }, id: "3", name: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: null },
    { ...{ patientNumber: 1 }, id: "1", name: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: null },
    { ...{ patientNumber: 5 }, id: "5", name: "", bed: "", clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: defaultSystemsValue, medications: defaultMedicationsValue, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: null },
  ];
  assert.equal(getNextPatientCounter(unsorted), 6);
});

test("tracks all major field types", () => {
  assert.equal(shouldTrackTimestamp("systems"), true);
  assert.equal(shouldTrackTimestamp("medications"), true);
  assert.equal(shouldTrackTimestamp("labs"), true);
  assert.equal(shouldTrackTimestamp("imaging"), true);
  assert.equal(shouldTrackTimestamp("intervalEvents"), true);
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

  assert.equal(mapped.imaging, "Chest X-ray");
  assert.equal(mapped.labs, "CBC, BMP");
  assert.equal(mapped.clinicalSummary, "Custom summary");
  assert.equal(mapped.intervalEvents, "Custom events");
  assert.equal(mapped.collapsed, true);
  assert.equal(mapped.lastModified, "2024-01-02T00:00:00Z");
});
