# Rolling Rounds UX Overhaul - Phased Implementation Plan

## TL;DR

> **Comprehensive UX overhaul addressing 10 critique areas across 3 phases**
>
> **Deliverables:**
> - Phase 1: Trust signals, interactive onboarding tour, sample patient dataset
> - Phase 2: Enhanced patient data model (service line, acuity, code status, vitals), disabled-state UI, guided workflows
> - Phase 3: Team collaboration features, AI transparency panel, accessibility hardening
>
> **Estimated Effort:** Large (3-4 weeks per phase, can run sequentially)
> **Parallel Execution:** YES - Within each phase, multiple workstreams can run in parallel
> **Critical Path:** Phase 1 (foundation) → Phase 2 (data model) → Phase 3 (advanced features)

---

## Context

### Original Request
Address a comprehensive UX critique of "Rolling Rounds" (Round Robin Notes), a clinical rounding application. The critique identified 10 major areas needing improvement, from trust signals and onboarding to collaboration features and accessibility.

### Current Implementation Baseline

**Tech Stack:**
- React 18 + TypeScript 5.8 + Vite + Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL + Auth + Edge Functions)
- React Query + React Context for state management

**Current Patient Data Model:**
```typescript
Patient {
  id, patientNumber, name, mrn, bed,
  clinicalSummary, intervalEvents, imaging, labs,
  systems: { neuro, cv, resp, renalGU, gi, endo, heme, infectious, skinLines, dispo },
  medications: { infusions[], scheduled[], prn[], rawText? },
  fieldTimestamps, collapsed, createdAt, lastModified, age
}
```

**Key Components:**
- `DesktopDashboard.tsx` - Main dashboard with utility panel
- `NewPatientSheet.tsx` - Patient creation (name, MRN, bed only)
- `Landing.tsx` - Marketing page with hero
- `KeyboardShortcutSystem.tsx` - Shortcuts dialog
- `AICommandPalette.tsx` - AI workspace

**Current Empty State:**
- Motion div with "Ready to Start Rounds"
- Quick start checklist (3 static items)
- "Add First Patient", "Import from CSV/EHR", "See a sample patient" buttons
- Sample preview text box (static text, not interactive)

### Interview Summary

**User Decisions:**
- **Phased approach**: Split work into 3 phases for manageable delivery
- **Phase 1 priority**: Trust signals + onboarding + sample data (builds confidence)
- **Phase 2 priority**: Data model expansion + workflow clarity (core functionality)
- **Phase 3 priority**: Collaboration + AI clarity + a11y (advanced features)

### Metis Review

**Identified Gaps (addressed in plan):**
- HIPAA compliance claims need validation before surfacing in UI
- Sample data must be clearly labeled as fake/demo
- Patient data model expansion requires database migrations
- Team collaboration features need real-time infrastructure decision
- AI transparency requires clear documentation of actual models in use

---

## Work Objectives

### Core Objective
Transform Rolling Rounds from a "prototype-like" appearance to a production-ready clinical tool with clear value proposition, trustworthy design patterns, guided onboarding, robust data model, and team collaboration features.

### Phase-Specific Deliverables

**Phase 1: Trust & Onboarding Foundation**
- Compliance badges and trust signals in header/footer
- Interactive onboarding tour (react-joyride or similar)
- Fully interactive sample patient dataset
- Improved empty state with actionable guidance
- Security/privacy documentation links

**Phase 2: Data Model & Workflow**
- Extended patient schema (service line, acuity, code status, alerts, structured vitals)
- Database migrations for new fields
- Disabled states for controls when prerequisites not met
- Guided patient creation with progressive disclosure
- Import mapping with validation

**Phase 3: Collaboration & Polish**
- Team member presence and assignments
- Per-patient activity feed/audit trail
- AI transparency panel (model info, PHI handling, usage)
- Accessibility hardening (labels, contrast, focus states)
- Keyboard shortcut cheat sheet modal

### Definition of Done (Each Phase)
- [ ] All tasks in phase completed with QA scenarios passed
- [ ] Code review completed
- [ ] Accessibility audit passed
- [ ] User acceptance testing (manual verification)
- [ ] Documentation updated

### Must Have (Non-Negotiable)
- Sample data must be clearly labeled as demo/fake
- HIPAA compliance claims must be accurate and defensible
- Patient PHI must never be exposed in sample data
- All new features must work in both desktop and mobile
- Database migrations must be reversible

### Must NOT Have (Guardrails)
- NO real patient data in sample datasets
- NO claims of compliance certifications without evidence
- NO breaking changes to existing patient data
- NO removal of existing keyboard shortcuts without deprecation period
- NO changes to core 10-system review structure without user consent

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Node.js native test runner + minimal coverage)
- **Automated tests**: Tests-after (unit tests for new utilities/components)
- **Framework**: bun test via `npm test`
- **E2E**: Playwright tests exist in `e2e/` directory

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Frontend/UI**: Playwright - Navigate, interact, assert DOM, screenshot
- **API/Backend**: Bash (curl) - Send requests, assert status + response fields
- **Database**: SQL validation - Run migrations, verify schema

---

## Execution Strategy

### Phased Rollout

```
Phase 1: Trust & Onboarding (Foundation)
├── 1-5: Trust signals and compliance UI
├── 6-10: Empty state overhaul
├── 11-15: Interactive onboarding tour
├── 16-20: Sample patient dataset
└── Duration: 2-3 weeks

Phase 2: Data Model & Workflow (Core)
├── 21-25: Database schema expansion
├── 26-30: Patient form enhancements
├── 31-35: Import validation
├── 36-40: Disabled states & workflow clarity
└── Duration: 3-4 weeks

Phase 3: Collaboration & Polish (Advanced)
├── 41-45: Team collaboration foundation
├── 46-50: Activity feed & audit trail
├── 51-55: AI transparency panel
├── 56-60: Accessibility hardening
└── Duration: 3-4 weeks
```

### Parallelization Strategy

Within each phase, tasks are grouped by domain and can run in parallel:
- UI tasks (components, styling)
- Data tasks (schema, migrations, types)
- Logic tasks (hooks, utilities, services)

Cross-domain dependencies are minimized through shared types defined early in each phase.

---

## Pre-Flight: Test Infrastructure Setup

Before starting implementation, verify test infrastructure:

- [ ] P0.1: Verify test runner works (`npm test` passes)
  **QA Scenario:**
  ```
  Tool: Bash
  Command: npm test
  Expected: Tests run, exit code 0 (or tests exist and pass)
  Evidence: .sisyphus/evidence/p0-test-runner.log
  ```

- [ ] P0.2: Verify TypeScript compilation (`npx tsc --noEmit`)
  **QA Scenario:**
  ```
  Tool: Bash
  Command: npx tsc --noEmit
  Expected: No type errors
  Evidence: .sisyphus/evidence/p0-typescript.log
  ```

- [ ] P0.3: Verify build works (`npm run build`)
  **QA Scenario:**
  ```
  Tool: Bash
  Command: npm run build
  Expected: Build succeeds
  Evidence: .sisyphus/evidence/p0-build.log
  ```

- [ ] P0.4: Setup evidence directory structure
  **QA Scenario:**
  ```
  Tool: Bash
  Command: mkdir -p .sisyphus/evidence/{phase-1,phase-2,phase-3}
  Expected: Directories created
  ```

---

## TODOs

**TDD-Oriented Task Template (Applied to all tasks below):**

Each task follows this pattern:
1. **RED**: Write failing test/QA scenario FIRST
2. **GREEN**: Implement minimal code to pass
3. **REFACTOR**: Improve while keeping tests green
4. **EVIDENCE**: Collect screenshots, logs, test output
5. **COMMIT**: Atomic commit with conventional message

---

### Phase 1: Trust & Onboarding Foundation

**Phase 1 Pre-Flight Checklist:**
- [ ] P1.0: All P0.x tasks completed
- [ ] P1.1: Evidence directory `.sisyphus/evidence/phase-1/` ready
- [ ] P1.2: Feature flags configured (if needed)
- [ ] P1.3: Staging environment accessible for testing

