---
title: Refine post-login Rolling Rounds workspace UI
type: feature
status: done
depends_on: []
---

# Refine Post-Login Rolling Rounds Workspace UI

## Intent

Refine the authenticated Rolling Rounds workspace so it feels calmer, more clinical, and easier to scan during real rounding, without changing patient data behavior, auth flow, print/export behavior, AI actions, sync behavior, or mobile navigation. The improvement should preserve the current high-function surface while reducing visual competition between the header, tools panel, patient roster, patient editor, task rail, and empty state.

This is a visual and interaction refinement for the main UI after login. It is not a rewrite, not a new dashboard, and not a feature expansion.

## Current Architecture Snapshot

- `src/pages/Index.tsx` owns authenticated bootstrapping, patient data, filtering, selected-patient state, todo hydration, and the desktop/mobile dashboard split.
- `src/components/dashboard/DesktopDashboard.tsx` owns the desktop shell, sticky header, workspace metrics, utility menu, search/filter/sort controls, empty state, AI floating action button, print/export modal, comparison modal, phrase manager, command palette, clear-all dialog, and sync history.
- `src/components/dashboard/VirtualizedPatientList.tsx` owns the desktop roster/editor/tasks layout and the selected-patient card handoff.
- `src/components/dashboard/MobileDashboard.tsx` owns the mobile tab shell and patient list/detail flow.
- `src/index.css` already defines the neutral clinical palette, `Outfit`/`DM Sans` typography, compact radius scale, elevation tokens, and performance-conscious utility classes.
- `package.json` already includes the required UI stack: React, Vite, Tailwind v3, Radix, lucide-react, framer-motion, animejs, and Playwright. Do not add dependencies.

## Problems To Solve

1. The desktop header currently carries brand, nav, primary actions, roster metrics, sync status, trust/presence, keyboard help, theme, panel controls, user identity, and sign-out in one dense vertical block. This makes priority hard to parse even though each item is individually useful.
2. The utility panel sits directly under the sticky header and can feel like a second header. When expanded, it competes with the patient workspace instead of reading as a contextual drawer.
3. Search/filter/view/team actions/status copy are spread across several adjacent strips. There is duplication between top metrics, team actions, and list meta.
4. The main workspace is framed as one large card, and then its children add more bordered surfaces. The result is slightly boxed-in for a daily clinical app.
5. Empty states are useful but currently more promotional than operational; they should guide the next concrete action while staying sober and clinically credible.
6. There is at least one existing emoji-style placeholder in the desktop empty state path in `VirtualizedPatientList`. The UI plan should remove emoji and use existing icon/logo primitives.
7. Desktop roster rows are compact but under-informative for rounds; they should make bed/room, selected state, and open-task context easier to scan without widening the rail.
8. The task rail is valuable but reads generically; it should be visibly scoped to the selected patient and surface open-task count.
9. Mobile has a separate but related density issue: the patient tab header, sticky filter strip, and floating add action should stay fast and thumb-friendly while inheriting the same hierarchy rules.

## Design Direction

Use a restrained clinical command-surface aesthetic:

- Base: existing neutral background and card tokens from `src/index.css`.
- Accent: keep the existing desaturated clinical blue/teal primary; do not introduce purple/blue neon gradients.
- Typography: keep the current sans stack. Use weight, spacing, and tabular numbers for hierarchy rather than larger type.
- Density: daily app mode, not marketing mode and not cockpit overload.
- Containers: reduce nested card boxes. Prefer bands, separators, subtle background shifts, and negative space.
- Motion: keep current reduced-motion gates; use only lightweight opacity/transform transitions already present through framer-motion/anime helpers.
- Icons: use existing `lucide-react`; no new icon library and no emoji.

## Acceptance Criteria

