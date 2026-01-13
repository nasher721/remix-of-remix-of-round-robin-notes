import { Cloud, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  rightAction?: React.ReactNode;
}

export const MobileHeader = ({
  title,
  subtitle,
  searchQuery = "",
  onSearchChange,
  showSearch = true,
  rightAction,
}: MobileHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border safe-area-top">
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
              <span className="text-2xl">🏥</span>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
                {subtitle && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Cloud className="h-3 w-3 text-success" />
                    <span className="truncate">{subtitle}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
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
