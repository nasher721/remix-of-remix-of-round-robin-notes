# Codebase Impact Analysis: Harden Production Readiness From Test Report

## Summary

The comprehensive browser test report maps to an implementation plan across four high-risk product surfaces:

1. Persistence and storage fallback.
2. Patient activity error handling.
3. Dialog accessibility and contextual UX clarity.
4. Verification coverage for browser permissions, selected-patient AI context, destructive actions, and async status.

The work should be staged as a hardening pass, not a redesign. The current app already has most feature surfaces working; the plan protects that breadth by locking behavior first, then repairing narrow reliability and accessibility gaps.

## Affected Files

### Storage Access

- `src/utils/safeStorage.ts`
  - Current helper checks `window.localStorage` but does not protect all access-time exceptions.
  - Extend to safe read/write/remove wrappers and add session-storage support.
- `src/contexts/SettingsContext.tsx`
  - Broad direct `localStorage` use for font, todos visibility, sort, theme, specialty, AI model/provider, credentials, section visibility, and toolbar preferences.
- `src/lib/dashboardPrefs.ts`
  - Existing dashboard preference helper is a good migration target for safe storage behavior.
- `src/components/dashboard/DesktopDashboard.tsx`
  - Direct `window.localStorage` for utility menu open state.
- `src/components/print/usePrintState.ts`, `src/components/PrintExportModalFull.tsx`, `src/components/print/layoutDesigner/useLayoutDesigner.ts`
  - Print layout and template preferences are storage-heavy and user-visible.
- `src/lib/offline/offlineQueue.ts`, `src/lib/offline/indexedDBQueue.ts`, `src/lib/cache/queryClientConfig.ts`, `src/lib/cache/performanceMonitor.ts`
  - Offline/cache state should degrade to memory or IndexedDB-first paths without crashing.
- `src/pages/FHIRCallback.tsx`, `src/components/fhir/EHRImportButton.tsx`, `src/integrations/fhir/client.ts`
  - Session storage paths need safe adapter coverage.
- `src/lib/observability/logger.ts`, `src/lib/observability/telemetry.ts`
  - Session IDs should fall back gracefully when `sessionStorage` is blocked.

### Patient Activity Fetch Failure

- `src/hooks/usePatientActivity.ts`
  - Current `fetchActivities` logs and clears loading but exposes no `error`, no retry state, and no user-visible status.
  - Add normalized error state, retry function, bounded retry behavior, and preservation of last successful data.
- `src/components/patient/ActivityFeed.tsx`
  - Current UI has loading and empty states only.
  - Add error row, retry action, and accessible status text.

### Dialog Accessibility

High-priority targets for title/description audit:

- `src/components/MultiPatientComparison.tsx`
- `src/components/VoiceCommandPanel.tsx`
- `src/components/UnifiedAIDropdown.tsx`
- `src/components/ui/command.tsx`
- `src/components/dashboard/MobileDashboard.tsx`
- `src/components/PatientInfoToolbarCustomizeDialog.tsx`
- `src/components/PrintExportModalFull.tsx`
- `src/components/phrases/PhraseManager.tsx`
- `src/components/import/CSVColumnMapper.tsx`
- `src/components/EpicHandoffImport.tsx`
- `src/components/DocumentImport.tsx`
- `src/components/tools/timeline/TimelineDialog.tsx`
- `src/components/ImageLightbox.tsx`

Shared primitives:

- `src/components/ui/dialog.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/command.tsx`

Do not globally suppress Radix warnings until the target dialogs are audited; add descriptions where they help, and opt out explicitly only when the title alone is appropriate.

### AI Context And Actions

- `src/pages/Index.tsx`
  - Owns selected patient/current patient derivation.
- `src/components/dashboard/DesktopDashboard.tsx`
  - Opens `AICommandPalette`; needs explicit selected patient handoff and loading/error status checks.
- `src/components/tools/AICommandPalette.tsx`
  - Has patient-required behavior and suggestions, but should explain patient context before action and expose status semantics.
- `src/components/AIClinicalAssistant.tsx`, `src/components/UnifiedAIDropdown.tsx`, `src/components/AIGeneratorTools.tsx`, `src/components/AppleAIAssistant.tsx`
  - Standardize patient/selection-required disabled states and action labels.

