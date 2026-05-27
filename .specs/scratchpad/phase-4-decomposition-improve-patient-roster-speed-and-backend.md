# Phase 4 Decomposition Scratchpad

Task: `.specs/tasks/draft/improve-patient-roster-speed-and-backend.feature.md`

## Source Links Used

- Research: `.specs/scratchpad/phase-2a-patient-roster-performance-research.md`
- Analysis: `.specs/analysis/analysis-improve-patient-roster-speed-and-backend.md`
- Architecture synthesis: `.specs/scratchpad/phase-3-architecture-synthesis-improve-patient-roster-speed-and-backend.md`

## Judge Notes Carried Forward

- Keep `src/hooks/usePatients.ts` as the direct re-export boundary unless a later implementation blocker proves it must change.
- If `src/hooks/usePatients.ts` is touched, implementation must document why the direct re-export was insufficient and preserve the current public hook/type surface.
- Backend/cache work is constrained to active dashboard paths: active patient fetch/selection, todo map, selected-patient todo hydration, import, and patient/todo mutations.
- Do not make broad backend changes, route dashboard CRUD through `clinical-mcp-server`, or add migrations before evidence shows existing query/cache improvements are insufficient.

## Decomposition Shape

Implementation steps count: 8

Total subtasks count: 34

Critical path steps:
1. Setup and Regression Baseline
2. Roster Visibility Test Harness
3. Desktop Roster Visibility
4. Input Motion Removal
5. Backend and Cache Active-Path Improvements
6. Final Verification

High priority risks count: 10

## Step Inventory

### 1. Setup and Regression Baseline

Purpose: establish current check status and lock workflows before edits.

Success criteria:
- Current `npm test`, `npm run lint`, and `npm run build` status is known.
- Coverage exists or is planned for roster visibility, input focus, active patient workflows, and duplicate request prevention.
- `src/hooks/usePatients.ts` is verified unchanged at baseline.

Subtasks:
1. Run baseline checks and capture pre-existing failures.
2. Map active dashboard roster, input, and todo test surfaces.
3. Add missing workflow regression coverage before edits.
4. Add a guard note/assertion for `src/hooks/usePatients.ts` re-export-only behavior.

Blockers:
- Credential-gated e2e paths.
- Pre-existing failing tests.

Risks:
- High: unprotected cache/layout edits can hide duplicate fetch regressions.
- Medium: brittle viewport fixtures can fail for the wrong reason.

### 2. Roster Visibility Test Harness

Purpose: make the visibility goal executable before layout edits.

Success criteria:
- Tests can prove several rows are visible after load/add/import.
- Desktop active-row accessibility and mobile reachability are covered.

Subtasks:
1. Seed or mock 8-patient and 20-patient dashboard data.
2. Assert at least four visible desktop roster rows at common desktop viewports.
3. Assert mobile search/filter/sort/add/import/selection reachability at `375px`.
4. Assert keyboard focus and active-row state with `aria-current` or equivalent.

Blockers:
- Authenticated dashboard setup may require component-level fallback.

Risks:
- High: class-based tests can pass while user-visible roster capacity remains poor.
- Medium: import e2e may need mocking without backend access.

### 3. Desktop Roster Visibility

Purpose: fix desktop roster capacity through layout constraints and scroll ownership.

Success criteria:
- Multiple patient rows remain visible after add/import/selection.
- Roster, editor, and task rail remain reachable without double-scroll confusion.

Subtasks:
1. Stabilize `DesktopDashboard` body sizing and scroll ownership.
2. Compact and bound `VirtualizedPatientList` sidebar/topbar containers.
3. Preserve selection, badges, keyboard access, and active state.
4. Remove or gate nonessential list motion that affects layout stability.

Blockers:
- Nested scroll ownership may require dashboard-shell changes before roster changes.

Risks:
- High: parent height changes can hide other dashboard controls.
- Medium: compact rows can remove clinically useful row context.

### 4. Mobile Roster Visibility

Purpose: preserve fast mobile roster behavior while improving narrow-screen reachability.

Success criteria:
- Existing `react-window` mobile list remains intact.
- Controls and patient rows fit at narrow width with no horizontal overflow.

