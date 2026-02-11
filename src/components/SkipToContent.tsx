import * as React from "react";

/**
 * Accessible skip-to-content link. Visible only on keyboard focus,
 * allowing keyboard users to skip past navigation to main content.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
