---
title: Improve patient roster visibility, remove input microanimations, and optimize app/backend speed
type: feature
depends_on: []
---

# Improve Patient Roster Visibility, Remove Input Microanimations, and Optimize Speed

## Intent

Make the authenticated Rolling Rounds workspace faster and easier to use during real clinical rounding. A clinician who adds or imports a patient list should immediately see multiple patients in the roster, move between them without visual distraction, and experience responsive dashboard interactions without unnecessary frontend churn or duplicate backend reads.

This is a focused usability and performance pass. It preserves the existing clinical workflow, patient data model, auth flow, print/export flow, mobile navigation, and current dependency set.

## User Request

- Improve the ability to see the patient list within the application.
- When adding a list of patients, more than one patient should be visible.
- Remove annoying microanimations when clicking in textboxes.
- Optimize the app for speed.
- Improve the backend.

## Current Evidence

- The authenticated dashboard is centered on `src/pages/Index.tsx`, `src/components/dashboard/DesktopDashboard.tsx`, `src/components/dashboard/VirtualizedPatientList.tsx`, and `src/components/dashboard/MobileDashboard.tsx`.
- The existing completed UI refinement task already established that the roster/editor/tasks workbench must stay clinically calm, dependency-free, and compatible with desktop and mobile dashboard behavior.
- Phase 2b scratchpad analysis identified likely contributors: constrained roster container sizing, list-item animation, shared `Input`/`Textarea` transition behavior, patient/todo context fan-out, and patient/todo fetch/cache churn.

## User Scenarios

1. A clinician imports a census of 12 ICU patients before rounds and needs to see several roster entries at once without fighting a one-card viewport.
2. A clinician clicks through patients while documenting interval events and expects text fields to focus instantly without scale, glow, shake, or border animation.
3. A clinician searches, filters, sorts, and selects patients during rounds and expects the selected patient editor and task rail to update without visible lag.
4. A clinician uses the mobile patient tab at bedside and expects the list to remain scannable with search/filter/sort/add controls reachable.
5. A clinician edits todos and patient fields repeatedly and expects the app to avoid redundant backend reloads that make the dashboard feel stale or slow.

## In Scope

- Desktop roster visibility in the authenticated dashboard workbench.
- Mobile patient-list visibility where the same roster constraint appears.
- Shared `Input` and `Textarea` focus/click animation behavior.
- Existing patient list rendering, selection, search, filter, sort, todo, and dashboard shell responsiveness.
- Backend-facing patient and todo fetch/cache/invalidation paths used by the authenticated dashboard.
- Regression coverage for roster visibility, input focus behavior, interaction responsiveness, and duplicate-request prevention.

## Out Of Scope

- New UI, animation, virtualization, backend, database, or performance-monitoring dependencies.
- Auth redesign, landing-page redesign, production deployment, or hosted infrastructure changes.
- Broad clinical data model redesign.
- New import formats, new AI features, new sync features, or new analytics.
- Replacing the completed post-login visual hierarchy work from the prior task.

## Constraints

- Do not add runtime dependencies.
- Keep existing desktop and mobile workflows reachable.
- Preserve reduced-motion behavior and accessibility-required focus indication.
- Do not remove patient create, import, update, duplicate, remove, search, filter, sort, print/export, todos, or mobile detail behavior.
- Keep static route imports in `App.tsx` intact.
- Do not use empty-string Radix `SelectItem` values.
- Backend changes must be narrow: reduce redundant reads, improve query/cache shape, or add indexes only when evidence shows the dashboard path needs it.
- Any backend or database migration must be reversible and covered by local verification or clearly documented if environment access is missing.

## Architecture Overview

### Solution Strategy

Treat this as a focused dashboard architecture cleanup, not a redesign. Preserve the existing authenticated workspace shell and improve three connected paths: roster layout capacity, static accessible form focus states, and patient/todo cache behavior. The primary implementation should keep the current desktop sidebar/detail/tasks model, make the roster region consume predictable available height, retain the mobile `react-window` list, and align patient/todo reads around existing React Query cache keys instead of introducing another data layer.

### Key Decisions and Tradeoffs

1. Keep `src/components/dashboard/VirtualizedPatientList.tsx` as the desktop roster/detail contract and fix visibility through layout constraints, compact row density, and scroll-area height rather than adding a new virtualization dependency. This avoids dynamic-height virtualization risk for rich patient cards.
2. Keep `src/components/mobile/VirtualizedMobilePatientList.tsx` on the existing `react-window` path and only adjust height, compact mode, and reachability issues found in the mobile patient tab. This preserves fast mobile scrolling without changing the mobile detail workflow.
3. Remove distracting text-control motion centrally in `src/components/ui/input.tsx` and `src/components/ui/textarea.tsx`. Replace broad `transition-all`, focus shadow/glow, and invalid shake behavior with static border/ring focus treatment that remains keyboard-visible and reduced-motion safe.
4. Preserve `src/hooks/usePatients.ts` as a direct re-export and keep `src/hooks/patients/index.ts` as the canonical patient API boundary. Patient fetch/mutation/import changes should stay inside the focused patient sub-hooks and keep their published return shapes stable.
5. Use the existing TanStack Query cache for backend-facing patient/todo state. Prefer immutable `queryClient.setQueryData` updates after successful mutations, stable `QUERY_KEYS`, and scoped invalidation over full-list refetches after every selected-patient or todo action.
6. Keep `useAllPatientTodos(patientIds)` as the dashboard bulk-todo source or convert it to React Query using existing `QUERY_KEYS.allTodos` / `QUERY_KEYS.patientTodos`; either way, selected-patient todo hydration must continue to use `initialTodos` to avoid duplicate per-patient fetches.
7. Avoid schema changes unless request-count or query evidence proves they are needed. Existing patient and todo query shapes should be optimized first; any Supabase index or migration must be reversible and verified or explicitly documented as environment-gated.

### Expected Files to Modify

