---
title: Implement Adaptive Decision Scribe
type: feature
status: in-progress
depends_on: []
spec: .specs/plans/adaptive-decision-scribe.design.md
---

# Implement Adaptive Decision Scribe

## Intent

Implement the validated design for Today's Round: an explicit, patient-scoped assistant that listens only to rounds audio while bound to the current in-app patient, extracts decisions into provisional review, and writes only physician-approved structured content through existing patient, todo, round-state, offline, sync, conflict, and undo pathways.

## Boundary and non-goals

The boundary is rounds audio plus a read-only snapshot of the current in-app patient record. Do not access a live EHR, other patients, silent longitudinal history, background microphone capture, autonomous orders, or a general transcript archive. Ordinary discussion, raw audio, temporary transcripts, rejected proposals, and unattested generated content must never become durable clinical data. Every proposed change requires a supporting spoken span. Reuse existing dependencies and persistence; no new runtime dependency without design review.

## Acceptance Criteria

1. Explicit start/stop binds capture to active round, patient, physician, and device; switch, interruption, timeout, end-round, and terminal paths invalidate safely.
2. Audio uses an encrypted ephemeral session and is never written to browser storage, database, durable logs, offline outbox, or telemetry.
3. Temporary attributed segments expire on discard, attestation, timeout, crash recovery, or invalidation.
4. Structured results include session/patient binding, speaker, statement type, destination, proposed content, task metadata, confidence, and supporting span.
5. Extraction preserves proposed versus affirmed status, polarity, start/stop, continue/discontinue, add/modify/remove/assign, conditionality, contradictions, and unresolved questions.
6. Stop opens compact exception-first review grouped by problem/system; rows support edit, reject, evidence expansion, and undo; no scrolling transcript appears during capture.
7. One explicit physician attestation is the sole durable clinical write boundary and uses existing mutations, todos, round state, offline queue, sync acknowledgement, conflicts, undo, and completion safety.
8. Connectivity loss, extraction failure, unsupported content, ambiguous speech, concurrent edits, crash-before-attestation, and unresolved writes never silently write.
9. A physician-scoped adaptation profile learns approval/edit/reversal signals, explains graduation, regresses on drift, permits revoke/reduce/reset, and never bypasses attestation.
10. Shadow, full-review, adaptive-composition, and exception-first rollout modes are explicit evidence-gated modes with consent, disclosure, institutional policy, encryption/retention, pilot, and model-version gates.

## Implementation Process

### Step 1: Contracts, policy boundary, and synthetic ICU corpus [DONE]
Depends on: none.
Expected Output:
- src/types/decisionScribe.ts — branded identifiers and capture, segment, candidate, draft, attestation, adaptation, lifecycle, and failure types.
- src/lib/decision-scribe/decisionScribePolicy.ts — pure binding, span, expiry, retention, and durable-write checks.
- src/lib/decision-scribe/fixtures/icuDecisionCorpus.ts — synthetic/de-identified hazards: overlap, interruption, abbreviations, negation, medication changes, competing recommendations, conditionals, deferred decisions.
- src/lib/decision-scribe/__tests__/contracts.test.ts and policy.test.ts.
Success Criteria: Types represent provisional versus approved data and provenance; policy rejects wrong-patient, missing-span, expired, rejected, and unattested writes; corpus has no real identifiers.
#### Verification
Level: Panel of 2 Judges. Critical: true. Threshold: 4.5/5.0.
Rubric:
- Boundary fidelity — weight 0.30 — Only rounds audio plus current in-app patient; excludes live EHR, longitudinal inference, and background capture.
- Contract completeness — weight 0.30 — Covers lifecycle, provenance, polarity, destination, task metadata, confidence, attestation, and adaptation.
- Safety policy — weight 0.25 — Prevents wrong-patient, unsupported, expired, rejected, or unattested durable writes.
- Corpus/test quality — weight 0.15 — Synthetic/de-identified hazards have deterministic assertions.

