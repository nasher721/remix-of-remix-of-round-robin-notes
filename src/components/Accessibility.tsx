/**
 * Accessibility Components
 * 
 * Provides skip links, screen reader announcements, and focus management
 * for WCAG 2.1 AA compliance.
 * 
 * @module Accessibility
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skip Links Component
 * 
 * Provides keyboard users with quick navigation to main content areas.
 * These links are visually hidden until focused.
 * 
 * @example
 * ```tsx
 * <SkipLinks />
 * <header>...</header>
 * <main id="main-content">...</main>
 * ```
 */
export function SkipLinks(): React.ReactElement {
  const links = [
    { href: '#main-content', label: 'Skip to main content' },
    { href: '#patient-list', label: 'Skip to patient list' },
    { href: '#search', label: 'Skip to search' },
  ];

  return (
    <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <ul className="fixed top-0 left-0 z-[100] flex gap-2 p-2 bg-background">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className={cn(
                'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2',
                'px-4 py-2 bg-primary text-primary-foreground rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
              )}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Screen Reader Announcer
 * 
 * Announces dynamic content changes to screen readers using ARIA live regions.
 * Uses a singleton pattern to prevent duplicate announcements.
 */
interface AnnouncerContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = React.createContext<AnnouncerContextType | null>(null);

export function AnnouncerProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [politeMessage, setPoliteMessage] = React.useState('');
  const [assertiveMessage, setAssertiveMessage] = React.useState('');

  const announce = React.useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage('');
      // Small delay to ensure the change is announced
      setTimeout(() => setAssertiveMessage(message), 50);
    } else {
      setPoliteMessage('');
      setTimeout(() => setPoliteMessage(message), 50);
    }
  }, []);

  const value = React.useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      {/* Polite announcements for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      {/* Assertive announcements for urgent updates */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

/**
 * Hook to access the screen reader announcer
 */
export function useAnnouncer(): AnnouncerContextType {
  const context = React.useContext(AnnouncerContext);
  if (!context) {
    // Return a no-op if not wrapped in provider
    return { announce: () => {} };
  }
  return context;
}

/**
 * Focus Trap Component
 * 
 * Traps focus within a container, useful for modals and dialogs.
 */
interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  returnFocus?: boolean;
}

export function FocusTrap({ children, active = true, returnFocus = true }: FocusTrapProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<Element | null>(null);

  React.useEffect(() => {
    if (!active) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement;

    // Focus the first focusable element in the container
    const container = containerRef.current;
    if (container) {
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }

    return () => {
      // Return focus to the previously focused element
      if (returnFocus && previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, returnFocus]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (!active || event.key !== 'Tab') return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  }, [active]);

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}

/**
 * Visually Hidden Component
 * 
 * Hides content visually while keeping it accessible to screen readers.
 */
export function VisuallyHidden({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>): React.ReactElement {
  return (
    <span className="sr-only" {...props}>
      {children}
    </span>
  );
}

/**
 * Hook to manage focus on route changes
 */
export function useRouteAnnouncement(pageTitle: string): void {
  const { announce } = useAnnouncer();

  React.useEffect(() => {
    // Announce page title on route change
    announce(`Navigated to ${pageTitle}`, 'polite');
    
    // Update document title
    document.title = `${pageTitle} | Patient Rounding Assistant`;
  }, [pageTitle, announce]);
}

/**
 * Hook for managing keyboard shortcuts with proper accessibility
 */
interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shiftKey === event.shiftKey;
        const altMatch = !!shortcut.altKey === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/**
 * Keyboard Shortcuts Help Dialog Content
 */
export function KeyboardShortcutsHelp(): React.ReactElement {
  const shortcuts = [
    { keys: 'Ctrl + I', description: 'Open IBCC Reference' },
    { keys: 'Ctrl + Shift + M', description: 'Toggle Change Tracking' },
    { keys: 'Ctrl + Shift + D', description: 'Start Dictation' },
    { keys: 'Ctrl + S', description: 'Save (auto-saves)' },
    { keys: 'Ctrl + P', description: 'Print / Export' },
    { keys: 'Escape', description: 'Close current panel' },
    { keys: '?', description: 'Show this help' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
      <dl className="space-y-2">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.keys} className="flex justify-between items-center py-1">
            <dt className="text-muted-foreground">{shortcut.description}</dt>
            <dd>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                {shortcut.keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