- `src/components/dashboard/DesktopDashboard.tsx` — dashboard body sizing, search/filter control stability, reduced-motion gates, and roster container handoff.
- `src/components/dashboard/VirtualizedPatientList.tsx` — desktop roster sidebar/topbar visibility, active-row accessibility, row density, selected-patient rendering, and shared selected-todo wiring.
- `src/components/dashboard/MobileDashboard.tsx` — mobile patient-tab reachability for search/filter/sort/add/import controls and list/detail transitions.
- `src/components/mobile/VirtualizedMobilePatientList.tsx` — mobile list height calculation, compact row behavior, overflow prevention, and scroll affordances.
- `src/components/mobile/MobilePatientDetail.tsx` — selected-patient todo hydration continuity through `initialTodos`.
- `src/components/PatientCard.tsx` — shared todo contract and render-boundary stability for the selected patient.
- `src/components/ui/input.tsx` and `src/components/ui/textarea.tsx` — static accessible focus styles and removal of nonessential motion.
- `src/hooks/usePatientTodos.ts` — selected-patient todo cache/hydration contract, mutation updates, and duplicate-fetch prevention.
- `src/hooks/useAllPatientTodos.ts` — dashboard todo-map batching, stable patient ID keying, and cache alignment.
- `src/hooks/usePatients.ts`, `src/hooks/patients/index.ts`, `src/hooks/patients/usePatientFetch.ts`, `src/hooks/patients/usePatientMutations.ts`, `src/hooks/patients/usePatientImport.ts` — patient API preservation, narrow fetch/mutation/import cache updates, and import batching where safe.
- `src/lib/cache/cacheConfig.ts`, `src/lib/cache/queryClientConfig.ts`, `src/lib/cache/cacheInvalidation.ts`, `src/lib/cache/cacheWarming.ts`, `src/hooks/useCacheWarming.ts`, and `src/hooks/useCacheMonitor.ts` — existing cache policy, invalidation scope, warming behavior, and performance visibility.
- `e2e/*` and focused component/unit tests — roster visibility, input focus behavior, reduced-motion behavior, duplicate-request prevention, and existing workflow regression coverage.
- `supabase/migrations/*` — only if measured evidence shows a missing reversible index or query-path improvement is required.

### Backend and Cache Approach

The patient list remains one ordered `patients` query backed by `QUERY_KEYS.patients` and the existing `usePatientFetch` contract. Mutations should update cached patient arrays immutably and invalidate only the affected patient/list data needed for correctness. Multi-patient import should avoid per-row full reloads; if conflict handling allows, insert a batch with precomputed patient numbers and apply one cache update. If the current conflict-retry behavior must remain sequential, still avoid full dashboard refetches between rows.

Todo data should load once for the current dashboard census through `useAllPatientTodos(patientIds)` and feed `DashboardTodosContext`. The selected desktop and mobile detail paths should hydrate from that map through `initialTodos` or shared todo APIs, then update both selected-todo state and dashboard todo-map cache after add/toggle/delete/generate operations. Invalidation should target `QUERY_KEYS.patientTodos(patientId)`, `QUERY_KEYS.allTodos`, or the affected dashboard todo map instead of forcing unrelated patient reloads.

No dashboard CRUD should be routed through `clinical-mcp-server`; it remains a separate MCP surface. Supabase schema work is a last step, not the first optimization path.

### Accessibility and Reduced Motion

Roster rows must remain button-based, keyboard reachable, and expose the active patient through `aria-current` or an equivalent accessible state. Focus indicators on inputs and textareas must stay visible without animated scale, glow, shake, or layout-shifting effects. Existing reduced-motion gates in dashboard/list animation paths should be preserved and extended where nonessential motion remains, including anime/framer list-entry effects and mobile scroll affordances.

### Risk Mitigations

- Lock the current workflows with focused tests before edits: create/import/update/duplicate/remove/search/filter/sort/print-export/todos/mobile detail.
- Add request-count or mocked-fetch coverage before cache changes so duplicate patient-list and todo-map reloads are observable.
- Keep patient hook public contracts stable, especially `usePatients`, `usePatientFetch`, `usePatientMutations`, `usePatientImport`, `usePatientTodos`, and `useAllPatientTodos`.
- Profile or instrument render/request behavior around `DesktopDashboard`, `VirtualizedPatientList`, `PatientCard`, and mobile roster before adding memoization; use `React.memo`, `useMemo`, `useCallback`, or `useDeferredValue` only where prop stability and measured jank justify it.
- Preserve last usable local state on refresh errors and reuse existing toast/offline/error paths instead of blanking the roster.
- Document any credential-gated Supabase inspection or migration verification that cannot be completed locally.

## Acceptance Criteria

1. Given a desktop user has at least 8 patients, when the authenticated dashboard loads at a 1440x900 viewport, at least 4 roster rows are visible without scrolling inside a one-card-height roster viewport.
2. Given a desktop user imports or adds a multi-patient list, when the roster updates, at least 4 patients remain visible and the selected-patient editor does not obscure the rest of the roster.
3. Given the desktop roster is in sidebar mode, when the user selects different patients, the active row is visually obvious, keyboard reachable, and exposed with `aria-current` or equivalent accessible state.
4. Given the desktop roster is in topbar mode, when multiple patients exist, the user can scan and select patients without horizontal layout breakage or hidden primary controls at common desktop widths.
5. Given a mobile user views the patient tab at 375px width, search, filter/sort, add patient, and patient selection remain reachable with no horizontal overflow.
6. Given a user clicks, tabs into, or focuses any shared `Input` or `Textarea`, the control does not run nonessential scale, shake, glow, shadow pulse, animated border, or layout-shifting focus effects.
7. Given a focused input or textarea, there is still a clear accessibility-compliant focus indicator.
8. Given reduced motion is enabled, roster, dashboard, and form-field changes do not run nonessential motion.
9. Given a realistic rounding census of 20 patients and existing todo data, patient search, filter, sort, selection, and todo-panel open/close interactions complete without perceptible UI stalls during manual smoke testing.
10. Given patients and todos are already loaded, selecting a different patient does not trigger duplicate full patient-list fetches or unnecessary full todo-map reloads.
11. Given todos or patient fields are mutated, cache invalidation refreshes only the affected dashboard data needed to show current state.
12. Given network/backend access fails during patient or todo refresh, the dashboard keeps the last usable local state where available and shows an existing error/offline path instead of blanking the roster.
13. Given existing patient create, import, update, duplicate, remove, search, filter, sort, print/export, todo, and mobile detail workflows are exercised, they continue to work after the changes.
14. Given the test suite and configured static checks are run, roster visibility, input focus behavior, and duplicate-request prevention are covered by focused regression tests or documented manual verification where automated coverage is impractical.

## Non-Functional Targets