### Step 2: Explicit capture controller and ephemeral lifecycle [DONE]
Depends on: Step 1. Parallel with: Steps 3 and 4 after Step 1 passes.
Expected Output:
- src/lib/decision-scribe/captureController.ts — explicit start/pause/stop, patient lock, interruption/timeout, bounded encrypted in-memory reconnect buffer, terminal cleanup.
- src/components/decision-scribe/CaptureControl.tsx and CaptureStatus.tsx.
- captureController.test.ts and CaptureControl.test.tsx.
Success Criteria: No continuation after switch or terminal state; no audio persistence; reconnect fallback discards safely; controls are keyboard and screen-reader usable.
#### Verification
Level: Panel of 2 Judges. Critical: true. Threshold: 4.5/5.0.
Rubric:
- Session safety — weight 0.30 — Correct binding, explicit controls, lock, interruption, timeout, and invalidation.
- Privacy lifecycle — weight 0.30 — Bounded encrypted in-memory handling and erasure on every terminal path.
- UI contract — weight 0.20 — Visible status without silent recording or scrolling transcript.
- Test coverage — weight 0.20 — Covers transitions, lock, timeout, discard, crash, and offline behavior.

### Step 3: Temporary attributed transcript processor [DONE]
Depends on: Step 1. Parallel with: Steps 2 and 4 after Step 1 passes.
Expected Output:
- src/lib/decision-scribe/transcriptProcessor.ts — provider adapter, temporary attribution, expiry, cancellation, and retry.
- supabase/functions/transcribe-decision-audio/index.ts — authenticated, owner/session-bound, size/rate-limited ephemeral endpoint with no persistence.
- Edge and transcriptProcessor tests.
Success Criteria: Only temporary attributed segments with spans return; unsupported, unauthorized, cancelled, and failed requests leave no durable material.
#### Verification
Level: Panel of 2 Judges. Critical: true. Threshold: 4.5/5.0.
Rubric:
- Ephemeral processing — weight 0.30 — No audio/transcript persistence, logging, or post-session return.
- Validation/security — weight 0.25 — Auth, ownership, limits, cancellation, rate limiting, and provider errors match edge patterns.
- Attribution fidelity — weight 0.25 — Segments preserve speaker, span/timestamps, uncertainty, and binding.
- Verification depth — weight 0.20 — Tests prove expiry, failure, unsupported payload, privacy, and isolation.

### Step 4: Decision extraction and contradiction-aware composition [DONE]
Depends on: Steps 1 and 3. Parallel with: Step 2. Review integration waits for this step.
Expected Output:
- src/lib/decision-scribe/decisionEngine.ts — read-only current-patient snapshot comparison and strict extraction.
- src/lib/decision-scribe/draftComposer.ts — merge compatible statements, preserve disagreement, detect changes, group by problem/system, exception-first ordering.
- supabase/functions/compose-decision-draft/index.ts — authenticated schema-validating boundary with no durable write.
- decisionEngine, draftComposer, and edge tests.
Success Criteria: Every candidate has a span and current binding; ordinary/unsupported speech is omitted; polarity, conditionality, contradictions, unresolved questions, and proposed/affirmed status survive; no silent longitudinal inference.
#### Verification
Level: Panel of 2 Judges. Critical: true. Threshold: 4.5/5.0.
Rubric:
- Decision fidelity — weight 0.35 — Captures affirmed decisions, tasks, ownership, timing, contingencies, and unresolved questions.
- Polarity/contradiction safety — weight 0.25 — Preserves add/modify/remove/assign, start/stop/continue/discontinue, conflict, and conditional meaning.
- Provenance/isolation — weight 0.20 — Uses only temporary spans and current snapshot; rejects unsupported/cross-patient content.
- Composition quality — weight 0.20 — Deterministic validation, grouping, merging, confidence, and exception ordering.

