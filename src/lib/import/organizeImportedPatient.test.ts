import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyClinicalFragmentToChartSection,
  organizeImportedPatient,
} from "@/lib/import/organizeImportedPatient";

describe("organizeImportedPatient", () => {
  it("maps core identity and system fields into chart payload", () => {
    const actual = organizeImportedPatient({
      name: "Jane Doe",
      mrn: "123",
      age: "72 yo",
      sex: "F",
      bed: "ICU-4",
      handoffSummary: "Septic shock",
      intervalEvents: "Started norepi",
      systems: {
        neuro: "AOx3",
        resp: "Intubated",
      },
      medications: {
        infusions: ["Norepinephrine 5 mcg/kg/min"],
        scheduled: [],
        prn: [],
      },
    });

    assert.equal(actual.bed, "ICU-4");
    assert.match(actual.name, /Jane Doe/);
    assert.match(actual.name, /123/);
    assert.equal(actual.mrn, "123");
    assert.equal(actual.clinicalSummary, "Septic shock");
    assert.equal(actual.intervalEvents, "Started norepi");
    assert.equal(actual.systems.neuro, "AOx3");
    assert.equal(actual.systems.resp, "Intubated");
    assert.deepEqual(actual.medications.infusions, ["Norepinephrine 5 mcg/kg/min"]);
  });

  it("uses room when bed is missing", () => {
    const actual = organizeImportedPatient({
      name: "John Smith",
      room: "H022-01",
      clinicalSummary: "ICH",
    });
    assert.equal(actual.bed, "H022-01");
  });

  it("exposes classifier hook for extra labeled fragments", () => {
    // Until the learning TODO is filled in, unknown labels default to clinicalSummary.
    assert.equal(
      classifyClinicalFragmentToChartSection("Pulm", "CXR clear"),
      "clinicalSummary",
    );

    const actual = organizeImportedPatient({
      name: "Ada",
      bed: "1",
      clinicalSummary: "Base",
      Pulm: "CXR clear",
    });
    assert.match(actual.clinicalSummary, /Base/);
    assert.match(actual.clinicalSummary, /CXR clear/);
  });
});
