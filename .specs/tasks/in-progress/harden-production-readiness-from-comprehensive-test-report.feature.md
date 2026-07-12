---
title: Harden production readiness from comprehensive test report
type: feature
status: todo
depends_on: []
---

# Harden Production Readiness From Comprehensive Test Report

## Intent

Address the comprehensive Rolling Rounds browser test report systematically by hardening reliability, accessibility, error handling, and discoverability without changing the core clinical workflows that already tested well.

The app already supports patient management, search/filter, print/export, comparison, rich clinical documentation, formatting tools, AI actions, themes, systems review, and sync. This task protects those features while resolving high-risk gaps around storage access, patient activity errors, dialog accessibility, selected-patient AI context, destructive action safety, empty states, help/tooltips, dictation permissions, and async loading feedback.

## Source Report Summary

Critical issues:

- Storage access errors: repeated `Access to storage is not allowed from this context`.
- Patient activity fetch error: `Error fetching patient activity: Object`.
- Dialog accessibility warnings: missing `Description` or `aria-describedby` for `DialogContent`.

Functional and UX issues:

- AI requires selected patient, but selection context is unclear.
- Remove/duplicate/destructive workflows need confirmation parity and clearer target copy.
- Empty states, help text, tooltips, quick actions, task workflows, view modes, phrases, autotexts, import formats, AI model choices, and security badge details need clearer guidance.
- Voice dictation needs browser-permission testing and visible recovery states.
- Sync/fetch/AI/dictation paths need loading indicators and status messages.

## Current Evidence

- `src/utils/safeStorage.ts` exists but does not catch all storage access-time exceptions.
- `src/hooks/usePatientActivity.ts` catches activity errors with `console.error` but exposes no error or retry state.
- `src/components/patient/ActivityFeed.tsx` renders loading/empty/success but not fetch failure.
- `src/components/ui/dialog.tsx` and `src/components/ui/alert-dialog.tsx` provide shared primitives; many callsites need descriptions audited.
- `src/pages/Index.tsx` owns selected/current patient state; AI surfaces must consume it explicitly.
- Desktop and mobile destructive confirmations exist in several places, but duplicate/remove/clear parity and target naming need tests.
- Existing coverage is strongest in `src/components/dashboard/__tests__/dashboardRegressionHarness.test.tsx`, `src/context/DashboardLayoutContext.test.tsx`, `src/lib/dashboardPrefs.test.ts`, and `e2e/dashboard-layout.e2e.spec.ts`.

## Skill And Analysis Links

- Skill: `.claude/skills/production-readiness-hardening/SKILL.md`
- Codebase analysis: `.specs/analysis/analysis-harden-production-readiness-from-test-report.md`
- Research scratchpad: `.specs/scratchpad/phase-2a-production-readiness-research.md`
- Codebase scratchpad: `.specs/scratchpad/phase-2b-production-readiness-codebase-analysis.md`
- Business scratchpad: `.specs/scratchpad/phase-2c-production-readiness-business-analysis.md`
- Architecture scratchpad: `.specs/scratchpad/phase-3-architecture-synthesis-production-readiness.md`
- Decomposition scratchpad: `.specs/scratchpad/phase-4-decomposition-production-readiness.md`
- Parallelization scratchpad: `.specs/scratchpad/phase-5-parallelization-production-readiness.md`
- Verification scratchpad: `.specs/scratchpad/phase-6-verification-rubrics-production-readiness.md`

## User Scenarios

1. A clinician opens the app in a restricted browser context and can still round without a crash when storage is blocked.
2. A clinician opens patient activity while the backend query fails and sees a visible retry path instead of only a console error.
3. A keyboard or screen-reader user opens major dialogs and receives useful title, description, focus, and status context.
4. A clinician selects a non-first patient and opens AI; suggestions and generated actions target the selected patient.
5. A clinician attempts remove, clear-all, or duplicate actions and sees a specific confirmation naming the target and outcome.
6. A clinician denies microphone permission and sees recovery guidance instead of a stuck or silent dictation button.
7. A new user sees useful empty states, help, tooltips, and labels for advanced features without a tutorial blocking the workflow.