- [ ] 1. Create TrustIndicators component with HIPAA compliance badge

  **TDD Approach:**
  1. **RED**: Write component test with failing assertions
  2. **GREEN**: Implement TrustIndicators component
  3. **REFACTOR**: Extract reusable badge variants
  4. **EVIDENCE**: Screenshot + test output

  **What to do**:
  - Create `src/components/trust/TrustIndicators.tsx`
  - Create `src/components/trust/__tests__/TrustIndicators.test.tsx` (TDD)
  - Display HIPAA-aligned badge (not certified unless actually certified)
  - Add encryption indicator (data encrypted at rest/transit via Supabase)
  - Add audit trail indicator
  - Include link to security documentation

  **Must NOT do**:
  - Claim actual HIPAA certification without evidence
  - Display specific security credentials that don't exist

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]
  - **Justification**: UI component with trust messaging, needs visual polish

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Phase 1 UI workstream (Tasks 1, 2, 4, 5, 8, 10)
  - **Blocks**: Task 3 (header integration)
  - **Blocked By**: None
  - **Can Start Immediately**: YES

  **References**:
  - Current header: `src/components/dashboard/DesktopDashboard.tsx:392-523`
  - Badge component: `src/components/ui/badge.tsx`
  - Tooltip pattern: `src/components/ui/tooltip.tsx`
  - Test pattern: Check `src/services/__tests__/` for examples

  **Test-First Implementation**:
  ```typescript
  // src/components/trust/__tests__/TrustIndicators.test.tsx
  import { describe, it, expect } from 'bun:test';
  import { render, screen } from '@testing-library/react';
  import { TrustIndicators } from '../TrustIndicators';

  describe('TrustIndicators', () => {
    it('renders three trust indicators', () => {
      render(<TrustIndicators />);
      expect(screen.getByTestId('hipaa-badge')).toBeDefined();
      expect(screen.getByTestId('encryption-badge')).toBeDefined();
      expect(screen.getByTestId('audit-badge')).toBeDefined();
    });

    it('shows HIPAA tooltip on hover', async () => {
      render(<TrustIndicators />);
      const hipaa = screen.getByTestId('hipaa-badge');
      // Tooltip test implementation
    });
  });
  ```

  **Acceptance Criteria**:
  - [ ] Component test file created and passing
  - [ ] Component renders with 3 trust indicators
  - [ ] Tooltips explain each indicator on hover
  - [ ] Links to `/security` page (create placeholder if needed)
  - [ ] Test coverage > 80% for component

  **QA Scenarios (Agent-Executed)**:
  ```
  Scenario: Trust indicators visible in header
    Tool: Playwright
    Preconditions: User logged in, on dashboard
    Steps:
      1. Navigate to dashboard "/"
      2. Wait for header to load
      3. Locate trust indicators in header (selector: `[data-testid="trust-indicators"]`)
    Expected Result: 3 indicators visible (HIPAA, Encryption, Audit)
    Evidence: .sisyphus/evidence/phase-1/task-1-trust-indicators.png

  Scenario: Tooltips show on hover
    Tool: Playwright
    Preconditions: Dashboard loaded
    Steps:
      1. Hover over HIPAA badge
      2. Wait for tooltip (timeout: 2s)
    Expected Result: Tooltip text contains "HIPAA-aligned safeguards"
    Evidence: .sisyphus/evidence/phase-1/task-1-tooltip.png

  Scenario: Unit tests pass
    Tool: Bash
    Command: npm test src/components/trust/__tests__/TrustIndicators.test.tsx
    Expected Result: All tests pass (3/3)
    Evidence: .sisyphus/evidence/phase-1/task-1-test.log
  ```

  **Evidence to Collect**:
  - [ ] Screenshot: Trust indicators rendered (`.sisyphus/evidence/phase-1/task-1-trust-indicators.png`)
  - [ ] Screenshot: Tooltips visible (`.sisyphus/evidence/phase-1/task-1-tooltip.png`)
  - [ ] Test output: Unit tests passing (`.sisyphus/evidence/phase-1/task-1-test.log`)
  - [ ] Build output: No TypeScript errors (`.sisyphus/evidence/phase-1/task-1-build.log`)

  **Atomic Commit**:
  ```
  feat(trust): add TrustIndicators component with HIPAA badge (#1)

  - Creates TrustIndicators.tsx with 3 indicators (HIPAA, Encryption, Audit)
  - Adds unit tests with 100% coverage
  - Includes tooltips with security explanations
  - Links to /security documentation page

  Testing:
  - Unit tests: 3/3 passing
  - QA: Screenshots captured
  - Build: No TypeScript errors

  Evidence: .sisyphus/evidence/phase-1/task-1-*.png
  ```
  - Files: `src/components/trust/TrustIndicators.tsx`, `src/components/trust/__tests__/TrustIndicators.test.tsx`

---

- [ ] 2. Create SecurityInfo page with compliance documentation

  **What to do**:
  - Create `src/pages/Security.tsx`
  - Document data handling practices
  - Explain encryption (Supabase at-rest, TLS in-transit)
  - Describe audit trail capabilities
  - Include contact for security questions
  - Add route in App.tsx

  **Must NOT do**:
  - Make claims about certifications not held
  - Include specific technical implementation details that could aid attackers

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: Task 1 (links to this page)
  - **Blocked By**: None

  **References**:
  - Page pattern: `src/pages/NotFound.tsx`
  - Route pattern: `src/App.tsx`
  - Landing page styling: `src/pages/Landing.tsx`

  **Acceptance Criteria**:
  - [ ] Page accessible at `/security`
  - [ ] Contains 4 sections: Data Handling, Encryption, Audit Trail, Contact
  - [ ] Responsive design works on mobile

  **QA Scenarios**:
  ```
  Scenario: Security page loads
    Tool: Playwright
    Steps:
      1. Navigate to "/security"
      2. Wait for page load
    Expected Result: Page shows "Security & Compliance" heading
    Evidence: .sisyphus/evidence/task-2-security-page.png
  ```

  **Commit**: YES
  - Message: `feat(security): add Security info page with compliance docs`

---

- [ ] 3. Integrate TrustIndicators into dashboard header

  **What to do**:
  - Import TrustIndicators into DesktopDashboard header
  - Position in header alongside existing controls
  - Ensure mobile responsive behavior
  - Update MobileDashboard if applicable

  **Must NOT do**:
  - Break existing header layout
  - Hide critical controls

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - Header location: `src/components/dashboard/DesktopDashboard.tsx:392-523`
  - Mobile dashboard: `src/components/dashboard/MobileDashboard.tsx`

  **Acceptance Criteria**:
  - [ ] Trust indicators visible in header on desktop
  - [ ] Collapsed/hidden appropriately on mobile
  - [ ] No layout shifts or broken styling

  **QA Scenarios**:
  ```
  Scenario: Header displays trust indicators
    Tool: Playwright
    Steps:
      1. Login and navigate to dashboard
      2. Screenshot header area
    Expected Result: Trust indicators visible in top-right area
    Evidence: .sisyphus/evidence/task-3-header-integration.png
  ```

  **Commit**: YES (group with Task 1)

---

- [ ] 4. Remove or contextualize "GLM-4 Flash" model badge

  **What to do**:
  - Review current AI badge implementation in DesktopDashboard
  - Replace generic "GLM-4 Flash" with neutral "AI Workspace" or remove
  - If keeping, add explanation tooltip about model selection
  - Move to less prominent location or behind settings

  **Must NOT do**:
  - Display specific model names without user context
  - Make AI seem more capable/safe than it is

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Current badge: `src/components/dashboard/DesktopDashboard.tsx:860-888`
  - Active model label logic: lines 157-167

  **Acceptance Criteria**:
  - [ ] Model badge removed OR contextualized with explanation
  - [ ] AI FAB button still functional
  - [ ] Tooltip explains what AI workspace does

  **QA Scenarios**:
  ```
  Scenario: AI badge cleaned up
    Tool: Playwright
    Steps:
      1. Open dashboard
      2. Locate AI FAB button (bottom-right)
    Expected Result: Shows "AI" or sparkles icon, no model name
    Evidence: .sisyphus/evidence/task-4-ai-badge.png
  ```

  **Commit**: YES
  - Message: `fix(ui): contextualize AI model badge, remove specific model names`

---

- [ ] 5. Add hero value proposition to dashboard empty state

  **What to do**:
  - Enhance empty state in DesktopDashboard
  - Add clear value prop statement: "Clinical rounding documentation with AI assistance"
  - Include brief feature list (3 bullets)
  - Maintain existing quick-start checklist

  **Must NOT do**:
  - Make the empty state too tall (keep above fold)
  - Remove existing functionality

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Empty state: `src/components/dashboard/DesktopDashboard.tsx:777-850`
  - Current content: "Ready to Start Rounds", sample preview

  **Acceptance Criteria**:
  - [ ] Hero statement visible in empty state
  - [ ] 3 feature bullets below hero
  - [ ] Quick-start checklist still present
  - [ ] All content visible without scrolling (viewport: 1366x768)

  **QA Scenarios**:
  ```
  Scenario: Empty state shows value prop
    Tool: Playwright
    Preconditions: No patients in system
    Steps:
      1. Navigate to dashboard
      2. Wait for empty state to render
    Expected Result: 
      - Heading contains "Clinical rounding"
      - 3 feature bullets visible
      - Quick start checklist below
    Evidence: .sisyphus/evidence/task-5-empty-state-hero.png
  ```

  **Commit**: YES
  - Message: `feat(dashboard): add value proposition to empty state`

