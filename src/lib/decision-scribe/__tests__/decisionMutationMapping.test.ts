import assert from "node:assert/strict";
import test from "node:test";
import { mapDecisionCandidate } from "../decisionMutationMapping";
import type { DecisionCandidate } from "@/types/decisionScribe";
import { defaultMedications, defaultSystems, type Patient } from "@/types/patient";

const patient = { id: "p1", systems: { ...defaultSystems }, medications: { ...defaultMedications } } as Patient;
const candidate = (destination: DecisionCandidate["destination"], changeType?: DecisionCandidate["changeType"], content = "repeat neuro exam"): DecisionCandidate => ({
  id: "candidate-1" as DecisionCandidate["id"], destination, changeType, proposedContent: content,
} as DecisionCandidate);

test("maps every durable destination to a valid patient field or stable todo id", () => {
  for (const destination of ["clinicalSummary", "intervalEvents", "imaging", "labs"] as const) {
    const result = mapDecisionCandidate(candidate(destination), patient, "op-1");
    assert.equal(result.kind, "patient");
    if (result.kind === "patient") assert.equal(result.field, destination);
  }
  const systems = mapDecisionCandidate(candidate("systems", "modify", "update respiratory status"), patient, "op-1");
  assert.equal(systems.kind, "patient");
  if (systems.kind === "patient") assert.equal(systems.field, "systems.resp");
  const todo = mapDecisionCandidate(candidate("todo", "add", "call family"), patient, "op-1");
  assert.deepEqual(todo, { kind: "todo", content: "call family", id: "decision-op-1" });
});

test("medication removal never creates an active medication", () => {
  const source = { ...patient, medications: { ...defaultMedications, scheduled: ["levetiracetam"] } } as Patient;
  const result = mapDecisionCandidate(candidate("medications", "stop", "stop levetiracetam"), source, "op-1");
  assert.equal(result.kind, "patient");
  if (result.kind === "patient") assert.deepEqual(result.value, { infusions: [], scheduled: [], prn: [], rawText: "" });
});

test("maps explicit clinical system aliases and fails closed for unknown removal", () => {
  for (const [content, field] of [
    ["renal function stable", "systems.renalGU"],
    ["cardiovascular exam unchanged", "systems.cv"],
    ["hematology: platelets stable", "systems.heme"],
    ["skin and lines clean", "systems.skinLines"],
  ] as const) {
    const result = mapDecisionCandidate(candidate("systems", "modify", content), patient, "op-alias");
    assert.equal(result.kind, "patient");
    if (result.kind === "patient") assert.equal(result.field, field);
  }
  assert.throws(
    () => mapDecisionCandidate(candidate("systems", "remove", "remove old note"), patient, "op-remove"),
    /removal unavailable/,
  );
});

test("matches system aliases on token boundaries and honors a persisted system key", () => {
  const neurologic = mapDecisionCandidate(
    candidate("systems", "modify", "neurologic exam stable"),
    patient,
    "op-boundary",
  );
  assert.equal(neurologic.kind, "patient");
  if (neurologic.kind === "patient") assert.equal(neurologic.field, "systems.neuro");

  const restored = mapDecisionCandidate(
    {
      ...candidate("systems", "modify", "stable"),
      inverseAction: "restore",
      systemKey: "cv",
    } as DecisionCandidate & { inverseAction: "restore"; systemKey: "cv" },
    patient,
    "op-restore-system",
  );
  assert.equal(restored.kind, "patient");
  if (restored.kind === "patient") assert.equal(restored.field, "systems.cv");
});

test("restores medication modifications as a typed medication object", () => {
  const result = mapDecisionCandidate(
    {
      ...candidate("medications", "modify", "increase levetiracetam"),
      currentValue: "old dose",
      inverseAction: "restore",
    } as DecisionCandidate & { inverseAction: "restore" },
    patient,
    "op-restore",
  );
  assert.equal(result.kind, "patient");
  if (result.kind === "patient") {
    assert.deepEqual(result.value, {
      infusions: [],
      scheduled: ["old dose"],
      prn: [],
    });
  }
});
