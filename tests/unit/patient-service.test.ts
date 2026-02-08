import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPatientInsertPayload,
  defaultMedicationsValue,
  defaultSystemsValue,
  getNextPatientCounter,
  shouldTrackTimestamp,
} from "@/services/patientService";

const baseInput = {
  userId: "user-1",
  patientNumber: 7,
};

describe("patient service", () => {
  it("builds insert payload with defaults", () => {
    const payload = buildPatientInsertPayload(baseInput);
    assert.equal(payload.user_id, "user-1");
    assert.equal(payload.patient_number, 7);
    assert.deepEqual(payload.systems, defaultSystemsValue);
    assert.deepEqual(payload.medications, defaultMedicationsValue);
    assert.equal(payload.collapsed, false);
  });

  it("tracks timestamps for known fields", () => {
    assert.equal(shouldTrackTimestamp("clinicalSummary"), true);
    assert.equal(shouldTrackTimestamp("systems.neuro"), true);
    assert.equal(shouldTrackTimestamp("name"), false);
  });

  it("calculates next patient counter", () => {
    const next = getNextPatientCounter([
      { patientNumber: 1 } as { patientNumber: number },
      { patientNumber: 4 } as { patientNumber: number },
    ]);
    assert.equal(next, 5);
  });
});
