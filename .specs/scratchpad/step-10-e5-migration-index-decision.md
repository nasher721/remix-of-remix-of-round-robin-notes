# Step 10 E5 Migration and Index Decision

Task: `improve-patient-roster-speed-and-backend.feature.md` Step 10, Group E5.
Date: 2026-05-27.

## Decision

Avoid a Supabase migration for this step.

## Evidence

- Active dashboard patient fetch path is `src/hooks/patients/usePatientFetch.ts`: `patients.select("*").order("patient_number", ascending)`.
- Active dashboard bulk todo path is `src/hooks/useAllPatientTodos.ts`: `patient_todos.select("*").in("patient_id", patientIds).order("created_at", descending)`.
- Selected-patient todo path in `src/hooks/usePatientTodos.ts` skips its per-patient fetch when `initialTodos` is provided from the dashboard todo map.
- Existing migration `supabase/migrations/20250315120000_optimize_postgres_indexes_rls.sql` already adds `idx_patient_todos_patient_id` and `idx_patient_todos_user_id`, and optimizes `patients` and `patient_todos` RLS policies to use `(SELECT auth.uid())`.
- Existing migration `supabase/migrations/20240101000000_add_rxdb_replication_fields.sql` adds `idx_patients_user_modified` for replication sync; no dashboard-specific `(user_id, patient_number)` index currently exists.
- Local request-count regression run passed: dashboard selection does not refetch the full patient list, patient cache reuse prevents a second full patient fetch, selected-patient changes do not reload the full todo map, selected todos hydrate from the bulk map without a duplicate per-patient fetch, mutation cache updates remain scoped, and import avoids full reload between rows.

## Rationale

The remaining potential patient-list index candidate, a composite index on `(user_id, patient_number)`, is plausible because RLS limits rows by `user_id` and the dashboard orders by `patient_number`. It is not justified in this step without `EXPLAIN`/slow-query evidence or a measured request/query bottleneck after the cache cleanup. The measured local evidence shows redundant reads were removed at the hook/cache layer, so adding schema churn would broaden rollback burden without proof.

The todo dashboard path is sufficiently covered for current evidence by the existing `patient_todos(patient_id)` index. A future composite `(patient_id, created_at DESC)` index should require a query plan or production slow-query sample showing the sort is material for real roster sizes.

## Verification

- `rg` inspected patient/todo query paths across `src/hooks`, `src/services`, `src/contexts`, `src/lib`, and `supabase/functions`.
- `rg` inspected migration/index definitions under `supabase/migrations`.
- `find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort` confirmed the local migration inventory.
- `supabase --version` succeeded with CLI `2.75.0`.
- `supabase migration list` was attempted and failed with `Cannot find project ref. Have you run supabase link?`, so linked remote migration state and remote query plans remain credential/project-link gated.
- `npm test -- --run src/hooks/__tests__/dashboardRequestInstrumentation.test.tsx src/hooks/__tests__/usePatientTodosCacheUpdates.test.tsx src/hooks/patients/__tests__/usePatientMutations.test.ts src/hooks/patients/__tests__/usePatientImport.test.ts` exited `0`; because of the existing script shape it ran the configured Node test suite and reported `101` passing tests.

## Rollback

No migration was added, so there is no schema rollback for Step 10. If a future measured index is added, include an explicit `DROP INDEX CONCURRENTLY IF EXISTS ...` rollback note in that migration or its paired decision record.
