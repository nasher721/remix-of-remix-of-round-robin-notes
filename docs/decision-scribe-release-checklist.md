# Decision Scribe release checklist

This checklist is a release gate, not a claim of hosted readiness. All examples and automated fixtures use fictional `SYNTH-*` identifiers.

## Evidence and quality gates

- [ ] Synthetic corpus covers interruption/overlap, negation, medication change, competing recommendations, conditional plans, assignment, and patient transition (`src/lib/decision-scribe/fixtures/icuDecisionCorpus.ts`).
- [ ] Every candidate is reviewable with supporting span, patient/session/round binding, edit, reject, and explicit attestation.
- [ ] Release thresholds are fixed before the pilot: at least 20 reviewed sessions, approval >=95%, edit <=10%, reversal <=2%, contradiction <=2%, critical miss <=1%.
- [ ] Timing budget is measured: capture start, transcription, composition, review, attestation, and sync retry; no unbounded client wait.
- [ ] No live microphone or provider network is required for deterministic CI; provider and browser paths still need credentialed synthetic validation.

## Consent, policy, and safety

- [ ] Consent, rounds-audio disclosure, and institutional-policy acknowledgement are separate, explicit, revocable gates.
- [ ] Wrong-patient, patient switch, stale snapshot, expired session, cancellation, interruption, and crash recovery fail closed.
- [ ] Provisional, rejected, and unattested candidates cannot become durable chart content.
- [ ] Attestation binds physician, device, round, session, patient snapshot, and approved candidate IDs; retry is idempotent and conflicts remain explicit.
- [ ] Adaptation is evidence-gated, physician-owned, resettable, and defaults to full review on drift or sparse evidence.

## Privacy, security, and retention

- [ ] Raw audio and temporary transcript are memory-only, encrypted while buffered, and erased on stop, reject, expiry, cancellation, offline invalidation, crash recovery, and attestation.
- [ ] Rejected/unattested material is not stored in DOM, localStorage, IndexedDB, logs, telemetry, network outbox, or analytics payloads.
- [ ] Durable retention is limited to approved structured content and nonclinical audit metrics; retention duration and deletion job are documented and verified.
- [ ] Encryption implementation, key lifecycle, transport, provider boundary, access controls, and threat model are reviewed by security/institutional owners.
- [ ] No PHI is present in test fixtures, snapshots, screenshots, traces, or release logs.

## Rollout and hosted gates

- [ ] `off`, `shadow`, `full-review`, `adaptive-composition`, and `exception-first` transitions are explicit and auditable.
- [ ] Model version, context version, consent, encryption, retention, and institutional policy gates pass in the target environment.
- [ ] Pilot metrics meet the thresholds above; any model/context drift falls back to full review.
- [ ] Target Supabase migrations, edge functions, JWT/verification configuration, RLS, telemetry sink, and Vercel deployment are independently verified.
- [ ] CI is green for unit/integration, targeted Chromium/WebKit, edge verification, migration verification, lint, typecheck, build, and security checks.

## Known gaps / release hold

## Observed local verification (2026-09-05)

- [x] Focused Decision Scribe tests: 9 passed, 0 skipped (`node --import ./scripts/test-setup.mjs ...`).
- [x] TypeScript typecheck and targeted ESLint passed (`npm run typecheck`; `npx eslint ...`).
- [x] Edge verification: 39 passed, 0 failed (`npm run edge:verify`).
- [x] Edge JWT configuration passed (`npm run edge:check-jwt-config`).
- [x] Migration verification passed: 56 migrations (`npm run verify:migrations`).
- [x] Formatting/diff hygiene passed (`deno fmt --check supabase/functions`; `git diff --check`).
- [ ] Full test suite: 776 passed, 14 failed due Node IndexedDB persistence harness failures; release remains held.
- [x] Chromium/WebKit harness execution: Decision Scribe synthetic/privacy harness 4/4 passed in Chromium and 4/4 passed in WebKit (local deterministic run, 2026-09-04; test Supabase placeholders; no credentials or live provider network).
- [ ] Production build/bundle/security scans: required public Supabase/session configuration was unavailable; no hosted readiness claimed.

- [ ] Hosted Decision Scribe UI wiring and a credentialed end-to-end capture/review/attestation walk are not established by local deterministic tests alone.
- [ ] Provider transcript boundary, telemetry sink behavior, server-side idempotency, sync conflict persistence, adaptation control persistence, encryption/retention operations, and hosted CI/deployment gates require environment-specific evidence.
- [ ] Until every unchecked item above has evidence from the target deployment, rollout remains `off` or `full-review`; do not claim production readiness.
