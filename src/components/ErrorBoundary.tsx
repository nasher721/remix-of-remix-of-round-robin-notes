/**
 * Production-Ready Error Boundary Components
 * 
 * Provides graceful error handling with user-friendly UI,
 * error logging, and recovery options.
 * 
 * @module ErrorBoundary
 */

import * as React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { logger, getLogBuffer } from '@/lib/logger';

/**
 * Props for error fallback components
 */
export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  errorInfo?: React.ErrorInfo;
}

/**
 * Default page-level error fallback
 */
export function PageErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps): React.ReactElement {
  const handleGoHome = (): void => {
    window.location.href = '/';
  };

  const handleReload = (): void => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We're sorry, but something unexpected happened. Our team has been notified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {import.meta.env.DEV && (
            <details className="mt-4 rounded-lg bg-muted p-3 text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">
                Error Details (Development Only)
              </summary>
              <pre className="mt-2 overflow-auto text-xs text-destructive">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={resetErrorBoundary} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={handleReload} className="flex-1">
              Reload Page
            </Button>
            <Button variant="outline" onClick={handleGoHome} className="flex-1">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Compact error fallback for components
 */
export function ComponentErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 text-destructive">
        <Bug className="h-4 w-4" />
        <span className="text-sm font-medium">Component Error</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        This section encountered an error and couldn't load.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={resetErrorBoundary}
        className="mt-3"
      >
        <RefreshCw className="mr-2 h-3 w-3" />
        Retry
      </Button>
    </div>
  );
}

/**
 * Error fallback for data loading failures
 */
export function DataErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium">Unable to load data</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        There was a problem loading this content. Please check your connection and try again.
      </p>
      <Button variant="outline" onClick={resetErrorBoundary} className="mt-4">
        <RefreshCw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}

/**
 * Error Boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary props
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
}

/**
 * Main Error Boundary Component
 * 
 * Catches JavaScript errors in child component tree,
 * logs them, and displays a fallback UI.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary fallback={PageErrorFallback}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error
    logger.error('React Error Boundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      recentLogs: getLogBuffer().slice(-10),
    });

    // Store error info for display
    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || PageErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo || undefined}
          resetErrorBoundary={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper with auto-reset on navigation
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<ErrorFallbackProps>
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}