## In Scope

- Safe storage fallback for local/session storage paths used by dashboard, settings, print/export, offline queues, FHIR, observability, and theme/preferences.
- Patient activity hook/UI error, retry, loading, and last-success behavior.
- Dialog accessibility descriptions, focus-return checks, and targeted Radix warning resolution.
- Selected-patient AI context and disabled-state explanations.
- Destructive confirmation parity and clearer copy for desktop/mobile remove, clear, duplicate, and clear-all flows.
- Empty states, tooltips, contextual help, quick actions, task labels, view-mode documentation, phrases/autotexts/import guidance, security badge details, and loading/status messages.
- Dictation browser-permission handling for cloud and local dictation paths.
- Automated and manual verification coverage.

## Out Of Scope

- Dashboard redesign or new information architecture.
- New AI capabilities, new import formats, new sync features, or new clinical calculators.
- Replacing Supabase, TanStack Query, Radix, print/export, or dictation architecture.
- Adding runtime dependencies.
- Production deployment unless explicitly requested after implementation.

## Constraints

- No new dependencies without explicit request.
- Preserve existing patient management, search/filter, print/export, comparison, rich text editing, AI, theme, systems review, sync, and mobile navigation workflows.
- Keep `App.tsx` static route imports intact.
- Do not use empty-string Radix `SelectItem` values.
- Keep edits small, reversible, and tested.
- Do not globally suppress accessibility warnings without auditing callsites.
- Required instructions must not be tooltip-only.

## Acceptance Criteria

1. Given `localStorage` or `sessionStorage` access throws, when the dashboard loads, the app does not crash and uses defaults or memory fallback with recoverable persistence behavior.
2. Given storage writes fail after load, when a user toggles dashboard settings, theme, print preferences, tools menu state, or offline queue state, the UI remains usable and records a nonfatal warning/status where appropriate.
3. Given patient activity fetch fails, when the activity feed is open, the user sees a readable error and retry control, and the last successful activity list is preserved when available.
4. Given activity retry succeeds, when the user retries, activity rows render and loading/error states clear.
5. Given a targeted dialog opens, when inspected by screen reader or test query, it has an accessible title and useful description or an explicit justified `aria-describedby={undefined}` opt-out.
6. Given a dialog closes by Escape, Cancel, or close button, focus returns to the triggering control.
7. Given a non-first patient is selected, when the AI command palette opens, suggestions and quick actions use that selected patient.
8. Given no patient is selected, when a patient-required AI action is attempted, the UI explains the requirement and does not call the AI hook.
9. Given selected-text-only AI actions are unavailable, when the menu renders, disabled-state copy explains the selection requirement.
10. Given remove, clear-all, clear-section, duplicate, or equivalent destructive/high-impact actions are attempted, a confirmation names the target and outcome before mutation.
11. Given confirmation is canceled, no mutation is called.
12. Given filters return no patients, the empty state explains the filter condition and offers clear-filter/add/import recovery actions.
13. Given no patients exist, the empty state shows add/import/sample-preview paths in sober clinical copy.
14. Given advanced controls such as Quick Actions, Phrases, Autotexts, Customize, View, Generate/Summary, Import Document, and Security badges are present, they expose concise visible labels, aria labels, or tooltips that clarify purpose.
15. Given dictation permission is denied, the user sees visible recovery instructions and the recording state returns to idle.
16. Given dictation is recording, processing, failed, or complete, the state is visible and announced without moving focus.
17. Given sync retry, AI streaming, activity loading, import parsing, or task generation is running, the UI exposes loading/status state with appropriate `aria-busy`, `role=status`, or live-region semantics.
18. Given `npm test`, `npm run lint`, `npm run build`, and available e2e smoke checks run, regressions are either passing or documented as credential/browser-permission gated with exact gaps.

