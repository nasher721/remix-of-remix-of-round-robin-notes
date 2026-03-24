---
status: in-progress
phase: 1
updated: 2026-03-24
---

# Dashboard Layout Usability & Focused Writing Plan

## TL;DR

> **Quick Summary**: Rework the desktop patient-notes workspace to prioritize writing: collapsible side panels, wider center editing surface, click-in autofocus/focus mode, 11px default editor text, and reversible systems-review combine/split views.
>
> **Deliverables**:
> - Left + right panel collapse with persisted preferences
> - Center-focused editing mode on editor click with safe exit behavior
> - Systems review `split`, `combine_all`, and `custom combine` modes
> - TDD coverage + agent-executed QA evidence for all behaviors
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 3 waves + final verification wave
> **Critical Path**: T1 → T2 → T7 → T8 → T12 → T14 → F1-F4

---

## Goal
Deliver a faster, less cramped desktop note-writing experience by making dashboard layout controls reversible, persistent, and test-verified.

## Context

### Original Request
Address all screenshot-annotated UX changes for the dashboard: collapsible list, wider work area, smaller default text, center-focused editing, and merge/split systems boxes.

### Interview Summary
**Confirmed user decisions**:
- Focus trigger: click-in autofocus
- Right panel: also collapsible
- Systems behavior: combine all + allow custom combine choices
- Default text size target: 11
- Persistence: localStorage
- Test strategy: TDD

### Context & Decisions
| Decision | Rationale | Source |
|----------|-----------|--------|
| Reuse existing collapsible persistence pattern | Minimizes risk and keeps behavior consistent | `ref:bg_f04d9b4c` |
| Use explicit layout mode state (`split/combine_all/custom`) | Supports both global and user-selected combinations | `ref:bg_93cb2c61` |
| Keep focus mode reversible with keyboard exit | Prevents disorientation and accessibility regressions | `ref:bg_ad0efb26` |
| TDD-first with UI interaction verification | Reduces regressions in complex stateful layout behaviors | User decision |

### Metis Review (addressed)
- Added guardrail to keep this as view-layer/state-layer only (no backend/schema changes).
- Added persistence hardening (parse/validate/migrate/fallback).
- Added accessibility and keyboard behavior criteria (`Esc`, tab order, aria-state).
- Added edge-case handling for invalid saved preferences and mode restoration.

---

## Work Objectives

### Core Objective
Improve dashboard writing ergonomics while keeping interaction predictable, reversible, and persisted.

### Concrete Deliverables
- Collapsible left patient list + collapsible right tasks panel with persistent state.
- Main editor area can expand/widen based on panel states.
- Click-in autofocus behavior opens centered large writing workspace for active editor.
- Systems Review supports split cards, combine all, and custom combine groups.
- Default editor text baseline set to 11px where applicable.

### Definition of Done
- [ ] TDD test suite covers new state model and interaction behaviors.
- [ ] Agent QA scenarios pass for panel collapse, focus mode, systems combine/split, and persistence.
- [ ] No horizontal overflow or text-loss regressions in desktop dashboard.

### Must Have
- Persistent dashboard preferences in localStorage with safe fallback.
- Keyboard-accessible toggles and exits.
- Reversible layout controls (user can always return to split/default view).

### Must NOT Have (Guardrails)
- No backend/API/database schema changes.
- No broad mobile redesign in this plan.
- No destructive rewrite of editor modules unrelated to requested behaviors.
- No unscoped “new dashboard architecture” expansion.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — all verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: TDD
- **Framework**: existing project test stack (detected in repo)
- **TDD rule**: Each task follows RED → GREEN → REFACTOR where code changes occur.

