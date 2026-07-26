# Task 1 Report: Desktop roster visibility (sidebar height)

## Status

Completed.

## Requirements implemented

- Added a focused source/layout contract test at `src/components/dashboard/__tests__/rosterVisibility.layout.test.ts`.
- Updated `src/components/dashboard/VirtualizedPatientList.tsx` so the sidebar roster no longer uses the `max-h-[42vh]` clamp.
- Preserved the desktop height contract with `lg:h-full`, `lg:min-h-0`, and `ScrollArea` as `flex-1 min-h-0`.
- Kept a bounded small-screen roster height by replacing the old clamp with `max-h-[60vh]`.
- Left `DesktopDashboard.tsx` unchanged because the parent layout already provides a full-height flex slot and this task’s regression was local to `VirtualizedPatientList`.

## TDD evidence

### RED

1. Added the failing contract test first:
   - `src/components/dashboard/__tests__/rosterVisibility.layout.test.ts`
2. Ran the required command from the brief:

```bash
npm test -- src/components/dashboard/__tests__/rosterVisibility.layout.test.ts
```

Observed result:
- TAP summary reported `fail 1`.
- The new test failed because `VirtualizedPatientList.tsx` still contained `max-h-[42vh]`.

Note:
- The repository `npm test` script currently chains setup commands after the test run, so the shell command returns exit code `0` even when TAP reports failures. I used the TAP summary (`fail 1` vs `fail 0`) as the authoritative RED/GREEN signal for this task.

### GREEN

1. Changed the sidebar aside class in `src/components/dashboard/VirtualizedPatientList.tsx`:
   - Replaced `max-h-[42vh]` with `max-h-[60vh]`
   - Kept `lg:h-full lg:min-h-0 lg:max-h-none`
2. Re-ran the same required command:

```bash
npm test -- src/components/dashboard/__tests__/rosterVisibility.layout.test.ts
```

Observed result:
- TAP summary reported `pass 342`, `fail 0`.

## Files changed

- `src/components/dashboard/VirtualizedPatientList.tsx`
- `src/components/dashboard/__tests__/rosterVisibility.layout.test.ts`

## Commit

- `65d3a83` — `fix(dashboard): make desktop patient roster fill workspace height`

## Self-review

- Confirmed the change is scoped to the requested roster sidebar component and test.
- Confirmed no new dependencies were added.
- Confirmed no offline write-queue behavior or patient-hook architecture was changed.
- Confirmed unrelated untracked workspace content (`docs/superpowers/`) was not staged.
- Confirmed the required focused verification command was run before and after the implementation.

## Concerns

- The current `npm test` script is not truly focused and masks test failures at the shell exit-code level because of chained `; node .github/setup.js` commands. This did not block task completion, but it is worth cleaning up separately if reliable CI/local failure detection is important.

## Review-finding follow-up

- Tightened `src/components/dashboard/__tests__/rosterVisibility.layout.test.ts` so it validates the specific `<aside aria-label="Patient list">` contract instead of only scanning the file for global class tokens.
- Locked the desktop roster invariant by asserting that the aside carries `lg:h-full`, `lg:min-h-0`, and `lg:max-h-none`.
- Added a guard that rejects any desktop `lg:max-h-*` class on that aside other than `lg:max-h-none`.

### Verification

Command run:

```bash
npm test -- src/components/dashboard/__tests__/rosterVisibility.layout.test.ts
```

Observed result:

- TAP summary reported `pass 342`, `fail 0`.

## Review-finding follow-up (ScrollArea scoping)

### Fix

- Scoped the ScrollArea assertion in `src/components/dashboard/__tests__/rosterVisibility.layout.test.ts` to the patient-list scroll container with `id="desktop-patient-list-content"`, so the test no longer matches the two other `ScrollArea` instances in `VirtualizedPatientList.tsx`.

### Verification

Command run:

```bash
npm test -- src/components/dashboard/__tests__/rosterVisibility.layout.test.ts
```

Observed result:

- Subtest `desktop sidebar roster fills workspace height without a 42vh clamp`: **ok**
- TAP summary reported `pass 342`, `fail 0`.

### Commit

- `a001fde` — `test(dashboard): scope roster ScrollArea assertion to patient list container`
