import * as React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEdgeHealth } from '@/contexts/EdgeHealthContext';
import { cn } from '@/lib/utils';

/**
 * Shown when edge healthcheck reports unhealthy (e.g. deploy / DB issues).
 * Dismiss is session-only; status re-checks on interval and on refresh.
 */
export const BackendStatusBanner = (): React.ReactElement | null => {
  const ctx = useEdgeHealth();
  if (!ctx || ctx.status !== 'unhealthy' || ctx.bannerDismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-between gap-3 border-b px-4 py-2 text-sm',
        'bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100',
        'border-amber-500/40',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">
          Backend services may be updating. AI and parsing actions may fail until ready.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-h-[44px] sm:min-h-0 sm:h-8 shrink-0"
          onClick={() => void ctx.refresh({ force: true })}
        >
          Retry check
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-8 sm:w-8 shrink-0"
          onClick={ctx.dismissBanner}
          aria-label="Dismiss backend status banner"
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
};