1. Given a signed-in desktop user with patients, when the dashboard loads, the first viewport has a clear hierarchy: primary rounding action, roster status, search/filter controls, patient roster, patient editor, and task rail are visually distinct without redundant status strips.
2. Given a signed-in desktop user with no patients, when the dashboard loads, the empty state offers add, import, and sample-preview paths in a sober operational layout with no generic names and no emoji.
3. Given the Tools menu is closed, it occupies minimal visual space and does not read as a second dashboard header.
4. Given the Tools menu is open, resources/tools/settings remain discoverable, keyboard accessible, and do not close while nested Radix dialogs are open.
5. Given a user changes filter, sort, patient list view, panel collapse, focus mode, or roster layout, existing behavior and persistence continue to work.
6. Given a mobile user is on the patient tab, search, sort, filter, print, collapse-all, add-patient, and tab navigation remain reachable without horizontal overflow.
7. Given reduced motion is enabled, UI refinements do not run nonessential animation.
8. Given existing e2e tests run against the dashboard, test selectors are either preserved or replaced with stable `data-testid` selectors and updated tests.
9. Given a patient is selected in the desktop roster, the selected row exposes semantic state through `aria-current` or equivalent accessible state and includes a clear label.
10. No new runtime dependencies are added.

## In Scope

- Desktop post-login shell hierarchy in `DesktopDashboard`.
- Desktop utility panel presentation in `DesktopUtilityPanel`.
- Desktop roster/editor/tasks frame in `VirtualizedPatientList`.
- Empty/loading visual states for the authenticated workspace.
- Mobile patient tab polish in `MobileDashboard` only where needed to preserve design consistency.
- Stable test hooks for dashboard shell, controls, empty state, and panel collapse.
- Documentation of visual QA expectations.

## Out Of Scope

- Auth page and landing page redesign.
- Patient card clinical field redesign beyond container spacing and shell integration.
- New AI features, new import flows, new analytics, new settings, or new dependencies.
- Backend, Supabase, FHIR, edge functions, or sync logic changes.
- Replacing lucide with another icon set.

## Implementation Plan

## Completion Evidence

- Desktop workspace hierarchy refined across the header, tools drawer, control band, roster/editor/task workbench, empty state, and loading state without adding dependencies.
- Mobile patient-tab controls were tightened while preserving search, sort, filter, print, collapse, add-patient, and tab navigation reachability with 44px touch targets.
- Regression coverage was added for dashboard layout persistence, focus mode, panel collapse, patient roster layout state, active dashboard e2e selectors, authenticated dashboard controls, and auth-page assertions.
- Verification completed with `npm test`, `npm run lint`, `npm run build`, `npx playwright test --list`, no-credential `npm run test:e2e`, desktop/mobile visual smoke screenshots, and `git diff --check`.

### Phase 1: Lock Existing Behavior

Files:
- `src/e2e/dashboard-layout.e2e.spec.ts`
- `e2e/auth-dashboard.spec.ts`
- Optional focused unit tests around dashboard layout state if needed.

Tasks:
- Audit current e2e selectors and add stable `data-testid` hooks before visual refactor where selectors are brittle.
- Bring the dashboard layout e2e coverage into the active Playwright surface: either move/mirror `src/e2e/dashboard-layout.e2e.spec.ts` into `e2e/` or intentionally update Playwright config.
- Correct dashboard e2e routing from `/dashboard` to `/`, because authenticated users render the main dashboard from the index route.
- Replace test-only selectors that do not exist in app code with accessible role/name selectors or stable test ids added to real elements.
- Update `e2e/auth-dashboard.spec.ts` so post-login assertions match the actual print affordance text, such as `Print` or `Print / Export`, instead of stale "open print and export" copy.
- Cover these baseline flows: dashboard shell visible, search input reachable, filter menu opens, print/export button opens modal, utility panel opens/closes, collapse/expand panel controls work, focus mode still exits with Escape.
- Add or update `DashboardLayoutContext` tests for localStorage hydration/persistence, focus mode panel collapse/restore, ignored panel toggles during focus mode, Escape exit, and `setPatientRosterLayoutMode`.
- Keep auth-gated tests skipped unless `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` are present.

Success criteria:
- `npm test` passes before UI changes.
- `npx playwright test --list` shows the intended active dashboard specs.
- Non-credential e2e smoke checks remain runnable locally, and credential-gated checks are clearly skipped when credentials are absent.

### Phase 2: Recompose The Desktop Header

Primary file:
- `src/components/dashboard/DesktopDashboard.tsx`

