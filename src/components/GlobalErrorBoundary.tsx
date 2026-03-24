import * as React from "react";
import { AlertTriangle, RefreshCw, Copy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordTelemetryEvent, exportDiagnosticsReport } from "@/lib/observability/telemetry";
import { captureExceptionToSentry } from "@/lib/observability/sentryClient";
import { toast } from "sonner";

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
    recordTelemetryEvent('render_error', error, {
      componentStack: errorInfo.componentStack?.slice(0, 1000),
    });
    captureExceptionToSentry(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } },
    });
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

  handleCopyDiagnostics = async () => {
    try {
      const text = await exportDiagnosticsReport();
      await navigator.clipboard.writeText(text);
      toast.success("Full diagnostics copied (fingerprints, stacks, navigation trail).");
    } catch {
      toast.error("Could not copy diagnostics.");
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, showDetails } = this.state;

      return (
        <main className="min-h-screen bg-background flex items-center justify-center p-6" id="main-content">
          <div className="max-w-md w-full text-center space-y-6" role="alert" aria-live="assertive">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Your data has been saved. Please reload the page to continue.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button type="button" onClick={this.handleReload} className="w-full min-h-[44px] gap-2">
                <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                Reload Page
              </Button>

              <button
                type="button"
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-expanded={showDetails}
                aria-controls="global-error-details"
              >
                <ChevronDown
                  className={`h-3 w-3 shrink-0 transition-transform motion-reduce:transition-none ${showDetails ? "rotate-180" : ""}`}
                  aria-hidden
                />
                {showDetails ? "Hide" : "Show"} error details
              </button>

              {showDetails && error && (
                <div
                  id="global-error-details"
                  className="text-left bg-muted/50 border rounded-md p-3 space-y-2"
                >
                  <p className="text-xs font-mono text-destructive break-all">
                    {error.name}: {error.message}
                  </p>
                  {error.stack && (
                    <pre className="text-[10px] font-mono text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap break-all">
                      {error.stack}
                    </pre>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={this.handleCopyError}
                      className="gap-1 text-xs min-h-9"
                    >
                      <Copy className="h-3 w-3 shrink-0" aria-hidden />
                      Copy error
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={this.handleCopyDiagnostics}
                      className="gap-1 text-xs min-h-9"
                    >
                      <Copy className="h-3 w-3 shrink-0" aria-hidden />
                      Copy diagnostics
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
