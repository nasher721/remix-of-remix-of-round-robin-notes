import assert from "node:assert/strict";
import test from "node:test";
import { createControlRecord, deriveAdaptationProfile, reduceAutonomy, resetProfile, revokeAdaptationPattern, resetAdaptationProfile, revokePattern, verifiedOutcomesFor } from "../adaptationProfile";
import type { VerifiedAttestationOutcome } from "../adaptationProfile";

const now = new Date("2026-01-31T00:00:00Z");
const outcome = (n: number, extra: Partial<VerifiedAttestationOutcome> = {}): VerifiedAttestationOutcome => ({ eventId: `event-${n}`, attestationId: `attestation-${n}`, physicianId: "p1", patternKey: "medication", contextKey: "icu", modelVersion: "m1", attestedAt: `2026-01-${String(n).padStart(2, "0")}T00:00:00Z`, outcome: "approved", verified: true, ...extra });
const profile = (items: VerifiedAttestationOutcome[], options?: Parameters<typeof deriveAdaptationProfile>[3]) => deriveAdaptationProfile("p1", items, now, options);

test("does not graduate on elapsed encounters or sparse evidence", () => {
  assert.equal(profile([outcome(1)]).patterns[0].autonomy, "full-review");
  assert.equal(profile([]).patterns.length, 0);
});

test("graduates only with calibrated explicit verified attestations", () => {
  const result = profile([27, 28, 29, 30, 31].map((n) => outcome(n)));
  assert.equal(result.patterns[0].autonomy, "exception-first");
  assert.match(result.patterns[0].rationale[0], /thresholds met/);
});

test("unverified, pending-like, and cross-physician evidence is ignored", () => {
  const items = [outcome(1, { verified: false }), outcome(2, { physicianId: "p2" }), outcome(3, { outcome: "reversed" })];
  assert.equal(verifiedOutcomesFor(items, "p1").length, 1);
  assert.equal(profile(items).patterns[0].autonomy, "full-review");
});

test("reversals and contradictions regress autonomy", () => {
  const result = profile([1, 2, 3, 4].map((n) => outcome(n)).concat(outcome(5, { outcome: "reversed", contradiction: true })));
  assert.equal(result.patterns[0].autonomy, "full-review");
  assert.ok(result.patterns[0].rationale.some((item) => /reversal|contradictory/.test(item)));
});

test("stale evidence, drift, and changed context/model fail closed", () => {
  const stale = [1, 2, 3, 4, 5].map((n) => outcome(n, { attestedAt: "2025-12-01T00:00:00Z" }));
  assert.equal(profile(stale).patterns[0].autonomy, "full-review");
  const drift = [27, 28, 29, 30].map((n) => outcome(n)).concat(outcome(31, { outcome: "edited" }));
  assert.equal(profile(drift).patterns[0].autonomy, "full-review");
  assert.equal(profile([27, 28, 29, 30, 31].map((n) => outcome(n)), { contextKey: "ward" }).patterns[0].autonomy, "full-review");
  assert.equal(profile([27, 28, 29, 30, 31].map((n) => outcome(n)), { modelVersion: "m2" }).patterns[0].autonomy, "full-review");
});

test("revoke and reset are physician-scoped and inspectable", () => {
 const original = profile([27, 28, 29, 30, 31].map((n) => outcome(n)));
  const revoked = revokePattern(original, "medication", "p1");
  assert.equal(revoked.patterns[0].autonomy, "full-review");
  assert.equal(revoked.patterns[0].revoked, true);
  assert.equal(resetAdaptationProfile("p2", "p2", now).physicianId, "p2");
  assert.equal(resetAdaptationProfile("p2", "p2", now).patterns.length, 0);
});

test("deduplicates replayed events and fails closed for conflicting IDs", () => {
  const five = [27, 28, 29, 30, 31].map((n) => outcome(n));
  assert.equal(profile(five.concat(outcome(31))).patterns[0].evidenceCount, 5);
  assert.equal(profile(five.concat(outcome(31, { attestationId: "other" }))).patterns[0].autonomy, "full-review");
});

test("controls persist across recomputation and require ownership", () => {
  const five = [27, 28, 29, 30, 31].map((n) => outcome(n));
  const reset = resetProfile("p1", "p1", now);
  assert.equal(profile(five, { controls: [reset] }).patterns[0].autonomy, "full-review");
  assert.throws(() => revokeAdaptationPattern("p1", "p2", "medication"));
  assert.equal(deriveAdaptationProfile("p1", five, now, { controls: [revokeAdaptationPattern("p1", "p1", "medication", now)] }).patterns[0].revoked, true);
  assert.equal(reduceAutonomy(profile(five), "medication", "p1", "physician-request").patterns[0].autonomy, "full-review");
});

test("rejects PHI-like identifiers and unsafe threshold overrides", () => {
  assert.equal(verifiedOutcomesFor([outcome(27, { patternKey: "patient-mrn-123" })], "p1").length, 0);
  assert.equal(profile([27, 28, 29, 30, 31].map((n) => outcome(n)), { minimumEvidence: 1 }).patterns[0].autonomy, "full-review");
  assert.throws(() => createControlRecord("reset", "p1", "p2"));
});