Subtasks:
1. Keep `VirtualizedMobilePatientList` on existing `react-window`.
2. Adjust list height/row constraints only where tests fail.
3. Preserve mobile detail `initialTodos` hydration.
4. Verify reduced-motion compatibility and no horizontal overflow.

Blockers:
- Mobile dashboard may need wrapper fixtures for testing.

Risks:
- High: list row height mismatch can clip rows.
- Medium: moving controls can harm bedside workflow familiarity.

### 5. Input Motion Removal

Purpose: remove distracting textbox microanimations centrally.

Success criteria:
- Shared inputs/textareas focus without scale, shake, glow, animated border, shadow pulse, or layout shift.
- Focus remains visible and accessible.

Subtasks:
1. Replace `Input` transition/glow/shake classes with static focus border/ring.
2. Replace `Textarea` transition/shake classes with static focus border/ring.
3. Preserve invalid state color and visible `focus-visible` treatment.
4. Add static assertions or tests for removed textbox motion utilities.

Blockers:
- Motion inherited from unrelated components should stay out of scope.

Risks:
- High: over-removal can erase accessible focus indication.
- Medium: exact class snapshots may need targeted updates.

### 6. Frontend Interaction Performance

Purpose: reduce unnecessary rerender work without introducing new abstractions.

Success criteria:
- Search/filter/sort/selection/todo-panel interactions are responsive for a 20-patient census.
- Memoization is justified by prop stability or measured interaction cost.

Subtasks:
1. Instrument/profile `DesktopDashboard`, `VirtualizedPatientList`, `PatientCard`, and mobile roster.
2. Stabilize expensive derived values and callbacks where they feed memoized children.
3. Use `useDeferredValue` only if search/filter remains visibly coupled to expensive list recompute.
4. Preserve split dashboard patient/todo contexts.

Blockers:
- Automated profiler evidence may be unavailable.

Risks:
- High: blanket memoization can add complexity without improving responsiveness.
- Medium: deferred search can feel stale without clear UI treatment.

### 7. Backend and Cache Active-Path Improvements

Purpose: reduce duplicate reads and broad invalidation on active dashboard paths only.

Success criteria:
- Patient selection avoids duplicate full patient-list and full todo-map reloads.
- Mutations update or invalidate only affected patient/todo data.
- Import avoids repeated full dashboard refetches where safe.

Subtasks:
1. Keep `src/hooks/usePatients.ts` unchanged unless a concrete blocker is documented.
2. Add stable keying/request dedupe or TanStack Query alignment to `useAllPatientTodos` while preserving return shape.
3. Preserve selected-patient `usePatientTodos(..., { initialTodos })` short-circuit on desktop and mobile.
4. Scope patient/todo mutation cache updates and invalidation to affected keys.
5. Improve import batching only if patient-number conflict behavior is preserved; otherwise prevent between-row full refetches.
6. Check existing Supabase active-path indexes/migrations before proposing a reversible schema change.

Blockers:
- Supabase inspection may be credential-gated.
- Conflict retry semantics may block safe bulk import.

Risks:
- High: breaking initial todo hydration causes duplicate fetches and flicker.
- High: broad invalidation erases perceived-speed gains.
- High: import conflict changes can create duplicate numbers or partial-import surprises.
- Medium: query-key changes can break cache warming/offline mutation assumptions.

### 8. Final Verification

Purpose: prove the full Phase 4 behavior and document gaps.

Success criteria:
- Automated and manual verification covers visibility, input focus, active-path requests, and unchanged workflows.
- Any credential-gated gaps or rollback notes are documented.

Subtasks:
1. Re-run `npm test`, `npm run lint`, `npm run build`, and relevant `npm run test:e2e` scopes.
2. Manually inspect desktop, mobile, input focus, reduced-motion, and request-count behavior.
3. Verify changed files are scoped and `src/hooks/usePatients.ts` remained unchanged unless justified.
4. Document verification evidence, gaps, and rollback notes for any backend/schema work.

Blockers:
- Hosted auth, Supabase, or browser state may block full e2e verification.

Risks:
- High: backend improvement claims without request-count evidence can miss the target regression.
- Medium: manual-only visual checks can miss viewport-specific collapse.