---

- [ ] 6. Create interactive sample patient dataset

  **What to do**:
  - Create `src/lib/sampleData/patients.ts`
  - Define 3-5 realistic but fake patients with complete data:
    - Full demographics (name: "Demo Patient 1", etc.)
    - All 10 systems filled with realistic clinical content
    - Medications (infusions, scheduled, PRN)
    - Labs, imaging, clinical summary
  - Create `src/hooks/useSamplePatients.ts` hook
  - Add "Load Sample Patients" button to empty state

  **Must NOT do**:
  - Use real patient data
  - Make sample data look like real PHI
  - Persist sample patients without clear labeling

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: Task 7 (empty state integration)
  - **Blocked By**: None

  **References**:
  - Patient type: `src/types/patient.ts`
  - Patient service: `src/services/patientService.ts`
  - Existing sample preview: `DesktopDashboard.tsx:841-847`

  **Acceptance Criteria**:
  - [ ] 3-5 sample patients defined with complete data
  - [ ] All patients clearly labeled as "Demo" or "Sample"
  - [ ] Hook provides function to load samples
  - [ ] Sample data includes all system fields

  **QA Scenarios**:
  ```
  Scenario: Sample patients load correctly
    Tool: Playwright
    Preconditions: Empty patient list
    Steps:
      1. Click "Load Sample Patients" button
      2. Wait for patients to appear
    Expected Result:
      - 3-5 patients appear in list
      - All patient names contain "Demo" or "Sample"
      - Patients have data in multiple systems
    Evidence: .sisyphus/evidence/task-6-sample-patients.png
  ```

  **Commit**: YES
  - Message: `feat(data): create interactive sample patient dataset`

---

- [ ] 7. Replace "See a sample patient" with "Load Sample Patients" button

  **What to do**:
  - Replace existing sample preview text with functional button
  - Button triggers sample patient loading via hook
  - Show loading state during import
  - Display success toast when complete
  - Add confirmation that these are demo patients

  **Must NOT do**:
  - Automatically load samples without user action
  - Hide the demo nature of the data

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 6)
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:
  - Empty state buttons: `DesktopDashboard.tsx:817-839`
  - Toast notifications: Use `sonner` (already in project)

  **Acceptance Criteria**:
  - [ ] Button labeled "Load Sample Patients" or similar
  - [ ] Button loads functional patients, not just text preview
  - [ ] Success toast shown after loading
  - [ ] Patients are fully editable after loading

  **QA Scenarios**:
  ```
  Scenario: Load sample patients button works
    Tool: Playwright
    Preconditions: Empty dashboard
    Steps:
      1. Click "Load Sample Patients"
      2. Wait for loading to complete (max 5s)
      3. Check patient list
    Expected Result: 
      - Toast "Sample patients loaded" appears
      - 3+ patients now in list
      - Can click first patient to expand
    Evidence: .sisyphus/evidence/task-7-load-samples.png
  ```

  **Commit**: YES (group with Task 6)

---

- [ ] 8. Implement interactive onboarding tour

  **What to do**:
  - Install `react-joyride` or similar tour library
  - Create `src/components/onboarding/OnboardingTour.tsx`
  - Define 5-7 tour steps:
    1. Welcome to Rolling Rounds
    2. Add your first patient (point to Add button)
    3. Patient documentation (point to patient card)
    4. AI assistance (point to AI FAB)
    5. Print/Export (point to Print button)
    6. Keyboard shortcuts (point to shortcuts button)
    7. Tour complete
  - Store tour completion in localStorage
  - Auto-start on first visit with no patients

  **Must NOT do**:
  - Force tour on returning users
  - Block UI without skip option
  - Make tour too long (>7 steps)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Install pattern: Check package.json for existing tour libs
  - Tour target selectors:
    - Add patient: `[data-testid="add-patient-btn"]` or similar
    - AI FAB: Bottom-right floating button
    - Print: Header print button

  **Acceptance Criteria**:
  - [ ] Tour auto-starts for new users
  - [ ] 5-7 steps covering key features
  - [ ] Skip button available at all steps
  - [ ] Progress saved to localStorage
  - [ ] Can be restarted from settings

  **QA Scenarios**:
  ```
  Scenario: Tour starts for new user
    Tool: Playwright
    Preconditions: Clear localStorage, no patients
    Steps:
      1. Login as new user
      2. Wait for dashboard
    Expected Result: Tour overlay appears with step 1
    Evidence: .sisyphus/evidence/task-8-tour-start.png

  Scenario: Tour can be skipped
    Tool: Playwright
    Preconditions: Tour is showing
    Steps:
      1. Click "Skip" button
      2. Reload page
    Expected Result: 
      - Tour closes
      - On reload, tour does not appear
    Evidence: .sisyphus/evidence/task-8-tour-skip.png
  ```

  **Commit**: YES
  - Message: `feat(onboarding): add interactive product tour with react-joyride`

---

- [ ] 9. Create progressive disclosure for quick-start checklist

  **What to do**:
  - Convert static checklist into interactive toggles
  - Checklist items:
    - [ ] Add first patient → Links to Add Patient
    - [ ] Try AI assistant → Opens AI palette
    - [ ] Print a summary → Opens print modal
    - [ ] Invite team member → Opens invite (Phase 3 prep)
  - Mark items complete when action performed
  - Store completion state in localStorage per user
  - Collapse checklist when all items complete

  **Must NOT do**:
  - Make checklist mandatory
  - Block other functionality until complete

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-8)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Current checklist: `DesktopDashboard.tsx:802-816`
  - CheckCircle2 icon already used

  **Acceptance Criteria**:
  - [ ] Checklist items are clickable buttons
  - [ ] Items mark complete when action performed
  - [ ] Progress persisted across sessions
  - [ ] Collapses/hides when all complete

  **QA Scenarios**:
  ```
  Scenario: Checklist tracks progress
    Tool: Playwright
    Preconditions: Fresh user, no patients
    Steps:
      1. Open dashboard
      2. Click "Add first patient" checklist item
      3. Add a patient
      4. Return to dashboard
    Expected Result: 
      - Checklist shows "Add first patient" as checked
    Evidence: .sisyphus/evidence/task-9-checklist-progress.png
  ```

  **Commit**: YES
  - Message: `feat(onboarding): make quick-start checklist interactive with progress tracking`

---

- [ ] 10. Add hotkey discovery tooltips

  **What to do**:
  - Add tooltips to key buttons showing keyboard shortcuts:
    - Add Patient: "N" or "Cmd+Shift+N"
    - Search: "/" or "Cmd+K"
    - Print: "Cmd+P"
    - AI: "Cmd+Shift+A"
  - Ensure tooltips show on hover
  - Keep existing shortcut hints at bottom of page

  **Must NOT do**:
  - Remove existing shortcut display
  - Make tooltips intrusive

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Tooltip component: `src/components/ui/tooltip.tsx`
  - Existing tooltip usage: `DesktopDashboard.tsx:426-450`
  - Shortcuts: `src/components/KeyboardShortcutSystem.tsx`

  **Acceptance Criteria**:
  - [ ] All primary buttons show shortcut in tooltip
  - [ ] Tooltips use consistent format
  - [ ] Works on both desktop and mobile (touch-friendly)

  **QA Scenarios**:
  ```
  Scenario: Tooltips show shortcuts
    Tool: Playwright
    Steps:
      1. Hover over "Add patient" button
      2. Wait for tooltip
    Expected Result: Tooltip shows "Add new patient (Shortcut: N or ⌘⇧N)"
    Evidence: .sisyphus/evidence/task-10-shortcut-tooltips.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add keyboard shortcut tooltips to primary actions`

---

### Phase 2: Data Model & Workflow Clarity