- Avoid roster layout shifts during patient selection and filtering.
- Avoid full-dashboard rerenders caused only by todo-map updates when narrower state updates are practical.
- Prefer memoization, existing context boundaries, and query/cache cleanup over new abstractions.
- Keep the implementation small enough to review as a focused dashboard performance/usability change.

## Verification Expectations

- Run unit/component tests covering changed patient, todo, input, and dashboard behavior.
- Run lint, typecheck/build, and available non-credential e2e smoke checks.
- Manually inspect desktop roster visibility, desktop input focus, mobile patient tab, reduced-motion behavior, and backend request patterns in dev tools or test instrumentation.
- Document any credential-gated, hosted, or migration verification that could not be run locally.

## Phase 5 Parallel Implementation Plan

### Phase Inputs and Judge Notes

- Research link: `.specs/scratchpad/phase-2a-patient-roster-performance-research.md`
- Analysis link: `.specs/analysis/analysis-improve-patient-roster-speed-and-backend.md`
- Architecture link: `.specs/scratchpad/phase-3-architecture-synthesis-improve-patient-roster-speed-and-backend.md`
- Phase 4 decomposition link: `.specs/scratchpad/phase-4-decomposition-improve-patient-roster-speed-and-backend.md`
- Phase 5 scratchpad link: `.specs/scratchpad/phase-5-parallelization-improve-patient-roster-speed-and-backend.md`
- Judge constraint: verify `src/hooks/usePatients.ts` remains the direct re-export boundary unless implementation evidence proves a change is truly required. Expected unchanged shape is `export { usePatients } from "./patients"` plus existing type re-exports.
- Judge constraint: backend/cache priority is limited to active authenticated dashboard paths: active patient fetch/selection, todo map and selected-patient todo hydration, import, and patient/todo mutations. Do not route dashboard CRUD through `clinical-mcp-server`.
- Judge constraint: schema/index work is evidence-gated and reversible; optimize existing query/cache behavior before proposing migrations.
- Judge 4 expansion: backend/cache work must be split into patient fetch/cache, todo hydration, mutation invalidation, import behavior, and migration/index check lanes.

### Execution Directive

Use a baseline-first, fan-out, merge-gated execution model.

1. No source edits start until Group A establishes baseline status, contract inventory, and regression fixtures.
2. Groups B, C, D, E1, and E2 may run in parallel after Group A because they touch separable concerns, but workers must coordinate before editing shared dashboard, todo, cache, or test files.
3. Backend/cache sublanes E1 and E2 may run in parallel after Group A. E3 mutation invalidation waits for E1 and E2 conclusions. E4 import behavior waits for E1 and the import-path inventory from Group A.
4. E5 migration/index work is evidence-gated and must not create a migration unless measured query/request evidence proves existing cache/query cleanup is insufficient.
5. Group F is the only final merge gate. It owns integrated verification, changed-file scope review, Definition of Done signoff, and documented gaps.

### Summary Table

| Group | Steps | Primary agent | Support/review agents | Parallel-with | Depends on | Output |
| --- | ---: | --- | --- | --- | --- | --- |
| A. Baseline and Test Scaffolding | 1-2 | `test-engineer` | `explore`, `performance benchmarker` | none | none | Known baseline, contract inventory, executable regression harness |
| B. Desktop Roster UX | 3 | `executor` | `designer`, `accessibility auditor` | C, D, E1, E2 | A | Desktop roster visibility implementation |
| C. Mobile Roster UX | 4 | `executor` | `accessibility auditor` | B, D, E1, E2 | A | Mobile roster visibility implementation |
| D. Textbox Motion Removal | 5 | `executor` | `accessibility auditor`, `style-reviewer` | B, C, E1, E2 | A | Static accessible input/textarea focus behavior |
| E1. Patient Fetch/Cache | 6 | `backend architect` | `executor` | B, C, D, E2 | A | Patient selection/fetch dedupe and cache reuse |
| E2. Todo Hydration | 7 | `backend architect` | `executor` | B, C, D, E1 | A | Bulk todo map and selected-todo hydration dedupe |
| E3. Mutation Invalidation | 8 | `backend architect` | `executor`, `security-reviewer` | E4, UI review | E1, E2 | Scoped mutation cache updates and invalidation |
| E4. Import Behavior | 9 | `backend architect` | `executor` | E3, UI review | E1, Group A import inventory | Multi-patient import without repeated full reloads |
| E5. Migration/Index Check | 10 | `backend architect` | `performance benchmarker`, `security-reviewer` | UI review only | E1-E4 evidence | Migration decision record or reversible index change |
| F. Integrated Verification | 11 | `verifier` | `code-reviewer`, `performance benchmarker` | none | B, C, D, E1-E5 | Final evidence, gaps, and DoD signoff |

Maximum safe parallelization depth: 5 concurrent implementation lanes after Group A (`B`, `C`, `D`, `E1`, `E2`).

### Dependency and Parallelization Diagram

```text
Group A
  Step 1 Baseline Checks and Contract Inventory
  Step 2 Regression Harness and Fixtures
        |
        v
  +-----+----------------+----------------+----------------+----------------+
  |                      |                |                |                |
  v                      v                v                v                v
Group B              Group C          Group D          Group E1         Group E2
Step 3 Desktop       Step 4 Mobile    Step 5 Inputs    Step 6 Patient   Step 7 Todo
Roster UX            Roster UX        Motion           Fetch/Cache      Hydration
  |                      |                |                |                |
  +----------+-----------+----------------+----------------+--------+-------+
             \                                           /          |
              v                                         v           v
            Group E3 Step 8 Mutation Invalidation   Group E4 Step 9 Import Behavior
                         |                                  |
                         +----------------+-----------------+
                                          v
                         Group E5 Step 10 Evidence-Gated Migration/Index Check
                                          |
                                          v
                         Group F Step 11 Integrated Verification
```

### Step 1: Group A - Baseline Checks and Contract Inventory [DONE]

Agent assignment: `test-engineer` primary, `explore` support.

Depends on: none.

Parallel-with: none.

Success criteria:
- Current `npm test`, `npm run lint`, and `npm run build` status is recorded with pre-existing failures separated from task failures.
- Active test surfaces are mapped for roster visibility, input focus behavior, todo request behavior, mobile detail, import, and mutation paths.
- `src/hooks/usePatients.ts` is confirmed as the direct re-export boundary at baseline.
- Shared implementation contracts are listed before parallel workers start.

