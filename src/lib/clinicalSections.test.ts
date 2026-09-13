import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SYSTEMS, mergeSystemsConfig, createEmptySystems, SYSTEM_KEYS } from "./clinicalSections";
import { parseSystemsJson } from "@/lib/mappers/patientMapper";
import { organizeImportedPatient } from "@/lib/import/organizeImportedPatient";
import { defaultMedications, type Patient } from "@/types/patient";
import { buildNoteSections } from "./continuousNote";
import { buildRoundsPatientModel } from "./print/roundsModel";
import { normalizeRoundsSettings } from "./print/roundsTypes";
import { createDefaultSections } from "@/components/print/layoutDesigner/defaultLayouts";

const requestedTitles = ["NEURO", "CV", "RESP", "RENAL/GU", "GI", "ENDO", "HEME/ONC", "ID", "L/D/A", "SKIN", "DISPO"];

test("existing system preferences upgrade titles and insert SKIN once after L/D/A", () => {
  const oldTitles = ["Neuro", "Cardiovascular", "Respiratory", "Renal/GU", "GI/Nutrition", "Endocrine", "Hematology", "Infectious", "Skin/Lines", "Disposition"];
  const saved = DEFAULT_SYSTEMS.filter((system) => system.key !== "skin")
    .map((system, i) => ({ ...system, label: oldTitles[i], shortLabel: oldTitles[i], sortOrder: i }));
  saved[0].enabled = false;
  const merged = mergeSystemsConfig(saved);
  assert.deepEqual(merged.map((system) => system.label), requestedTitles);
  assert.deepEqual(merged.map((system) => system.shortLabel), requestedTitles);
  assert.equal(merged[0].enabled, false);
  assert.deepEqual(mergeSystemsConfig(merged), merged);
  assert.equal(saved.length, 10);
  assert.equal(saved[8].label, "Skin/Lines");
});

test("custom labels, custom sections and their order survive the title upgrade", () => {
  const customNeuro = { ...DEFAULT_SYSTEMS[0], label: "Neuro ICU", shortLabel: "NICU" };
  const custom = { ...customNeuro, key: "family", label: "Family", shortLabel: "Family", isCustom: true, sortOrder: 1 };
  const merged = mergeSystemsConfig([customNeuro, custom]);
  assert.equal(merged[0].label, "Neuro ICU");
  assert.equal(merged[0].shortLabel, "NICU");
  assert.equal(merged[1].key, "family");
});

test("legacy combined content stays intact and separate skin notes survive database parsing", () => {
  const legacy = parseSystemsJson({ skinLines: "Existing skin and line findings" });
  assert.equal(legacy.skinLines, "Existing skin and line findings");
  assert.equal(legacy.skin, "");
  const updated = parseSystemsJson({ ...legacy, skin: "Separate skin assessment" });
  assert.equal(updated.skin, "Separate skin assessment");
  assert.equal(updated.skinLines, legacy.skinLines);
});

test("import headings route L/D/A, SKIN and HEME/ONC to independent chart fields", () => {
  const patient = organizeImportedPatient({
    "L/D/A": "L/D/A: Line assessment",
    "SKIN": "SKIN: Wound assessment",
    "HEME/ONC": "HEME/ONC: Hematology assessment",
  });
  assert.equal(patient.systems.skinLines, "Line assessment");
  assert.equal(patient.systems.skin, "Wound assessment");
  assert.equal(patient.systems.heme, "Hematology assessment");
});

test("every built-in section survives database parsing and appears in editing and full print layouts", () => {
  const original = createEmptySystems();
  SYSTEM_KEYS.forEach((key) => { original[key] = `Source findings for ${key}`; });
  const patient: Patient = {
    id: "synthetic-section-test", patientNumber: 1, name: "Synthetic patient", mrn: "", bed: "TEST",
    clinicalSummary: "", intervalEvents: "", imaging: "", labs: "", systems: parseSystemsJson(original),
    medications: defaultMedications, fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "",
  };
  const editing = buildNoteSections(patient, DEFAULT_SYSTEMS).filter(section => section.group === "systems");
  const printing = buildRoundsPatientModel(patient, [], normalizeRoundsSettings({ dispoStyle: "section" }));
  const layout = createDefaultSections().filter(section => section.type.startsWith("systems."));
  assert.deepEqual(editing.map(section => section.label), requestedTitles);
  assert.deepEqual(printing.sections.map(section => section.label), requestedTitles);
  assert.deepEqual(layout.map(section => section.label), requestedTitles);
  SYSTEM_KEYS.forEach((key, index) => {
    assert.equal(editing[index].html, original[key]);
    assert.deepEqual(printing.sections[index].lines, [original[key]]);
  });
  assert.equal(new Set(createDefaultSections().map(section => section.order)).size, createDefaultSections().length);
});

test("patient defaults do not share mutable note values", () => {
  const first = createEmptySystems();
  first.neuro = "First patient findings";
  assert.equal(createEmptySystems().neuro, "");
  assert.deepEqual(parseSystemsJson(null), createEmptySystems());
});

test("saved print titles upgrade former defaults and retain clinician titles and visibility", () => {
  const settings = normalizeRoundsSettings({ sections: [
    { key: "cv", label: "Cardio/Vasc", color: "#123456", enabled: false },
    { key: "neuro", label: "My neuro assessment", color: "#654321", enabled: true },
  ] });
  assert.equal(settings.sections[0].label, "CV");
  assert.equal(settings.sections[0].enabled, false);
  assert.equal(settings.sections[0].color, "#123456");
  assert.equal(settings.sections[1].label, "My neuro assessment");
});

