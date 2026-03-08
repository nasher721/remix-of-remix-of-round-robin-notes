/**
 * Guidelines Panel with Error Boundary
 * Lazy loads the panel content for better performance
 */

import React, { Suspense, memo } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Lazy load the heavy panel component
const GuidelinesPanelContent = React.lazy(() => import('./GuidelinesPanelContent'));

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="h-full w-full bg-card flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <h3 className="font-medium text-lg">Failed to load Guidelines</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error.message || 'An unexpected error occurred'}
          </p>
        </div>
        <Button onClick={resetErrorBoundary} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GuidelinesErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GuidelinesPanel] Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

function GuidelinesPanelComponent() {
  // The panel is now natively embedded in the DesktopDashboard Resources tab,
  // so we no longer need the floating toggle button or isOpen check.

  return (
    <GuidelinesErrorBoundary>
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
    </GuidelinesErrorBoundary>
  );
}

export const GuidelinesPanel = memo(GuidelinesPanelComponent);