Subtasks:
1. [X] Run baseline checks and record exact commands, results, and pre-existing failures.
2. [X] Map dashboard, roster, input, todo, import, mutation, cache, and e2e test surfaces.
3. [X] Inspect `src/hooks/usePatients.ts`, `src/hooks/patients/*`, `useAllPatientTodos`, `usePatientTodos`, and cache utilities for public contracts that parallel lanes must preserve.
4. [X] Identify shared files that require edit sequencing between UI, backend/cache, and tests.

Blockers:
- Local auth, Supabase credentials, or seeded dashboard fixtures may be unavailable for some e2e checks.
- Existing test failures may obscure task regressions unless captured before edits.

Risks:
- High: starting layout/cache edits without request-count or workflow coverage can hide duplicate fetch regressions.
- Medium: incomplete contract inventory can create shared-file conflicts between parallel workers.

### Step 2: Group A - Regression Harness and Fixtures [DONE]

Agent assignment: `test-engineer` primary, `performance benchmarker` support.

Depends on: Step 1.

Parallel-with: none.

Success criteria:
- Deterministic 8-patient and 20-patient fixtures or mocks exist for dashboard tests.
- Desktop `1440x900` and mobile `375px` checks can assert roster visibility and control reachability.
- Tests or instrumentation can detect duplicate full patient-list fetches and unnecessary full todo-map reloads.
- Input/textarea focus tests or static assertions can detect removed motion utilities while preserving visible focus.

Subtasks:
1. [X] Add or update fixtures for create/import/update/duplicate/remove/search/filter/sort/todo/mobile detail paths where coverage is missing.
2. [X] Add desktop roster visibility checks for at least four visible rows after load, add, import, and selection.
3. [X] Add mobile reachability checks for search, filter/sort, add/import, selection, detail, and no horizontal overflow.
4. [X] Add request-count or mocked-fetch instrumentation for patient-list and todo-map duplicate reload detection.
5. [X] Add static or component assertions for input/textarea motion removal and visible focus preservation.

Blockers:
- If authenticated dashboard setup is too slow or credential-gated, use component-level tests plus one documented manual smoke path.

Risks:
- High: visibility tests that inspect implementation classes instead of user-visible rows can pass while the roster remains clinically unusable.
- Medium: import-flow setup may need mocking if backend credentials are absent.

### Step 3: Group B - Desktop Roster Visibility [DONE]

Agent assignment: `executor` primary, `designer` support, `accessibility auditor` review.

Depends on: Steps 1-2.

Parallel-with: Steps 4, 5, 6, 7.

Success criteria:
- At least four desktop roster rows are visible at common desktop heights after load, add, import, and selection.
- `DesktopDashboard` and `VirtualizedPatientList` have stable height/scroll ownership with no double-scroll confusion.
- Active row remains keyboard reachable and exposes active state with `aria-current` or equivalent.
- Nonessential list-entry motion is removed or reduced-motion gated without hiding clinically useful row cues.

Subtasks:
1. [X] Adjust `DesktopDashboard` body sizing and scroll ownership so roster/detail/tasks get stable vertical space.
2. [X] Adjust `VirtualizedPatientList` sidebar/topbar containers for compact, bounded rows and reliable internal scrolling.
3. [X] Preserve desktop list modes, active selection, todo badges, print/export access, and task rail reachability.
4. [X] Remove or gate nonessential roster/list entry motion that contributes to layout shift.

Blockers:
- Existing nested `ScrollArea` ownership may require dashboard-shell changes before roster changes.

Risks:
- High: parent height changes can create double scrollbars or hide print/export/task controls.
- Medium: reducing row height can truncate clinically relevant name/bed/task cues.

### Step 4: Group C - Mobile Roster Visibility [DONE]

Agent assignment: `executor` primary, `accessibility auditor` support.

Depends on: Steps 1-2.

Parallel-with: Steps 3, 5, 6, 7.

Success criteria:
- `VirtualizedMobilePatientList` remains on the existing `react-window` path.
- Mobile patient tab at `375px` keeps search, filter/sort, add/import, selection, and detail navigation reachable with no horizontal overflow.
- Row height and list height remain aligned so rows are not clipped or unreachable.
- Mobile detail continues to receive `initialTodos` and avoids eager duplicate selected-patient todo reads.

Subtasks:
1. [X] Adjust mobile list height and compact row constraints only where visibility tests fail.
2. [X] Preserve search/filter/sort/add/import controls and current mobile navigation flow.
3. [X] Verify `MobilePatientDetail` still receives selected-patient todo hydration through `initialTodos`.
4. [X] Check mobile transitions and empty/loading states for reduced-motion compatibility and overflow safety.

Blockers:
- Mobile route state may need a fixture wrapper around `MobileDashboard` if full app e2e setup is unavailable.

Risks:
- High: changing mobile row sizing without `react-window` height alignment can cause clipped or unreachable rows.
- Medium: moving controls for visibility can break bedside workflow familiarity.

### Step 5: Group D - Textbox Motion Removal [DONE]

Agent assignment: `executor` primary, `accessibility auditor` support, `style-reviewer` review.

Depends on: Steps 1-2.

Parallel-with: Steps 3, 4, 6, 7.

Success criteria:
- `src/components/ui/input.tsx` and `src/components/ui/textarea.tsx` no longer apply nonessential scale, shake, glow, shadow pulse, animated border, or layout-shifting focus behavior.
- Visible `focus-visible` and invalid/error indicators remain accessible.
- Changes are scoped to textbox focus/click behavior and do not remove unrelated component affordances.
- Tests or static assertions prove the removed motion utilities stay out of shared textbox controls.

Subtasks:
1. [X] Replace `transition-all`, focus glow/shadow, and invalid shake on `Input` with static border/ring focus styles.
2. [X] Replace `transition-all` and invalid shake on `Textarea` with static border/ring focus styles.
3. [X] Preserve invalid state color and visible `focus-visible` treatment.
4. [X] Update targeted snapshots/assertions without broad styling churn.

Blockers:
- Some animation classes may be inherited from generic button/card/dialog components; keep this step scoped to textbox focus behavior.

Risks:
- High: removing motion too broadly can degrade accessible focus indication or unrelated component affordances.
- Medium: exact class snapshots may need targeted updates.

### Step 6: Group E1 - Patient Fetch and Cache Path [DONE]

Agent assignment: `backend architect` primary, `executor` support.

Depends on: Steps 1-2.