### Step 5: Exception-first review UI and Patient Focus integration [DONE]
Depends on: Steps 2 and 4.
Expected Output:
- src/components/decision-scribe/DecisionReview.tsx, DecisionDraftRow.tsx, and DecisionEvidence.tsx.
- Updates to src/components/round/PatientFocus.tsx and RoundChrome.tsx preserving Focus-first navigation and no transcript during capture.
- Component tests and src/components/round/__tests__/decisionScribeReview.test.tsx.
Success Criteria: Stop opens compact grouped review; rows expose destination/change type, confidence/contradiction, edit/reject/evidence/undo; accessible, touch-safe, dark-theme readable, and patient lock is preserved.
#### Verification
Level: Panel of 2 Judges. Critical: true. Threshold: 4.5/5.0.
Rubric:
- Review workflow — weight 0.30 — Stop/review, compact summary, grouping, edit/reject/undo/evidence work.
- Clinical safety UX — weight 0.30 — Provisional state, contradiction, confidence, destination, and lock are unmistakable.
- Focus-first integration — weight 0.20 — Preserves Today's Round and excludes transcript/secondary tools from capture chrome.
- Accessibility/responsiveness — weight 0.20 — Keyboard, screen reader, touch, mobile layout, focus, and contrast are covered.

### Step 6: Attestation-only durable boundary and failure recovery [DONE]
Depends on: Steps 1, 4, and 5. Parallel with: Step 7 after interfaces stabilize.
Expected Output:
- src/lib/decision-scribe/attestationController.ts — one explicit attestation, approved-only filtering, idempotency, undo metadata, existing pathway delegation.
- src/lib/decision-scribe/decisionScribeOutbox.ts — approved-only offline lifecycle, never raw audio/transcript.
- AttestationControl.tsx, ConflictReview.tsx, and focused tests.
Success Criteria: Rejected/unattested/raw material is absent; approved changes use existing mutations/conflicts; offline acknowledgement/retry is visible; unresolved conflicts block End Round; repeat attestation is idempotent.
#### Verification
Level: Panel of 2 Judges. Critical: true. Threshold: 4.5/5.0.
Rubric:
- Durable-write boundary — weight 0.35 — Only one explicit attestation commits approved structured content through existing pathways.
- Failure/conflict safety — weight 0.25 — Offline, retry, concurrent edit, unresolved conflict, crash, and idempotency are safe and visible.
- Data minimization — weight 0.20 — Raw, temporary, rejected, and unattested content is deleted and never queued.
- Integration tests — weight 0.20 — Prove patient/todo/round/outbox/sync, acknowledgement, undo, conflict, and End-Round blocking.

### Step 7: Physician adaptation profile and progressive autonomy [DONE]
Depends on: Steps 1 and 6. Parallel with: Step 8 after profile interfaces stabilize.
Expected Output:
- src/lib/decision-scribe/adaptationProfile.ts — physician-scoped evidence, approval/edit/reversal/recency/context/model-version metrics, graduation/regression/revocation/reset, autonomy modes.
- adaptationProfile.test.ts.
- Either src/lib/decision-scribe/profileStorageDecision.md, or reversible supabase/migrations/<timestamp>_create_decision_scribe_profile.sql with RLS/retention/rollback notes.
Success Criteria: Graduation is per-pattern and evidence-gated; drift/stale/contradictory/reversed patterns return to full review; rationale, reduce, revoke, reset work; attestation remains mandatory.
#### Verification
Level: Panel of 2 Judges. Critical: true. Threshold: 4.5/5.0.
Rubric:
- Evidence gating — weight 0.30 — Uses approval/edit/reversal/recency/context/contradiction/model-version evidence, not elapsed encounters.
- Regression controls — weight 0.25 — Drift, stale patterns, reversals, changed context, and calibration issues restore full review.
- Physician control — weight 0.25 — Rationale, autonomy reduction, revoke, and reset are physician-scoped.
- Storage/privacy — weight 0.20 — Only permitted nonclinical signals with ownership/RLS/retention; avoids needless schema work.

