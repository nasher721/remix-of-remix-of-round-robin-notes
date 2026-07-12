# Phase 3 Architecture Synthesis Scratchpad

## Solution Strategy

Use a baseline-first hardening strategy:

1. Add tests that reproduce the test-report risks.
2. Introduce small shared reliability primitives where repeated patterns exist.
3. Repair the highest-risk runtime paths.
4. Apply targeted accessibility/UX improvements to current components.
5. Verify with unit, component, e2e, browser-permission, blocked-storage, and manual production smoke checks.

## Key Decisions

- Keep the current app architecture and feature surfaces.
- Centralize storage safety without a broad state-management rewrite.
- Expose activity fetch errors through hook state instead of relying on `console.error`.
- Treat selected-patient AI context as clinical correctness, not only UX polish.
- Fix dialog accessibility at feature boundaries rather than hiding Radix warnings globally.
- Sequence shared dashboard-file edits to reduce conflict risk.

## Expected Implementation Lanes

- Lane A: Baseline tests and instrumentation.
- Lane B: Safe storage adapter and callsite migration.
- Lane C: Patient activity error/retry UI.
- Lane D: Dialog accessibility and focus-return audit.
- Lane E: AI context, destructive confirmations, task labels, and advanced feature discoverability.
- Lane F: Dictation permission and loading/status semantics.
- Lane G: Integrated verification and documentation.

## Tradeoffs

- A central storage adapter adds a small abstraction, but it reduces duplicated `try/catch` and supports both local and session storage.
- Retrying patient activity fetches helps transient failures, but retries must be bounded to avoid noise.
- Dialog-description work is easy to overdo. Descriptions should be brief and useful.
- Tooltips are useful for advanced controls, but required instructions must be visible or announced, not tooltip-only.
