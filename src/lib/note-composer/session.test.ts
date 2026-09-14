import { test } from "node:test";
import assert from "node:assert/strict";
import { ComposerSession, type ComposerTransport } from "./session";
import {
  defaultMedications,
  defaultSystems,
  type Patient,
} from "@/types/patient";
import type { ComposeRequest, ComposeResponse } from "@/types/noteComposer";
const p: Patient = {
  id: "p1",
  name: "Synthetic One",
  mrn: "",
  bed: "TEST 1",
  patientNumber: 1,
  clinicalSummary: "Original",
  intervalEvents: "",
  labs: "",
  imaging: "",
  systems: { ...defaultSystems },
  medications: { ...defaultMedications },
  fieldTimestamps: {},
  revision: 2,
  createdAt: "",
  lastModified: "",
  collapsed: false,
};
const result = (r: ComposeRequest): ComposeResponse => ({
  binding: r.binding,
  blocks: [{
    id: "clinicalSummary",
    destination: "clinicalSummary",
    kind: "summary",
    text: "Revised",
    claimIds: ["c1"],
    editVersion: 0,
    provenance: "generated",
  }],
  claims: [{
    id: "c1",
    patientId: "p1",
    concept: "summary",
    text: "Revised",
    state: "interpretation",
    timeKind: "undated",
    destination: "clinicalSummary",
    spans: [{ sourceId: "attending", start: 0, end: 7 }],
    uncertainty: "",
  }],
  removals: [],
  supportedClaimIds: ["c1"],
  conflicts: [],
});
const transport: ComposerTransport = {
  generate: async (r) => result(r),
  apply: async () => ({ revision: 3 }),
};
function session(t = transport) {
  const s = new ComposerSession("u1", p, t);
  s.setAttending("Revised");
  return s;
}
test("generation produces a proposal, never saves or overwrites the working note", async () => {
  const s = session();
  await s.generate();
  assert.equal(s.state.blocks[0].text, "Original");
  assert.equal(s.state.proposal?.response.blocks[0].text, "Revised");
  assert.equal(s.state.saveStatus, "unsaved");
});
test("manual edits during generation require explicit overlap resolution", async () => {
  let finish!: (r: ComposeResponse) => void;
  let request!: ComposeRequest;
  const s = session({
    ...transport,
    generate: (r) => {
      request = r;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const pending = s.generate();
  s.edit("clinicalSummary", "My words");
  finish(result(request));
  await pending;
  s.acceptProposal();
  assert.equal(s.state.blocks[0].text, "My words");
  assert.deepEqual(s.state.mergeConflicts, ["clinicalSummary"]);
  s.resolveConflict("clinicalSummary", "keep");
  assert.equal(s.state.blocks[0].provenance, "clinician");
});
test("cancelled and destroyed sessions reject late responses and clear temporary material", async () => {
  let finish!: (r: ComposeResponse) => void;
  let request!: ComposeRequest;
  const s = session({
    ...transport,
    generate: (r) => {
      request = r;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const pending = s.generate();
  s.destroy();
  finish(result(request));
  await pending;
  assert.equal(s.state.attending, "");
  assert.equal(s.state.sources.length, 0);
  assert.equal(s.state.blocks.length, 0);
  assert.equal(s.state.proposal, null);
});
test("source intake requires an explicit patient-specific selection without truncation", () => {
  const s = session();
  const id = s.addSource("Patient A Na 139\nPatient B Na 152", "Paste");
  assert.equal(
    s.state.sources.find((x) => x.id === id)?.assignment,
    "quarantined",
  );
  s.selectSource(id, 0, 17);
  assert.equal(
    s.state.sources.find((x) => x.id === id)?.text,
    "Patient A Na 139\n",
  );
  assert.equal(
    s.state.sources.find((x) => x.id === id)?.assignment,
    "confirmed",
  );
  assert.throws(() => s.addSource("x".repeat(200001), "Large"), /limit/i);
});
test("copy requires reviewed generated content and preserves exact displayed line breaks", async () => {
  const s = session();
  await s.generate();
  s.acceptProposal();
  assert.throws(() => s.reviewedText(), /review/i);
  s.review("clinicalSummary", true);
  assert.equal(s.reviewedText(), "Revised");
  s.edit("clinicalSummary", "My line\nSecond line");
  assert.equal(s.reviewedText(), "My line\nSecond line");
  assert.equal(s.state.saveStatus, "unsaved");
});
test("failed saves retry the identical operation and stale revision preserves the draft", async () => {
  const operations: string[] = [];
  let calls = 0;
  const s = session({
    ...transport,
    apply: async (patch) => {
      operations.push(patch.operationId);
      if (++calls === 1) throw new Error("network secret");
      return { conflict: true, revision: 9 };
    },
  });
  s.edit("clinicalSummary", "Manual");
  await s.apply();
  await s.apply();
  assert.equal(operations[0], operations[1]);
  assert.equal(s.state.saveStatus, "conflict");
  assert.equal(s.state.blocks[0].text, "Manual");
  assert.ok(!s.state.error.includes("secret"));
});
test("undo after saving becomes an unsaved new revision, offline apply never queues", async () => {
  const s = session();
  s.edit("clinicalSummary", "Manual");
  await s.apply();
  assert.equal(s.state.saveStatus, "saved");
  s.undo();
  assert.equal(s.state.blocks[0].text, "Original");
  assert.equal(s.state.saveStatus, "unsaved");
  await s.apply(false);
  assert.match(s.state.error, /offline/i);
});
test("removed source invalidates evidence and pending requests", async () => {
  const s = session();
  await s.generate();
  s.acceptProposal();
  s.review("clinicalSummary", true);
  s.setAttending("Different");
  assert.throws(() => s.reviewedText(), /source|support|review/i);
});
test("source extraction failures remain visible until explicitly excluded", async () => {
  const s = session();
  s.intakeFailed("File could not be read");
  await s.generate();
  assert.equal(s.state.proposal, null);
  assert.ok(s.state.error);
  s.excludeFailure();
  await s.generate();
  assert.ok(s.state.proposal);
});
test("deleting all text requires an explicit field clear before apply", () => {
  const s = session();
  s.edit("clinicalSummary", "");
  assert.throws(() => s.reviewedText(), /clear/i);
  s.clearField("clinicalSummary");
  assert.equal(s.reviewedText(), "");
});
test("server conflict review merges newer chart additions and preserves local edits", () => {
  const s = session();
  s.edit("clinicalSummary", "My words");
  s.rebaseChart({
    ...p,
    revision: 8,
    clinicalSummary: "Other clinician",
    systems: { ...p.systems, resp: "NC 2 L" },
  });
  assert.equal(
    s.state.blocks.find((b) => b.id === "clinicalSummary")?.text,
    "My words",
  );
  assert.equal(
    s.state.blocks.find((b) => b.id === "systems.resp")?.text,
    "NC 2 L",
  );
  assert.deepEqual(s.state.mergeConflicts, ["clinicalSummary"]);
  s.resolveConflict("clinicalSummary", "keep");
  assert.equal(s.patient.revision, 8);
  assert.match(s.reviewedText(), /My words/);
});
test("loading the default mode does not mark an unchanged chart unsaved", () => {
  const s = new ComposerSession("u1", p, transport);
  s.setMode("standard");
  assert.equal(s.state.saveStatus, "saved");
});