## Architecture Overview

### Solution Strategy

Implement this as a reliability and accessibility hardening pass. First add regression coverage that captures the test report's failures. Then introduce narrow shared helpers only where they reduce repeated unsafe behavior, especially storage access and normalized async error state. Finally, patch UI copy, labels, dialogs, and loading states in the existing components.

### Key Decisions

1. Extend safe storage instead of scattering `try/catch` at every callsite.
2. Add patient activity error/retry state to `usePatientActivity` and keep `ActivityFeed` responsible for user-facing recovery.
3. Fix dialog descriptions at callsites before considering primitive-level warning suppression.
4. Treat selected-patient AI context as a safety issue and test it before broader label polish.
5. Preserve existing confirmation flows, then add missing parity and specific target copy.
6. Keep tooltip/help improvements compact so the rounding surface remains calm.

### Expected Files To Modify

- `src/utils/safeStorage.ts`
- `src/contexts/SettingsContext.tsx`
- `src/lib/dashboardPrefs.ts`
- `src/components/dashboard/DesktopDashboard.tsx`
- `src/components/dashboard/VirtualizedPatientList.tsx`
- `src/components/dashboard/MobileDashboard.tsx`
- `src/hooks/usePatientActivity.ts`
- `src/components/patient/ActivityFeed.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/command.tsx`
- `src/components/tools/AICommandPalette.tsx`
- `src/components/AIClinicalAssistant.tsx`
- `src/components/UnifiedAIDropdown.tsx`
- `src/components/PatientCard.tsx`
- `src/components/mobile/MobilePatientDetail.tsx`
- `src/components/PatientTodos.tsx`
- `src/components/QuickActionsPanel.tsx`
- `src/components/ContextAwareHelp.tsx`
- `src/hooks/useDictation.ts`
- `src/components/DictationButton.tsx`
- `src/hooks/useLocalDictation.ts`
- `src/components/tools/LocalDictationButton.tsx`
- `src/components/print/usePrintState.ts`
- `src/components/print/layoutDesigner/useLayoutDesigner.ts`
- `src/lib/offline/offlineQueue.ts`
- `src/lib/offline/indexedDBQueue.ts`
- `src/components/sync/SyncHistoryPanel.tsx`
- `src/components/offline/OfflineSyncIndicator.tsx`
- `src/components/dashboard/__tests__/dashboardRegressionHarness.test.tsx`
- `src/context/DashboardLayoutContext.test.tsx`
- `src/lib/dashboardPrefs.test.ts`
- `e2e/dashboard-layout.e2e.spec.ts`
- New `src/hooks/__tests__/usePatientActivity.test.tsx`
- New focused dictation/activity/help tests as needed.

## Implementation Process

### Step 1: Baseline And Regression Harness

Agent assignment: `test-engineer`

Depends on: none.

Success criteria:

- Current `npm test`, `npm run lint`, `npm run build`, and `npx playwright test --list` status is recorded.
- Tests are added or updated to fail for the report's major risks before implementation where practical.
- Shared fixtures cover at least zero patients, filtered-empty state, three-patient roster, selected non-first patient, storage throwing, activity fetch failure, dictation denied, and dialog open/close focus return.

Subtasks:

- Extend `dashboardRegressionHarness.test.tsx` for selected-patient AI context, destructive confirmations, empty states, tooltips/help, sync loading, and dialog basics.
- Extend `DashboardLayoutContext.test.tsx` and `dashboardPrefs.test.ts` for throwing storage.
- Add `usePatientActivity` and `ActivityFeed` tests.
- Replace placeholder `ContextAwareHelp.test.tsx` with real open/close/content checks.
- Add dictation hook/button tests with mocked `navigator.mediaDevices.getUserMedia`.

Verification:

- Run focused new tests and document expected failures before implementation.

### Step 2: Safe Storage Foundation

Agent assignment: `executor`

Depends on: Step 1 storage tests.

Parallel with: Steps 3 and 6 after Step 1.

