import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientInsertPayload,
  mapPatientRecord,
  defaultSystemsValue,
  defaultMedicationsValue,
} from "@/services/patientService";

/**
 * This test simulates a small but realistic end-to-end flow for a single patient:
 * - build an insert payload for Supabase
 * - simulate the record as it would come back from the database
 * - map it into the app's Patient domain type
 */
test("patient insert and read-back round trip preserves key fields", () => {
  const insert = buildPatientInsertPayload({
    userId: "user-rt",
    patientNumber: 12,
    name: "Round Trip Patient",
    bed: "ICU-7",
    clinicalSummary: "Initial summary",
    intervalEvents: "Overnight events",
    imaging: "CT head",
    labs: "CBC, BMP",
  });

  // Simulate what a row from the `patients` table would look like when read back.
  const dbRecord = {
    id: "patient-rt-1",
    patient_number: insert.patient_number,
    name: insert.name,
    bed: insert.bed,
    clinical_summary: insert.clinical_summary,
    interval_events: insert.interval_events,
    imaging: insert.imaging,
    labs: insert.labs,
    systems: insert.systems,
    medications: insert.medications,
    field_timestamps: null,
    collapsed: false,
    created_at: "2024-01-01T00:00:00Z",
    last_modified: null,
  } as const;

  const patient = mapPatientRecord(dbRecord);

  assert.equal(patient.id, "patient-rt-1");
  assert.equal(patient.patientNumber, 12);
  assert.equal(patient.name, "Round Trip Patient");
  assert.equal(patient.bed, "ICU-7");
  assert.equal(patient.clinicalSummary, "Initial summary");
  assert.equal(patient.intervalEvents, "Overnight events");
  assert.equal(patient.imaging, "CT head");
  assert.equal(patient.labs, "CBC, BMP");
  assert.deepEqual(patient.systems, defaultSystemsValue);
  assert.deepEqual(patient.medications, defaultMedicationsValue);
  assert.equal(patient.collapsed, false);
  assert.equal(patient.lastModified, null);
});

