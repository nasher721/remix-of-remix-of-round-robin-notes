import { test } from "node:test";
import assert from "node:assert/strict";
import {
  abstractPreference,
  applyComposerPatch,
  readCompositionStream,
} from "./noteComposerService";
test("stream delivers only stages before a complete result and rejects truncated output", async () => {
  const stages: string[] = [];
  const response = new Response(
    '{"stage":"Reconciling updates"}\n{"result":{"ok":true}}\n',
  );
  assert.deepEqual(
    await readCompositionStream(response, (s) => stages.push(s)),
    { ok: true },
  );
  assert.deepEqual(stages, ["Reconciling updates"]);
  await assert.rejects(
    () =>
      readCompositionStream(
        new Response('{"stage":"Drafting note"}\n'),
        () => {},
      ),
    /incomplete/i,
  );
});
test("atomic service passes only accepted fields and preserves conflict response", async () => {
  const patch = {
    patientId: "p1",
    expectedRevision: 3,
    operationId: "op",
    fields: { clinicalSummary: "Reviewed" },
    format: { profileVersion: "2026-09-13.1", mode: "standard" as const },
  };
  const result = await applyComposerPatch(
    patch,
    new AbortController().signal,
    async (body) => {
      assert.deepEqual(Object.keys(body).sort(), [
        "p_expected_revision",
        "p_fields",
        "p_format",
        "p_operation_id",
        "p_patient_id",
      ]);
      assert.equal(body.p_operation_id, "op");
      return { conflict: true, revision: 8 };
    },
  );
  assert.deepEqual(result, { conflict: true, revision: 8 });
});
test("future-note preference accepts only an abstract allowlisted mode", () => {
  assert.deepEqual(abstractPreference("concise"), {
    profileVersion: "2026-09-13.1",
    mode: "concise",
  });
  assert.throws(() => abstractPreference("Patient has Na 139"), /preference/i);
});
