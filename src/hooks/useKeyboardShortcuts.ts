import { useEffect, useCallback } from "react";

export interface KeyboardShortcutActions {
  onAddPatient?: () => void;
  onSearch?: () => void;
  onCollapseAll?: () => void;
  onPrint?: () => void;
}

/**
 * Provides keyboard shortcuts for common rounding actions.
 * All shortcuts use Ctrl/Cmd modifier to avoid conflicts with text editing.
 *
 * Shortcuts:
 * - Ctrl+Shift+N: Add new patient
 * - Ctrl+K or Ctrl+Shift+F: Focus search bar
 * - Ctrl+Shift+C: Collapse/expand all patients
 * - Ctrl+P: Print/export (overrides browser print)
 */
export function useKeyboardShortcuts(actions: KeyboardShortcutActions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;

      // Don't trigger shortcuts when typing in inputs (unless it's search-related)
      const target = event.target as HTMLElement;
      const isEditing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Ctrl+K: Focus search (works even in inputs)
      if (event.key === "k") {
        event.preventDefault();
        actions.onSearch?.();
        return;
      }

      // Skip other shortcuts when editing
      if (isEditing) return;

      // Ctrl+Shift+N: Add new patient
      if (event.shiftKey && event.key === "N") {
        event.preventDefault();
        actions.onAddPatient?.();
        return;
      }

      // Ctrl+Shift+F: Focus search (alternative)
      if (event.shiftKey && event.key === "F") {
        event.preventDefault();
        actions.onSearch?.();
        return;
      }

      // Ctrl+Shift+C: Collapse all
      if (event.shiftKey && event.key === "C") {
        event.preventDefault();
        actions.onCollapseAll?.();
        return;
      }

      // Ctrl+P: Print/export
      if (event.key === "p") {
        event.preventDefault();
        actions.onPrint?.();
        return;
      }
    },
    [actions]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