Success criteria:

- `createSafeStorage` catches access-time, read, write, and remove exceptions.
- Safe session storage is available.
- Highest-risk direct storage callsites use the adapter.
- Storage fallback does not mask corrupted JSON; defaults are used.

Subtasks:

- Update `src/utils/safeStorage.ts` with resilient local/session storage adapters and memory fallback.
- Migrate dashboard prefs, settings initialization, desktop utility menu, print state, layout designer, offline queue fallback, FHIR state, observability session, and theme/provider paths where feasible.
- Add a small nonfatal warning path only where the user benefits from knowing persistence is degraded.

Verification:

- Throwing storage tests pass.
- Dashboard and print preference tests still pass.

### Step 3: Patient Activity Error And Retry

Agent assignment: `executor`

Depends on: Step 1 activity tests.

Parallel with: Steps 2 and 6.

Success criteria:

- `usePatientActivity` exposes `error`, `retry`, `lastFetchedAt`, and loading state.
- `ActivityFeed` shows error, retry, preserved entries, and accessible status.
- Retry succeeds after an initial failure in tests.

Subtasks:

- Normalize Supabase errors into user-facing messages.
- Add bounded retry or retry helper without infinite loops.
- Preserve previous `activities` on refresh failure.
- Add retry button and status copy in `ActivityFeed`.

Verification:

- Hook and component tests cover loading, error, retry, empty, success, show-more, and preserved last-success state.

### Step 4: Dialog Accessibility Audit

Agent assignment: `accessibility auditor` plus `executor`

Depends on: Step 1 dialog tests.

Parallel with: Steps 2, 3, and 6, but coordinate shared dashboard files.

Success criteria:

- Targeted dialogs have useful `DialogDescription` or documented opt-out.
- `CommandDialog` and major feature dialogs have accessible names.
- Escape and close paths return focus.
- Radix warnings from the report are resolved in browser smoke.

Subtasks:

- Audit `DialogContent` and `AlertDialogContent` usages.
- Prioritize comparison, voice command, unified AI, command dialog, mobile import/autotext wrappers, patient toolbar customize, print/export, phrases, CSV/Epic/document import, timeline, and image lightbox.
- Add descriptions that explain what the dialog contains or what action is being confirmed.
- Add tests for title/description/focus return on representative dialogs.

Verification:

- Component tests query dialogs by role/name and check description text where appropriate.
- Manual keyboard pass opens/closes targeted dialogs.

### Step 5: AI Context And Destructive Action Safety

Agent assignment: `executor` plus `designer`

Depends on: Step 1 dashboard tests.

Parallel with: Step 4 only if file ownership is coordinated.

Success criteria:

- AI command palette receives the selected patient explicitly.
- AI suggestions/actions reflect selected patient.
- Patient-required and selection-required AI actions explain unavailable states.
- Remove, clear-all, clear-section, duplicate, and equivalent high-impact actions are confirmation-gated where product risk warrants.
- Confirmation copy names target and outcome.

Subtasks:

- Trace selected patient from `Index.tsx` through `DesktopDashboard` into `AICommandPalette`.
- Add disabled-state reasons and scope badges/copy for patient and selection-dependent AI actions.
- Verify desktop/mobile remove and clear flows.
- Decide and implement duplicate confirmation semantics for patient duplication.
- Add dashboard harness tests for non-first selected patient, no selected patient, cancel confirmation, and confirm mutation exactly once.

Verification:

- Selected-patient AI tests pass.
- Destructive action matrix passes on desktop and mobile.

### Step 6: Discoverability, Dictation, And Async Status

Agent assignment: `executor`

Depends on: Step 1 tests.

Parallel with: Steps 2 and 3; coordinate dashboard files with Steps 4 and 5.

Success criteria:

- Empty states explain recovery.
- Advanced controls have concise labels, tooltips, or visible helper copy.
- Dictation permission denial and recording/processing states are visible and announced.
- Sync retry, AI streaming, activity fetch, import parsing, and task generation expose loading/status semantics.

