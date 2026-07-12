# Phase 6 Verification Rubrics Scratchpad

## Verification Levels

- HIGH: storage fallback, patient activity error/retry, selected-patient AI context, dialog accessibility, destructive action confirmation.
- MEDIUM: empty states, tooltips/help, task workflow labels, dictation permission UI, loading/status indicators.
- LOW: copy standardization, view-mode documentation, security badge detail copy.

## Judge Rubrics

### Storage Fallback

Threshold: 4.0/5.0

- Exception coverage (0.30): get/set/remove/access-time errors covered for local and session storage.
- User safety (0.25): app preserves usable state and avoids blank dashboard.
- Scope control (0.20): high-risk callsites migrated without broad rewrite.
- Tests (0.25): throwing storage tests cover dashboard prefs and at least two real feature callsites.

### Patient Activity

Threshold: 4.0/5.0

- Error contract (0.25): hook exposes normalized error/retry/loading state.
- UI recovery (0.25): ActivityFeed shows useful error and retry without losing last successful entries.
- Retry discipline (0.20): retries are bounded and avoid non-recoverable loops.
- Tests (0.30): hook and component tests cover error, retry, loading, empty, success, and show-more behavior.

### Accessibility And Context

Threshold: 4.0/5.0

- Dialog semantics (0.25): targeted dialogs have accessible title and useful description or explicit justified opt-out.
- Keyboard/focus (0.20): focus order, trap, Escape, and focus return verified.
- AI/task/destructive labels (0.25): labels name the target patient/section/outcome where needed.
- Status messages (0.15): loading/error/processing states announce without moving focus.
- Tests/manual evidence (0.15): automated and manual checks cover desktop and mobile.

### UX Discoverability

Threshold: 3.8/5.0

- Empty states (0.20): no-result and no-patient states explain recovery actions.
- Tooltips/help (0.20): advanced controls have concise guidance without clutter.
- Label consistency (0.20): generate/summary/duplicate/customize/quick-actions labels are intentional.
- Dictation permission clarity (0.20): permission and denial paths are visible and actionable.
- Tests/manual evidence (0.20): coverage includes the most likely discovery failures.

## Required Commands

- `npm test`
- `npm run lint`
- `npm run build`
- `npx playwright test --list`
- Non-credential e2e smoke where available.
- Credential/microphone/storage/manual checks documented when not runnable locally.
