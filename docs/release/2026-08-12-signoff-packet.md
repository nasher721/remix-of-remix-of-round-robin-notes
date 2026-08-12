# Release Sign-off Packet — 2026-08-12

Plan: `docs/plans/2026-08-11-clinical-production-readiness-plan.md`
Status: **NO-GO for clinical production** until the human gates in section 4
close. All engineering-controlled items are complete and evidenced below.

## 1. Exact deployed artifacts

| Item | Value |
| --- | --- |
| Repo SHA (CI green) | `4761978` — fix(ci): restore green release pipeline and gate Vercel auto-deploy |
| CI run | `31553909471` (green) |
| Supabase deploy workflow | run `31554068909` **failed** — GitHub secret `SUPABASE_ACCESS_TOKEN` is empty; re-run after secrets are set (`SUPABASE_ACCESS_TOKEN`, `VERCEL_DEPLOY_HOOK_URL`) |
| Frontend production deploy | **Not yet shipped** — held intentionally until the deploy hook secret exists; live bundle predates the revision work |
| Supabase project | `zsavxqvnseqxusfwdovu` (RollingRounds) |
| Latest migration versions in prod | through `20260811133644_create_round_state` (includes `20260811000000_add_patient_optimistic_revision`, `20260811014046_add_distributed_edge_rate_limits`); history repaired per `supabase/manual/2026-08-11-migration-history-repair.sql` |

Follow-up engineering commit (this packet's work: offline-queue/conflict
fixes, bundle budgets, e2e, docs) lands after `4761978`; see git log for the
exact SHA once pushed. The deploy workflow must be re-run at that SHA.

## 2. Evidence index

- **Phase 0 release-hold assessment:** `docs/release/2026-08-11-release-hold-phase0.md`
  (proved the live frontend predated `revision`; prevented a split-brain deploy)
- **Backend verification (Phase 2):** same document — `patients.revision`
  column + `bump_patient_revision` trigger present; stale-revision write
  matched 0 rows; matching write bumped revision exactly once; RLS enabled on
  all 17 clinical tables; healthcheck returns `{"status":"healthy"}`.
- **Data-integrity matrix (Phase 3):** `docs/qa/2026-08-12-data-integrity-matrix.md`
  — automated multi-tab-conflict and offline-queue-recovery scenarios pass;
  manual matrix defined for WebKit/real-device/failure-injection evidence.
  Includes the three offline/conflict defects found and fixed on 2026-08-12.
- **Accessibility/responsive (Phase 4):** `MobilePatientDetail` hook-dependency
  fix; Fast Refresh exception documented in `eslint.config.js`
  (expires 2026-10-01). Device/screen-reader passes remain human gates.
- **Security/dependency (Phase 5.3):** risk acceptance
  `docs/security/2026-08-11-optional-dependency-risk-acceptance.md`
  (expires 2026-11-12); SBOM `docs/security/sbom-2026-08-12.cyclonedx.json`;
  bundle reachability assertion wired into CI
  (`scripts/assert-no-optional-native-in-bundle.mjs`).
- **Bundle budgets (Phase 6):** entry 2,098,050 bytes (was 2,283,487);
  per-chunk budgets in `scripts/check-bundle-size.mjs`; zero ineffective
  dynamic-import warnings. Residual: 15%-headroom criterion not yet met
  (entry at ~95% of the 2.2 MB budget) — tracked as post-release work to
  lazy-split analytics/print subgraphs.
- **Operations (Phase 7):** `docs/operations/runbooks.md` — sync incidents,
  stale-client conflicts, provider outage, migration failure,
  Vercel/Supabase mismatch, escalation/breach paths, RPO/RTO, monitoring
  gaps, staged rollout with stop conditions.
- **Deployment procedure:** `docs/deployment.md` (verify:local pre-push
  checklist).

## 3. Final release gate status (from plan)

| Gate | Status |
| --- | --- |
| CI/deployment workflows green at exact production SHA | PARTIAL — CI green at `4761978`; deploy workflow blocked on empty GitHub secrets |
| Backend migration deployed; revision/RLS proven | DONE (2026-08-11, evidence above) |
| Live multi-tab/cross-device/offline/failure/recovery scenarios pass | PARTIAL — Chromium e2e automated and passing; cross-device/WebKit manual cells open |
| Accessibility/responsive validation on representative devices | OPEN (human) |
| Runtime audits clean; optional findings removed or time-bounded | DONE — clinical-mcp-server `npm audit` 0 vulns; risk acceptance time-bounded |
| PHI/provider, telemetry, access-control, legal evidence | OPEN (human) — see section 4 |
| Monitoring/backup/rollback/support runbooks tested | PARTIAL — runbooks written; restore drill and alert tests undone |
| Clinical UAT and hazard review signed off | OPEN (human) |

## 4. Open human gates (required before GO)

1. **GitHub secrets** — add `SUPABASE_ACCESS_TOKEN` and
   `VERCEL_DEPLOY_HOOK_URL`, then re-run deploy run `31554068909`
   (or dispatch the workflow at the new SHA) and ship the frontend.
2. **BAA/DPA and PHI/provider approvals** — evidence items in
   `docs/clinical-data-flow.md` (allowlist, retention, key custody,
   redaction tests, clinician review, legacy credential rotation).
3. **Clinical UAT + hazard review** — scenario-based UAT with ICU
   attendings/residents/fellows; written sign-off from engineering, QA,
   security/privacy, operations, clinical safety owner.
4. **Accessibility passes** — keyboard-only, VoiceOver/Safari + one more
   screen reader, touch targets at 320–900 px, 200% text zoom, reduced
   motion, high contrast, dark theme.
5. **Manual data-integrity cells** — WebKit/Safari, real phone,
   failure-injection, completion-guard, recovery-export rows in
   `docs/qa/2026-08-12-data-integrity-matrix.md`.
6. **Restore drill + alert tests** — quarterly restore drill (first one
   before GA) and synthetic-failure alert validation; monitoring gaps in
   `docs/operations/runbooks.md` §8 closed or formally accepted.
7. **On-call owner + decision-makers** — named in runbooks §9.
8. **E2E credentials in CI** — `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` as
   GitHub secrets if the data-integrity spec should run in CI.

## 5. Security advisor findings (need owner decision — not executed)

From the Supabase security advisors on 2026-08-11/12:

- `pg_graphql` extension exposes tables to `anon`/`authenticated`; the app
  does not use GraphQL. **Proposed:** `DROP EXTENSION pg_graphql` after
  confirming nothing depends on it.
- `rls_auto_enable()` is `SECURITY DEFINER` and executable by `anon`.
  **Proposed:** `REVOKE EXECUTE FROM anon, authenticated`.
- Auth **leaked-password protection is disabled** (HaveIBeenPwned check).
  **Proposed:** enable in Supabase Auth settings.
- Several RLS policies lack `TO authenticated` (hygiene; default is PUBLIC
  role scoping). **Proposed:** tighten in a follow-up migration.
- `disable_signup` could not be verified/enforced because the deploy
  workflow failed before that step; confirm restricted enrollment in the
  Supabase Auth dashboard.

Any one of these changes can affect production behavior — they are listed
for explicit owner approval, not applied.

## 6. Sign-off

| Role | Name | Date | Signature |
| --- | --- | --- | --- |
| Engineering | | | |
| QA | | | |
| Security/Privacy | | | |
| Operations | | | |
| Clinical safety owner | | | |
