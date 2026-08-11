---
title: Implement Today's Round Focus-first runner
type: feature
status: done
depends_on: []
spec: docs/superpowers/specs/2026-08-11-todays-round-runner-design.md
---

# Implement Today's Round Focus-first Runner

## Intent

Redesign Round Robin Notes around a **Today’s Round** runner with a **Focus-first** shell so ICU clinicians can move bed-by-bed quickly on phone and workstation with one mental model. Mid-rounds core stays ruthless (roster, identity, clinical summary, systems compact stack, todos, next/prev/done). Secondary tools move behind `Tools •••`. Import Patient List and End-Round print/export stay first-class. Mid-rounds core must work offline with cross-device session continuity and explicit field conflicts.

Source of truth: `docs/superpowers/specs/2026-08-11-todays-round-runner-design.md`.

## Description

Replace the feature-dashboard chrome with a Round-scoped Focus-first experience:

- **Round** is the top-level session (list order, position, filters, done/skip, active section, expanded system).
- **Patient Focus** is the default screen on desktop and mobile; roster is an overlay.
- **Chart slice** in primary UI: identity, clinical summary (compact), systems (compact stack, one expanded), todos.
- **Tools Sheet** hosts demoted capabilities (AI, IBCC, guidelines, compare, risk, phrases admin, advanced settings, destructive admin).
- **Sync**: Round state + chart drafts via local cache/outbox + Supabase; conflict UI Mine/Theirs/merge for same-field divergence.

## Acceptance Criteria

1. Given a signed-in user, when a Round is active, Patient Focus is the default surface (not a persistent split megabar of utilities).
2. Given Patient Focus, when the user opens the roster (☰ / `R`), an overlay lists today’s patients with search; closing returns to the same patient without losing drafts.
3. Given systems review, when one system is expanded, expanding another collapses the prior (compact stack).
4. Given next/prev/done, the Round position updates and is restored when switching devices (or after reload once sync lands).
5. Given offline, the mid-rounds core remains editable; pending sync is visible; Tools requiring network are disabled or labeled.
6. Given the same field edited offline on two devices, conflict UI offers Mine / Theirs / merge (no silent drop).
7. Given Import Patient List and End-Round print/export, both remain first-class (not buried only in Tools).
8. Given demoted tools (AI, IBCC, guidelines, compare, etc.), they are reachable only via Tools ••• (or equivalent single secondary entry).
9. Given existing patient CRUD, systems save/load, auth, and import pipelines, behavior is preserved (entry points may move).
10. No new runtime dependencies unless required for Round persistence; prefer existing IndexedDB/offline and Supabase patterns.

## In Scope

- Round session model (client + persistence sketch/`round_state`)
- Focus-first UI: RoundHome, PatientFocus, RosterOverlay, RoundEnd, ToolsSheet
- Desktop + mobile shared mental model
- Compact systems stack interaction
- Offline outbox for mid-rounds core + conflict UI
- Demotion of utility megabar into Tools
- Tests for rounds path, device-hop/conflict, chrome rules, regression smoke

## Out Of Scope

- Cohort/spatial bed board home
- Dual Rounds vs Workbench modes
- Multi-user live cursors / ambient AI
- Rewriting import parsers or print engine internals
- Landing/auth marketing redesign

## Current Architecture Snapshot

- `src/pages/Index.tsx` — auth bootstrap, patients, desktop/mobile split
- `src/components/dashboard/DesktopDashboard.tsx` — dense desktop shell + utilities
- `src/components/dashboard/MobileDashboard.tsx` — mobile tabs
- `src/components/dashboard/PatientWorkspace.tsx` / `PatientCard.tsx` — chart editing
- `src/lib/offline/` — IndexedDB + sync engine patterns to extend
- `src/hooks/patients/` / `src/services/patientService.ts` — patient persistence to reuse
- Spec: `docs/superpowers/specs/2026-08-11-todays-round-runner-design.md`

## Implementation Process

### Step 1: Round domain model and session store [DONE]

**Expected Output:**
- `src/types/round.ts` — Round, RoundPatientRef, RoundSyncStatus types
- `src/lib/round/roundSessionStore.ts` — create/resume Round, select patient, next/prev/done, filters, expanded system, active section
- Unit tests for store transitions

**Success Criteria:**
- Store can create/resume a Round from a patient id list
- next/prev/done update index and done flags deterministically
- expanded system is single-id (expanding replaces prior)

#### Verification

**Level:** Single Judge  
**Artifact:** `src/types/round.ts`, `src/lib/round/roundSessionStore.ts`, related tests  
**Threshold:** 4.0/5.0  

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Type clarity | 0.25 | Types match design objects (Round, chart-relevant session fields) |
| Store correctness | 0.35 | Transitions for select/next/prev/done/expand are correct and tested |
| Continuity fields | 0.25 | Filters, index, section, expanded system represented |
| Code quality | 0.15 | Matches project TS conventions; no `any` |

---

### Step 2: Focus-first Patient Focus + Roster overlay (desktop) [DONE]

**Expected Output:**
- `src/components/round/PatientFocus.tsx`
- `src/components/round/RosterOverlay.tsx`
- `src/components/round/RoundChrome.tsx` — `Round · N/M`, offline cue slot, Tools entry, Done/Next
- Wire desktop entry from dashboard/Index to Round shell (strangler: can feature-flag or replace primary chrome)

**Success Criteria:**
- Default desktop surface is Patient Focus for active Round patient
- Roster overlay open/close preserves patient drafts in memory
- Systems compact stack: one expanded at a time
- Primary chrome has no IBCC/AI/compare megabar

#### Verification

