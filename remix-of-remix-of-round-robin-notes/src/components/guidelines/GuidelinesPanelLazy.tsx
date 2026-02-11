/**
 * Guidelines Panel Lazy Loader
 * Lazy loads the panel content for better initial performance
 */

import React, { Suspense, lazy } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClinicalGuidelinesState } from '@/contexts/ClinicalGuidelinesContext';

const GuidelinesPanelContent = lazy(() => import('./GuidelinesPanelContent'));

function PanelSkeleton() {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading guidelines...</span>
      </div>
    </div>
  );
}

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <h3 className="font-medium text-lg">Failed to load guidelines</h3>
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
  { children: React.ReactNode; onClose?: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onClose?: () => void }) {
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

export function GuidelinesPanelLazy() {
  const { isOpen } = useClinicalGuidelinesState();

  if (!isOpen) return null;

  return (
    <GuidelinesErrorBoundary>
      <Suspense fallback={<PanelSkeleton />}>
        <GuidelinesPanelContent />
      </Suspense>
    </GuidelinesErrorBoundary>
  );
}