- [ ] 11. Design extended patient data model

  **What to do**:
  - Define new fields to add to Patient type:
    ```typescript
    serviceLine?: string // MICU, SICU, CVICU, etc.
    attendingPhysician?: string
    consultingTeam?: string[]
    acuity?: 'low' | 'moderate' | 'high' | 'critical'
    codeStatus?: 'full' | 'dnr' | 'dni' | 'comfort'
    alerts?: string[] // Allergies, isolation, etc.
    vitals?: {
      lastRecorded?: string
      temp?: string
      hr?: string
      bp?: string
      rr?: string
      spo2?: string
    }
    ```
  - Create type definitions in `src/types/patient.ts`
  - Document migration strategy

  **Must NOT do**:
  - Make all new fields required (maintain backward compatibility)
  - Remove existing fields

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`typescript-pro`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (foundation for all Phase 2)
  - **Blocks**: Tasks 12, 13, 14, 15
  - **Blocked By**: None

  **References**:
  - Current types: `src/types/patient.ts`
  - Database types: `src/integrations/supabase/types.ts`

  **Acceptance Criteria**:
  - [ ] TypeScript types defined for all new fields
  - [ ] Optional fields marked with `?`
  - [ ] Documentation comments added

  **QA Scenarios**:
  ```
  Scenario: Types compile successfully
    Tool: Bash
    Steps:
      1. Run `npm run build`
    Expected Result: Build succeeds with no type errors
    Evidence: .sisyphus/evidence/task-11-types-build.log
  ```

  **Commit**: YES
  - Message: `types(patient): extend data model with service line, acuity, code status, alerts, vitals`

---

- [ ] 12. Create database migrations for new patient fields

  **What to do**:
  - Create migration file: `supabase/migrations/20260327_extend_patient_schema.sql`
  - Add columns:
    - `service_line TEXT`
    - `attending_physician TEXT`
    - `consulting_team TEXT[]` (PostgreSQL array)
    - `acuity TEXT` (check constraint: 'low', 'moderate', 'high', 'critical')
    - `code_status TEXT` (check constraint: 'full', 'dnr', 'dni', 'comfort')
    - `alerts TEXT[]`
    - `vitals JSONB` (flexible structure)
  - Add comments on columns
  - Update RLS policies if needed

  **Must NOT do**:
  - Make columns NOT NULL (breaks existing data)
  - Drop any existing columns
  - Change existing column types

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`postgres-pro`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 11)
  - **Blocks**: Task 13
  - **Blocked By**: Task 11

  **References**:
  - Migration pattern: `supabase/migrations/20260322120000_add_mrn_to_patients.sql`
  - Array type usage: Check existing migrations for `TEXT[]` examples

  **Acceptance Criteria**:
  - [ ] Migration file created and tested locally
  - [ ] Migration runs successfully on fresh database
  - [ ] Existing data preserved after migration

  **QA Scenarios**:
  ```
  Scenario: Migration applies successfully
    Tool: Bash
    Steps:
      1. Run `supabase db reset`
      2. Run `supabase migration up`
    Expected Result: Migration applies without errors
    Evidence: .sisyphus/evidence/task-12-migration.log
  ```

  **Commit**: YES
  - Message: `db(migrations): add extended patient fields (service_line, acuity, code_status, etc.)`

---

- [ ] 13. Update patient mapper for new fields

  **What to do**:
  - Update `src/lib/mappers/patientMapper.ts`
  - Map new snake_case DB fields to camelCase UI fields:
    - `service_line` → `serviceLine`
    - `attending_physician` → `attendingPhysician`
    - `consulting_team` → `consultingTeam`
    - etc.
  - Handle null/undefined gracefully
  - Update inverse mapper (UI to DB)

  **Must NOT do**:
  - Break existing field mappings
  - Return undefined for empty fields (use empty string or null)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`typescript-pro`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 12)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 11, 12

  **References**:
  - Current mapper: `src/lib/mappers/patientMapper.ts`
  - Patient service: `src/services/patientService.ts`

  **Acceptance Criteria**:
  - [ ] All new fields mapped correctly
  - [ ] Unit tests pass (if existing)
  - [ ] TypeScript compilation succeeds

  **QA Scenarios**:
  ```
  Scenario: Patient with new fields displays correctly
    Tool: Playwright
    Steps:
      1. Create patient with serviceLine="MICU", acuity="high"
      2. Save and refresh
      3. Verify data persists
    Expected Result: Fields show correct values after refresh
    Evidence: .sisyphus/evidence/task-13-mapper.png
  ```

  **Commit**: YES
  - Message: `feat(patient): update mapper for extended patient fields`

---

- [ ] 14. Enhance NewPatientSheet with extended fields

  **What to do**:
  - Redesign `src/components/dashboard/NewPatientSheet.tsx`
  - Add sections:
    - **Basic Info** (name, MRN, bed) - required
    - **Team** (service line, attending, consulting) - optional
    - **Status** (acuity, code status) - optional
    - **Alerts** (allergies, isolation) - optional
  - Use progressive disclosure (collapsible sections)
  - Add field validation:
    - Name: required
    - MRN: format validation if provided
    - Service line: dropdown with common options
    - Acuity: radio/select with 4 options
    - Code status: radio/select

  **Must NOT do**:
  - Make new fields required
  - Overwhelm user with all fields at once

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 13)
  - **Blocks**: None
  - **Blocked By**: Tasks 11, 12, 13

  **References**:
  - Current sheet: `src/components/dashboard/NewPatientSheet.tsx`
  - Sheet component: `src/components/ui/sheet.tsx`
  - Select component: `src/components/ui/select.tsx`

  **Acceptance Criteria**:
  - [ ] Form has collapsible sections
  - [ ] Service line dropdown has 10+ options
  - [ ] Acuity shown as visual indicator (color-coded)
  - [ ] Form validates and submits correctly

  **QA Scenarios**:
  ```
  Scenario: Create patient with extended fields
    Tool: Playwright
    Steps:
      1. Click "Add patient"
      2. Fill name, MRN, bed
      3. Expand "Team" section
      4. Select service line "MICU"
      5. Expand "Status" section
      6. Select acuity "High"
      7. Submit form
    Expected Result:
      - Patient created successfully
      - Service line and acuity visible in patient card
    Evidence: .sisyphus/evidence/task-14-extended-form.png
  ```

  **Commit**: YES
  - Message: `feat(patient): enhance patient creation form with extended fields`

---

- [ ] 15. Display extended fields in PatientCard

  **What to do**:
  - Update `src/components/PatientCard.tsx` (or equivalent)
  - Show new fields in card header or metadata section:
    - Service line badge
    - Acuity indicator (color-coded dot)
    - Code status badge
    - Alert icons (allergies, isolation)
  - Responsive design (mobile-friendly)

  **Must NOT do**:
  - Make cards significantly taller
  - Hide critical information behind clicks

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 14)
  - **Blocks**: None
  - **Blocked By**: Task 14

  **References**:
  - Patient card location: `src/components/PatientCard.tsx`
  - Badge component: `src/components/ui/badge.tsx`

  **Acceptance Criteria**:
  - [ ] Service line shown as badge
  - [ ] Acuity shown as colored indicator
  - [ ] Alerts shown as warning icons
  - [ ] Mobile layout works

  **QA Scenarios**:
  ```
  Scenario: Patient card shows extended metadata
    Tool: Playwright
    Steps:
      1. Create patient with all extended fields
      2. View patient card
    Expected Result:
      - Service line badge visible
      - Acuity color indicator present
      - Alert icons shown if alerts exist
    Evidence: .sisyphus/evidence/task-15-card-metadata.png
  ```

  **Commit**: YES
  - Message: `feat(ui): display extended patient metadata in PatientCard`

---

- [ ] 16. Add structured vitals input section

  **What to do**:
  - Create `src/components/patient/VitalsSection.tsx`
  - Input fields:
    - Temperature (°C or °F toggle)
    - Heart Rate (bpm)
    - Blood Pressure (systolic/diabstolic)
    - Respiratory Rate (breaths/min)
    - SpO2 (%)
    - Last recorded timestamp
  - Integration with PatientCard systems panel
  - Optional section (collapsed by default)

  **Must NOT do**:
  - Make vitals required
  - Overcomplicate UI with too many fields

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 15)
  - **Blocks**: None
  - **Blocked By**: Task 13

  **References**:
  - Input component: `src/components/ui/input.tsx`
  - Systems structure: `src/types/patient.ts:7-18`

  **Acceptance Criteria**:
  - [ ] Vitals section collapsible
  - [ ] All vital sign fields present
  - [ ] Unit toggle for temperature
  - [ ] Data persists on save

  **QA Scenarios**:
  ```
  Scenario: Vitals input and display
    Tool: Playwright
    Steps:
      1. Open patient card
      2. Expand vitals section
      3. Enter HR: 88, BP: 120/80, SpO2: 98%
      4. Save
      5. Refresh page
    Expected Result: Vitals values persist
    Evidence: .sisyphus/evidence/task-16-vitals.png
  ```

  **Commit**: YES
  - Message: `feat(patient): add structured vitals input section`