**Level:** Panel of 2 Judges  
**Critical:** true  
**Artifact:** `src/components/round/*`, desktop wiring  
**Threshold:** 4.5/5.0  

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Focus-first IA | 0.30 | Patient Focus default; roster is overlay not permanent column |
| Mid-rounds core | 0.25 | Identity, summary, systems stack, todos, next/prev/done present |
| Chrome discipline | 0.25 | Demoted tools absent from primary chrome |
| A11y/keyboard | 0.20 | Overlay dismissible; next/prev/done operable by keyboard |

---

### Step 3: Mobile Focus-first parity [DONE]

**Expected Output:**
- Mobile Round shell using same Round store + Patient Focus / Roster overlay patterns
- Preserve scroll-reset on patient open; mount only active section
- Touch targets ≥ 44px for primary actions

**Success Criteria:**
- Same mental model as desktop (Round · N/M, overlay roster, Tools •••)
- next/prev/done work on touch
- Dark theme contrast remains readable for body text

#### Verification

**Level:** Single Judge  
**Artifact:** mobile round components / MobileDashboard wiring  
**Threshold:** 4.0/5.0  

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Mental model parity | 0.35 | Same Round objects and navigation semantics |
| Mobile UX prefs | 0.35 | Scroll reset, no stacked sections, touch targets |
| Chrome discipline | 0.30 | Tools demoted; Import/print still reachable appropriately |

---

### Step 4: ToolsSheet demotion + first-class Import / End Round [DONE]

**Expected Output:**
- `src/components/round/ToolsSheet.tsx` — mounts demoted panels
- `src/components/round/RoundHome.tsx` / `RoundEnd.tsx` — import first-class; print/export at end
- Move DesktopDashboard utility entry points behind Tools

**Success Criteria:**
- AI, IBCC, guidelines, compare, risk, phrases admin, advanced settings only via Tools
- Import Patient List first-class on Round Home (or equivalent start flow)
- Print/Export first-class on Round End

#### Verification

**Level:** Single Judge  
**Artifact:** ToolsSheet, RoundHome, RoundEnd, wiring  
**Threshold:** 4.0/5.0  

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Demotion completeness | 0.40 | Listed tools not in primary chrome |
| First-class actions | 0.35 | Import + End print remain obvious |
| Regression safety | 0.25 | Panels still open and function from Tools |

---

### Step 5: Offline outbox, sync, conflict UI [DONE]

**Expected Output:**
- Extend `src/lib/offline/` (or `src/lib/round/sync/`) for Round state + chart draft outbox
- Supabase persistence for round session state
- Conflict UI component for Mine/Theirs/merge on field divergence
- Quiet offline/syncing/conflict cues in RoundChrome

**Success Criteria:**
- Mid-rounds core editable offline; queue drains on reconnect
- Same-field offline divergence surfaces conflict UI (no silent drop)
- Position/expanded-system follow design conflict rules

#### Verification

**Level:** Panel of 2 Judges  
**Critical:** true  
**Artifact:** sync/outbox modules, conflict UI, tests  
**Threshold:** 4.5/5.0  

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Offline core | 0.30 | Core editable offline with pending visibility |
| Conflict correctness | 0.30 | Explicit Mine/Theirs/merge; no silent drop |
| Continuity bar D | 0.25 | Position, filters, drafts, expanded system sync |
| Safety | 0.15 | Retries; drafts not wiped on sync fail |

---

### Step 6: E2E and regression verification [DONE]

**Expected Output:**
- Playwright (or existing e2e harness) coverage for rounds path and Focus-first chrome rules
- Unit/integration tests for conflict + store
- Update selectors/`data-testid` as needed

**Success Criteria:**
- Import → walk ≥3 patients → next/prev/done → end print path covered (credential-gated OK)
- Roster overlay + Tools-not-in-primary-chrome assertions
- `npm test` and lint/build pass for touched areas

#### Verification

**Level:** Single Judge  
**Artifact:** e2e/unit tests, CI-local commands  
**Threshold:** 4.0/5.0  

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Rounds path | 0.35 | Core happy path covered |
| Continuity/conflict | 0.25 | Store/sync/conflict tests exist |
| Chrome rules | 0.20 | Tools demotion asserted |
| Stability | 0.20 | Tests pass; selectors stable |

## Definition of Done (Task Level)

- [X] All Implementation Process steps complete
- [X] Acceptance criteria 1–10 satisfied or explicitly waived with reason
- [X] Spec success criteria addressed (speed, device hop, offline, tools demotion)
- [X] `npm test` passes for new/updated tests
- [X] `npm run build` succeeds
- [X] No secrets committed; `.superpowers/` remains gitignored

### DoD verification notes (2026-08-11)

- Typecheck: `npm run typecheck` PASS after Round fixes (`PatientFocus.tsx`, `roundRemote.ts`).
- Round unit suite: 38/38 PASS (`roundSessionStore`, `conflictRules`, `outboxMerge`, `fieldConflictDialog`, `roundRunnerHarness`).
- Build: `npm run build` PASS (vite production).
- AC5 offline Tools: network tools labeled/disabled in `ToolsSheet` (`tools-offline-cue`, AI/batch course).
- Secrets: no Round-area secrets; `.superpowers/` ignored (`git status --ignored` shows `!! .superpowers/`).
- Spec success: Focus-first harness + conflict rules + sync engine cover speed chrome, device-hop rules, offline/conflict, tools demotion.
- No new runtime dependencies added for Round persistence (Dexie + Supabase reused).

## Risks

- `DesktopDashboard.tsx` / `PatientCard.tsx` size — prefer extract + strangler over big-bang rewrite
- Offline sync conflicts with existing offline queue — extend carefully; don’t break current sync
- Scope creep from Tools demotion — keep mounts, move triggers only