### Step 8: Consent, rollout gates, and telemetry minimization [DONE]
Depends on: Steps 2–7. Parallel with: Step 9 after contracts stabilize.
Expected Output:
- src/components/decision-scribe/ConsentDisclosure.tsx — consent, recording disclosure, policy acknowledgement, disable path.
- src/lib/decision-scribe/rolloutPolicy.ts — shadow, full-review, adaptive-composition, exception-first and drift gates.
- src/lib/decision-scribe/telemetry.ts — nonclinical lifecycle/error metrics only.
- rolloutPolicy.test.ts, telemetry.test.ts, and Privacy.tsx update if required.
Success Criteria: Capture requires disclosure/policy; rollout is explicit/auditable; encryption/retention/pilot thresholds gate release; telemetry excludes audio, transcript, candidate text, and patient identifiers.
#### Verification
Level: Single Judge. Critical: false. Threshold: 4.0/5.0.
Rubric:
- Policy gates — weight 0.35 — Consent, disclosure, institutional policy, encryption/retention, and pilot thresholds block unsafe rollout.
- Rollout correctness — weight 0.30 — Four modes and model/context drift fallback are explicit and evidence-gated.
- Telemetry minimization — weight 0.20 — Payloads exclude prohibited data and have redaction tests.
- User clarity — weight 0.15 — Consent and mode status are accessible, understandable, and reversible.

### Step 9: End-to-end, privacy, and release verification [DONE]
Depends on: Steps 1–8.
Expected Output:
- e2e/decision-scribe.e2e.spec.ts — capture, review, edit/reject/attest, next patient, offline queue, reconnect, conflict, and no-transcript UI.
- e2e/decision-scribe-privacy.e2e.spec.ts — terminal proof of absent audio/transcripts/rejected/unattested content from storage, payloads, logs, and stores.
- src/lib/decision-scribe/__tests__/decisionScribe.integration.test.ts.
- docs/decision-scribe-release-checklist.md — corpus size, pilot thresholds, under-30-second timing evidence, consent/policy/encryption/retention signoff, rollout gates, hosted gaps.
Success Criteria: Tests cover every criterion and corpus hazard; wrong-patient contamination is blocked; timing is measured; typecheck, lint, focused tests, build, and available E2E pass or gaps are recorded.
#### Verification
Level: Panel of 2 Judges. Critical: true. Threshold: 4.5/5.0.
Rubric:
- Scenario coverage — weight 0.30 — Exercises capture, extraction, review, attestation, offline/sync/conflict, adaptation, and rollout.
- Privacy proof — weight 0.30 — Proves terminal absence of raw/temporary/rejected/unattested content and wrong-patient isolation.
- Release evidence — weight 0.20 — Documents corpus, thresholds, timing, consent/policy/encryption/retention gates, and hosted gaps.
- Stability — weight 0.20 — Focused tests, lint, typecheck/build, and available E2E are reproducible without debug leftovers.

## Definition of Done (Task Level)

- [X] All nine steps complete and every verification gate passes.
- [X] Acceptance criteria 1–10 map to implementation and test evidence; hosted gaps are documented.
- [X] Capture is explicit, patient-scoped, interruption-safe, terminal-clean, and never background.
- [X] Raw audio and temporary transcripts never enter storage, database, durable logs, outbox, or telemetry.
- [X] Candidates require supporting spans and current patient/session binding; ordinary discussion and silent longitudinal inference are excluded.
- [X] Review is exception-first, editable, reversible, accessible, and transcript-free during capture.
- [X] Only one explicit attestation writes approved content through existing pathways; rejected/unattested content is removed.
- [X] Offline, extraction failure, unsupported/ambiguous speech, concurrent edits, crash, retry, undo, and unresolved conflict behavior is tested; End Round safety remains intact.
- [X] Adaptation is physician-scoped, evidence-gated, inspectable, revocable, resettable, provisional until attestation; drift regresses autonomy.
- [X] Consent, disclosure, policy, encryption, retention, rollout gates, pilot thresholds, and model-version policy are documented and enforced.
- [X] npm run typecheck, npm run lint, npm test, npm run build, and available decision-scribe E2E pass; gaps are recorded.
- [X] No unapproved dependency, secret, real patient data, raw recording, or debug artifact is committed.
- [X] Existing Patient Focus, navigation, patient/todo mutations, offline outbox, conflict resolution, End Round safety, and print/export remain regression-tested.
