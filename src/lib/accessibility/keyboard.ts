/**
 * Keyboard Navigation Utilities
 * 
 * Provides hooks and utilities for keyboard navigation,
 * focus management, and accessible interactions.
 */

import * as React from 'react';
import { useMediaQuery } from '@/hooks/use-media';

// Common key codes
export const Keys = {
  Enter: 'Enter',
  Escape: 'Escape',
  Space: ' ',
  Tab: 'Tab',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
} as const;

/**
 * Hook for managing focus within a container
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  options: { enabled?: boolean; returnFocus?: boolean } = {}
) {
  const { enabled = true, returnFocus = true } = options;
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element
    const container = containerRef.current;
    if (container) {
      const focusableElements = getFocusableElements(container);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    // Handle Tab key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== Keys.Tab || !container) return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift + Tab on first element -> wrap to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // Tab on last element -> wrap to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore previous focus
      if (returnFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [enabled, returnFocus, containerRef]);
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
  ].join(', ');

  return Array.from(container.querySelectorAll(selector)).filter(
    (el): el is HTMLElement => {
      // Check visibility
      const style = window.getComputedStyle(el as Element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
  );
}

/**
 * Hook for roving tabindex pattern
 * Used for lists, menus, toolbars, etc.
 */
export function useRovingTabIndex(
  containerRef: React.RefObject<HTMLElement>,
  orientation: 'horizontal' | 'vertical' = 'vertical'
) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) return;

      let nextIndex = activeIndex;

      switch (e.key) {
        case orientation === 'vertical' ? Keys.ArrowDown : Keys.ArrowRight:
          e.preventDefault();
          nextIndex = (activeIndex + 1) % focusableElements.length;
          break;
        case orientation === 'vertical' ? Keys.ArrowUp : Keys.ArrowLeft:
          e.preventDefault();
          nextIndex = (activeIndex - 1 + focusableElements.length) % focusableElements.length;
          break;
        case Keys.Home:
          e.preventDefault();
          nextIndex = 0;
          break;
        case Keys.End:
          e.preventDefault();
          nextIndex = focusableElements.length - 1;
          break;
        default:
          return;
      }

      setActiveIndex(nextIndex);
      focusableElements[nextIndex].focus();
    },
    [activeIndex, containerRef, orientation]
  );

  return { activeIndex, handleKeyDown };
}

/**
 * Hook for managing focus on mount
 */
export function useAutoFocus<T extends HTMLElement>(
  options: { enabled?: boolean; delay?: number } = {}
) {
  const { enabled = true, delay = 0 } = options;
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      ref.current?.focus();
    }, delay);

    return () => clearTimeout(timer);
  }, [enabled, delay]);

  return ref;
}

/**
 * Hook for managing focus when dependencies change
 */
export function useFocusOnChange<T extends HTMLElement>(
  deps: React.DependencyList,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (!enabled) return;
    ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Hook for escape key handling
 */
export function useEscapeKey(
  onEscape: () => void,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === Keys.Escape) {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onEscape]);
}

/**
 * Check if the current device supports hover (mouse)
 */
export function useHasHover(): boolean {
  return useMediaQuery('(hover: hover)');
}

/**
 * Check if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook for accessible click outside handling
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  onClickOutside: () => void,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  React.useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [enabled, onClickOutside, ref]);
}

/**
 * Create accessible button props for non-button elements
 */
export function createAccessibleButtonProps(
  onClick: () => void,
  options: { role?: string; label?: string } = {}
): React.HTMLAttributes<HTMLElement> {
  const { role = 'button', label } = options;

  return {
    role,
    tabIndex: 0,
    'aria-label': label,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === Keys.Enter || e.key === Keys.Space) {
        e.preventDefault();
        onClick();
      }
    },
  };
}
