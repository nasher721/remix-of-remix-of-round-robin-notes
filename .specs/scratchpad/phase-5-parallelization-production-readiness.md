# Phase 5 Parallelization Scratchpad

## Execution Directive

Use a baseline-first, fan-out, merge-gated model.

1. No source edits begin until baseline tests and contracts are captured.
2. Storage, patient activity, dictation, and documentation/help tests can proceed in parallel after baseline.
3. Dialog accessibility and AI/action context share UI surfaces and should coordinate through one UI owner or sequence by file.
4. Final verification is a single merge gate that reads all outputs and runs the full available check set.

## Parallel Groups

| Group | Primary role | Depends on | Parallel with | Output |
| --- | --- | --- | --- | --- |
| A. Baseline tests | `test-engineer` | none | none | Current behavior locked and risk tests failing/pending |
| B. Storage hardening | `executor` | A | C, F | Safe storage adapter and migrated high-risk callsites |
| C. Activity errors | `executor` | A | B, F | Hook error/retry state and ActivityFeed recovery UI |
| D. Dialog accessibility | `accessibility auditor` + `executor` | A | B, C, F with file coordination | Dialog descriptions and focus-return checks |
| E. AI/action UX | `executor` + `designer` | A | B, C, F with file coordination | Selected-patient AI context, confirmations, task labels, help/tooltips |
| F. Dictation/status | `executor` | A | B, C | Permission states and async status semantics |
| G. Integrated verification | `verifier` | B-F | none | Test/build/e2e/manual evidence |

Maximum safe parallelization depth after Group A: 4 independent lanes, with dashboard UI files coordinated carefully.

## Shared File Coordination

- `src/components/dashboard/DesktopDashboard.tsx` is shared by AI context, empty states, sync status, tools, dialogs, and clear-all confirmation.
- `src/components/dashboard/MobileDashboard.tsx` is shared by mobile dialogs, clear-all confirmation, import/autotext wrappers, and e2e assertions.
- `src/components/PatientCard.tsx` is shared by destructive action and editor/task context.
- Test fixtures in `dashboardRegressionHarness.test.tsx` should be owned by one test lane to avoid churn.
