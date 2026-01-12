/**
 * Lazy IBCC Panel Wrapper
 * Only renders the full panel when opened for better performance
 */

import React, { Suspense, memo } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIBCCState } from '@/contexts/IBCCContext';

// Lazy load the heavy panel component
const IBCCPanelContent = React.lazy(() => import('./IBCCPanelContent'));

function IBCCPanelComponent() {
  const { isOpen, togglePanel, hasContextSuggestions } = useIBCCState();

  if (!isOpen) {
    return (
      <Button
        onClick={togglePanel}
        className="fixed right-4 bottom-4 z-50 h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all hover:scale-105"
        title="Open IBCC Reference (Ctrl+I)"
      >
        <BookOpen className="h-5 w-5" />
        {hasContextSuggestions && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] animate-pulse"
          >
            !
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Loading IBCC Reference...</p>
          </div>
        </div>
      }
    >
      <IBCCPanelContent />
    </Suspense>
  );
}

export const IBCCPanel = memo(IBCCPanelComponent);
