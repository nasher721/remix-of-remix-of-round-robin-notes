import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchesBinding,
  mergeProposal,
  PROFILE_VERSION,
  reconcileClaims,
  serializeBlocks,
  validateEvidence,
  validateFormat,
  validateGenerated,
} from "../../../supabase/functions/_shared/note-composer.ts";
import type {
  Binding,
  Claim,
  NoteBlock,
  Source,
} from "../../../supabase/functions/_shared/note-composer.ts";

const source: Source = {
  id: "s1",
  patientId: "p1",
  type: "record",
  text: "Na 139. Heparin ordered. Foley removed.",
  importedAt: "2026-09-13T12:00:00Z",
  assignment: "confirmed",
};
const claim = (overrides: Partial<Claim> = {}): Claim => ({
  id: "c1",
  patientId: "p1",
  concept: "Na",
  text: "Na 139",
  state: "observed",
  time: "2026-09-13T08:00:00Z",
  timeKind: "specimen",
  destination: "systems.renalGU",
  spans: [{ sourceId: "s1", start: 0, end: 6 }],
  uncertainty: "",
  ...overrides,
});
const block = (id: string, text: string): NoteBlock => ({
  id,
  destination: id as NoteBlock["destination"],
  kind: "system",
  text,
  claimIds: [],
  editVersion: 0,
  provenance: "clinician",
});
const binding: Binding = {
  ownerId: "u1",
  patientId: "p1",
  sessionId: "session",
  requestId: "r1",
  profileVersion: PROFILE_VERSION,
  mode: "standard",
  sourceVersion: 1,
  draftVersion: 1,
  chartRevision: 3,
};

