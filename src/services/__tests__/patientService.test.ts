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
  assert.equal(getNextPatientCounter([{ patientNumber: 7 } as { patientNumber: number }]), 8);
});
