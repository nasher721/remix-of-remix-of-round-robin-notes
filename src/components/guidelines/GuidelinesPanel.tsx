/**
 * Guidelines Panel with Floating Trigger
 * Lazy loads the panel content and shows a floating button when closed
 */

import React, { Suspense, memo } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClinicalGuidelinesState } from '@/contexts/ClinicalGuidelinesContext';

// Lazy load the heavy panel component
const GuidelinesPanelContent = React.lazy(() => import('./GuidelinesPanelContent'));

function GuidelinesPanelComponent() {
  const { isOpen, togglePanel } = useClinicalGuidelinesState();

  if (!isOpen) {
    return (
      <Button
        onClick={togglePanel}
        className="fixed right-4 bottom-20 z-50 h-12 w-12 rounded-full shadow-lg bg-secondary hover:bg-secondary/90 border border-border transition-all hover:scale-105"
        title="Clinical Guidelines (Ctrl+G)"
      >
        <FileText className="h-5 w-5 text-foreground" />
      </Button>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex items-center justify-center">
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
