import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import rollingRoundsLogo from "@/assets/rolling-rounds-logo.png";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  rightAction?: React.ReactNode;
  statusText?: string;
  statusTone?: "success" | "warning" | "info";
}

export const MobileHeader = ({
  title,
  subtitle,
  searchQuery = "",
  onSearchChange,
  showSearch = true,
  rightAction,
  statusText,
  statusTone = "info",
}: MobileHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const statusClasses = {
    success: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    warning: "bg-amber-500/10 text-amber-700 border-amber-200",
    info: "bg-blue-500/10 text-blue-700 border-blue-200",
  };

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 safe-area-top shadow-sm">
      <div className="flex items-center justify-between h-14 px-4">
        {isSearchOpen && onSearchChange ? (
          <div className="flex items-center gap-2 flex-1 animate-fade-in">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-10 bg-secondary/50 border-0"
                autoFocus
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearchOpen(false);
                onSearchChange("");
              }}
              className="h-10 w-10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-8 w-auto" />
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
                {(subtitle || statusText) && (
                  <div className="flex items-center gap-2 min-w-0">
                    {subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                    )}
                    {statusText && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full border",
                          statusClasses[statusTone]
                        )}
                      >
                        {statusText}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <OfflineIndicator />
              {showSearch && onSearchChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSearchOpen(true)}
                  className="h-10 w-10"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}
              {rightAction}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
