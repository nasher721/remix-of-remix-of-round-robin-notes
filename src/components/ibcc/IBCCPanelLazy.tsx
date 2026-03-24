/**
 * Lazy IBCC Panel Wrapper
 * Only renders the full panel when opened for better performance
 */

import React, { Suspense, memo } from "react";
import { Loader2 } from "lucide-react";
import { useIBCCState } from "@/contexts/IBCCContext";
import { LazyPanelErrorBoundary } from "@/components/LazyPanelErrorBoundary";

const IBCCPanelContent = React.lazy(() => import("./IBCCPanelContent"));

function IBCCPanelComponent() {
  useIBCCState();

  return (
    <LazyPanelErrorBoundary
      title="Failed to load IBCC Reference"
      fallbackClassName="h-full w-full bg-card flex items-center justify-center p-6"
    >
      <Suspense
        fallback={
          <div className="h-full w-full bg-card flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">Loading Clinical Reference…</p>
            </div>
          </div>
        }
      >
        <IBCCPanelContent />
      </Suspense>
    </LazyPanelErrorBoundary>
  );
}

export const IBCCPanel = memo(IBCCPanelComponent);