Parallel-with: Steps 3, 4, 5, 7.

Success criteria:
- `src/hooks/usePatients.ts` remains unchanged unless a concrete blocker is documented.
- Patient fetch/cache changes stay inside `src/hooks/patients/*` and existing cache utilities.
- Already-loaded patient data is reused across selection and dashboard interactions.
- Patient selection does not trigger duplicate full patient-list fetches.

Subtasks:
1. [X] Preserve the `usePatients` re-export and current patient hook return shapes.
2. [X] Audit `usePatientFetch`, patient query keys, cache warming, and dashboard selection for redundant full-list reads.
3. [X] Apply narrow patient cache reuse or dedupe changes only where tests/instrumentation show duplicate fetches.
4. [X] Coordinate with Step 8 before changing invalidation semantics.

Blockers:
- Query-cache behavior may be coupled to existing offline/cache warming utilities.

Risks:
- High: query-key changes can orphan existing cache-warming or offline mutation behavior.
- Medium: over-localized cache fixes can pass selection tests but miss import/mutation refresh paths.

### Step 7: Group E2 - Todo Hydration and Bulk Todo Map [DONE]

Agent assignment: `backend architect` primary, `executor` support.

Depends on: Steps 1-2.

Parallel-with: Steps 3, 4, 5, 6.

Success criteria:
- `useAllPatientTodos(patientIds)` has stable keying/request dedupe or TanStack Query alignment while preserving `{ todosMap, loading, refetch }`.
- Desktop `PatientCard` and mobile `MobilePatientDetail` preserve `usePatientTodos(patientId, { initialTodos })` short-circuit hydration.
- Selected-patient changes do not trigger unnecessary full todo-map reloads.
- Dashboard todo map and selected-patient todo state remain consistent after selection changes.

Subtasks:
1. [X] Map current bulk todo map loading and selected-patient todo hydration paths.
2. [X] Add stable patient ID keying, request dedupe, or TanStack Query alignment without changing the published return shape.
3. [X] Preserve selected-detail hydration from the dashboard todo map for desktop and mobile.
4. [X] Add assertions that selected-patient changes do not cause duplicate per-patient fetches when `initialTodos` exists.

Blockers:
- Existing custom bulk Supabase hook behavior may not map one-to-one to TanStack Query without preserving return shape explicitly.

Risks:
- High: breaking `usePatientTodos` initial hydration can reintroduce duplicate selected-patient todo fetches and flicker.
- Medium: todo map refetch changes can desynchronize badges and selected-card todos.

### Step 8: Group E3 - Mutation Invalidation and Cache Updates [DONE]

Agent assignment: `backend architect` primary, `executor` support, `security-reviewer` review for data consistency.

Depends on: Steps 6-7.

Parallel-with: Step 9; may continue while Steps 3-5 are finishing.

Success criteria:
- Patient and todo mutations update cached data immutably where safe.
- Invalidations target only affected patient/list/todo keys needed for correctness.
- Existing offline/error/toast paths are preserved.
- Mutations do not blank the roster when refresh fails and last usable local state exists.

Subtasks:
1. [X] Update patient mutations with scoped cache writes/invalidation that preserve list correctness.
2. [X] Update todo add/toggle/delete/generate behavior so selected-todo state and dashboard todo map stay consistent.
3. [X] Avoid broad dashboard refetches unless correctness evidence requires them.
4. [X] Preserve existing error, offline, retry, and toast semantics.

Blockers:
- Mutation order and optimistic updates may require a smaller first pass if current tests expose race conditions.

Risks:
- High: broad invalidation can erase perceived-speed gains.
- High: overly optimistic updates can show stale clinical state after failed mutations.

### Step 9: Group E4 - Import Behavior and Conflict Preservation [DONE]

Agent assignment: `backend architect` primary, `executor` support.

Depends on: Step 6 and import-path findings from Step 1.

Parallel-with: Step 8; may continue while Steps 3-5 are finishing.

Success criteria:
- Multi-patient import avoids full dashboard refetch between rows where safe.
- Batch import is used only if patient-number conflict behavior and existing validation/toast semantics are preserved.
- If conflict semantics require sequential import, the implementation still prevents unnecessary between-row full reloads.
- Import tests cover visibility after multi-patient add/import and preserve duplicate/conflict behavior.

Subtasks:
1. [X] Map current import validation, patient-number assignment, conflict retry, and toast behavior.
2. [X] Use batch insert only if it preserves existing conflict semantics.
3. [X] If sequential import remains required, consolidate cache updates and avoid full-list refetch between rows.
4. [X] Verify imported rosters immediately meet desktop/mobile visibility requirements.

Blockers:
- Patient-number conflict semantics may prevent safe bulk import in the first implementation pass.

Risks:
- High: altering import conflict behavior can create duplicate patient numbers or partial-import surprises.
- Medium: import speed improvements can conflict with user-visible validation ordering.

### Step 10: Group E5 - Evidence-Gated Migration and Index Check [DONE]

Agent assignment: `backend architect` primary, `performance benchmarker` support, `security-reviewer` review.

Depends on: Steps 6-9.

Parallel-with: none inside backend group; can run while UI groups are under review.

Success criteria:
- Existing Supabase migrations/indexes are inspected for active patient/todo query coverage.
- No migration is added unless measured request/query evidence proves cache/query cleanup is insufficient.
- Any migration is reversible, narrow, locally verified where credentials allow, and documented with rollback steps.
- Credential-gated migration verification gaps are explicitly documented instead of treated as complete.

Subtasks:
1. [X] Inspect existing migrations/index definitions for patient and todo active dashboard query paths.
2. [X] Compare request/query evidence after cache/query cleanup against non-functional targets.
3. [X] Add no migration if current indexes are sufficient or environment evidence is unavailable.
4. [X] If evidence proves an index is required, add one reversible migration with rollback notes and local verification where possible.

Blockers:
- Supabase inspection or migration verification may be credential-gated.

Risks:
- High: adding schema work without measured evidence broadens scope and creates rollback burden.
- Medium: credential-gated checks can leave migration claims under-verified.

### Step 11: Group F - Integrated Verification and Review [DONE]

Agent assignment: `verifier` primary, `code-reviewer` support, `performance benchmarker` support.

Depends on: Steps 3-10.

Parallel-with: none.

