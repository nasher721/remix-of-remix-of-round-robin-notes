/**
 * Loading Fallback Components
 * 
 * Provides consistent loading states for Suspense boundaries
 * and data loading scenarios.
 * 
 * @module LoadingFallback
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Props for loading fallback components
 */
interface LoadingFallbackProps {
  /** Optional message to display */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Full page loading fallback for route-level code splitting
 */
export function PageLoadingFallback({ message = 'Loading...', className }: LoadingFallbackProps): React.ReactElement {
  return (
    <div className={cn('min-h-screen flex flex-col items-center justify-center bg-background', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}

/**
 * Inline loading fallback for component-level code splitting
 */
export function ComponentLoadingFallback({ message, className }: LoadingFallbackProps): React.ReactElement {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      {message && <span className="ml-2 text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}

/**
 * Card skeleton for loading patient cards
 */
export function PatientCardSkeleton(): React.ReactElement {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

/**
 * List skeleton for loading patient lists
 */
export function PatientListSkeleton({ count = 3 }: { count?: number }): React.ReactElement {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <PatientCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Table skeleton for loading data tables
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }): React.ReactElement {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/50 p-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-3 flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Form skeleton for loading forms
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }): React.ReactElement {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 mt-6" />
    </div>
  );
}

/**
 * Dashboard skeleton for initial load
 */
export function DashboardSkeleton(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>
      
      {/* Action bar */}
      <div className="border-b p-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto p-4">
        <PatientListSkeleton count={3} />
      </div>
    </div>
  );
}

/**
 * Spinner component for inline loading indicators
 */
export function Spinner({ size = 'default', className }: { size?: 'sm' | 'default' | 'lg'; className?: string }): React.ReactElement {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8',
  };
  
  return <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />;
}
