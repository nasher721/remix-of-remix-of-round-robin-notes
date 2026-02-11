import * as React from "react";
import { AlertTriangle, RefreshCw, Copy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyError = () => {
    const { error } = this.state;
    if (error) {
      navigator.clipboard.writeText(`${error.name}: ${error.message}\n\n${error.stack || ""}`);
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, showDetails } = this.state;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Your data has been saved. Please reload the page to continue.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={this.handleReload} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </Button>

              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
                {showDetails ? "Hide" : "Show"} error details
              </button>

              {showDetails && error && (
                <div className="text-left bg-muted/50 border rounded-md p-3 space-y-2">
                  <p className="text-xs font-mono text-destructive break-all">
                    {error.name}: {error.message}
                  </p>
                  {error.stack && (
                    <pre className="text-[10px] font-mono text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap break-all">
                      {error.stack}
                    </pre>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleCopyError}
                    className="gap-1 text-xs h-7"
                  >
                    <Copy className="h-3 w-3" />
                    Copy error
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
