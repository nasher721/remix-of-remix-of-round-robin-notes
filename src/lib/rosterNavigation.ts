/**
 * Keyboard navigation math for the desktop patient roster rail.
 *
 * Kept as a pure function (no DOM, no React) so the wrap-around and clamping
 * rules that decide which chart a clinician lands on are unit-testable on their
 * own. The rail owns focus movement and selection; this module only answers
 * "which index does this key go to?".
 */

/** Rows moved by PageUp / PageDown in one press. */
export const ROSTER_PAGE_STEP = 5;

const clamp = (index: number, count: number): number =>
  Math.min(Math.max(index, 0), count - 1);

/**
 * Resolves the roster index a navigation key should move to.
 *
 * - `ArrowDown` / `ArrowUp` step by one and wrap around the ends, matching the
 *   existing `Cmd/Ctrl + ]` / `[` patient shortcuts.
 * - `Home` / `End` jump to the first / last patient.
 * - `PageDown` / `PageUp` jump by {@link ROSTER_PAGE_STEP} rows and clamp
 *   instead of wrapping, so a long roster cannot skip past an end.
 *
 * @param key - `KeyboardEvent.key`.
 * @param currentIndex - Index of the selected row, or `-1` when none is selected.
 * @param count - Number of rows currently rendered.
 * @returns The target index, or `null` when the key is not a navigation key or
 * there is nothing to navigate (callers should not `preventDefault` on `null`).
 */
export function resolveRosterNavigationIndex(
  key: string,
  currentIndex: number,
  count: number,
): number | null {
  if (count <= 0) return null;

  const hasSelection = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < count;
  const current = hasSelection ? currentIndex : -1;

  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : (current + 1) % count;
    case "ArrowUp":
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "PageDown":
      return clamp((current < 0 ? 0 : current) + ROSTER_PAGE_STEP, count);
    case "PageUp":
      return clamp((current < 0 ? count - 1 : current) - ROSTER_PAGE_STEP, count);
    default:
      return null;
  }
}
