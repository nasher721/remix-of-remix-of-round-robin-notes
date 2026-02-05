/**
 * AI Error Boundary
 * Provides graceful degradation for AI-generated content sections.
 * Catches rendering errors and displays a user-friendly fallback UI.
 */

import * as React from 'react';
import { AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface AIErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback component to render on error */
  fallback?: React.ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Label for the feature that failed (e.g., "Differential Diagnosis") */
  featureLabel?: string;
  /** Whether to show a compact error message */
  compact?: boolean;
  /** Custom className for the error container */
  className?: string;
}

interface AIErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export class AIErrorBoundary extends React.Component<AIErrorBoundaryProps, AIErrorBoundaryState> {
  constructor(props: AIErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AIErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error for debugging
    console.error('[AIErrorBoundary] Caught error:', error);
    console.error('[AIErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  handleCopyError = (): void => {
    const { error, errorInfo } = this.state;
    const errorText = `Error: ${error?.message || 'Unknown error'}\n\nStack: ${error?.stack || 'No stack trace'}\n\nComponent Stack: ${errorInfo?.componentStack || 'No component stack'}`;
    navigator.clipboard.writeText(errorText);
  };

  toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render(): React.ReactNode {
    const { hasError, error, showDetails } = this.state;
    const { children, fallback, featureLabel, compact, className } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Compact error message
      if (compact) {
        return (
          <div className={cn("p-3 bg-destructive/10 border border-destructive/30 rounded-lg", className)}>
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                {featureLabel ? `Failed to render ${featureLabel}` : 'Failed to render AI content'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={this.handleReset}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        );
      }

      // Full error display
      return (
        <Alert variant="destructive" className={cn("my-4", className)}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>
              {featureLabel ? `Error in ${featureLabel}` : 'Error Rendering AI Content'}
            </span>
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm mb-3">
              Something went wrong while displaying this content. This might be due to an unexpected response format from the AI.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Try Again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={this.toggleDetails}
                className="gap-1"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show Details
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={this.handleCopyError}
                className="gap-1"
              >
                <Copy className="h-3 w-3" />
                Copy Error
              </Button>
            </div>

            {showDetails && error && (
              <div className="mt-3 p-2 bg-muted rounded text-xs font-mono overflow-auto max-h-32">
                <div className="text-destructive font-medium">{error.name}: {error.message}</div>
                {error.stack && (
                  <pre className="mt-2 text-muted-foreground whitespace-pre-wrap">
                    {error.stack.split('\n').slice(1, 5).join('\n')}
                  </pre>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return children;
  }
}

/**
 * Hook-friendly wrapper for AIErrorBoundary
 * Use this when you need to reset the error boundary from a parent component
 */
interface AIErrorBoundaryWithKeyProps extends AIErrorBoundaryProps {
  resetKey?: string | number;
}

export function AIErrorBoundaryWithKey({ resetKey, ...props }: AIErrorBoundaryWithKeyProps) {
  return <AIErrorBoundary key={resetKey} {...props} />;
}

/**
 * Wrapper component for AI content sections that provides error boundary protection.
 * Useful for wrapping sections that display AI-generated content.
 */
interface AIContentWrapperProps {
  children: React.ReactNode;
  featureLabel?: string;
  compact?: boolean;
  className?: string;
}

export function AIContentWrapper({ children, featureLabel, compact, className }: AIContentWrapperProps) {
  return (
    <AIErrorBoundary featureLabel={featureLabel} compact={compact} className={className}>
      {children}
    </AIErrorBoundary>
  );
}
