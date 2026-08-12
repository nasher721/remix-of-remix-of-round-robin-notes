# Data-Integrity Validation Matrix — 2026-08-12

Plan reference: `2026-08-11-clinical-production-readiness-plan.md`, Phase 3.
Scope: prove zero silent overwrites, zero endless `syncing` states, and zero
falsely reported saves across browsers, devices, and failure conditions.

## Test account and seed data

- Use the dedicated non-PHI E2E account (see `.env.local` keys
  `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`; never commit credentials).
- Seed at least three patients with clearly fake names (current seed:
  `E2E Alpha`, `E2E Bravo`, `E2E Charlie`).
- Reset between runs: sign out, reload, confirm roster matches the seed.

## Automated coverage (this repository)

`e2e/data-integrity.e2e.spec.ts` — run with:

```bash
E2E_PORT=8173 npx playwright test e2e/data-integrity.e2e.spec.ts
```

(Any free port works; `E2E_PORT` exists because `localhost:8080` may be used
by other local services. Tests run in `serial` mode because they share one
account and roster.)

| Scenario | Coverage | Status 2026-08-12 |
| --- | --- | --- |
| 3. Multi-tab concurrency (same account, two tabs) | Automated — tab B's stale write must surface an explicit "Save conflict" and never overwrite tab A's persisted content | PASS (Chromium) |
| 5. Offline recovery (queue → reconnect → no duplication) | Automated — offline edit must show "Offline queued", drain on reconnect, and persist exactly once after reload | PASS (Chromium) |
| 9. Reload truth | Automated for the two scenarios above (post-reload content match + occurrence count) | PASS (Chromium) |

Unit-level coverage that backs the matrix:

- `src/lib/offline/indexedDBQueue.test.ts` — durable queue, owner isolation,
  coalescing, legacy-data discard.
- `src/lib/offline/syncEngine.test.ts` — replay, conflict detection, retries.
- `src/hooks/patients/__tests__/usePatientMutations.test.ts` — write
  serialization, rollback, stale-write rejection, revision tracking.

## Defects found by this matrix and fixed (2026-08-12)

All three were reachable in ordinary offline use and violated the
"no falsely reported saves / no silent loss" acceptance criteria:

1. **Offline writes were not queued once the API circuit breaker opened.**
   Background requests trip the breaker within seconds of going offline;
   patient writes then failed fast with `CircuitOpenError`, which
   `isRetryablePatientWriteError` classified as non-retryable, so the edit was
   rolled back and reported "Save failed" instead of entering the durable
   queue. Fix: `CircuitOpenError` (including the `ApiError`-wrapped cause) and
   any status-less failure while `navigator.onLine === false` are now
   retryable/queueable (`src/hooks/patients/usePatientMutations.ts`).
2. **Sync drain burned all retries against the open breaker in under a
   second.** On reconnect during the 30 s breaker cooldown, queued mutations
   exhausted `maxRetries` immediately and were condemned as `failed`.
   Fixes: all circuit breakers reset on the browser `online` event
   (`src/lib/circuitBreaker.ts`), and the sync engine defers a pass on
   `CircuitOpenError` instead of consuming retries
   (`src/lib/offline/syncEngine.ts`).
3. **Save-state indicator never left "Offline queued" after a successful
   drain.** `usePatientMutations` now reconciles `patientSaveStates` against
   the queue: a drained patient write becomes `Saved`, an exhausted one
   becomes `Save failed`, and the cached expected revision is dropped plus a
   forced refetch issued so the next edit cannot hit a spurious conflict.

## Manual matrix (evidence required before sign-off)

Record each cell as PASS/FAIL/N-A with a screenshot or screen recording.
Template per run: date, build SHA, browser/device + OS version, account,
observer, notes.

| # | Scenario | Chromium | WebKit/Safari | Real phone | Expected result |
| --- | --- | --- | --- | --- | --- |
| 1 | Todo isolation: expand/collapse every editor; type in Todo input | | | | Todo input keeps focus; clinical notes unchanged |
| 2 | Toolbar routing: customize toolbar, AI model selector, phrase library, formatting, overflow | | | | Each control performs only its intended action |
| 3 | Multi-tab concurrency (covered by automation on Chromium) | PASS (auto) | | | Second stale write → explicit conflict UI; no silent overwrite |
| 4 | Cross-device concurrency: edit same field on phone and workstation | | | | Same explicit-conflict behavior as scenario 3 |
| 5 | Offline recovery: queue edits offline, reload, reconnect, retry | PASS (auto, Chromium) | | | Queued edits persist exactly once; indicator goes queued → Saved |
| 6 | Failure injection: expired session, rejected write, storage unavailable, rate limit, timeout, 4xx/5xx | | | | Actionable retry/conflict/recovery path; no false "Saved" |
| 7 | Completion guard: Done / End Round with pending, failed, conflicting, or queued changes | | | | Completion blocks or clearly resolves every unresolved change |
| 8 | Recovery export: export failed/pending changes, re-import via documented process | | | | No silent data loss; identifiers intact |
| 9 | Reload truth: compare rendered content vs database rows after refresh on every tab/device | | | | Rendered content matches DB exactly |

### Scenario 6 notes (failure injection recipes)

- **Expired session:** sign in, then revoke the session from another device
  (or wait for token expiry with auto-refresh disabled); the next write must
  surface an auth error, not a false save.
- **Rate limit:** trigger the `parse-handoff` edge function repeatedly;
  expect HTTP 429 handling with a user-visible retry message.
- **Backend 5xx:** block/rewrite `*.supabase.co/rest/v1/*` to return 500 via
  DevTools request interception; writes must queue or fail loudly.
- **Storage unavailable:** run in a profile with IndexedDB disabled; the app
  must fall back to the in-memory queue and still report honestly.

### Scenario 7/8 pointers

- Completion guard lives in the round-completion flow (`Done` / `End Round`);
  exercise it with one patient in each state: pending, failed, conflicting,
  offline-queued.
- Recovery export: use the Offline indicator's pending-changes surface and
  the documented export path; verify identifiers and content on re-import.

## Acceptance criteria mapping (plan Phase 3)

- Zero silent overwrites / endless syncing / falsely reported saves —
  enforced by revision-predicate writes (server-side), conflict UI,
  queue-state reconciliation, and the automated scenarios above.
- Every failure state offers an actionable path — validated per scenario row.
- Automated Playwright coverage exists for stable scenarios; manual evidence
  covers WebKit, real-device, and injection conditions that automation cannot
  reproduce reliably.
