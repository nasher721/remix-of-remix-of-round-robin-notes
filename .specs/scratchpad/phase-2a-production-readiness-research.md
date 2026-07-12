# Phase 2a Research Scratchpad

## Resources Gathered

Repo resources:

- Existing SDD task format: `.specs/tasks/done/refine-main-ui-after-login.feature.md`
- Existing SDD task format with parallel implementation: `.specs/tasks/done/improve-patient-roster-speed-and-backend.feature.md`
- Existing reusable skill format: `.claude/skills/patient-roster-performance/SKILL.md`
- Safe storage helper: `src/utils/safeStorage.ts`
- Patient activity hook and UI: `src/hooks/usePatientActivity.ts`, `src/components/patient/ActivityFeed.tsx`
- Dialog primitives: `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/command.tsx`
- Dashboard harness: `src/components/dashboard/__tests__/dashboardRegressionHarness.test.tsx`
- Dashboard e2e: `e2e/dashboard-layout.e2e.spec.ts`
- Dashboard preference tests: `src/context/DashboardLayoutContext.test.tsx`, `src/lib/dashboardPrefs.test.ts`

Framework/library anchors already in project:

- React 18, Vite, TypeScript.
- Radix UI dialog/alert-dialog/command wrappers via shadcn-style components.
- TanStack Query for server-state cache.
- Supabase client for patient activity and patient CRUD.
- Playwright for e2e testing.
- Node test runner with local mock loaders.

## Key Recommendations

- Treat storage as a platform capability, not an assumption. Access can throw even when `window.localStorage` exists.
- Preserve last usable clinical state during transient fetch/storage errors.
- Add explicit patient context before AI generation to prevent wrong-patient actions.
- Fix Radix description warnings at callsites with meaningful descriptions, not a global silence switch.
- Test browser-permission and blocked-storage paths directly because they are hard to infer from happy-path rendering.

## Skill Created

- `.claude/skills/production-readiness-hardening/SKILL.md`