### QA Policy
- Frontend/UI verification via Playwright-style interaction checks.
- State/model verification via unit tests for reducers/selectors/persistence parsing.
- Evidence files under `.sisyphus/evidence/task-{N}-{scenario}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundation — start immediately):
- T1 Preferences model + migration guards
- T2 Dashboard layout state container (single source of truth)
- T3 Left panel collapse wiring
- T4 Right panel collapse wiring
- T5 Editor text-size baseline normalization (11)
- T6 Tests scaffolding for layout/focus/system modes

Wave 2 (Core UX behaviors — after Wave 1):
- T7 Focus-mode state machine + exit semantics
- T8 Click-in autofocus integration for main editor cards
- T9 Center-width rebalance and breakpoint tuning
- T10 Systems mode model (`split/combine_all/custom`)
- T11 Systems controls UI for merge/split/custom selection
- T12 Combined systems editor rendering + split restore

Wave 3 (Integration + hardening — after Wave 2):
- T13 Persistence integration across patient switch/reload/error fallback
- T14 End-to-end interaction + regression suite
- T15 Accessibility + keyboard/focus-order polish

Wave FINAL (After ALL implementation tasks):
- F1 Plan compliance audit
- F2 Code quality review
- F3 Real QA execution of all scenarios
- F4 Scope fidelity audit

### Dependency Matrix
- T1: blocked by none → blocks T2, T7, T10, T13
- T2: blocked by T1 → blocks T3, T4, T7, T9, T13
- T3: blocked by T2 → blocks T9, T14
- T4: blocked by T2 → blocks T9, T14
- T5: blocked by none → blocks T8, T12, T14
- T6: blocked by none → blocks T14
- T7: blocked by T1, T2 → blocks T8, T15
- T8: blocked by T5, T7 → blocks T14, T15
- T9: blocked by T2, T3, T4 → blocks T14
- T10: blocked by T1 → blocks T11, T12, T13
- T11: blocked by T10 → blocks T12, T14
- T12: blocked by T5, T10, T11 → blocks T14, T15
- T13: blocked by T1, T2, T10 → blocks T14
- T14: blocked by T3, T4, T6, T8, T9, T11, T12, T13 → blocks F1-F4
- T15: blocked by T7, T8, T12 → blocks F1-F4

### Agent Dispatch Summary
- Wave 1: mostly `quick` + one `unspecified-high` (state model)
- Wave 2: `deep` for focus/systems state, `visual-engineering` for layout rendering
- Wave 3: `unspecified-high` for integration QA; `quick` for accessibility fixes
- Final: oracle/deep/high mixed review quartet

---

## TODOs

- [ ] 1. Dashboard preferences model + migration guard

  **What to do**:
  - Create/extend typed dashboard prefs model (`panelLeftCollapsed`, `panelRightCollapsed`, `focusMode`, `systemsLayoutMode`, `customSystemsGroupIds`, version).
  - Add parse/validate/migrate/sanitize logic for localStorage payloads.
  - Add RED→GREEN unit tests for invalid JSON, unknown fields, version mismatch, and fallback defaults.

  **Must NOT do**:
  - Do not write server-side preference storage.

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: `plan-protocol` (alignment), existing test skill patterns

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 2, 7, 10, 13
  - Blocked By: None

  **References**:
  - `src/components/dashboard/PatientNavigator.tsx` — persisted open/closed pattern to replicate.
  - `src/components/dashboard/SettingsContext*` (if present) — canonical preference state location.

  **Acceptance Criteria**:
  - [ ] Preferences deserialize safely on startup and recover from malformed storage.
  - [ ] Unit tests pass for migration and fallback behavior.

  **QA Scenarios**:
  - Happy path: Seed valid prefs in localStorage, reload, assert UI state restored. Evidence: `.sisyphus/evidence/task-1-prefs-restore.txt`
  - Error path: Seed invalid JSON, reload, assert defaults applied without crash. Evidence: `.sisyphus/evidence/task-1-prefs-invalid.txt`

- [ ] 2. Dashboard layout state container (single source of truth)

  **What to do**:
  - Centralize layout state so panel collapse, focus mode, and systems mode are coordinated.
  - Expose controlled actions/selectors for child components.
  - Add tests ensuring no conflicting states (e.g., invalid mode combinations).

  **Must NOT do**:
  - Do not duplicate preference-writing logic in multiple child components.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `plan-protocol`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 1
  - Blocks: 3, 4, 7, 9, 13
  - Blocked By: 1

  **References**:
  - `src/components/dashboard/VirtualizedPatientList.tsx` — likely root layout orchestrator.
  - `src/components/dashboard/PatientNavigator.tsx` — current collapse state behavior.

  **Acceptance Criteria**:
  - [ ] One authoritative state container controls all dashboard layout modes.
  - [ ] Tests pass for state transitions and selector outputs.

  **QA Scenarios**:
  - Happy path: Toggle left/right/focus/systems mode in sequence; state remains consistent. Evidence: `.sisyphus/evidence/task-2-state-sequence.txt`
  - Error path: Dispatch invalid/unknown action; state remains unchanged and app stable. Evidence: `.sisyphus/evidence/task-2-invalid-action.txt`

- [ ] 3. Left patient list collapsible behavior

  **What to do**:
  - Wire left panel collapse toggle into unified layout state.
  - Ensure collapsed panel is keyboard accessible and announced (`aria-expanded`).
  - Persist collapse state via prefs model.

  **Must NOT do**:
  - Do not remove patient list functionality when expanded.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 9, 14
  - Blocked By: 2

  **References**:
  - `src/components/dashboard/PatientNavigator.tsx` — collapsible width/toggle semantics.
  - `src/components/dashboard/VirtualizedPatientList.tsx` — list placement in desktop layout.

  **Acceptance Criteria**:
  - [ ] Left panel collapses/expands via mouse + keyboard.
  - [ ] State restored after reload.

  **QA Scenarios**:
  - Happy path: Click collapse button; panel shrinks and center width increases. Evidence: `.sisyphus/evidence/task-3-left-collapse.png`
  - Error path: Keyboard toggle on collapsed panel keeps focus reachable and no trap. Evidence: `.sisyphus/evidence/task-3-left-a11y.txt`

- [ ] 4. Right tasks panel collapsible behavior

  **What to do**:
  - Add right panel collapse/expand control aligned with left panel behavior.
  - Persist right panel state.
  - Ensure hidden content leaves tab order when collapsed.

  **Must NOT do**:
  - Do not delete task data or task interactions.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 9, 14
  - Blocked By: 2

  **References**:
  - Right-column task panel container in dashboard layout files.
  - Collapse control pattern from left panel implementation.

  **Acceptance Criteria**:
  - [ ] Right panel collapses/expands without layout jitter.
  - [ ] State restored after reload.

  **QA Scenarios**:
  - Happy path: Collapse right panel, verify center workspace widens. Evidence: `.sisyphus/evidence/task-4-right-collapse.png`
  - Error path: With right panel collapsed, tab navigation skips hidden controls. Evidence: `.sisyphus/evidence/task-4-right-taborder.txt`

- [ ] 5. Editor default typography baseline to 11

  **What to do**:
  - Apply 11px baseline to default editor content areas relevant to dashboard cards.
  - Ensure placeholder/helper text remains readable and consistent.
  - Add tests/snapshots for typography class/style regression.

  **Must NOT do**:
  - Do not alter unrelated mobile-only typography paths.

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 8, 12, 14
  - Blocked By: None

  **References**:
  - `src/components/PatientCard.tsx` — editor card rendering zones.
  - Rich text editor base style/config used by card editors.

  **Acceptance Criteria**:
  - [ ] Default typing text in targeted boxes renders at 11 baseline.
  - [ ] No clipping/overflow in toolbar + editor combinations.

  **QA Scenarios**:
  - Happy path: Type in Clinical Summary, Interval Events, Imaging; verify computed font size target. Evidence: `.sisyphus/evidence/task-5-fontsize.txt`
  - Error path: Zoom/responsive change does not collapse text controls. Evidence: `.sisyphus/evidence/task-5-font-regression.png`

- [ ] 6. TDD harness and interaction test scaffolding

  **What to do**:
  - Add/extend test helpers for dashboard rendering, keyboard simulation, and localStorage mocking.
  - Establish baseline failing tests for planned behaviors before implementation merges.

  **Must NOT do**:
  - Do not add brittle timing-dependent tests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `code-review`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 14
  - Blocked By: None

  **References**:
  - Existing project test setup and dashboard component tests.

  **Acceptance Criteria**:
  - [ ] New test utilities support focus/keyboard/layout assertions.
  - [ ] Initial RED tests fail for new behaviors before implementation completion.

  **QA Scenarios**:
  - Happy path: Run targeted test file and confirm RED phase captures missing behavior. Evidence: `.sisyphus/evidence/task-6-red-tests.txt`
  - Error path: Simulated localStorage throw path handled in tests without crashes. Evidence: `.sisyphus/evidence/task-6-storage-error.txt`

- [ ] 7. Focus-mode state machine with safe exits

  **What to do**:
  - Implement focus-mode transitions for active editor card and centered large workspace behavior.
  - Define exit semantics (`Esc`, explicit close, context switch) and restore prior layout.
  - Add reducer/state tests for mode transitions.

  **Must NOT do**:
  - Do not force irreversible fullscreen with no keyboard exit.

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 2
  - Blocks: 8, 15
  - Blocked By: 1, 2

  **References**:
  - State container from Task 2.
  - Editor cards in `src/components/PatientCard.tsx`.

  **Acceptance Criteria**:
  - [ ] Focus mode enters on configured click path and exits on `Esc`.
  - [ ] Previous panel/layout state is restored on exit.

  **QA Scenarios**:
  - Happy path: Click editor body, focus mode activates and centers active editor. Evidence: `.sisyphus/evidence/task-7-focus-enter.png`
  - Error path: Press `Esc` during focus mode; layout restores and focus returns safely. Evidence: `.sisyphus/evidence/task-7-focus-exit.txt`

- [ ] 8. Click-in autofocus integration for main editor cards

  **What to do**:
  - Wire click-in behavior in Clinical Summary, Interval Events, Imaging editors to trigger focus mode.
  - Prevent accidental trigger from toolbar/button clicks.
  - Preserve unsaved text and caret position where feasible.

  **Must NOT do**:
  - Do not trigger focus mode for non-editor UI chrome interactions.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 14, 15
  - Blocked By: 5, 7

  **References**:
  - `src/components/PatientCard.tsx` — editor card event boundaries.

  **Acceptance Criteria**:
  - [ ] Clicking inside editable area enters focus mode.
  - [ ] Toolbar controls remain usable without unintended mode switch.

  **QA Scenarios**:
  - Happy path: Click editor content, verify autofocus and centered workspace. Evidence: `.sisyphus/evidence/task-8-click-focus.mp4`
  - Error path: Click toolbar bold/icon controls; no unexpected focus-mode entry. Evidence: `.sisyphus/evidence/task-8-toolbar-guard.txt`

- [ ] 9. Main workspace width rebalance and responsiveness

  **What to do**:
  - Rebalance column widths so center editing area is primary.
  - Ensure expanded width when one or both side panels are collapsed.
  - Tune breakpoints to avoid cramped mid-width desktop states.

  **Must NOT do**:
  - Do not introduce horizontal page overflow.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 14
  - Blocked By: 2, 3, 4

  **References**:
  - `src/components/dashboard/VirtualizedPatientList.tsx` — desktop pane layout.

  **Acceptance Criteria**:
  - [ ] Center pane width materially increases versus baseline when side panels collapse.
  - [ ] No overlap of editor/toolbars at common desktop widths.

  **QA Scenarios**:
  - Happy path: Collapse both side panels, verify center pane expands and remains stable. Evidence: `.sisyphus/evidence/task-9-width-expanded.png`
  - Error path: Resize viewport through breakpoints; no overflow/x-scroll regressions. Evidence: `.sisyphus/evidence/task-9-breakpoint-check.txt`

- [ ] 10. Systems layout mode model (`split/combine_all/custom`)

  **What to do**:
  - Define systems-layout state and normalization rules.
  - Support default split, global combine-all, and custom-id grouping.
  - Add tests for invalid/duplicate/empty custom selections.

  **Must NOT do**:
  - Do not modify server-side systems schema.

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: `code-review`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 11, 12, 13
  - Blocked By: 1

  **References**:
  - `src/components/PatientSystemsReview.tsx` — current systems card rendering and enabled systems config.

  **Acceptance Criteria**:
  - [ ] Mode transitions are deterministic and reversible.
  - [ ] Custom mode sanitizes invalid IDs safely.

  **QA Scenarios**:
  - Happy path: Set mode to `combine_all`; all systems render in unified editor view. Evidence: `.sisyphus/evidence/task-10-combine-all.png`
  - Error path: Supply invalid custom IDs; app falls back gracefully without crash. Evidence: `.sisyphus/evidence/task-10-custom-invalid.txt`

- [ ] 11. Systems merge/split controls UI

  **What to do**:
  - Add user-facing controls for split/combine-all/custom selection.
  - Ensure controls are discoverable and reversible.
  - Add keyboard and aria labels for mode controls.

  **Must NOT do**:
  - Do not hide split restore path.

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 2
  - Blocks: 12, 14
  - Blocked By: 10

  **References**:
  - `src/components/PatientSystemsReview.tsx` — toolbar/header zone for controls.

  **Acceptance Criteria**:
  - [ ] User can switch among split, combine-all, and custom modes in ≤2 interactions.
  - [ ] Mode controls are keyboard accessible and labeled.

  **QA Scenarios**:
  - Happy path: Toggle split→combine-all→split; state and view update correctly. Evidence: `.sisyphus/evidence/task-11-toggle-modes.mp4`
  - Error path: Attempt custom mode with no selection; clear validation feedback shown. Evidence: `.sisyphus/evidence/task-11-custom-empty.txt`

- [ ] 12. Combined systems editor rendering + split restore

  **What to do**:
  - Implement merged editing view for combine-all and custom groups.
  - Ensure split restoration returns to per-system cards without data loss.
  - Add tests for mode transition retaining unsaved edits in local UI state.

  **Must NOT do**:
  - Do not discard typed text during mode switch.

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 2
  - Blocks: 14, 15
  - Blocked By: 5, 10, 11

  **References**:
  - `src/components/PatientSystemsReview.tsx` — card grid and editor instances.

  **Acceptance Criteria**:
  - [ ] Combined mode presents larger useful writing area.
  - [ ] Switching between combined and split preserves in-progress input.

  **QA Scenarios**:
  - Happy path: Enter text in combined mode, switch to split, verify text retained per mapped sections. Evidence: `.sisyphus/evidence/task-12-merge-retain.txt`
  - Error path: Switch modes rapidly; no React key/state corruption or crashes. Evidence: `.sisyphus/evidence/task-12-rapid-toggle.txt`

- [ ] 13. Persistence integration + restore lifecycle hardening

  **What to do**:
  - Wire restore/save lifecycle for all layout modes and custom systems selection.
  - Ensure patient switch/navigation doesn’t corrupt or unexpectedly reset global layout preferences.
  - Add fallback behavior when storage unavailable/quota exceeded.

  **Must NOT do**:
  - Do not throw uncaught exceptions from persistence operations.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `code-review`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 3
  - Blocks: 14
  - Blocked By: 1, 2, 10

  **References**:
  - Persistence utility from Task 1 and layout container from Task 2.

  **Acceptance Criteria**:
  - [ ] Preferences survive reload and route transitions.
  - [ ] Invalid/partial persisted state falls back safely.

  **QA Scenarios**:
  - Happy path: Configure custom layout, reload app, verify complete state restore. Evidence: `.sisyphus/evidence/task-13-reload-restore.mp4`
  - Error path: Simulate storage failure, verify defaults apply with warning path only (no crash). Evidence: `.sisyphus/evidence/task-13-storage-fallback.txt`

- [ ] 14. End-to-end dashboard interaction regression suite

  **What to do**:
  - Implement/expand E2E tests covering full requested workflow.
  - Cover: panel collapse, focus mode entry/exit, systems combine/split/custom, persistence after reload.
  - Capture evidence artifacts for each critical scenario.

  **Must NOT do**:
  - Do not leave only happy-path coverage.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `code-review`, `playwright`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 3
  - Blocks: Final verification wave
  - Blocked By: 3, 4, 6, 8, 9, 11, 12, 13

  **References**:
  - Dashboard route/component test harness and E2E framework setup.

  **Acceptance Criteria**:
  - [ ] E2E tests pass for all screenshot-requested behaviors.
  - [ ] Evidence files exist for every major scenario.

  **QA Scenarios**:
  - Happy path: Full flow run (collapse panels → edit/focus → combine systems → reload) passes. Evidence: `.sisyphus/evidence/task-14-full-flow.mp4`
  - Error path: Invalid custom systems selection and rapid mode switching handled gracefully. Evidence: `.sisyphus/evidence/task-14-edge-flow.txt`

- [ ] 15. Accessibility and focus-order polish

  **What to do**:
  - Verify keyboard traversal, `Esc` handling, aria-state labels, and no hidden-focus traps.
  - Add targeted a11y checks and fix issues discovered by tests.

  **Must NOT do**:
  - Do not leave collapsed/hidden controls reachable via unintended tab sequence.

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: `frontend-philosophy`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 3
  - Blocks: Final verification wave
  - Blocked By: 7, 8, 12

  **References**:
  - Focus-mode implementation from Tasks 7/8.
  - Systems mode controls from Task 11.

  **Acceptance Criteria**:
  - [ ] Keyboard-only user can complete all new flows.
  - [ ] Focus returns predictably after entering/exiting modes.

  **QA Scenarios**:
  - Happy path: Keyboard-only traversal completes panel toggles, focus mode, systems mode switches. Evidence: `.sisyphus/evidence/task-15-keyboard-walkthrough.txt`
  - Error path: Attempt tabbing into collapsed panel controls fails (as expected) while still preserving discoverable expand control. Evidence: `.sisyphus/evidence/task-15-hidden-focus-guard.txt`

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  - Verify every deliverable, every guardrail, and evidence completeness.

- [ ] F2. **Code Quality Review** — `unspecified-high`
  - Run type/lint/test suite and detect anti-patterns/slop.

- [ ] F3. **Real Manual QA (Agent-executed)** — `unspecified-high`
  - Execute all listed QA scenarios end-to-end; store evidence under `.sisyphus/evidence/final-qa/`.

- [ ] F4. **Scope Fidelity Check** — `deep`
  - Confirm implementation is 1:1 with this plan and no unplanned creep.

---

## Commit Strategy

- C1: `feat(dashboard): add persisted layout preference model and guards`
- C2: `feat(layout): add collapsible left and right panels`
- C3: `feat(editor): add click-focus mode and width rebalance`
- C4: `feat(systems): add combine/split modes with custom grouping`
- C5: `test(dashboard): add interaction and persistence regressions`
- C6: `chore(a11y): finalize keyboard and aria compliance`

---

## Success Criteria

### Verification Commands
```bash
npm run test         # Expected: pass
npm run test:e2e     # Expected: pass
npm run lint         # Expected: pass
npx tsc --noEmit     # Expected: pass
```

### Final Checklist
- [ ] All Must-Have items implemented
- [ ] All Must-NOT-Have guardrails respected
- [ ] TDD tests passing
- [ ] QA evidence files present for all task scenarios
