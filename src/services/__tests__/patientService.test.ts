import { describe, expect, it } from "vitest";
import {
  buildPatientInsertPayload,
  defaultMedicationsValue,
  defaultSystemsValue,
  getNextPatientCounter,
  mapPatientRecord,
  shouldTrackTimestamp,
} from "@/services/patientService";

describe("patientService", () => {
  it("maps patient records with safe defaults", () => {
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

    expect(mapped.imaging).toBe("");
    expect(mapped.labs).toBe("");
    expect(mapped.systems).toEqual(defaultSystemsValue);
    expect(mapped.medications).toEqual(defaultMedicationsValue);
  });

  it("builds patient insert payload with defaults", () => {
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

  it("flags trackable fields and computes next counter", () => {
    expect(shouldTrackTimestamp("clinicalSummary")).toBe(true);
    expect(shouldTrackTimestamp("systems.neuro")).toBe(true);
    expect(shouldTrackTimestamp("nonTracked")).toBe(false);
    expect(getNextPatientCounter([{ patientNumber: 7 } as { patientNumber: number }])).toBe(8);
  });
});
