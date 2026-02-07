import * as React from "react";
import { Bell, CircleUser, Filter, MoonStar, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopCommandBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearFocus: () => void;
  shiftMode: "day" | "night";
  onShiftModeChange: (mode: "day" | "night") => void;
}

export const TopCommandBar = ({
  searchQuery,
  onSearchChange,
  onClearFocus,
  shiftMode,
  onShiftModeChange,
}: TopCommandBarProps) => {
  return (
    <div className="sticky top-4 z-40 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_20px_50px_rgba(15,23,42,0.6)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm text-slate-200">
        <Sparkles className="h-4 w-4 text-cyan-300" />
        <span className="font-semibold">Command Console</span>
      </div>
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search patients, rooms, prompts"
          className="h-9 rounded-xl border-white/10 bg-slate-900/60 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-cyan-400/40"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearFocus}
        className="h-9 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10"
      >
        Clear Focus
      </Button>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-2 py-1">
        <Filter className="h-4 w-4 text-cyan-300" />
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Filter</span>
      </div>
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/50 p-1 text-xs text-slate-200">
        <Button
          variant={shiftMode === "day" ? "default" : "ghost"}
          size="sm"
          onClick={() => onShiftModeChange("day")}
          className="h-7 rounded-lg px-3 text-xs"
        >
          Day
        </Button>
        <Button
          variant={shiftMode === "night" ? "default" : "ghost"}
          size="sm"
          onClick={() => onShiftModeChange("night")}
          className="h-7 rounded-lg px-3 text-xs"
        >
          <MoonStar className="mr-1 h-3.5 w-3.5" />
          Night
        </Button>
      </div>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-white/10 bg-slate-900/40 text-slate-300 hover:text-white">
        <Bell className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-white/10 bg-slate-900/40 text-slate-300 hover:text-white">
        <CircleUser className="h-4 w-4" />
      </Button>
    </div>
  );
};
