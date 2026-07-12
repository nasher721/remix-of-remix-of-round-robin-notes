# Phase 2c Business Analysis Scratchpad

## Business Goal

Move Rolling Rounds from "feature-rich and mostly working" to "clinically safe enough for production hardening" by resolving the failure modes that can cause data persistence uncertainty, invisible activity failures, inaccessible dialogs, wrong-patient AI actions, accidental destructive actions, and unclear advanced workflows.

## Primary Users

- ICU clinicians documenting and reviewing multiple active patients during rounds.
- Clinicians using AI, dictation, phrases/autotexts, task generation, and print/export under time pressure.
- Keyboard and screen-reader users who need dialogs, buttons, loading states, and destructive actions to expose clear names and state.

## User Scenarios

1. A clinician opens the app in a browser context where storage is blocked and can still round without a crash.
2. A clinician opens the activity feed while the patient activity query fails and sees a retry path rather than only a console error.
3. A screen-reader user opens comparison, print/export, AI, import, phrases, and settings dialogs and hears useful title/description context.
4. A clinician selects a non-first patient and opens AI; AI suggestions and generated content target the selected patient.
5. A clinician attempts removal, clear-all, or duplicate actions and gets a specific confirmation naming the target and outcome.
6. A clinician uses dictation with microphone permission denied and sees recovery instructions.
7. A new user filters to no results or opens advanced tools and sees concise, actionable guidance.

## Scope Boundaries

In scope:

- Reliability hardening around storage and patient activity.
- Accessibility and discoverability improvements in existing UI.
- Tests and manual verification for the report findings.
- No new dependencies.

Out of scope:

- Redesigning the dashboard.
- Adding new clinical features.
- Replacing Supabase, TanStack Query, Radix, or the print/export stack.
- Reworking the AI provider architecture.
- Production deployment.

## Acceptance Criteria Themes

- No console-only critical failures for storage/activity paths.
- User-visible recovery for failed async operations.
- Programmatic title/description for dialogs.
- Explicit selected-patient and selected-text requirements for AI actions.
- Confirmation before destructive actions and product-approved duplicate behavior.
- Clear empty states, labels, tooltips, and status messages.
- Automated tests cover the highest-risk regressions.
