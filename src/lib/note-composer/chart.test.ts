import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  defaultMedications,
  defaultSystems,
  type Patient,
} from "@/types/patient";
import { chartSource, projectReviewed, snapshotBlocks } from "./chart";
import { serializeBlocks } from "../../../supabase/functions/_shared/note-composer.ts";
import {
  PROFILE_PREFERENCES,
  PROFILE_RULES,
} from "../../../supabase/functions/_shared/note-composer-profile.ts";
import {
  mapPatientRecord,
  PATIENT_SELECT_COLUMNS,
} from "@/services/patientService";

export const patient: Patient = {
  id: "p1",
  name: "Synthetic One",
  mrn: "",
  bed: "TEST 1",
  patientNumber: 1,
  clinicalSummary: "<p>61F w hemorrhage</p>",
  intervalEvents: "",
  labs: "Na 139",
  imaging: "CTH stable",
  systems: { ...defaultSystems, neuro: "<p>NC q2h</p>", dispo: "ICU" },
  medications: { ...defaultMedications, scheduled: ["Synthetic medication"] },
  fieldTimestamps: {},
  revision: 2,
  createdAt: "",
  lastModified: "",
  collapsed: false,
  codeStatus: "dnr",
};
test("packaged profile includes the full preference list with explicit safety precedence", () => {
  assert.ok(PROFILE_PREFERENCES.length > 10000);
  for (
    const rule of [
      "TF at goal",
      "q8h",
      "NC 2 L",
      "refusal",
      "MAP>65",
      "BMP daily",
      "Dilaudid PCA",
      "Standard Mode",
    ]
  ) assert.ok(PROFILE_PREFERENCES.includes(rule), rule);
  assert.match(PROFILE_RULES, /preferences override.*formatting/i);
  assert.match(PROFILE_RULES, /management-relevant normal/i);
});
test("accepted projection round trips exact displayed text and never changes medication or coded status", () => {
  const blocks = snapshotBlocks(patient);
  blocks[0] = {
    ...blocks[0],
    text: "61F w hemorrhage\nExact < target & timing\n",
  };
  const patch = projectReviewed(patient, blocks, [], "concise", "op");
  assert.equal(patch.expectedRevision, 2);
  assert.ok(!("medications" in patch.fields));
  const saved = structuredClone(patient);
  for (const [field, value] of Object.entries(patch.fields)) {
    if (field.startsWith("systems.")) {
      (saved.systems as Record<string, string>)[field.slice(8)] = value!;
    } else (saved as unknown as Record<string, unknown>)[field] = value;
  }
  assert.equal(serializeBlocks(snapshotBlocks(saved)), serializeBlocks(blocks));
  assert.deepEqual(saved.medications, patient.medications);
  assert.equal(saved.codeStatus, "dnr");
  assert.deepEqual(patch.format, {
    profileVersion: "2026-09-13.1",
    mode: "concise",
  });
});
test("omitted existing fields block apply unless their clear is explicitly accepted", () => {
  const blocks = snapshotBlocks(patient).filter((b) =>
    b.destination !== "systems.neuro"
  );
  assert.throws(
    () => projectReviewed(patient, blocks, [], "standard", "op"),
    /clear/i,
  );
  assert.equal(
    projectReviewed(patient, blocks, ["systems.neuro"], "standard", "op")
      .fields["systems.neuro"],
    "",
  );
});
test("source snapshot is undated and includes results without treating edit time as clinical time", () => {
  const s = chartSource(patient, "now");
  assert.equal(s.documentedTime, undefined);
  assert.match(s.text, /Na 139/);
  assert.match(s.text, /Synthetic medication/);
});
test("managed field attachments survive a text edit", () => {
  const p = {
    ...patient,
    clinicalSummary:
      '<p>Original</p><img src="https://example.test/image.png" alt="Chart image">',
  };
  const blocks = snapshotBlocks(p);
  blocks[0].text = "Updated";
  assert.match(
    projectReviewed(p, blocks, [], "standard", "op").fields.clinicalSummary!,
    /<img/,
  );
});
test("atomic migration locks the owned patient, checks revision and operation before one patch", () => {
  const sql = readFileSync(
    new URL(
      "../../../supabase/migrations/20260914000000_note_composer.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /user_id = auth\.uid\(\)/i);
  assert.match(sql, /revision <> p_expected_revision/i);
  assert.match(sql, /operation_id = p_operation_id/i);
  assert.match(sql, /systems = .*\|\|/i);
  assert.doesNotMatch(sql, /SET[\s\S]*medications\s*=/i);
});
test("roster mapping loads accepted profile metadata without temporary evidence", () => {
  assert.ok(PATIENT_SELECT_COLUMNS.includes("note_format"));
  const mapped = mapPatientRecord({
    id: "p1",
    patient_number: 1,
    name: "Synthetic",
    bed: "",
    clinical_summary: "",
    interval_events: "",
    imaging: null,
    labs: null,
    systems: {},
    medications: {},
    field_timestamps: {},
    collapsed: false,
    created_at: "",
    last_modified: "",
    note_format: { profileVersion: "2026-09-13.1", mode: "concise" },
  });
  assert.deepEqual(mapped.noteFormat, {
    profileVersion: "2026-09-13.1",
    mode: "concise",
  });
});
