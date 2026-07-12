# Phase 4 Decomposition Scratchpad

## Implementation Groups

1. Baseline and regression tests.
2. Storage fallback hardening.
3. Patient activity error and retry behavior.
4. Dialog accessibility audit.
5. AI context and destructive action safety.
6. Help, labels, empty states, task workflow, dictation, and loading status.
7. Integrated verification.

## Critical Path

Baseline tests must land first. Storage and activity lanes can then proceed in parallel. Dialog accessibility, AI/action context, and UX labels share dashboard and feature files, so they should coordinate through one UI owner. Final verification waits for all lanes.

## Major Risks

- Missing a storage direct callsite and leaving the original exception path.
- Accidentally hiding patient activity failures without giving the user recovery.
- Passing the wrong patient into AI after filters/search change selected state.
- Introducing inaccessible descriptions or focus traps while fixing Radix warnings.
- Creating noisy tooltip text or visible instructions that clutter the rounding surface.

## Done Criteria

- The final diff has tests for every critical and high-priority issue from the report.
- Storage-blocked and activity-failure scenarios are recoverable.
- Dialog warnings are resolved or intentionally documented per dialog.
- Selected-patient AI actions are explicit and tested.
- Destructive actions have parity across desktop and mobile.
- Verification commands and manual gaps are documented.