Success criteria:
- `npm test`, `npm run lint`, `npm run build`, and relevant e2e scopes are rerun with results recorded.
- Manual or automated evidence covers desktop roster visibility, mobile roster visibility, static input focus, reduced motion, request-count behavior, and unchanged workflows.
- Changed-file review confirms source scope is limited and `src/hooks/usePatients.ts` remains unchanged unless the documented blocker path was used.
- Remaining risks, credential-gated gaps, and any schema rollback notes are documented.

Subtasks:
1. [X] Re-run all relevant automated checks and separate pre-existing failures from new failures.
2. [X] Manually inspect desktop roster, mobile patient tab, input focus, reduced-motion behavior, and patient/todo request patterns.
3. [X] Review changed files for unrelated churn, dependency additions, empty-string Radix `SelectItem` values, and static route import regressions.
4. [X] Produce final evidence notes covering Definition of Done, credential-gated gaps, and migration rollback status.

Blockers:
- Hosted auth, Supabase, or e2e browser state may block full end-to-end verification.

Risks:
- High: declaring backend improvement complete without request-count evidence can miss the main performance regression.
- Medium: manual-only visual verification may miss a viewport-specific roster collapse.

### Definition of Done

- [X] All acceptance criteria in the task file remain covered or explicitly mapped to verification evidence.
- [X] Baseline failures are separated from new failures.
- [X] Desktop users with at least 8 patients can see at least four roster rows at `1440x900` after load, add, and import.
- [X] Mobile users at `375px` can reach search, filter/sort, add/import, selection, and detail without horizontal overflow.
- [X] Shared `Input` and `Textarea` controls have static accessible focus behavior with no nonessential motion utilities.
- [X] Patient selection avoids duplicate full patient-list fetches and unnecessary full todo-map reloads.
- [X] Mutations and import update or invalidate only affected patient/todo data needed for correctness.
- [X] Supabase migration/index changes are either avoided or backed by evidence, reversibility, and documented verification.
- [X] Existing create, import, update, duplicate, remove, search, filter, sort, print/export, todo, and mobile detail workflows still pass.

### Traceability Table

| Requirement / Judge Note | Covered by steps | Verification |
| --- | --- | --- |
| Show multiple patients after add/import | 2, 3, 4, 9, 11 | Desktop/mobile visibility tests and manual viewport smoke |
| Remove textbox microanimations | 2, 5, 11 | Input/textarea class assertions plus focus smoke |
| Optimize speed without new dependencies | 2, 3, 4, 6, 7, 8, 11 | Request-count instrumentation, build/test pass, dependency review |
| Improve backend active dashboard paths only | 6, 7, 8, 9, 10 | Cache/request tests and scoped invalidation review |
| Preserve `usePatients.ts` re-export boundary | 1, 6, 11 | Baseline + final changed-file review |
| Split backend/cache work into patient fetch/cache, todo hydration, mutation invalidation, import behavior, and migration/index check | 6, 7, 8, 9, 10 | Separate backend sublane acceptance evidence |
| Todo hydration must avoid duplicate fetches | 2, 7, 8, 11 | Todo map/request-count tests |
| Import behavior must preserve conflict semantics | 1, 9, 11 | Import tests and conflict-path review |
| Migration/index work is evidence-gated | 10, 11 | Migration decision record and rollback notes |
| Accessibility and reduced motion remain intact | 3, 4, 5, 11 | Accessibility review and reduced-motion smoke |

### Agent Distribution Summary

- `test-engineer`: Steps 1-2.
- `explore`: Step 1 support.
- `performance benchmarker`: Steps 2, 10, 11.
- `executor`: Steps 3-9.
- `designer`: Step 3.
- `accessibility auditor`: Steps 3-5.
- `style-reviewer`: Step 5.
- `backend architect`: Steps 6-10.
- `security-reviewer`: Steps 8 and 10.
- `verifier`: Step 11.
- `code-reviewer`: Step 11.

## Phase 6 LLM-as-Judge Verification Rubrics

### Phase Inputs and Judge 5 Notes

- Phase 6 scratchpad link: `.specs/scratchpad/phase-6-verification-rubrics-improve-patient-roster-speed-and-backend.md`
- Judge 5 requirement: every implementation step must have an explicit LLM-as-Judge verification gate with verification level, custom rubric, threshold, and dependency on concrete evidence.
- Judge 5 requirement: panel and per-item gates MUST name the required sub-agent perspectives; workers cannot mark the gate complete without those perspectives or an explicit documented unavailability note.
- Judge 5 requirement: final integration MUST cover roster visibility, input focus/no microanimation, frontend responsiveness, duplicate request/cache behavior, import/backend active path, accessibility/reduced-motion, and cross-workflow regression evidence.
- Judge 5 requirement: dependency order must be clear. Step-level judging happens after the step's implementation evidence exists; Step 11 per-item judging happens only after Steps 1-10 have recorded pass/fail/gap results.

### Judge Execution Rules

1. Each judge gate evaluates evidence, not intent. Acceptable evidence includes test output, static check output, Playwright/component-test assertions, request-count logs, changed-file review notes, screenshots when visual proof is needed, and documented credential-gated gaps.
2. A `Panel` gate MUST include all named sub-agent perspectives in the rubric. If a required perspective is unavailable, the primary agent must record the missing perspective, why it was unavailable, and which evidence partially substitutes for it.
3. A `Single` gate may be evaluated by one role-appropriate sub-agent, but it still requires concrete evidence and a written pass/fail/gap conclusion.
4. A `Per-Item` gate evaluates each listed item independently. One failing item fails the gate unless it is explicitly marked out-of-scope or credential-gated with a follow-up owner.
5. No judge gate can pass on manual inspection alone when an automated test or request-count assertion is practical for the same claim.
6. Any `None` level must be justified. This task intentionally assigns no `None` gates.

### Verification Summary Table

