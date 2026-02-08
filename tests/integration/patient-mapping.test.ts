import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseFieldTimestampsJson,
  parseMedicationsJson,
  parseSystemsJson,
  prepareUpdateData,
} from "@/lib/mappers/patientMapper";
import { mapPatientRecord } from "@/services/patientService";
import { sampleDbRecord } from "../fixtures/patient";

describe("patient mapping integration", () => {
  it("maps a database record into UI model", () => {
    const result = mapPatientRecord(sampleDbRecord);

    assert.equal(result.patientNumber, 3);
    assert.equal(result.imaging, "");
    assert.equal(result.systems.neuro, "Alert");
    assert.equal(result.medications.infusions[0], "Propofol");
  });

  it("parses systems and medications with defaults", () => {
    assert.equal(parseSystemsJson(null).cv, "");
    assert.equal(parseMedicationsJson(null).scheduled.length, 0);
  });

  it("parses field timestamps from JSON", () => {
    const timestamps = parseFieldTimestampsJson({ clinicalSummary: "2024-01-01" });
    assert.equal(timestamps.clinicalSummary, "2024-01-01");
  });

  it("prepares update data for nested fields", () => {
    const update = prepareUpdateData(
      "systems.neuro",
      "Sedated",
      { neuro: "Alert", cv: "", resp: "", renalGU: "", gi: "", endo: "", heme: "", infectious: "", skinLines: "", dispo: "" },
      undefined
    );

    assert.deepEqual(update.systems, {
      neuro: "Sedated",
      cv: "",
      resp: "",
      renalGU: "",
      gi: "",
      endo: "",
      heme: "",
      infectious: "",
      skinLines: "",
      dispo: "",
    });
  });
});
