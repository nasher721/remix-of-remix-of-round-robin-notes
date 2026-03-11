/**
 * Guidelines Panel
 * Lazy loads the panel content for performance. Renders content directly
 * when embedded (e.g. in a tab), without a floating toggle button.
 */

import React, { Suspense, memo } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the heavy panel component
const GuidelinesPanelContent = React.lazy(() => import('./GuidelinesPanelContent'));

function GuidelinesPanelComponent() {
  return (
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
  );
}

export const GuidelinesPanel = memo(GuidelinesPanelComponent);
