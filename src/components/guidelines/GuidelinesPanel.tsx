/**
 * Guidelines Panel with Error Boundary
 * Lazy loads the panel content for better performance
 */

import React, { Suspense, memo } from 'react';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy load the heavy panel component
const GuidelinesPanelContent = React.lazy(() => import('./GuidelinesPanelContent'));

function GuidelinesPanelComponent() {
  // The panel is now natively embedded in the DesktopDashboard Resources tab,
  // so we no longer need the floating toggle button or isOpen check.

  return (
    <ErrorBoundary componentName="Clinical Guidelines">
      <Suspense
        fallback={
          <div className="h-full w-full bg-card flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Loading Clinical Guidelines...</p>
            </div>
          </div>
        }
      >
        <GuidelinesPanelContent />
      </Suspense>
    </ErrorBoundary>
  );
}

export const GuidelinesPanel = memo(GuidelinesPanelComponent);