Tasks:
- Collapse the current two-row header into a quieter app bar: brand, roster/sync summary, primary Add Patient button, print/export, utility/settings cluster.
- Move secondary nav links and keyboard hints out of the most visually prominent row.
- Convert the metric chip row into a compact status cluster with tabular numbers and fewer separators.
- Keep `TrustIndicators`, `PresenceIndicator`, `KeyboardShortcutHelp`, `TogglePanelsButton`, `ThemeToggle`, and sign-out reachable.
- Ensure the header remains sticky and does not consume more vertical space than today.

Success criteria:
- Add patient and print/export remain obvious.
- Sync state, task count, and roster count remain visible without duplicate copy.
- Header height is stable across common desktop widths.

### Phase 3: Turn Tools Into A Context Drawer

Primary file:
- `src/components/dashboard/DesktopDashboard.tsx`

Tasks:
- Refine `DesktopUtilityPanel` so closed state is a compact command row, not a framed mini-dashboard.
- Keep the existing localStorage persistence key unless there is a strong reason to migrate.
- Preserve click-outside and Radix dialog guard behavior.
- Keep resources, tools, and settings as tabbed sections, but simplify nested card borders and use separators/section labels instead.
- Retain current import, IBCC, guidelines, model settings, phrase, timeline, risk, analytics, lab, and batch components.

Success criteria:
- Closed tools panel is visually subordinate to the main workspace.
- Open tools panel feels intentionally attached to the workspace and does not obscure nested dialog flows.
- No feature disappears.

### Phase 4: Simplify Search, Filter, Team Actions, And List Meta

Primary file:
- `src/components/dashboard/DesktopDashboard.tsx`

Tasks:
- Combine search, filter/sort, view mode, and active filter chips into one coherent control band.
- Remove the separate "Team actions" strip by moving Compare, Print/Export, AI, and Sync into either the control band or utility drawer based on frequency.
- Keep disabled states and tooltips for Compare and Print/Export.
- Keep `LiveRegion` updates for search/filter result changes.
- Avoid long visible shortcut instructions inside the core workspace; keep shortcuts accessible through keyboard help.

Success criteria:
- The patient list header has one clear control area.
- There are fewer bordered strips before the patient content.
- Screen-reader status announcements still fire.

### Phase 5: Reframe The Main Workspace

Primary files:
- `src/components/dashboard/DesktopDashboard.tsx`
- `src/components/dashboard/VirtualizedPatientList.tsx`

Tasks:
- Reduce the outer "card inside page" feeling around the main workspace; prefer a full-width constrained work surface with subtle borders only where they communicate functional separation.
- Preserve sidebar/topbar roster modes.
- Refine active patient roster items with a clearer active state and less hover-induced layout shift.
- Make roster rows scan like a rounding list: emphasize bed/room or short location, then patient name, then MRN or secondary identifier.
- Add an open-task count badge to roster rows only if it can be derived cheaply from the existing `todosMap`.
- Add selected-state semantics to sidebar and topbar roster buttons.
- Scope the right task rail heading to the selected patient and include open-task count where available.
- Keep left/right collapsed rail affordances visible and keyboard reachable.
- Remove emoji placeholder from the empty `VirtualizedPatientList` path and use logo or lucide icon primitives.

Success criteria:
- Patient roster, selected patient, and task rail read as one cohesive workbench.
- Active patient is obvious in both sidebar and topbar modes.
- Roster and task rail provide useful clinical context without extra data fetches.
- Collapsed panel controls remain discoverable.

### Phase 6: Empty, Loading, Error, And Offline States

Primary files:
- `src/pages/Index.tsx`
- `src/components/dashboard/DesktopDashboard.tsx`
- `src/components/dashboard/VirtualizedPatientList.tsx`
- Existing offline/status components as needed.

Tasks:
- Replace generic sample patient copy with clinically credible but non-identifying example text, avoiding generic names.
- Keep empty state actions: Add first patient, import from CSV/EHR, sample preview.
- Convert loading state from spinner-first to layout-matching skeleton-first where practical, using existing skeleton components.
- Ensure offline/sync state remains visible without duplicating "synced" copy.

Success criteria:
- Empty workspace is useful, calm, and non-generic.
- Loading state previews the dashboard structure.
- No emoji in post-login UI code touched by this work.

### Phase 7: Mobile Consistency Pass

Primary file:
- `src/components/dashboard/MobileDashboard.tsx`

