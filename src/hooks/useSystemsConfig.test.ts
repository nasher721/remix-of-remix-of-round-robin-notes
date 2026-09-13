import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SYSTEMS, mergeSystemsConfig } from "./useSystemsConfig";
import { parseSystemsJson } from "@/lib/mappers/patientMapper";
import { organizeImportedPatient } from "@/lib/import/organizeImportedPatient";

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
