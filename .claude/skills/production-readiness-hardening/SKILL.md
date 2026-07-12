# Production Readiness Hardening

Use this skill when planning or implementing the Rolling Rounds production-readiness pass created from the comprehensive browser test report.

## Scope

- Make storage persistence safe when `localStorage` or `sessionStorage` is unavailable, blocked, or throws at access time.
- Replace console-only patient activity failures with visible error, retry, and preserved-state behavior.
- Ensure Radix dialogs and command dialogs have programmatic titles and useful descriptions.
- Clarify selected-patient context for AI actions before users run generation.
- Confirm destructive patient and clear-all workflows require explicit confirmation across desktop and mobile.
- Improve empty states, contextual help, tooltips, task workflow labels, dictation permission states, and async loading feedback.
- Preserve existing patient management, search/filter, print/export, comparison, rich text editing, AI, theme, systems review, sync, and mobile workflows.

## Repo Anchors

- Authenticated shell and selected-patient state: `src/pages/Index.tsx`
- Desktop dashboard, tools, empty states, AI palette, sync retry, clear-all dialogs: `src/components/dashboard/DesktopDashboard.tsx`
- Desktop roster, remove confirmation, task rail context: `src/components/dashboard/VirtualizedPatientList.tsx`
- Mobile dashboard dialogs and clear-all confirmation: `src/components/dashboard/MobileDashboard.tsx`
- Patient editor, duplicate/remove entry points, clear-field dialogs: `src/components/PatientCard.tsx`
- Patient activity data and UI: `src/hooks/usePatientActivity.ts`, `src/components/patient/ActivityFeed.tsx`
- Safe storage boundary: `src/utils/safeStorage.ts`
- Storage-heavy settings: `src/contexts/SettingsContext.tsx`, `src/lib/dashboardPrefs.ts`, `src/components/print/usePrintState.ts`, `src/components/print/layoutDesigner/useLayoutDesigner.ts`, `src/lib/offline/indexedDBQueue.ts`, `src/lib/offline/offlineQueue.ts`
- Dialog primitives: `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/command.tsx`
- AI surfaces: `src/components/tools/AICommandPalette.tsx`, `src/components/AIClinicalAssistant.tsx`, `src/components/UnifiedAIDropdown.tsx`, `src/components/AIGeneratorTools.tsx`, `src/components/AppleAIAssistant.tsx`
- Dictation surfaces: `src/hooks/useDictation.ts`, `src/components/DictationButton.tsx`, `src/hooks/useLocalDictation.ts`, `src/components/tools/LocalDictationButton.tsx`
- Task/help surfaces: `src/components/PatientTodos.tsx`, `src/components/QuickActionsPanel.tsx`, `src/components/ContextAwareHelp.tsx`
- Sync/status surfaces: `src/components/offline/OfflineSyncIndicator.tsx`, `src/components/sync/SyncHistoryPanel.tsx`, `src/hooks/useOfflineSync.ts`

## Recommended Implementation Order

1. Lock observed behavior first.
   - Add storage-denial tests before changing storage helpers.
   - Add patient activity failure/retry tests before changing the hook contract.
   - Add dashboard harness assertions for selected-patient AI context, destructive confirmations, empty states, tooltips/help, and async status.
   - Keep credential-gated Playwright checks separated from local unit/component checks.

2. Harden storage through a small shared boundary.
   - Extend `createSafeStorage` so availability checks wrap access, reads, writes, and removals in `try/catch`.
   - Add explicit `createSafeSessionStorage` or a storage adapter that accepts the target storage type.
   - Use the adapter in high-risk settings, dashboard preference, print preference, offline queue, FHIR state, observability, and theme paths.
   - Prefer memory fallback and visible degraded persistence status over crashing or blanking the dashboard.

3. Fix patient activity as the first runtime error path.
   - Add `error`, `retry`, and optional `lastFetchedAt` state to `usePatientActivity`.
   - Preserve the last successful activity list when refresh fails.
   - Add bounded retry for recoverable fetch errors and a user-facing retry button in `ActivityFeed`.
   - Avoid logging raw Supabase objects without normalized user-facing messages.

4. Close dialog accessibility gaps.
   - Add `DialogDescription` to dialogs where description helps screen-reader users.
   - Use `aria-describedby={undefined}` only for intentionally visual-only dialogs that have a clear title and no useful description.
   - Prioritize `MultiPatientComparison`, `VoiceCommandPanel`, `UnifiedAIDropdown`, `CommandDialog`, `MobileDashboard`, `PatientInfoToolbarCustomizeDialog`, `PrintExportModalFull`, `PhraseManager`, and import/dialog wrappers.
   - Verify Escape/focus return behavior after each modal path.

5. Clarify AI, task, and action context.
   - Ensure `AICommandPalette` receives and displays the selected patient, not an implicit first patient.
   - Add disabled-state reasons for patient-required and selection-required AI actions.
   - Show patient/section scope in task generation labels and task popover headings.
   - Keep clinical copy short, non-marketing, and visible without relying on tooltip-only instructions.

6. Improve UX polish without expanding feature scope.
   - Add helpful filtered-empty states and clear-filter recovery actions.
   - Add concise tooltips to advanced controls that are discoverable but not verbose.
   - Standardize labels for `Generate`, `Summary`, duplicate, customize, quick actions, phrases, autotexts, import, view modes, and security/trust details.
   - Add async loading/status semantics for sync retry, AI streaming, dictation, import, and activity fetch.

7. Verify across browser/platform constraints.
   - Test storage-blocked contexts, microphone denied/allowed contexts, offline/poor-network behavior, keyboard-only modal paths, and common desktop/mobile viewports.
   - Run `npm test`, `npm run lint`, `npm run build`, and non-credential e2e smoke checks.
   - Document credential-gated or browser-permission checks that cannot run locally.

## Pitfalls

- Do not replace the existing dashboard, patient hooks, or print/export architecture for this task.
- Do not add dependencies unless the user explicitly asks.
- Do not hide the critical storage/activity failures behind silent catches; fallback should be graceful and observable.
- Do not remove existing confirmations; make them more specific and parity-checked.
- Do not use tooltip-only text for required instructions such as dictation permissions or AI context requirements.
- Do not make `DialogContent` suppress warnings globally without auditing actual missing descriptions.

## Verification Ideas

- Simulate throwing `localStorage` and `sessionStorage` methods and prove dashboard settings, print preferences, theme, offline queues, and FHIR state do not crash.
- Mock Supabase patient activity errors and prove `ActivityFeed` shows retry while preserving last successful entries.
- Render every targeted dialog and assert accessible name plus description where appropriate.
- Select a non-first patient, open AI, and assert suggestions/actions use that patient.
- Attempt remove/clear-all/duplicate paths on desktop and mobile and assert confirmation copy names the target and Cancel is safe.
- Deny microphone access in unit and Playwright contexts and assert visible recovery guidance.
- Run keyboard-only Tab/Escape paths through AI palette, quick actions, print/export, import, phrases, autotexts, and comparison dialogs.