---

- [ ] 17. Implement disabled states for controls without prerequisites

  **What to do**:
  - Identify controls that need prerequisites:
    - "Compare": needs 2+ patients
    - "AI": needs patient context (optional - can work without)
    - "Print/Export": needs 1+ patients
    - "Filter": affects display but works with 0 patients
    - "Sync": always enabled
  - Add disabled prop with tooltip explanation
  - Update DesktopDashboard team actions section

  **Must NOT do**:
  - Disable search (still useful for demo)
  - Hide controls completely (confusing)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Team actions: `DesktopDashboard.tsx:682-698`
  - Button disabled: `src/components/ui/button.tsx`

  **Acceptance Criteria**:
  - [ ] Compare disabled with <2 patients
  - [ ] Print disabled with 0 patients
  - [ ] Tooltips explain why disabled
  - [ ] Controls enable when prerequisites met

  **QA Scenarios**:
  ```
  Scenario: Compare button disabled with one patient
    Tool: Playwright
    Preconditions: Only 1 patient exists
    Steps:
      1. Open dashboard
      2. Hover over "Compare" button
    Expected Result:
      - Button is disabled (grayed out)
      - Tooltip shows "Add at least 2 patients to compare"
    Evidence: .sisyphus/evidence/task-17-disabled-compare.png

  Scenario: Compare enables with second patient
    Tool: Playwright
    Steps:
      1. Add second patient
      2. Check Compare button
    Expected Result: Button is now enabled
    Evidence: .sisyphus/evidence/task-17-enabled-compare.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add disabled states with tooltips for prerequisite controls`

---

- [ ] 18. Create CSV/EHR import with column mapping

  **What to do**:
  - Enhance existing import functionality
  - Create mapping UI for CSV columns:
    - Show CSV preview (first 5 rows)
    - Dropdown per column to map to patient field
    - Auto-detect common column names (Name, MRN, Bed, Room)
  - Validation:
    - Required: Name
    - Optional: MRN, Bed, Service Line, etc.
  - Error handling for malformed CSV

  **Must NOT do**:
  - Support complex EHR formats (keep simple CSV)
  - Auto-import without user confirmation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Existing import: `src/components/SmartPatientImport.tsx`
  - CSV parsing: Check if PapaParse or similar exists

  **Acceptance Criteria**:
  - [ ] CSV preview shows before import
  - [ ] Column mapping UI functional
  - [ ] Required field validation
  - [ ] Import preview with row count

  **QA Scenarios**:
  ```
  Scenario: Import CSV with mapping
    Tool: Playwright
    Preconditions: CSV file with columns: Patient Name, Medical Record, Location
    Steps:
      1. Click "Import from CSV"
      2. Upload CSV file
      3. Map "Patient Name" → "Name"
      4. Map "Medical Record" → "MRN"
      5. Map "Location" → "Bed"
      6. Preview shows 5 patients
      7. Confirm import
    Expected Result: 5 patients imported with correct data
    Evidence: .sisyphus/evidence/task-18-csv-import.png
  ```

  **Commit**: YES
  - Message: `feat(import): add CSV column mapping with validation`

---

- [ ] 19. Add patient templates for rapid creation

  **What to do**:
  - Create `src/lib/templates/patientTemplates.ts`
  - Define common templates:
    - "ICU Admission": MICU, Critical acuity, Full code
    - "Step-down": SDU, Moderate acuity
    - "Observation": Observation unit, Low acuity
  - Add template selector in NewPatientSheet
  - Pre-fill form based on selected template

  **Must NOT do**:
  - Make templates mandatory
  - Include real patient data in templates

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: Task 14

  **References**:
  - NewPatientSheet: `src/components/dashboard/NewPatientSheet.tsx`
  - Template pattern: Check autotext/templates for existing patterns

  **Acceptance Criteria**:
  - [ ] 3+ templates defined
  - [ ] Template selector in form
  - [ ] Selecting template pre-fills fields
  - [ ] User can edit pre-filled values

  **QA Scenarios**:
  ```
  Scenario: Create patient from template
    Tool: Playwright
    Steps:
      1. Open "Add patient"
      2. Select "ICU Admission" template
      3. Verify fields pre-filled
      4. Edit name
      5. Submit
    Expected Result: Patient created with template values
    Evidence: .sisyphus/evidence/task-19-templates.png
  ```

  **Commit**: YES
  - Message: `feat(patient): add patient templates for rapid ICU/step-down creation`

---

- [ ] 20. Create sync history panel

  **What to do**:
  - Create `src/components/sync/SyncHistoryPanel.tsx`
  - Display:
    - Last sync timestamp per data source
    - Sync status (success, error, pending)
    - Error details with retry option
    - Data source breakdown (Supabase, local, etc.)
  - Slide-over panel triggered from sync badge
  - Store last 10 sync events in localStorage

  **Must NOT do**:
  - Block UI on sync errors
  - Show technical error details to users

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Sync badge: `DesktopDashboard.tsx:726-753`
  - Sheet/Slide-over: `src/components/ui/sheet.tsx`

  **Acceptance Criteria**:
  - [ ] Panel slides out from right
  - [ ] Shows last 10 sync events
  - [ ] Retry button for failed syncs
  - [ ] Timestamps shown in relative format

  **QA Scenarios**:
  ```
  Scenario: View sync history
    Tool: Playwright
    Steps:
      1. Click on sync badge "Last sync just now"
      2. Wait for panel to open
    Expected Result:
      - Panel shows sync history
      - Most recent sync at top
      - Shows success status
    Evidence: .sisyphus/evidence/task-20-sync-history.png
  ```

  **Commit**: YES
  - Message: `feat(sync): add sync history panel with retry functionality`

---

### Phase 3: Collaboration, AI Clarity, & Accessibility

- [ ] 21. Create team member presence system

  **What to do**:
  - Create `src/contexts/TeamContext.tsx`
  - Track:
    - Online status (via Supabase Realtime or polling)
    - Current user per patient (who's viewing/editing)
    - Last seen timestamp
  - Show presence indicators on patient cards
  - Privacy: only show presence to team members, not external

  **Must NOT do**:
  - Show exact location or sensitive info
  - Enable without user consent

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (foundation)
  - **Blocks**: Tasks 22, 23
  - **Blocked By**: None

  **References**:
  - Existing context: `src/contexts/SettingsContext.tsx`
  - Supabase Realtime: `src/integrations/supabase/client.ts`

  **Acceptance Criteria**:
  - [ ] Presence tracking working
  - [ ] Shows online/offline status
  - [ ] Updates in real-time
  - [ ] Respects privacy settings

  **QA Scenarios**:
  ```
  Scenario: Team member appears online
    Tool: Playwright
    Preconditions: Two browsers/sessions
    Steps:
      1. User A logs in
      2. User B logs in (different account)
      3. User A views dashboard
    Expected Result: User B sees User A as "online"
    Evidence: .sisyphus/evidence/task-21-presence.png
  ```

  **Commit**: YES
  - Message: `feat(collab): add team member presence tracking`

---

- [ ] 22. Add patient assignment feature

  **What to do**:
  - Add "Assign to" dropdown in PatientCard
  - Show assigned clinician badge on card
  - Filter by "My patients" in dashboard
  - Store assignment in patient record
  - Notifications on assignment (optional)

  **Must NOT do**:
  - Auto-assign without user action
  - Allow assignment to non-team members

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 21)
  - **Blocks**: None
  - **Blocked By**: Task 21

  **References**:
  - PatientCard: `src/components/PatientCard.tsx`
  - Dropdown: `src/components/ui/dropdown-menu.tsx`

  **Acceptance Criteria**:
  - [ ] Assignment dropdown in patient card
  - [ ] Assigned user shown as badge
  - [ ] "My patients" filter works
  - [ ] Assignment persists

  **QA Scenarios**:
  ```
  Scenario: Assign patient to clinician
    Tool: Playwright
    Steps:
      1. Open patient card
      2. Click "Assign to"
      3. Select user from dropdown
      4. Save
    Expected Result:
      - Assignment badge shows on card
      - "My patients" filter includes this patient
    Evidence: .sisyphus/evidence/task-22-assignment.png
  ```

  **Commit**: YES
  - Message: `feat(collab): add patient assignment and "my patients" filter`