| Step | Area | Verification level | Required sub-agent judge perspectives | Evaluation count | Threshold |
| --- | --- | --- | --- | ---: | --- |
| 1 | Baseline and contract inventory | Single | `test-engineer` | 1 | Pass if baseline commands, pre-existing failures, direct `usePatients.ts` boundary, and shared-file contracts are documented. |
| 2 | Regression harness and fixtures | Panel | `test-engineer`, `performance benchmarker`, `accessibility auditor` | 3 | Pass if deterministic fixtures and assertions cover visibility, reachability, focus motion, and duplicate-request detection. |
| 3 | Desktop roster visibility | Panel | `designer`, `accessibility auditor`, `verifier` | 3 | Pass if desktop roster evidence proves at least four rows visible and active selection remains accessible without layout regressions. |
| 4 | Mobile roster visibility | Panel | `accessibility auditor`, `verifier`, `test-engineer` | 3 | Pass if mobile evidence proves controls and patient rows are reachable at `375px` with no overflow or todo-hydration regression. |
| 5 | Textbox motion removal | Panel | `accessibility auditor`, `style-reviewer`, `test-engineer` | 3 | Pass if shared text controls have no nonessential focus/click motion and still expose visible accessible focus. |
| 6 | Patient fetch/cache path | Single | `backend architect` | 1 | Pass if patient selection reuses loaded data and does not trigger duplicate full patient-list fetches while preserving hook contracts. |
| 7 | Todo hydration and bulk map | Single | `backend architect` | 1 | Pass if bulk todo map and selected-patient hydration avoid duplicate reloads while preserving published return shapes. |
| 8 | Mutation invalidation/cache updates | Panel | `backend architect`, `security-reviewer`, `verifier` | 3 | Pass if mutation cache updates are scoped, consistent, failure-safe, and do not blank last usable roster state. |
| 9 | Import behavior/backend active path | Panel | `backend architect`, `test-engineer`, `verifier` | 3 | Pass if import avoids unnecessary full reloads while preserving validation, conflict, toast, and visibility behavior. |
| 10 | Migration/index check | Single | `performance benchmarker` | 1 | Pass if schema work is avoided or backed by measured evidence, reversibility, rollback notes, and credential-gated gap documentation. |
| 11 | Final integration | Per-Item | `verifier`, `code-reviewer`, `performance benchmarker` | 14 | Pass if every acceptance criterion has pass/fail/gap evidence and no critical gap remains unresolved. |

Verification breakdown by step: `Panel` 6, `Single` 4, `Per-Item` 1, `None` 0.

Total evaluations defined: 36.

### Step 1 Judge Gate: Baseline and Contract Inventory

Verification level: Single.

Required sub-agent judge perspective: `test-engineer`.

Custom rubric:
- Confirms `npm test`, `npm run lint`, and `npm run build` baseline results are recorded with pre-existing failures separated from task failures.
- Confirms active test surfaces are mapped for roster visibility, input focus behavior, todo request behavior, mobile detail, import, and mutation paths.
- Confirms `src/hooks/usePatients.ts` is the direct re-export boundary at baseline and records its expected unchanged shape.
- Confirms shared files and contracts that require sequencing are listed before parallel implementation starts.

Threshold: pass only if all four rubric bullets have concrete evidence. Any missing baseline command result or missing `usePatients.ts` contract inventory fails the gate.

Dependencies: runs after Step 1 evidence exists and before Step 2 starts.

### Step 2 Judge Gate: Regression Harness and Fixtures

Verification level: Panel.

Required sub-agent judge perspectives: `test-engineer` MUST judge behavioral coverage, `performance benchmarker` MUST judge request-count/responsiveness observability, and `accessibility auditor` MUST judge focus/reduced-motion/viewport assertion adequacy.

Custom rubric:
- Verifies deterministic 8-patient and 20-patient fixtures or mocks exist and are usable by the chosen test surface.
- Verifies desktop `1440x900` and mobile `375px` checks assert user-visible roster rows and reachable controls instead of implementation-only class names.
- Verifies request-count or mocked-fetch instrumentation can detect duplicate full patient-list fetches and unnecessary full todo-map reloads.
- Verifies input/textarea tests or static assertions can catch scale, shake, glow, shadow pulse, animated border, and layout-shifting focus effects while preserving visible focus.

Threshold: panel passes only if every perspective marks pass and at least one executable check exists for each of visibility, focus motion, and duplicate-request behavior. Manual-only substitutes are allowed only when the blocker is documented and component-level coverage exists.

Dependencies: runs after Step 2 evidence exists and before Steps 3-7 begin.

### Step 3 Judge Gate: Desktop Roster Visibility

Verification level: Panel.

Required sub-agent judge perspectives: `designer` MUST judge clinical scannability and layout stability, `accessibility auditor` MUST judge active row keyboard/accessibility state, and `verifier` MUST judge evidence completeness.

Custom rubric:
- Verifies at least four desktop roster rows are visible at `1440x900` after load, add/import, and selection.
- Verifies `DesktopDashboard` and `VirtualizedPatientList` have clear height and scroll ownership with no double-scroll confusion or hidden primary controls.
- Verifies active row state is visually obvious, keyboard reachable, and exposed with `aria-current` or equivalent.
- Verifies nonessential list-entry motion is removed or reduced-motion gated without removing useful row cues.

Threshold: panel passes only if all four rubric bullets pass in automated evidence or a documented manual smoke paired with focused tests. Any hidden roster controls, fewer than four visible rows, or missing active-row accessibility fails the gate.

Dependencies: runs after Step 3 implementation and tests, depends on Step 2 harness availability.

### Step 4 Judge Gate: Mobile Roster Visibility

Verification level: Panel.

Required sub-agent judge perspectives: `accessibility auditor` MUST judge reachability/no overflow, `verifier` MUST judge mobile workflow evidence, and `test-engineer` MUST judge fixture/test reliability.

Custom rubric:
- Verifies `VirtualizedMobilePatientList` remains on the existing `react-window` path with aligned row/list heights.
- Verifies the patient tab at `375px` keeps search, filter/sort, add/import, patient selection, and detail navigation reachable with no horizontal overflow.
- Verifies `MobilePatientDetail` continues receiving selected-patient todo hydration through `initialTodos`.
- Verifies mobile transitions, empty/loading states, and scroll affordances respect reduced-motion requirements.

Threshold: panel passes only if all required mobile controls are reachable and no clipping/overflow/todo-hydration regression is found. A `react-window` row-height mismatch or duplicate selected-patient todo fetch fails the gate.

Dependencies: runs after Step 4 implementation and tests, depends on Step 2 mobile fixture/harness.

### Step 5 Judge Gate: Textbox Motion Removal

Verification level: Panel.

Required sub-agent judge perspectives: `accessibility auditor` MUST judge focus visibility and reduced-motion compatibility, `style-reviewer` MUST judge scoped class changes, and `test-engineer` MUST judge regression assertions.

