import * as React from 'react';
import { logError } from '@/lib/observability/logger';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Production-ready Error Boundary with Sentry integration
 * and user-friendly fallback UI
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { componentName, onError } = this.props;
    
    // Log to console and Sentry (logError calls captureException internally)
    logError(`Error in ${componentName || 'component'}`, {
      error,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      component: componentName,
    });

    this.setState({ errorInfo });
    
    onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.state.hasError &&
      this.props.resetOnPropsChange &&
      prevProps.children !== this.props.children
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <ErrorFallback
          error={this.state.error}
          componentName={this.props.componentName}
          onReset={this.reset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
function ErrorFallback({
  error,
  componentName,
  onReset,
}: {
  error: Error | null;
  componentName?: string;
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = React.useState(false);

  const handleGoHome = () => {
    navigate('/');
    onReset();
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Something went wrong
          </h2>
        </div>

        <p className="text-gray-600 mb-4">
          We apologize for the inconvenience. An error occurred
          {componentName ? ` in the ${componentName} component` : ''}.
          Our team has been notified and is working to fix the issue.
        </p>

        <div className="space-y-2 mb-4">
          <Button
            onClick={onReset}
            className="w-full"
            variant="default"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          
          <Button
            onClick={handleGoHome}
            className="w-full"
            variant="outline"
          >
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {showDetails ? 'Hide' : 'Show'} technical details
        </button>

        {showDetails && error && (
          <div className="mt-4 p-3 bg-gray-50 rounded text-sm font-mono text-gray-700 overflow-auto">
            <p className="font-semibold">Error:</p>
            <p className="text-red-600">{error.message}</p>
            {error.stack && (
              <>
                <p className="font-semibold mt-2">Stack:</p>
                <pre className="text-xs whitespace-pre-wrap">{error.stack}</pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Async Error Boundary - catches errors in async operations
 * Wraps children and provides error state management
 */
export function AsyncErrorBoundary({
  children,
  onError,
}: {
  children: (props: {
    error: Error | null;
    clearError: () => void;
  }) => React.ReactNode;
  onError?: (error: Error) => void;
}) {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(event.error);
      onError?.(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [onError]);

  const clearError = () => setError(null);

  return <>{children({ error, clearError })}</>;
}

/**
 * Hook to report errors to Sentry from functional components
 */
export function useErrorReporter() {
  const reportError = React.useCallback((error: Error, context?: Record<string, unknown>) => {
    logError('Error reported from component', { error, ...context });
  }, []);

  return { reportError };
}