Subtasks:

- Improve zero-patient and filtered-empty states.
- Add or refine tooltips/help for Quick Actions, Duplicate, Customize, View modes, Generate/Summary, Import Document, Phrases, Autotexts, AI model selection, and security badges.
- Improve `ContextAwareHelp` content and tests.
- Add dictation permission preflight/denied states in cloud and local dictation paths.
- Add `aria-live`, `role=status`, or `aria-busy` to async operations where missing.

Verification:

- Help/tooltip/empty-state tests pass.
- Dictation denied and allowed-path tests pass where mocked.
- Manual browser permission check is documented.

### Step 7: Integrated Verification And Release Readiness

Agent assignment: `verifier`

Depends on: Steps 2-6.

Success criteria:

- Full local verification commands pass or gaps are explicitly documented.
- Browser smoke verifies the original report's critical and high-priority findings.
- No unrelated `.DS_Store` or `.understand-anything/` changes are staged.

Subtasks:

- Run `npm test`.
- Run `npm run lint`.
- Run `npm run build`.
- Run `npx playwright test --list`.
- Run available non-credential e2e smoke checks.
- Manually inspect storage-blocked, activity error/retry, selected-patient AI, dialog accessibility, destructive confirmations, dictation denied/allowed, sync loading, and empty states.
- Record credential-gated or browser-permission-gated checks.

Verification:

- Final report includes changed files, simplifications made, remaining risks, command evidence, and manual checks.

## Parallelization Plan

```text
Step 1 Baseline and Regression Harness
        |
        +--> Step 2 Safe Storage Foundation
        |
        +--> Step 3 Patient Activity Error/Retry
        |
        +--> Step 6 Dictation and Async Status
        |
        +--> Step 4 Dialog Accessibility
                  |
                  v
              Step 5 AI Context and Destructive Safety
        |
        v
Step 7 Integrated Verification
```

Maximum safe parallelization depth after Step 1: four lanes, with `DesktopDashboard.tsx`, `MobileDashboard.tsx`, and `dashboardRegressionHarness.test.tsx` coordinated by one owner at a time.

## Verification Rubrics

### Storage Fallback

Threshold: 4.0/5.0

- Exception coverage: 30%
- User safety and preserved usability: 25%
- Scope control: 20%
- Tests against real callsites: 25%

### Patient Activity

Threshold: 4.0/5.0

- Hook error contract: 25%
- ActivityFeed recovery UX: 25%
- Bounded retry discipline: 20%
- Tests across loading/error/retry/success/show-more: 30%

### Accessibility And Context

Threshold: 4.0/5.0

- Dialog semantics: 25%
- Keyboard/focus behavior: 20%
- AI/task/destructive target labels: 25%
- Status messages: 15%
- Automated and manual evidence: 15%

### Discoverability And Permission UX

Threshold: 3.8/5.0

- Empty-state quality: 20%
- Tooltip/help clarity: 20%
- Label consistency: 20%
- Dictation permission clarity: 20%
- Tests/manual evidence: 20%

## Quality Gates Summary

| Phase | Judge Score | Verdict |
| --- | ---: | --- |
| Phase 2a: Research | 4.1/5.0 | PASS |
| Phase 2b: Codebase Analysis | 4.2/5.0 | PASS |
| Phase 2c: Business Analysis | 4.1/5.0 | PASS |
| Phase 3: Architecture Synthesis | 4.0/5.0 | PASS |
| Phase 4: Decomposition | 4.1/5.0 | PASS |
| Phase 5: Parallelize | 4.0/5.0 | PASS |
| Phase 6: Verifications | 4.0/5.0 | PASS |

Threshold used: 3.5/5.0.

## Task Status Management

This task is ready for implementation from:

- `.specs/tasks/todo/harden-production-readiness-from-comprehensive-test-report.feature.md`

Move it to `in-progress/` when implementation begins and to `done/` after verification is complete.
