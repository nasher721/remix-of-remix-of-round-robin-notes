import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Home, Menu, MoreHorizontal, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoundSyncStatus } from "@/types/round";
import { useRoundSession } from "@/contexts/RoundSessionContext";
import { safeLocalStorage, safeSessionStorage } from "@/utils/safeStorage";

export interface RoundChromeProps {
  onOpenRoster: () => void;
  /** Opens ToolsSheet (demoted panels). */
  onOpenTools: () => void;
  /** Quiet path to Round Home (Import / Start). */
  onGoHome?: () => void;
  /** Quiet path to Round End (Print / Export). */
  onEndRound?: () => void;
  /** Show Home / End beside Tools when mid-Focus. */
  showLifecycleActions?: boolean;
  className?: string;
  /**
   * Phone layout: ≥44px targets, Done/Next/Prev in a sticky bottom bar,
   * quieter top bar (roster · Round · N/M · Tools).
   * Pass `children` (Patient Focus) so the action bar sits under the chart.
   */
  touchFriendly?: boolean;
  children?: React.ReactNode;
  /** Optional overrides when the shell wires navigation itself. */
  onPrev?: () => void;
  onNext?: () => void;
  onDoneAndNext?: () => void;
}

const formatSyncCueLabel = (
  status: RoundSyncStatus,
  pendingCount: number,
): string | null => {
  if (status === "idle") return null;
  if (status === "offline") {
    return pendingCount > 0 ? `offline · ${pendingCount} pending` : "offline";
  }
  if (status === "syncing") {
    return pendingCount > 0 ? `syncing · ${pendingCount}` : "syncing";
  }
  if (status === "conflict") return "conflict";
  return null;
};

const formatChromeCueLabel = (
  status: RoundSyncStatus,
  pendingCount: number,
  isStorageDegraded: boolean,
): string | null => {
  const syncLabel = formatSyncCueLabel(status, pendingCount);
  if (syncLabel) {
    return isStorageDegraded ? `${syncLabel} · storage limited` : syncLabel;
  }
  if (isStorageDegraded) return "storage limited";
  return null;
};

/**
 * Quiet Round top chrome: roster, Round · N/M, sync cue slot, Tools, Done/Next.
 * No IBCC / AI / compare megabar.
 */
