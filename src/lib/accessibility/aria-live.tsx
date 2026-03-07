/**
 * ARIA Live Region Announcer
 * 
 * Provides a way to announce messages to screen readers
 * without visual changes to the UI.
 */

import * as React from 'react';

// Global announcer for convenience
let globalAnnouncer: ((message: string, priority?: 'polite' | 'assertive') => void) | null = null;

export function setGlobalAnnouncer(announcer: typeof globalAnnouncer) {
  globalAnnouncer = announcer;
}

/**
 * Announce a message to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  if (globalAnnouncer) {
    globalAnnouncer(message, priority);
  }
}

interface AriaLiveProps {
  children: React.ReactNode;
}

/**
 * Provider component that creates aria-live regions
 */
export function AriaLiveProvider({ children }: AriaLiveProps) {
  const [politeMessage, setPoliteMessage] = React.useState('');
  const [assertiveMessage, setAssertiveMessage] = React.useState('');

  const announceMessage = React.useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage(message);
    } else {
      setPoliteMessage(message);
    }
  }, []);

  React.useEffect(() => {
    setGlobalAnnouncer(announceMessage);
    return () => {
      setGlobalAnnouncer(null);
    };
  }, [announceMessage]);

  // Clear messages after they're announced
  React.useEffect(() => {
    if (politeMessage) {
      const timer = setTimeout(() => setPoliteMessage(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [politeMessage]);

  React.useEffect(() => {
    if (assertiveMessage) {
      const timer = setTimeout(() => setAssertiveMessage(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [assertiveMessage]);

  return (
    <>
      {children}
      {/* Aria-live regions - visually hidden but announced by screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {politeMessage}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      >
        {assertiveMessage}
      </div>
    </>
  );
}

/**
 * Hook to use the announcer in components
 */
export function useAnnouncer() {
  return {
    announce: React.useCallback((message: string, priority?: 'polite' | 'assertive') => {
      announce(message, priority);
    }, []),
  };
}