Tasks:
- Align mobile patient tab hierarchy with desktop: header summary, search, filter/sort/view controls, patient list, add action.
- Preserve existing bottom nav and patient detail flow.
- Ensure sticky filter strip does not collide with `MobileHeader` or bottom nav at narrow widths.
- Keep 44px minimum touch targets for primary controls.

Success criteria:
- No horizontal overflow at 375px width.
- Search/filter/sort/add/print/collapse remain reachable by touch.
- Mobile detail view behavior is unchanged.

### Phase 8: Visual QA And Regression Verification

Tasks:
- Run `npm test`.
- Run `npm run lint`.
- Run Playwright smoke tests that do not require credentials.
- If credentials are available, run login-to-dashboard and print/export e2e.
- Start the dev server and inspect desktop and mobile viewports.
- Capture or inspect at least these states: loading, no patients, patients with sidebar roster, topbar roster, utility drawer open, filter active, focus mode, right tasks rail collapsed, mobile patient list, mobile patient detail.
- Confirm the dashboard layout e2e specs are active under the configured Playwright `testDir`.

Success criteria:
- Tests pass or documented credential-gated tests are skipped.
- No obvious overlap, clipped text, or horizontal scroll on mobile.
- Reduced-motion behavior remains respected.
- Existing static imports in `App.tsx` are not changed.
- Radix `SelectItem` never receives an empty string value.

## Parallelization Plan

These workstreams can run in parallel after Phase 1:

- Shell and header refinement: `DesktopDashboard` header and status area.
- Utility drawer refinement: `DesktopUtilityPanel` inside `DesktopDashboard`.
- Workbench framing: `VirtualizedPatientList` roster/workbench surfaces.
- Verification updates: Playwright selectors and dashboard regression tests.

Dependencies:
- Phase 4 should follow Phase 2 because control placement depends on final header hierarchy.
- Phase 5 can start after stable test hooks exist.
- Phase 7 should wait until desktop hierarchy decisions are settled so mobile mirrors the same information priorities.
- Phase 8 runs after all UI changes.

## Risks And Mitigations

- Risk: Visual cleanup accidentally hides useful clinical actions.
  Mitigation: Inventory all current actions before edits and verify every action still has a reachable surface.

- Risk: Existing e2e tests rely on brittle selectors.
  Mitigation: Add stable test ids before visual restructuring and update tests in the same change.

- Risk: Header height or sticky bands reduce available patient editor space.
  Mitigation: Measure first viewport on 1366x768 and 1440x900; keep the workspace taller than today where possible.

- Risk: Tool drawer changes break nested Radix dialog flows.
  Mitigation: Preserve the existing click-outside guard and explicitly test import/dialog flows.

- Risk: Motion polish becomes distracting in a clinical app.
  Mitigation: Limit motion to opacity/transform and keep reduced-motion gates.

- Risk: Adding task counts to roster rows causes stale or expensive derived state.
  Mitigation: Derive from already-loaded `todosMap`, memoize aggregate counts if needed, and verify counts update after todo changes.

## Verification Rubric

Judge each implementation against:

1. Clinical hierarchy, weight 0.25: the main workspace prioritizes active rounding work over decoration.
2. Workflow preservation, weight 0.25: all existing desktop and mobile actions remain reachable and behave the same.
3. Visual polish, weight 0.20: spacing, borders, typography, and active states are cohesive and non-generic.
4. Accessibility, weight 0.15: keyboard focus, labels, live regions, reduced motion, and touch targets remain sound.
5. Regression safety, weight 0.15: tests, lint, and e2e smoke checks pass or credential skips are documented.

Target score: 4.0/5.0 before implementation is considered complete.

## Notes For Implementers

- Do not add dependencies. `framer-motion`, `animejs`, Radix, lucide, and Tailwind v3 are already present.
- Do not introduce purple/neon gradients, decorative orbs, emoji, generic placeholder names, or marketing-style hero sections.
- Keep changes incremental and reversible.
- Preserve user data behavior and all callback contracts from `Index.tsx`.
- Keep mobile and desktop in separate files unless a shared helper clearly reduces duplication without hiding behavior.
- If committing this work, use the repository Lore Commit Protocol from `AGENTS.md`.
