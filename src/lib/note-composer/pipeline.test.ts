import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composePipeline,
  parseResponse,
  validateRequest,
  verifiedAttempts,
} from "../../../supabase/functions/_shared/note-composer-pipeline.ts";
import {
  type ComposeRequest,
  PROFILE_VERSION,
} from "../../../supabase/functions/_shared/note-composer.ts";
const request: ComposeRequest = {
  binding: {
    ownerId: "u1",
    patientId: "p1",
    sessionId: "s1",
    requestId: "r1",
    profileVersion: PROFILE_VERSION,
    mode: "standard",
    sourceVersion: 1,
    draftVersion: 0,
    chartRevision: 2,
  },
  sources: [{
    id: "s1",
    patientId: "p1",
    type: "record",
    text: "Na 139",
    assignment: "confirmed",
    importedAt: "2026-09-13T12:00:00Z",
  }],
  base: [],
  allowedTargets: ["systems.renalGU"],
  instruction: "",
};
const c = {
  id: "c1",
  patientId: "p1",
  concept: "Na",
  text: "Na 139",
  state: "observed",
  timeKind: "specimen",
  time: "2026-09-13T08:00:00Z",
  destination: "systems.renalGU",
  spans: [{ sourceId: "s1", start: 0, end: 6 }],
  uncertainty: "",
};
const b = {
  id: "systems.renalGU",
  destination: "systems.renalGU",
  kind: "system",
  text: "Na 139",
  claimIds: ["c1"],
  editVersion: 0,
  provenance: "generated",
};
test("request boundary rejects wrong owner, patient, quarantine, oversized and malformed input", () => {
  assert.equal(validateRequest(request, "u1"), true);
  for (
    const value of [
      { ...request, binding: { ...request.binding, ownerId: "u2" } },
      { ...request, sources: [{ ...request.sources[0], patientId: "p2" }] },
      {
        ...request,
        sources: [{ ...request.sources[0], assignment: "quarantined" }],
      },
      {
        ...request,
        sources: [{ ...request.sources[0], text: "x".repeat(200001) }],
      },
      {},
      null,
    ]
  ) assert.equal(validateRequest(value, "u1"), false);
});
test("failover excludes every provider lacking explicit retention attestation", () => {
  const attempts = [{ config: { provider: "openai" } }, {
    config: { provider: "gemini" },
  }];
  assert.deepEqual(verifiedAttempts(attempts, ""), []);
  assert.deepEqual(verifiedAttempts(attempts, "openai"), [attempts[0]]);
});
test("pipeline reconciles before drafting and separately verifies every assertion", async () => {
  const phases: string[] = [];
  const result = await composePipeline(
    request,
    async (stage, _system, input) => {
      phases.push(stage);
      if (stage === "reconcile") return { claims: [c] };
      if (stage === "draft") {
        assert.ok(JSON.stringify(input).includes("historical"));
        return { blocks: [b], removals: [] };
      }
      return {
        supportedClaimIds: ["c1"],
        supportedBlockIds: [b.id],
        unsupported: [],
        wrongPatient: false,
      };
    },
  );
  assert.deepEqual(phases, ["reconcile", "draft", "verify"]);
  assert.equal(result.blocks[0].text, "Na 139");
  assert.deepEqual(result.binding, request.binding);
});
test("valid offsets cannot excuse semantic fabrication or unverified block prose", async () => {
  await assert.rejects(
    () =>
      composePipeline(
        request,
        async (stage) =>
          stage === "reconcile" ? { claims: [c] } : stage === "draft"
            ? {
              blocks: [{ ...b, text: "Na 139. Renal failure resolved." }],
              removals: [],
            }
            : {
              supportedClaimIds: ["c1"],
              supportedBlockIds: [],
              unsupported: ["fabrication"],
              wrongPatient: false,
            },
      ),
    /support/i,
  );
});
test("malformed output cannot supply fake evidence or mutate scope", () => {
  assert.throws(
    () =>
      parseResponse({
        binding: request.binding,
        blocks: [b],
        claims: [{ ...c, spans: null }],
        removals: [],
        supportedClaimIds: ["c1"],
        conflicts: [],
      }, request),
    /response/i,
  );
  assert.throws(
    () =>
      parseResponse({
        binding: request.binding,
        blocks: [{ ...b, id: "systems.neuro", destination: "systems.neuro" }],
        claims: [c],
        removals: [],
        supportedClaimIds: ["c1"],
        conflicts: [],
      }, request),
    /response|scope/i,
  );
});
