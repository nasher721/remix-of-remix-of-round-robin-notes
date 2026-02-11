import * as React from "react";
import { Search, Bell, Mic, X, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ClinicalAlert } from "@/types/clinicalAlerts";

interface MobileHeaderEnhancedProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  rightAction?: React.ReactNode;
  alerts?: ClinicalAlert[];
  onOpenAlerts?: () => void;
  onVoiceCommand?: () => void;
  voiceEnabled?: boolean;
  isListening?: boolean;
}

export const MobileHeaderEnhanced = ({
  title,
  subtitle,
  searchQuery = "",
  onSearchChange,
  showSearch = true,
  rightAction,
  alerts = [],
  onOpenAlerts,
  onVoiceCommand,
  voiceEnabled = false,
  isListening = false,
}: MobileHeaderEnhancedProps) => {
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter(a => a.severity === 'critical');
  const hasAlerts = unacknowledgedAlerts.length > 0;
  const hasCritical = criticalAlerts.length > 0;

  React.useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 safe-area-top shadow-sm">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Title or Search */}
        {isSearchExpanded ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="search"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-9 pr-4 h-10 bg-secondary/50 border-0 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearchExpanded(false);
                onSearchChange?.("");
              }}
              className="h-10 w-10 flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {subtitle}
                </p>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
              {showSearch && onSearchChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSearchExpanded(true)}
                  className="h-10 w-10"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}

              {voiceEnabled && onVoiceCommand && (
                <Button
                  variant={isListening ? "default" : "ghost"}
                  size="icon"
                  onClick={onVoiceCommand}
                  className={cn(
                    "h-10 w-10",
                    isListening && "bg-red-500 hover:bg-red-600 animate-pulse"
                  )}
                >
                  {isListening ? (
                    <Mic className="h-5 w-5 text-white" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              )}

              {onOpenAlerts && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenAlerts}
                  className={cn(
                    "h-10 w-10 relative",
                    hasCritical && "animate-pulse"
                  )}
                >
                  <Bell className={cn(
                    "h-5 w-5",
                    hasCritical ? "text-red-500" : hasAlerts ? "text-amber-500" : ""
                  )} />
                  {hasAlerts && (
                    <span
                      className={cn(
                        "absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-0.5",
                        hasCritical ? "bg-red-500" : "bg-amber-500"
                      )}
                    >
                      {unacknowledgedAlerts.length}
                    </span>
                  )}
                </Button>
              )}

              {rightAction}
            </div>
          </>
        )}
      </div>

      {/* Critical Alert Banner */}
      {hasCritical && !isSearchExpanded && (
        <button
          onClick={onOpenAlerts}
          className="w-full px-4 py-2 bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 active:bg-red-600"
        >
          <Bell className="h-4 w-4" />
          {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''} - Tap to view
        </button>
      )}
    </header>
  );
};

export default MobileHeaderEnhanced;