export const RoundChrome = ({
  onOpenRoster,
  onOpenTools,
  onGoHome,
  onEndRound,
  showLifecycleActions = false,
  className,
  touchFriendly = false,
  children,
  onPrev,
  onNext,
  onDoneAndNext,
}: RoundChromeProps) => {
  const {
    position,
    round,
    prevPatient,
    nextPatient,
    markDoneAndNext,
    openConflictDialog,
    conflicts,
    pendingCount,
  } = useRoundSession();

  const [isStorageDegraded, setIsStorageDegraded] = React.useState(() =>
    safeLocalStorage.isDegraded() || safeSessionStorage.isDegraded(),
  );
  React.useEffect(() => {
    if (isStorageDegraded) return;
    const timer = window.setInterval(() => {
      if (safeLocalStorage.isDegraded() || safeSessionStorage.isDegraded()) {
        setIsStorageDegraded(true);
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [isStorageDegraded]);

  const syncLabel = formatChromeCueLabel(round.syncStatus, pendingCount, isStorageDegraded);
  const isEmpty = position.total === 0;
  const atStart = isEmpty || position.current <= 1;
  const atEnd = isEmpty || position.current >= position.total;
  const hasConflicts = conflicts.length > 0 || round.syncStatus === "conflict";

  const handleOpenRoster = () => {
    onOpenRoster();
  };

  const handleOpenTools = () => {
    onOpenTools();
  };

  const handleGoHome = () => {
    onGoHome?.();
  };

  const handleEndRound = () => {
    onEndRound?.();
  };

  const handlePrev = () => {
    if (onPrev) {
      onPrev();
      return;
    }
    prevPatient();
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
      return;
    }
    nextPatient();
  };

  const handleDoneAndNext = () => {
    if (onDoneAndNext) {
      onDoneAndNext();
      return;
    }
    markDoneAndNext();
  };

  const handleSyncCueActivate = () => {
    if (!hasConflicts) return;
    openConflictDialog();
  };

  const handleSyncCueKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSyncCueActivate();
  };

  const iconBtnClass = touchFriendly
    ? "h-11 w-11 min-h-11 min-w-11 shrink-0 text-foreground/80 hover:text-foreground"
    : "h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground";

  const toolsBtnClass = touchFriendly
    ? "h-11 min-h-11 gap-1.5 px-3 text-foreground/80 hover:text-foreground"
    : "h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground";

  const actionBar = (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1",
        touchFriendly && "w-full gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2",
      )}
      data-testid={touchFriendly ? "round-chrome-actions" : undefined}
    >
      <Button
        type="button"
        variant="ghost"
        size={touchFriendly ? "default" : "icon"}
        className={cn(
          touchFriendly
            ? "h-11 min-h-11 flex-1 text-foreground/85 hover:text-foreground"
            : "h-9 w-9 text-muted-foreground hover:text-foreground",
        )}
        onClick={handlePrev}
        disabled={atStart}
        aria-label="Previous patient"
        title="Previous ([ or K)"
        data-testid="round-prev"
      >
        <ChevronLeft className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
        {touchFriendly && <span className="text-sm font-medium">Prev</span>}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          touchFriendly
            ? "h-11 min-h-11 flex-1 gap-1.5 px-3 border-border/50 bg-card text-foreground"
            : "h-9 gap-1.5 px-3",
        )}
        onClick={handleDoneAndNext}
        disabled={isEmpty}
        aria-label="Mark done and go to next patient"
        title="Done (D)"
        data-testid="round-done"
      >
        <Check className={cn(touchFriendly ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden="true" />
        <span className={cn("font-medium", touchFriendly ? "text-sm" : "text-xs")}>Done</span>
      </Button>

      <Button
        type="button"
        variant="default"
        size="sm"
        className={cn(
          touchFriendly ? "h-11 min-h-11 flex-1 gap-1.5 px-3" : "h-9 gap-1.5 px-3",
        )}
        onClick={handleNext}
        disabled={atEnd}
        aria-label="Next patient"
        title="Next (] or J)"
        data-testid="round-next"
      >
        <span className={cn("font-medium", touchFriendly ? "text-sm" : "text-xs")}>Next</span>
        <ChevronRight className={cn(touchFriendly ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden="true" />
      </Button>
    </div>
  );

  const header = (
    <header
      className={cn(
        "sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b border-border/30 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        touchFriendly ? "h-14 min-h-14 safe-area-top" : "h-12",
        className,
      )}
      data-testid="round-chrome"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={iconBtnClass}
        onClick={handleOpenRoster}
        aria-label="Open roster"
        title="Roster (R)"
        data-testid="round-roster-entry"
      >
        <Menu className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p
          className={cn(
            "truncate font-medium tracking-tight text-foreground",
            touchFriendly ? "text-base" : "text-sm text-foreground/90",
          )}
          aria-live="polite"
          data-testid="round-position"
        >
          Round · {position.current}/{position.total}
        </p>
        {/* Quiet offline / syncing / conflict cue */}
        {hasConflicts ? (
          <button
            type="button"
            className={cn(
              "truncate text-xs font-medium underline-offset-2 hover:underline",
              touchFriendly ? "text-amber-600 dark:text-amber-400" : "text-amber-700 dark:text-amber-400",
            )}
            data-testid="round-sync-cue"
            aria-live="polite"
            aria-label="Resolve field conflicts — tap to open"
            onClick={handleSyncCueActivate}
            onKeyDown={handleSyncCueKeyDown}
            tabIndex={0}
          >
            {pendingCount > 0 ? `conflict · ${pendingCount} pending` : "conflict — resolve"}
          </button>
        ) : (
          <span
            className={cn(
              "truncate text-xs",
              touchFriendly ? "text-foreground/70" : "text-muted-foreground",
              !syncLabel && "sr-only",
            )}
            data-testid="round-sync-cue"
            aria-live="polite"
          >
            {syncLabel ?? "sync idle"}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {showLifecycleActions && onGoHome && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={iconBtnClass}
            onClick={handleGoHome}
            aria-label="Round Home"
            title="Round Home"
            data-testid="round-go-home"
          >
            <Home className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
          </Button>
        )}
        {showLifecycleActions && onEndRound && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={iconBtnClass}
            onClick={handleEndRound}
            aria-label="End Round"
            title="End Round"
            data-testid="round-end-entry"
          >
            <Printer className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={toolsBtnClass}
          onClick={handleOpenTools}
          aria-label="Open tools"
          title="Tools"
          data-testid="round-tools-entry"
        >
          <MoreHorizontal className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
          <span className={cn("font-medium", touchFriendly ? "text-sm" : "hidden text-xs sm:inline")}>
            Tools
          </span>
        </Button>

        {!touchFriendly && actionBar}
      </div>
    </header>
  );

  if (!touchFriendly) {
    return header;
  }

  if (!children) {
    return header;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div
        className="shrink-0 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90"
        data-testid="round-chrome-sticky-actions"
      >
        {actionBar}
      </div>
    </div>
  );
};
