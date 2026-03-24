# Draft: Dashboard Layout Usability Improvements

## Requirements (confirmed)
- Make left patient list collapsible to free workspace.
- Main working editor area is too narrow; increase usable writing width.
- Default text in editor boxes is too large; reduce default text size.
- Clicking into text box should bring active editor into centered focus with larger working area.
- Systems review boxes should support combining into a single view and splitting back into separate views.
- Focus trigger confirmed: click-in autofocus.
- Right-side panel confirmed: also collapsible.
- Systems behavior confirmed: provide one combined editor for all systems + allow custom combine choices.
- Text size target confirmed: 11px baseline.

## Technical Decisions
- Prefer incremental enhancement over full layout rewrite.
- Reuse existing persisted-collapsible pattern already present in dashboard components.
- Implement an explicit editor "focus mode" (enter/exit) rather than silent auto-fullscreen, to avoid disorientation.
- Add systems-review layout mode state (`split` vs `combined`) with reversible toggle.
- Override prior focus-mode assumption: user requested click-in autofocus behavior.

## Research Findings
- Screenshot annotations indicate desktop dashboard layout pain points around horizontal density, editor focus, and systems grid flexibility.
- Existing memory indicates prior font-size unification work already touched Input/Textarea/ImagePasteEditor/MobilePatientDetail.
- Existing collapsible persistence pattern found in `src/components/dashboard/PatientNavigator.tsx` (localStorage + width toggle classes).
- Core editor content appears in `src/components/PatientCard.tsx` (Clinical Summary, Interval Events, Imaging).
- Systems card grid appears in `src/components/PatientSystemsReview.tsx`, currently responsive columns (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`).
- Desktop list/main layout orchestration appears in `src/components/dashboard/VirtualizedPatientList.tsx`.
- 2026 UI pattern references favor `react-resizable-panels` + shadcn/radix-style controlled collapsibles for this type of dashboard UX.

## Open Questions
- Should panel/focus/layout preferences persist across sessions (localStorage) or reset per session?
- Test strategy choice pending: TDD, tests-after, or no automated tests (agent-executed QA remains mandatory regardless).

## Scope Boundaries
- INCLUDE: Desktop dashboard layout, editor sizing behavior, systems review layout controls, typography defaults in note editors.
- EXCLUDE: Backend/API/database schema changes, authentication changes, non-dashboard mobile flows (unless user asks).
