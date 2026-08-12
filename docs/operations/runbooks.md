# Operations Runbooks — Round Robin Notes

Created 2026-08-12 for the clinical production-readiness program (plan Phase 7).
Owner during the release window: _name required before go-live_ (see
`docs/release/2026-08-12-signoff-packet.md`).

Systems: Vercel (frontend, `remix-of-remix-of-round-robin-notes.vercel.app`),
Supabase project `zsavxqvnseqxusfwdovu` (RollingRounds; Postgres, Auth,
Edge Functions, Realtime), AI providers reached only through the
`parse-handoff` / AI Edge Functions.

---

## 1. Sync incidents (failed / queued / conflicting writes)

**Signals**

- Client: save-state badge stuck on `Saving`, `Offline queued`, or
  `Save failed`; Offline indicator shows pending/failed counts; toast
  `Save conflict` / `Save failed` / `Synced N changes`.
- Logs: structured events `patient.update.failed`,
  `patient.field_history.failed`; `[SyncEngine]` / `[IndexedDBQueue]`
  console lines; Sentry (when `VITE_SENTRY_DSN` is set).

**Diagnosis**

1. Ask for device, browser, approximate time, patient count, and whether
   the app showed offline banners.
2. In Supabase logs (Edge/Postgres), look for elevated 4xx/5xx or
   `consume_edge_rate_limit` rejections in the same window.
3. Check the `patients.revision` trail via `patient_field_history` for the
   affected patient to reconstruct what actually persisted.

**Remediation**

- Single user, queued writes: have them reconnect and keep the tab open;
  the sync engine drains automatically on `online`. If the badge shows
  `N pending`, clicking it forces a sync.
- Conflict: use the conflict dialog (Keep My Changes / Use Server Version).
  Never ask the user to "just retype" before exporting pending changes
  (see Runbook: Recovery export in the QA matrix, scenario 8).
- Queue growth across many users → treat as backend incident; go to
  Runbook 3 or 4.

**Known behaviors (as of 2026-08-12)**

- While offline, edits are queued durably (IndexedDB) and replay with a
  revision guard; server-newer data produces an explicit conflict, never a
  silent overwrite.
- Circuit breakers reset automatically on reconnect; a sync pass defers
  instead of consuming retries while a breaker is open.

---

## 2. Stale-client conflicts

**Signal:** user sees `Save conflict — this patient changed in another tab
or device`.

**Expected causes:** same account in two tabs/devices editing the same
patient; a tab asleep long enough to miss realtime refetches.

**Remediation**

1. Tell the user **not** to keep editing in the stale tab.
2. The app refetches the patient after a conflict; review the refreshed
   chart, then re-apply the intended change.
3. If conflicts repeat for one account with only one active device, suspect
   a wedged background tab (check for duplicate browser windows) or a
   realtime subscription loop — escalate to engineering with the
   `patient_field_history` timeline.

---

## 3. AI provider outage (parse-handoff / generation)

**Signals:** import parsing or AI actions hang or return provider errors;
edge logs show provider 429/5xx; client timeout (~180 s) messages.

**Remediation**

1. Confirm provider status page; `parse-handoff` fails over between
   configured providers on 429s — check edge logs to see which provider
   failed.
2. If one provider is down, verify the failover key/env is set
   (Supabase Edge Function secrets) and redeploy the function if rotated.
3. User-facing guidance during outage: paste/type notes manually; imports
   can be retried later — no data is lost by waiting.
4. If both providers are degraded, announce via the support channel
   (Runbook 6) and log a clinical incident review entry if any note was
   delayed past a rounding session.

---

## 4. Database migration failure

**Prevention:** migrations deploy only via the `Deploy Supabase` GitHub
workflow, which refuses to run when the repo SHA differs from the deployed
frontend SHA ordering rules, and `scripts/verify-supabase-migration-order.mjs`
runs in CI.

**If a migration fails mid-deploy**

1. Do **not** re-run blindly. Capture the failing migration filename and
   the exact error from the workflow logs.
2. Inspect `supabase_migrations.schema_migrations`: if the version row was
   recorded, the failure happened after the DDL committed — assess whether
   the DDL is idempotent before replaying.
3. If the row was not recorded, the transaction rolled back; fix the
   migration in a new file (never edit an applied migration) and redeploy.
4. If production is in a mixed state, pause the frontend deploy hook and
   follow the manual repair precedent:
   `supabase/manual/2026-08-11-migration-history-repair.sql` documents how
   history was reconciled in the 2026-08-11 incident.

---

## 5. Vercel/Supabase version mismatch