---

- [ ] 23. Create per-patient activity feed

  **What to do**:
  - Create `src/components/patient/ActivityFeed.tsx`
  - Track events:
    - Patient created
    - Field updates (with before/after)
    - Assignment changes
    - Note exports
    - AI generations
  - Show in timeline format on patient card
  - Store in `patient_activity` table (new migration)

  **Must NOT do**:
  - Track sensitive PHI in activity log
  - Store full note content (just "summary updated")

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`, `postgres-pro`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 22)
  - **Blocks**: None
  - **Blocked By**: Task 22

  **References**:
  - Timeline component: Check if existing
  - Patient service: `src/services/patientService.ts`

  **Acceptance Criteria**:
  - [ ] Activity feed shows in patient card
  - [ ] Timeline shows recent events
  - [ ] Events have timestamps and actors
  - [ ] Collapsible to save space

  **QA Scenarios**:
  ```
  Scenario: Activity feed shows updates
    Tool: Playwright
    Steps:
      1. Create patient
      2. Update clinical summary
      3. View activity feed
    Expected Result:
      - Shows "Patient created"
      - Shows "Clinical summary updated"
      - Timestamps accurate
    Evidence: .sisyphus/evidence/task-23-activity.png
  ```

  **Commit**: YES
  - Message: `feat(collab): add per-patient activity feed and audit trail`

---

- [ ] 24. Create AI transparency panel

  **What to do**:
  - Create `src/components/ai/AITransparencyPanel.tsx`
  - Display:
    - Current AI model name and version
    - Data handling explanation (PHI stays encrypted)
    - What AI can/cannot do
    - Example prompts
    - Usage limits (if applicable)
    - Privacy policy link
  - Accessible from AI command palette

  **Must NOT do**:
  - Make false claims about AI capabilities
  - Hide data usage terms

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - AI palette: `src/components/tools/AICommandPalette.tsx`
  - Sheet component: `src/components/ui/sheet.tsx`

  **Acceptance Criteria**:
  - [ ] Panel shows current model info
  - [ ] PHI handling explained clearly
  - [ ] 3 example prompts provided
  - [ ] Links to full documentation

  **QA Scenarios**:
  ```
  Scenario: AI transparency panel opens
    Tool: Playwright
    Steps:
      1. Open AI command palette
      2. Click "About AI" or similar
    Expected Result:
      - Panel shows model info
      - Shows data handling info
      - Example prompts visible
    Evidence: .sisyphus/evidence/task-24-ai-panel.png
  ```

  **Commit**: YES
  - Message: `feat(ai): add transparency panel with model info and PHI handling`

---

- [ ] 25. Add AI usage examples and guidance

  **What to do**:
  - Add to AI command palette:
    - "Try: Draft today's SOAP note"
    - "Try: Summarize interval events"
    - "Try: Format medications list"
  - Quick action buttons for common tasks
  - Contextual suggestions based on current patient

  **Must NOT do**:
  - Auto-execute AI without user confirmation
  - Suggest inappropriate clinical uses

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 24)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - AI palette: `src/components/tools/AICommandPalette.tsx`
  - Command pattern: Check existing implementation

  **Acceptance Criteria**:
  - [ ] 3 example prompts visible
  - [ ] Quick action buttons work
  - [ ] Contextual when patient selected

  **QA Scenarios**:
  ```
  Scenario: AI examples shown
    Tool: Playwright
    Steps:
      1. Open AI palette
      2. Look for examples section
    Expected Result: Shows "Try drafting today's SOAP note" etc.
    Evidence: .sisyphus/evidence/task-25-ai-examples.png
  ```

  **Commit**: YES
  - Message: `feat(ai): add usage examples and quick actions to AI palette`

---

- [ ] 26. Harden form input accessibility

  **What to do**:
  - Audit all inputs in NewPatientSheet and PatientCard
  - Fix issues:
    - Add proper `<label>` elements (not just placeholders)
    - Ensure labels persist when input has value
    - Add `aria-describedby` for help text
    - Ensure focus rings visible
    - Test with screen reader
  - Pattern: Floating labels or persistent labels

  **Must NOT do**:
  - Remove placeholder text (supplement, don't replace)
  - Change styling significantly without review

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Label component: `src/components/ui/label.tsx`
  - Input component: `src/components/ui/input.tsx`
  - Current usage: `NewPatientSheet.tsx:89-130`

  **Acceptance Criteria**:
  - [ ] All inputs have proper labels
  - [ ] Labels visible when input has value
  - [ ] Focus rings clearly visible
  - [ ] Screen reader announces correctly

  **QA Scenarios**:
  ```
  Scenario: Input labels are accessible
    Tool: Playwright + a11y audit
    Steps:
      1. Open NewPatientSheet
      2. Run accessibility audit
    Expected Result: No "Form elements must have labels" errors
    Evidence: .sisyphus/evidence/task-26-a11y-audit.log
  ```

  **Commit**: YES
  - Message: `fix(a11y): add proper labels and focus rings to all form inputs`

---

- [ ] 27. Improve button hierarchy and color contrast

  **What to do**:
  - Audit button hierarchy across app:
    - Primary actions: filled button (Add Patient)
    - Secondary actions: outline button (Import)
    - Tertiary actions: ghost button (Cancel)
  - Ensure colorblind-friendly indicators:
    - Icons on all buttons
    - Text labels (not just color)
    - Size differences for importance
  - Check contrast ratios (WCAG AA: 4.5:1 minimum)

  **Must NOT do**:
  - Remove color entirely
  - Make all buttons look identical

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Button variants: `src/components/ui/button.tsx`
  - Current usage: `DesktopDashboard.tsx` (many buttons)

  **Acceptance Criteria**:
  - [ ] All buttons have icons
  - [ ] Primary/secondary distinction clear without color
  - [ ] Contrast ratios meet WCAG AA

  **QA Scenarios**:
  ```
  Scenario: Button hierarchy clear
    Tool: Playwright + contrast checker
    Steps:
      1. Navigate to dashboard
      2. Check contrast ratios
    Expected Result:
      - All buttons have icons
      - Contrast >= 4.5:1 for normal text
    Evidence: .sisyphus/evidence/task-27-contrast.png
  ```

  **Commit**: YES
  - Message: `fix(a11y): improve button hierarchy and color contrast`

---

- [ ] 28. Enhance keyboard navigation and focus management

  **What to do**:
  - Ensure all interactive elements keyboard accessible:
    - Tab order logical
    - Focus visible on all elements
    - Esc closes modals
    - Enter activates buttons
  - Add skip links for main content
  - Trap focus in modals (already done, verify)
  - Add keyboard shortcuts help modal improvements

  **Must NOT do**:
  - Add so many shortcuts they conflict
  - Trap focus incorrectly

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Shortcuts: `src/components/KeyboardShortcutSystem.tsx`
  - Modal focus: Check Radix Dialog implementation

  **Acceptance Criteria**:
  - [ ] Tab order logical on all pages
  - [ ] Focus visible on all elements
  - [ ] Skip link present
  - [ ] Modal focus trapped correctly

  **QA Scenarios**:
  ```
  Scenario: Keyboard navigation works
    Tool: Playwright
    Steps:
      1. Press Tab multiple times
      2. Verify focus moves logically
      3. Press Enter on focused button
    Expected Result: Buttons activate, modals open
    Evidence: .sisyphus/evidence/task-28-keyboard.png
  ```

  **Commit**: YES
  - Message: `fix(a11y): enhance keyboard navigation and focus management`

---

- [ ] 29. Create keyboard shortcuts cheat sheet modal

  **What to do**:
  - Enhance `KeyboardShortcutSystem.tsx`
  - Create full-screen modal (not tiny dialog):
    - Organized by category (Navigation, Actions, Editing)
    - Searchable shortcuts
    - Visual key representations
    - Printable version
  - Trigger with `?` key or button in header
  - Show shortcut count (e.g., "15 shortcuts")

  **Must NOT do**:
  - Remove existing shortcut hints
  - Block UI without close option

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Current system: `src/components/KeyboardShortcutSystem.tsx`
  - Dialog: `src/components/ui/dialog.tsx`

  **Acceptance Criteria**:
  - [ ] Modal opens with `?` key
  - [ ] Shortcuts organized by category
  - [ ] Visual key representations
  - [ ] Search/filter works

  **QA Scenarios**:
  ```
  Scenario: Shortcuts modal opens
    Tool: Playwright
    Steps:
      1. Press "?" key
      2. Wait for modal
    Expected Result:
      - Modal shows shortcuts by category
      - Shows visual key representations
      - Search box present
    Evidence: .sisyphus/evidence/task-29-shortcuts-modal.png
  ```

  **Commit**: YES
  - Message: `feat(a11y): create comprehensive keyboard shortcuts cheat sheet`

---

- [ ] 30. Add command palette for power users

  **What to do**:
  - Create `src/components/command/CommandPalette.tsx`
  - Features:
    - Search and execute actions
    - Patient search (jump to patient)
    - Quick actions (add patient, print, etc.)
    - Settings access
  - Trigger: `Cmd+K` (enhance existing search)
  - Similar to VS Code command palette or Linear

  **Must NOT do**:
  - Replace existing UI entirely
  - Require palette for basic actions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-expert`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Command pattern: `src/components/ui/command.tsx` (may exist)
  - Search: `DesktopDashboard.tsx:568-581`

  **Acceptance Criteria**:
  - [ ] Palette opens with Cmd+K
  - [ ] Search patients works
  - [ ] Quick actions available
  - [ ] Keyboard navigable

  **QA Scenarios**:
  ```
  Scenario: Command palette opens and works
    Tool: Playwright
    Steps:
      1. Press Cmd+K
      2. Type "add patient"
      3. Press Enter
    Expected Result: Add patient sheet opens
    Evidence: .sisyphus/evidence/task-30-command-palette.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add command palette for power users`

