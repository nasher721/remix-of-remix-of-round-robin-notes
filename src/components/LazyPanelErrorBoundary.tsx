/**
 * Shared error boundary and fallback for lazy-loaded panels (IBCC, Guidelines, etc.).
 * Use when wrapping React.lazy() content so load errors show a consistent retry UI.
 */

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LazyPanelErrorFallbackProps {
  title: string;
  error: Error;
  onRetry: () => void;
  /** Optional wrapper className (e.g. "h-full w-full bg-card" or "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l") */
  className?: string;
}

export function LazyPanelErrorFallback({
  title,
  error,
  onRetry,
  className,
}: LazyPanelErrorFallbackProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center p-6",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
        <div>
          <h3 className="font-medium text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error.message || "An unexpected error occurred"}
          </p>
        </div>
        <Button onClick={onRetry} variant="outline" className="gap-2" type="button">
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try Again
        </Button>
      </div>
    </div>
  );
}

export interface LazyPanelErrorBoundaryProps {
  children: React.ReactNode;
  /** Title shown in the fallback (e.g. "Failed to load IBCC Reference") */
  title: string;
  /** Optional wrapper className for the fallback container */
  fallbackClassName?: string;
}

interface LazyPanelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class LazyPanelErrorBoundary extends React.Component<
  LazyPanelErrorBoundaryProps,
  LazyPanelErrorBoundaryState
> {
  constructor(props: LazyPanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LazyPanelErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[LazyPanelErrorBoundary]", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <LazyPanelErrorFallback
          title={this.props.title}
          error={this.state.error}
          onRetry={this.handleReset}
          className={this.props.fallbackClassName}
        />
      );
    }
    return this.props.children;
  }
}