**Signal:** frontend build references columns/behavior the database does
not have (e.g. `revision`), or vice versa. The 2026-08-11 release hold was
exactly this (see `docs/release/2026-08-11-release-hold-phase0.md`).

**Rule:** frontend deploys only via the Vercel deploy hook
(`vercel.json` disables git-triggered deploys for `main`), and only after
the Supabase deploy workflow succeeds for the same SHA.

**If a mismatch reaches production anyway**

1. Immediately redeploy the last known-good frontend from the Vercel
   dashboard (instant rollback).
2. Verify with the bundle-content check: the deployed `index-*.js` must
   contain `revision` references when the DB has the column.
3. Record the incident and re-run Phase 0 of the release checklist before
   the next attempt.

---

## 6. Support escalation, clinical incident review, breach response

- **Support path:** user reports → #support channel / on-call owner →
  engineering. Every data-integrity report gets a `patient_field_history`
  reconstruction before closing.
- **Clinical incident review:** any wrong-patient context, lost note, or
  misleading saved/completed state is logged as a clinical incident with
  timeline, affected patients (by internal id only), and corrective action.
- **Breach response:** on suspected PHI exposure (logs, telemetry,
  screenshots, wrong recipient): stop the source, revoke/rotate affected
  credentials (Supabase keys, provider keys), preserve evidence, notify the
  privacy officer, and follow the organization breach-notification policy.
- **User communication:** template — acknowledge, state scope honestly,
  state what persisted vs what must be re-entered, give the recovery-export
  path, follow up in writing.

---

## 7. Backup / restore (RPO / RTO)

- Supabase managed backups: daily logical backups (plan-dependent) plus
  point-in-time recovery if enabled on the project tier.
- **RPO target:** 24 h with daily backups; ≤ 5 min if PITR is enabled.
- **RTO target:** 4 h for full project restore; 1 h for single-table
  surgical restore from a SQL dump.
- **Drill (human task, schedule quarterly):** restore the latest backup
  into a throwaway Supabase project, verify `patients` row counts and one
  day's `patient_field_history`, document timings. Record drill evidence in
  this file's drill log below. _No restore drill has been performed yet —
  required before general availability._

Drill log: (date / operator / backup point / RTO measured / result)

---

## 8. Monitoring and alerting — current state and gaps

**In place today**

- Sentry browser SDK, lazily loaded, active when `VITE_SENTRY_DSN` is set;
  CSP allows only the approved Sentry ingest origin.
- Structured client logger (`src/lib/observability/logger.ts`) with stable
  event names (`patient.update.failed`, etc.).
- Supabase logs for Postgres, Auth, and Edge Functions; edge rate-limit
  table `edge_rate_limits` / `consume_edge_rate_limit`.
- CI bundle assertions: `scripts/check-bundle-size.mjs`,
  `scripts/assert-no-optional-native-in-bundle.mjs`.

**Open gaps (must close or formally accept before GA)**

- No alerting on sustained `patient.update.failed` volume, queue age, or
  queue growth. Recommended: a Sentry alert rule on
  `message:"patient.update.failed"` (rate > N/5 min) and a scheduled
  Supabase SQL check on queue-age proxies.
- No synthetic canary for the save path. Recommended: a scheduled Playwright
  run of `e2e/data-integrity.e2e.spec.ts` against production with the E2E
  account, alerting on failure (doubles as the "tested with synthetic
  failures" acceptance item).
- No uptime monitor on the healthcheck Edge Function. Recommended: any
  external pinger hitting `/functions/v1/healthcheck` expecting
  `{"status":"healthy"}`.

---

## 9. Staged rollout plan

| Stage | Audience | Entry criteria | Stop conditions | Decision-maker |
| --- | --- | --- | --- | --- |
| 0. Internal | Developers + E2E account | CI green at release SHA; Phase 2 backend verified | Any P0 defect | Engineering lead |
| 1. Limited pilot | 1 team, ≤ 5 clinicians, non-critical census | Stages 0 pass; monitoring gaps accepted in writing | Any lost/overwritten note; any wrong-patient event; sustained save failures > 30 min | Clinical safety owner |
| 2. Monitored expansion | One full ICU team | 2 pilot weeks with zero open P0/P1 | Same as pilot + unresolved a11y serious findings | Clinical safety owner + ops |
| 3. General availability | All intended units | Stage 2 exit + restore drill complete + sign-off packet complete | — | Go/no-go board |

**Rollback criteria (any stage):** silent data loss, wrong-patient data
exposure, RLS bypass, or sustained write failure → immediate frontend
rollback (Vercel instant rollback) + freeze deploy hook + incident review.

**On-call for release window:** _name + contact required before go-live._