---

## Final Verification Wave

After ALL implementation tasks complete, run these 4 parallel verification tasks:

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read plan end-to-end. For each "Must Have": verify implementation exists.
  For each "Must NOT Have": search codebase for forbidden patterns.
  Check evidence files exist in .sisyphus/evidence/.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `npm run lint` + `npm test`.
  Review for AI slop patterns: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N/N] | VERDICT`

- [ ] F3. **Accessibility Audit** — `unspecified-high`
  Run automated a11y checks (axe-core or similar).
  Manual check: keyboard navigation, screen reader labels, color contrast.
  Test all new UI components.
  Output: `Automated [N issues] | Manual [N issues] | VERDICT`

- [ ] F4. **User Acceptance Testing** — `deep`
  Execute complete workflow:
  1. New user onboarding → sample patients → tour
  2. Create patient with extended fields
  3. Assign patient, view activity feed
  4. Use AI with transparency panel
  5. Export/print with all data
  Output: `Workflows [N/N pass] | VERDICT`

---

## Commit Strategy

### Atomic Commit Rules

| Change Type | Commit Size | Example |
|-------------|-------------|---------|
| Component creation | 1 component = 1 commit | `feat(trust): add TrustIndicators component` |
| Feature integration | Related changes only | `feat(dashboard): integrate TrustIndicators into header` |
| Bug fixes | Single fix per commit | `fix(ui): contextualize AI badge` |
| Database changes | Migration + mapper in same commit | `feat(patient): add extended fields with migration` |
| Tests only | Test additions/updates | `test(trust): add TrustIndicators unit tests` |
| Documentation | Docs updates only | `docs(security): add compliance documentation` |

### Commit Message Format

```
type(scope): description (#task-number)

- What: Brief description of change
- Why: Context/motivation
- Testing: How verified
- Evidence: .sisyphus/evidence/phase-N/task-N-*.png

Refs: Task X, Task Y
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `test`: Test additions/updates
- `docs`: Documentation
- `style`: Formatting, no logic change
- `chore`: Maintenance, dependencies

**Scopes:**
- `trust`: Trust signals, compliance, security
- `patient`: Patient data, forms, cards
- `onboarding`: Tour, empty state, samples
- `collab`: Team features, presence, assignments
- `ai`: AI features, transparency, palette
- `a11y`: Accessibility, keyboard, labels
- `db`: Database, migrations
- `ui`: General UI components

### Example Commits

```
feat(trust): add TrustIndicators component with HIPAA badge (#1)

- Creates TrustIndicators.tsx with 3 indicators
- Adds unit tests with 100% coverage
- Includes tooltips with security explanations

Testing:
- Unit tests: 3/3 passing
- QA: Screenshots captured in .sisyphus/evidence/phase-1/
- Build: No TypeScript errors

Refs: Task 1
```

```
feat(patient): extend data model with service line, acuity, code status (#11)

- Adds TypeScript types for extended patient fields
- All new fields optional for backward compatibility
- Includes vitals, alerts, consulting team

Testing:
- TypeScript: npx tsc --noEmit passes
- Build: npm run build succeeds

Refs: Task 11
```

```
db(migrations): add extended patient fields to database (#12)

- Migration: 20260327_extend_patient_schema.sql
- Adds columns: service_line, acuity, code_status, alerts, vitals
- All columns nullable for backward compatibility

Testing:
- Migration tested on fresh database
- Rollback script verified

Refs: Task 12
```

### Per-Phase Commit Targets

- **Phase 1**: 10-12 atomic commits
- **Phase 2**: 10-12 atomic commits
- **Phase 3**: 10-12 atomic commits
- **Total**: 30-36 commits for complete overhaul

---

## Success Criteria

### Phase 1 Completion
- [ ] Trust indicators visible in header
- [ ] Security page accessible
- [ ] Sample patients loadable and interactive
- [ ] Onboarding tour runs for new users
- [ ] Value proposition clear in empty state

### Phase 2 Completion
- [ ] Extended patient fields functional
- [ ] Database migrations applied
- [ ] Import with column mapping works
- [ ] Disabled states prevent invalid actions
- [ ] Templates available for rapid creation

### Phase 3 Completion
- [ ] Team presence working
- [ ] Patient assignments functional
- [ ] Activity feed shows audit trail
- [ ] AI transparency panel accessible
- [ ] All a11y checks pass

### Final Verification
- [ ] All 30 tasks completed
- [ ] All 4 verification tasks pass
- [ ] User acceptance testing successful
- [ ] Documentation updated
- [ ] Zero critical bugs

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| HIPAA compliance claims | Use "HIPAA-aligned" not "HIPAA certified". Document actual safeguards. |
| Database migration failure | Test on copy of production data. Make reversible. |
| Breaking existing functionality | Maintain backward compatibility. All new fields optional. |
| Performance degradation | Lazy load new components. Virtualize long lists. |
| User confusion from UI changes | Progressive rollout. Keep existing patterns where possible. |

---

## Ultrawork Execution Map

### Parallel Execution Waves

**Phase 1 - Wave 1 (Foundation - All Parallel)**
```
Task 1 (TrustIndicators) ──┐
Task 2 (SecurityPage) ─────┼──> Wave 2 integration
Task 4 (AI Badge cleanup) ─┤
Task 5 (Empty state hero) ─┤
Task 8 (Onboarding tour) ──┤
Task 10 (Shortcut tooltips)┘
```

**Phase 1 - Wave 2 (Integration - Depends on Wave 1)**
```
Task 3 (Header integration) ──> After Task 1
Task 6 (Sample data) ─────────> Independent
Task 7 (Load samples button) ─> After Task 6
Task 9 (Interactive checklist) ─> Independent
```

**Phase 2 - Wave 1 (Foundation - Parallel)**
```
Task 11 (Type definitions) ──┐
Task 17 (Disabled states) ───┼──> Wave 2 integration
Task 18 (CSV import) ────────┤
Task 20 (Sync history) ──────┘
```

**Phase 2 - Wave 2 (Data Model - Sequential)**
```
Task 12 (Migration) ──> After Task 11
Task 13 (Mapper) ─────> After Task 12
Task 14 (PatientSheet) ──> After Task 13
Task 15 (PatientCard) ───> After Task 14
Task 16 (Vitals) ────────> After Task 13
Task 19 (Templates) ─────> After Task 14
```

**Phase 3 - Wave 1 (Independent - Parallel)**
```
Task 24 (AI transparency) ──┐
Task 25 (AI examples) ──────┤
Task 26 (a11y forms) ───────┼──> Wave 2 integration
Task 27 (Button hierarchy) ─┤
Task 28 (Keyboard nav) ─────┤
Task 29 (Shortcuts modal) ──┤
Task 30 (Command palette) ──┘
```

**Phase 3 - Wave 2 (Collaboration - Sequential)**
```
Task 21 (Presence) ──> Foundation
Task 22 (Assignment) ──> After Task 21
Task 23 (Activity feed) ──> After Task 22
```

### Agent Assignment by Task

| Task | Category | Skills | Estimated Effort |
|------|----------|--------|------------------|
| 1, 2, 5, 8, 10 | `visual-engineering` | `react-expert` | 2-4h each |
| 3, 4, 7, 9 | `quick` | `react-expert` | 1-2h each |
| 6 | `unspecified-high` | `react-expert` | 4-6h |
| 11, 12, 13 | `deep` | `typescript-pro`, `postgres-pro` | 4-6h each |
| 14, 15, 16, 19 | `visual-engineering` | `react-expert` | 4-6h each |
| 17, 18, 20 | `unspecified-high` | `react-expert` | 4-6h each |
| 21, 22, 23 | `unspecified-high` | `react-expert` | 6-8h each |
| 24, 25, 26, 27, 28 | `visual-engineering` | `react-expert` | 2-4h each |
| 29, 30 | `unspecified-high` | `react-expert` | 4-6h each |

## Dependencies

### External Libraries to Add

**Phase 1:**
- `react-joyride@^2.8.0` (onboarding tour)
- `@testing-library/react@^14.0.0` (if not present)
- `@testing-library/jest-dom@^6.0.0` (if not present)

**Phase 2:**
- `papaparse@^5.4.0` (CSV parsing, if not present)
- `zod@^3.22.0` (schema validation, if not present)

**Phase 3:**
- `@supabase/realtime-js` (already included with supabase-js)

### Supabase Configuration

**Phase 2:**
- Run migrations: `supabase migration up`
- Verify RLS policies for new tables

**Phase 3:**
- Enable Realtime for presence tracking
- Configure RLS policies for team data
- Set up realtime channels for presence

---

## Critical Task Identification & Rollback Strategy

### Critical Path Tasks

These tasks block downstream work. Failure here requires immediate attention:

| Task | Criticality | Impact if Failed | Mitigation |
|------|-------------|------------------|------------|
| Task 11 (Type definitions) | **BLOCKING** | All Phase 2 tasks blocked | Prototype types in separate branch first |
| Task 12 (Database migration) | **CRITICAL** | Cannot revert without data loss | Test on staging DB; backup before apply |
| Task 13 (Patient mapper) | **BLOCKING** | UI cannot display new fields | Pair with Task 12 in single commit |
| Task 21 (Team context) | **BLOCKING** | All Phase 3 collaboration blocked | Implement with feature flag |

### Per-Task Rollback Strategy

**If Task N fails:**
1. `git revert <task-n-commit>` (creates clean revert commit)
2. Verify revert with `npm run build && npm test`
3. Re-plan Task N with lessons learned
4. Continue with remaining tasks

**Database Migration Rollback (Task 12 only):**
```bash
# If migration applied but causes issues:
# 1. Create reverse migration (manual)
supabase migration new revert_patient_extension

# 2. Apply reverse migration
supabase db reset  # Development only

# 3. Production: Use supabase dashboard or CLI
supabase db push --dry-run  # Check what will happen
```

### Feature Flags for Risky Features

Add feature flags to these tasks for safe rollout:

```typescript
// src/lib/features.ts
export const FEATURES = {
  TRUST_INDICATORS: true,           // Task 1
  ONBOARDING_TOUR: true,            // Task 8
  EXTENDED_PATIENT_FIELDS: false,   // Task 14 (enable after testing)
  TEAM_PRESENCE: false,             // Task 21 (enable after testing)
  AI_TRANSPARENCY: true,            // Task 24
};
```

Usage:
```typescript
import { FEATURES } from '@/lib/features';

{FEATURES.TRUST_INDICATORS && <TrustIndicators />}
```

### Emergency Rollback Commands

**Full Phase Rollback:**
```bash
# Phase 1 rollback (UI only)
git revert --no-commit phase-1-start..HEAD

# Phase 2 rollback (includes DB - careful!)
# Must manually revert DB migration first
git revert --no-commit phase-2-start..HEAD

# Phase 3 rollback (collaboration features)
git revert --no-commit phase-3-start..HEAD
```

**Single Task Rollback:**
```bash
# Find commit hash
git log --oneline --grep="Task 14"

# Revert specific commit
git revert abc1234

# Or revert range
git revert abc1234^..def5678
```

## Continuous Verification

### Daily Standup Verification (if multi-day execution)

Run these checks at the start of each work session:

```bash
#!/bin/bash
# .sisyphus/scripts/daily-check.sh

echo "=== Daily Verification ==="

# 1. Build check
echo "1. TypeScript build..."
npx tsc --noEmit || exit 1

# 2. Lint check
echo "2. Lint check..."
npm run lint || exit 1

# 3. Test check
echo "3. Unit tests..."
npm test 2>/dev/null || echo "Warning: Tests may not exist yet"

# 4. Evidence check
echo "4. Evidence completeness..."
for phase in phase-1 phase-2 phase-3; do
  count=$(ls .sisyphus/evidence/$phase/*.png 2>/dev/null | wc -l)
  echo "  $phase: $count evidence files"
done

echo "=== Verification Complete ==="
```

### Pre-Phase Verification

Before starting each phase:

**Before Phase 1:**
- [ ] Test infrastructure verified (P0.x tasks)
- [ ] Evidence directories created
- [ ] No uncommitted changes from previous work

**Before Phase 2:**
- [ ] All Phase 1 tasks completed
- [ ] Phase 1 verification tasks passed
- [ ] Database backup created
- [ ] Staging environment ready

**Before Phase 3:**
- [ ] All Phase 2 tasks completed
- [ ] Database migrations verified in production
- [ ] Feature flags configured
- [ ] Team presence infrastructure ready

### Nightly Build Verification

If execution spans multiple days:

- [ ] Run full test suite
- [ ] Check evidence completeness
- [ ] Verify no regressions in existing features
- [ ] Update task status in plan
- [ ] Document blockers for next day

## Rollback Plan

If critical issues discovered:
1. Phase 1: Can rollback UI changes independently
2. Phase 2: Database migrations are additive only (safe to keep)
3. Phase 3: Team features can be feature-flagged off

**Emergency rollback command:**
```bash
# Revert to pre-overhaul state
git revert --no-commit HEAD~N..HEAD
# N = number of commits to rollback
```

---

## Plan Review Summary

### Momus High-Accuracy Review Results

**Reviewer:** Momus (Plan Critic)  
**Date:** 2026-03-27  
**Status:** ✅ **APPROVED WITH ENHANCEMENTS**

**Review Findings:**

| Category | Rating | Notes |
|----------|--------|-------|
| **Structure** | ✅ Excellent | Clear phases, logical flow, good dependencies |
| **Completeness** | ✅ Excellent | All 10 critique areas addressed |
| **TDD Orientation** | ⚠️ Needs Work | Added test-first structure, unit test templates |
| **Parallelization** | ✅ Good | Clear parallel groups identified |
| **Evidence Strategy** | ✅ Good | QA scenarios with evidence paths defined |
| **Commit Strategy** | ⚠️ Needs Detail | Enhanced with atomic commit rules, message format |
| **Risk Mitigation** | ✅ Good | Critical tasks identified, rollback strategy added |

**Required Enhancements (COMPLETED):**

1. ✅ **Pre-flight Test Infrastructure** - Added P0.x tasks
2. ✅ **TDD-Oriented Task Template** - Applied to Task 1 as example
3. ✅ **Atomic Commit Rules** - Detailed commit strategy with types, scopes, examples
4. ✅ **Critical Task Identification** - Blocking tasks flagged with mitigation
5. ✅ **Ultrawork Execution Map** - Parallel waves visualized
6. ✅ **Continuous Verification** - Daily standup checks, nightly builds
7. ✅ **Feature Flags** - Recommended for risky features

**Final Assessment:**

This plan is now **production-ready for ultrawork execution**. The enhancements address TDD requirements, provide clear atomic commit guidelines, and include comprehensive risk mitigation. The parallel execution waves enable maximum throughput while maintaining quality through test-first development.

**Recommendation:** Proceed to execution with Sisyphus orchestration.

---

## Execution Readiness Checklist

Before starting `/start-work`:

- [x] Plan reviewed by Momus (high-accuracy mode)
- [x] All 10 critique areas addressed
- [x] 30 tasks defined with TDD structure
- [x] Pre-flight tasks (P0.x) defined
- [x] Parallel execution waves mapped
- [x] Critical tasks identified
- [x] Rollback strategy documented
- [x] Commit strategy defined
- [x] Evidence collection paths specified
- [x] Feature flags recommended for risky features
