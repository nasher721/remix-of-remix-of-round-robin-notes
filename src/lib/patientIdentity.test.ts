import assert from "node:assert/strict";
import test from "node:test";
import { getPatientIdentity, normalizePatientAlerts, normalizePatientIdentityValue } from "./patientIdentity";

test("normalizes blank and unresolved template values", () => {
  assert.equal(normalizePatientIdentityValue(""), "Not documented");
  assert.equal(normalizePatientIdentityValue("   "), "Not documented");
  assert.equal(normalizePatientIdentityValue("[MRN]"), "Not documented");
  assert.equal(normalizePatientIdentityValue(" [Code Status] "), "Not documented");
  assert.equal(normalizePatientIdentityValue("MRN-123"), "MRN-123");
});

test("builds a complete identity without duplicate allergies", () => {
  assert.deepEqual(normalizePatientAlerts([" Penicillin ", "penicillin", "[No Allergies]"]), ["Penicillin"]);
  const identity = getPatientIdentity({
    id: "patient-1",
    patientNumber: 1,
    name: "  Ada Lovelace ",
    mrn: "[MRN]",
    bed: "7A",
    clinicalSummary: "",
    intervalEvents: "",
    imaging: "",
    labs: "",
    systems: {} as never,
    medications: { infusions: [], scheduled: [], prn: [] },
    fieldTimestamps: {},
    collapsed: false,
    createdAt: "",
    lastModified: "",
    alerts: ["Penicillin", "penicillin", "[No Allergies]"],
    attendingPhysician: "[Attending]",
    codeStatus: undefined,
  });

  assert.deepEqual(identity, {
    name: "Ada Lovelace",
    mrn: "Not documented",
    room: "7A",
    dob: "Not documented",
    allergies: "Penicillin",
    codeStatus: "Not documented",
    attending: "Not documented",
    diagnosis: "Not documented",
  });
});