### Destructive Actions

- `src/components/dashboard/VirtualizedPatientList.tsx`
  - Remove patient confirmation exists; verify copy, focus return, and target naming.
- `src/components/dashboard/DesktopDashboard.tsx`
  - Clear-all confirmation exists; verify specificity and safe Cancel.
- `src/components/dashboard/MobileDashboard.tsx`
  - Clear-all and mobile dialog parity.
- `src/components/PatientCard.tsx`
  - Clear section and clear all systems confirmation exist; duplicate/remove entry points should be audited for upstream confirmation.
- `src/components/mobile/MobilePatientDetail.tsx`
  - Remove patient and clear systems confirmations exist; verify parity and target naming.
- `src/hooks/patients/usePatientMutations.ts`
  - Duplicate executes directly at mutation layer; UI should confirm if product treats duplication as high-risk.

### Empty States, Tooltips, Help, Labels

- `src/components/dashboard/DesktopDashboard.tsx`
  - Zero-patient and filtered-empty states, disabled Print/Compare tooltips, sync retry, utility drawer.
- `src/components/dashboard/VirtualizedPatientList.tsx`
  - List/task-rail empty states and selected-patient task context.
- `src/components/ContextAwareHelp.tsx`
  - Existing help popover is very lightweight; replace placeholder test with useful coverage.
- `src/components/QuickActionsPanel.tsx`
  - Quick action categories, shortcut labels, and confirmation text.
- `src/components/PatientTodos.tsx`
  - Task add/generate/complete/delete labels and status announcements.
- `src/components/AutotextManager.tsx`, `src/components/phrases/PhraseManager.tsx`, `src/components/RichTextEditor.tsx`
  - Discoverability and copy for phrases/autotexts.
- `src/components/trust/TrustIndicators.tsx`, `src/pages/Security.tsx`
  - Security badge details and trust explanations.

### Dictation And Browser Permissions

- `src/hooks/useDictation.ts`, `src/components/DictationButton.tsx`
  - Cloud dictation path.
- `src/hooks/useLocalDictation.ts`, `src/components/tools/LocalDictationButton.tsx`
  - Local dictation path.
- Add visible permission guidance, denied-state recovery, `aria-live` status, and tests with mocked `getUserMedia`.

## Existing Test Surfaces To Extend

- `src/components/dashboard/__tests__/dashboardRegressionHarness.test.tsx`
  - Best home for dashboard behavior, empty states, selected-patient AI context, tooltips/help reachability, destructive confirmations, loading indicators.
- `e2e/dashboard-layout.e2e.spec.ts`
  - Best home for authenticated visual/interaction smoke, dialogs, focus return, microphone permission, sync retry.
- `src/context/DashboardLayoutContext.test.tsx`
  - Storage unavailable behavior for dashboard layout state.
- `src/lib/dashboardPrefs.test.ts`
  - Safe preference read/write fallback.
- `src/components/ContextAwareHelp.test.tsx`
  - Replace placeholder coverage with real help popover behavior.
- New `src/hooks/__tests__/usePatientActivity.test.tsx`
  - Hook error/retry/last-success behavior.
- New or extended `ActivityFeed` component test.
- New dictation hook/button tests around permission denied and successful transcript.

## Risks

- Broad storage migration can create churn if every callsite is touched at once. Use a small adapter first, then migrate highest-risk surfaces.
- Patient activity retry can become noisy if it retries non-recoverable authorization/schema errors. Normalize errors and use bounded retry.
- Dialog-description work can become mechanical and shallow. Each description should say what the user can do or what content is presented.
- AI context bugs are high clinical-risk because generated content can target the wrong patient. This lane should be tested before label polish.
- Dictation permission behavior differs across browsers, so automated tests should be paired with manual Chromium/Safari checks.

## Recommended Parallel Boundaries

- Storage hardening and patient activity error handling can run in parallel after tests are added because their write sets are mostly separate.
- Dialog accessibility, destructive confirmations, and UX label/tooltips share dashboard files and should sequence through a common UI owner after baseline tests.
- Dictation permission handling is independent and can run in parallel with storage/activity work.
- Final verification should merge all lanes and run accessibility, unit, build, and browser smoke checks together.