test("newer imports never displace newer specimen results, older results remain dated trends", () => {
  const result = reconcileClaims([
    claim(),
    claim({ id: "old", text: "Na 151", time: "2026-09-12T08:00:00Z" }),
  ]);
  assert.deepEqual(result.current.map((c) => c.id), ["c1"]);
  assert.deepEqual(result.historical.map((c) => c.id), ["old"]);
});
test("material equal-time conflicts and undated alternatives remain unresolved", () => {
  const result = reconcileClaims([
    claim(),
    claim({ id: "c2", text: "Na 145" }),
    claim({ id: "c3", time: undefined }),
  ]);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.current.length, 3);
});
test("explicit corrections supersede only the corrected claim and preserve plan/action distinctions", () => {
  const result = reconcileClaims([
    claim(),
    claim({ id: "fix", text: "Na 140", state: "correction", corrects: "c1" }),
    claim({ id: "plan", state: "planned", text: "Recheck Na" }),
  ]);
  assert.deepEqual(result.current.map((c) => c.id), ["fix", "plan"]);
});
test("ordered, administered, held, stopped, planned, completed, removed and current states never collapse", () => {
  const states = [
    "ordered",
    "administered",
    "held",
    "stopped",
    "planned",
    "completed",
    "removed",
    "infusing",
  ] as const;
  assert.equal(
    reconcileClaims(states.map((state, i) => claim({ id: String(i), state })))
      .current.length,
    states.length,
  );
});
test("evidence rejects wrong patient, unknown/removed source, quarantined input and bad offsets", () => {
  assert.deepEqual(validateEvidence([claim()], [source], "p1"), []);
  for (
    const sources of [[], [{ ...source, patientId: "p2" }], [{
      ...source,
      assignment: "quarantined" as const,
    }]]
  ) assert.ok(validateEvidence([claim()], sources, "p1").length);
  assert.ok(
    validateEvidence([claim({ patientId: "p2" })], [source], "p1").length,
  );
  assert.ok(
    validateEvidence(
      [claim({ spans: [{ sourceId: "s1", start: 0, end: 500 }] })],
      [source],
      "p1",
    ).length,
  );
});
test("serializer preserves exact bodies, ordered systems and consecutive supported closing lines", () => {
  const blocks = [
    block("systems.dispo", "ICU for NC q2h"),
    block(
      "systems.neuro",
      "NC q1h->q2h\n\n# Intracerebral hemorrhage\nCTH stable\nDex 8 BID",
    ),
    block("clinicalSummary", "61F w hemorrhage"),
    block("systems.skinLines", "PICC"),
  ];
  const text = serializeBlocks(blocks);
  assert.equal(
    text,
    "61F w hemorrhage\n\nNEURO\nNC q1h->q2h\n\n# Intracerebral hemorrhage\nCTH stable\nDex 8 BID\n\nL/D/A: PICC\nDispo/Code status: ICU for NC q2h",
  );
  assert.deepEqual(validateFormat(text), []);
  assert.ok(!text.includes("Skin:"));
});
test("profile-aware validator accepts multiline primary and adjacent simple problems", () => {
  assert.deepEqual(
    validateFormat(
      "NEURO\nNC q2h\nMS awake\n\n# Intracerebral hemorrhage\nCTH stable\n\n# Epilepsy: Levetiracetam 750->1000 mg\n# Headache: Improved",
    ),
    [],
  );
  for (
    const text of [
      "```note```",
      "NEURO\n- Plan",
      "CV\nMAP>65; stable",
      "RESP\nNC 2 L → 1 L",
      "CV\nNEURO",
      "NEURO\nNC q2h\n# Hemorrhage\nCTH stable",
      "CV\n# A: Stable\n\n# B: Stable",
    ]
  ) assert.ok(validateFormat(text).length, text);
});
test("three-way proposal keeps manual edits and requires overlapping changes to be resolved", () => {
  const base = [
    block("clinicalSummary", "Original"),
    block("systems.neuro", "Original neuro"),
  ];
  const current = [block("clinicalSummary", "Manual"), base[1]];
  const result = mergeProposal(
    base,
    current,
    [
      block("clinicalSummary", "Generated"),
      block("systems.neuro", "New neuro"),
    ],
    ["clinicalSummary", "systems.neuro"],
    [],
  );
  assert.equal(result.blocks[0].text, "Manual");
  assert.equal(result.blocks[1].text, "New neuro");
  assert.deepEqual(result.conflicts, ["clinicalSummary"]);
});
test("scoped rewrite rejects outside changes and requires explicit deletions", () => {
  const base = [
    block("clinicalSummary", "Original"),
    block("systems.neuro", "Keep exact taper"),
  ];
  assert.throws(
    () =>
      mergeProposal(base, base, [block("systems.neuro", "Changed")], [
        "clinicalSummary",
      ], []),
    /scope/i,
  );
  assert.deepEqual(
    mergeProposal(base, base, [block("clinicalSummary", "Short")], [
      "clinicalSummary",
    ], []).blocks.map((b) => b.text),
    ["Short", "Keep exact taper"],
  );
  assert.deepEqual(
    mergeProposal(base, base, [], ["systems.neuro"], ["systems.neuro"]).blocks
      .map((b) => b.text),
    ["Original"],
  );
});
test("every async binding dimension rejects a late response", () => {
  assert.ok(matchesBinding(binding, { ...binding }));
  for (const key of Object.keys(binding)) {
    assert.equal(
      matchesBinding(binding, { ...binding, [key]: "other" }),
      false,
      key,
    );
  }
});
test("generated assertions require valid evidence, known claims and separate semantic support", () => {
  const b = {
    ...block("systems.renalGU", "Na 139"),
    provenance: "generated" as const,
    claimIds: ["c1"],
  };
  assert.deepEqual(
    validateGenerated([b], [claim()], [source], "p1", ["c1"]),
    [],
  );
  assert.ok(validateGenerated([b], [claim()], [source], "p1", []).length);
  assert.ok(
    validateGenerated(
      [{ ...b, claimIds: ["invented"] }],
      [claim()],
      [source],
      "p1",
      ["c1"],
    ).length,
  );
});
