# Phase 2b Codebase Analysis Scratchpad

## High-Risk Findings

1. Storage access is not centralized enough.
   - `src/utils/safeStorage.ts` exists but only protects the first `window.localStorage` lookup.
   - Many callsites still read/write storage directly.

2. Patient activity errors are console-only.
   - `src/hooks/usePatientActivity.ts` catches and logs fetch/add errors.
   - `src/components/patient/ActivityFeed.tsx` cannot render error or retry state because the hook does not expose it.

3. Dialog accessibility needs a targeted audit.
   - Many dialogs already include titles/descriptions.
   - Several high-risk wrappers use `DialogContent` without obvious `DialogDescription`, especially command/dialog wrappers and large feature dialogs.

4. Selected-patient AI context is a clinical correctness risk.
   - `Index.tsx` owns selected patient derivation.
   - `DesktopDashboard.tsx` opens the AI command palette and must pass explicit selected-patient context.

5. Destructive confirmations mostly exist, but parity and specificity need tests.
   - Desktop remove patient confirmation exists in `VirtualizedPatientList`.
   - Mobile remove and clear systems confirmation exists in `MobilePatientDetail`.
   - Duplicate action still needs product-level confirmation decision and UI parity.

6. Help and discoverability are present but light.
   - `ContextAwareHelp` is generic.
   - `QuickActionsPanel`, phrases, autotexts, dictation, view modes, and security badges need concise inline guidance and tests.

## Integration Points

- Storage adapter should be implemented before migrating callsites.
- Activity hook contract change must be reflected in `ActivityFeed`.
- Dialog accessibility should keep focus-return behavior in `DialogContent`.
- AI context work should not change the AI provider/router layer.
- Dictation permission work should not change transcription APIs unless tests prove the hook needs state shape changes.

## Existing Tests To Reuse

- `src/components/dashboard/__tests__/dashboardRegressionHarness.test.tsx`
- `src/context/DashboardLayoutContext.test.tsx`
- `src/lib/dashboardPrefs.test.ts`
- `e2e/dashboard-layout.e2e.spec.ts`

## Missing Tests To Add

- `src/hooks/__tests__/usePatientActivity.test.tsx`
- `src/components/patient/ActivityFeed.test.tsx` or equivalent component test.
- Dictation permission tests for `useDictation`, `DictationButton`, `useLocalDictation`, and `LocalDictationButton`.
- Real `ContextAwareHelp` behavior tests.
- Dialog accessibility/focus-return assertions.