Custom rubric:
- Verifies shared `Input` and `Textarea` no longer apply nonessential scale, shake, glow, shadow pulse, animated border, or layout-shifting focus/click effects.
- Verifies visible `focus-visible` and invalid/error indicators remain accessible and static.
- Verifies the diff is scoped to textbox focus/click behavior and does not remove unrelated component affordances.
- Verifies tests or static assertions prevent reintroduction of removed motion utilities in shared textbox controls.

Threshold: panel passes only if all motion categories are absent from shared textbox focus/click behavior and accessible focus remains visible. Missing focus indication or broad unrelated styling churn fails the gate.

Dependencies: runs after Step 5 implementation and tests, depends on Step 2 focus-motion assertions.

### Step 6 Judge Gate: Patient Fetch and Cache Path

Verification level: Single.

Required sub-agent judge perspective: `backend architect`.

Custom rubric:
- Verifies `src/hooks/usePatients.ts` remains unchanged unless a documented blocker proves a direct re-export change was required.
- Verifies patient fetch/cache changes stay inside `src/hooks/patients/*` and existing cache utilities unless the shared-file inventory justified a broader touch.
- Verifies already-loaded patient data is reused across selection and dashboard interactions.
- Verifies patient selection does not trigger duplicate full patient-list fetches.

Threshold: pass only if hook contracts remain stable and request-count evidence proves no duplicate full patient-list fetch on selection. Any unapproved `usePatients.ts` contract change fails the gate.

Dependencies: runs after Step 6 implementation and request-count tests, depends on Step 1 contract inventory and Step 2 instrumentation.

### Step 7 Judge Gate: Todo Hydration and Bulk Todo Map

Verification level: Single.

Required sub-agent judge perspective: `backend architect`.

Custom rubric:
- Verifies `useAllPatientTodos(patientIds)` preserves `{ todosMap, loading, refetch }`.
- Verifies stable keying, request dedupe, or TanStack Query alignment prevents unnecessary full todo-map reloads on selected-patient changes.
- Verifies desktop `PatientCard` and mobile `MobilePatientDetail` preserve `usePatientTodos(patientId, { initialTodos })` short-circuit hydration.
- Verifies dashboard todo badges/map and selected-patient todo state remain consistent after selection changes.

Threshold: pass only if selected-patient changes do not trigger duplicate per-patient todo fetches when `initialTodos` exists and the public return shapes remain stable.

Dependencies: runs after Step 7 implementation and tests, depends on Step 1 contract inventory and Step 2 instrumentation.

### Step 8 Judge Gate: Mutation Invalidation and Cache Updates

Verification level: Panel.

Required sub-agent judge perspectives: `backend architect` MUST judge cache correctness, `security-reviewer` MUST judge data consistency/failure safety, and `verifier` MUST judge evidence coverage.

Custom rubric:
- Verifies patient and todo mutations update cached data immutably where safe.
- Verifies invalidations target only affected patient/list/todo keys needed for correctness.
- Verifies selected-todo state and dashboard todo-map cache remain consistent after add/toggle/delete/generate operations.
- Verifies refresh failures keep the last usable local roster state where available and use existing error/offline/toast paths.

Threshold: panel passes only if scoped invalidation is proven by tests or request evidence and failure paths do not blank usable clinical state. Broad dashboard refetch without justification or unsafe optimistic stale state fails the gate.

Dependencies: runs after Step 8 implementation and tests, depends on Step 6 and Step 7 judge conclusions.

### Step 9 Judge Gate: Import Behavior and Backend Active Path

Verification level: Panel.

Required sub-agent judge perspectives: `backend architect` MUST judge import/cache active path, `test-engineer` MUST judge import regression coverage, and `verifier` MUST judge user-visible roster evidence.

Custom rubric:
- Verifies multi-patient import avoids full dashboard refetch between rows where safe.
- Verifies batch import is used only if patient-number conflict behavior and validation/toast semantics are preserved.
- Verifies sequential import, if retained, consolidates cache updates and avoids unnecessary between-row full reloads.
- Verifies imported rosters immediately meet desktop/mobile visibility requirements and preserve duplicate/conflict behavior.

Threshold: panel passes only if import speed improvements do not alter conflict semantics or visibility after import. Any duplicate patient-number risk, partial-import surprise, or repeated full reload without documented necessity fails the gate.

Dependencies: runs after Step 9 implementation and tests, depends on Step 6 and Group A import-path inventory.

### Step 10 Judge Gate: Evidence-Gated Migration and Index Check

Verification level: Single.

Required sub-agent judge perspective: `performance benchmarker`.

Custom rubric:
- Verifies existing migrations/indexes are inspected for active patient/todo dashboard query paths where environment access allows.
- Verifies no migration is added unless measured request/query evidence proves cache/query cleanup is insufficient.
- Verifies any migration is narrow, reversible, locally verified where credentials allow, and documented with rollback steps.
- Verifies credential-gated inspection or migration verification gaps are explicitly documented.

Threshold: pass if the migration decision is evidence-backed: either no migration with sufficient rationale, or one reversible migration with rollback and verification/gap notes. Schema work without measured evidence fails the gate.

Dependencies: runs after Steps 6-9 evidence exists and before Step 11 final integration.

### Step 11 Judge Gate: Final Integration

Verification level: Per-Item.

Required sub-agent judge perspectives: `verifier` MUST own item-by-item pass/fail/gap evidence, `code-reviewer` MUST review changed-file scope and regression risk, and `performance benchmarker` MUST judge responsiveness/request-count claims.

Custom rubric:
- Evaluates each of the 14 acceptance criteria independently with evidence links or recorded command/manual outputs.
- Confirms final evidence covers roster visibility, input focus/no microanimation, frontend responsiveness, duplicate request/cache behavior, import/backend active path, accessibility/reduced-motion, and unchanged workflow regressions.
- Confirms `npm test`, `npm run lint`, `npm run build`, and relevant e2e scopes were rerun or explicitly blocked with documented reason.
- Confirms changed-file review finds no dependency additions, unrelated churn, static route import regression, empty-string Radix `SelectItem` value, or unjustified `usePatients.ts` contract change.

Threshold: all 14 acceptance-criterion evaluations must be `pass` or documented `credential-gated/manual-gap` with a named owner and no critical user-facing risk. Any unresolved critical gap in roster visibility, textbox motion, duplicate requests, import correctness, or accessibility fails final integration.

Dependencies: runs only after Steps 1-10 judge gates have recorded pass/fail/gap results.
