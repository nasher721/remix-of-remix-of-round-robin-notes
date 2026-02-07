import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LayoutGrid,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const unitFilters = ["ICU", "Stepdown", "Consults"];

interface LeftRailProps {
  collapsed: boolean;
  onToggle: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  unitFilter: string;
  onUnitFilterChange: (value: string) => void;
}

export const LeftRail = ({
  collapsed,
  onToggle,
  searchQuery,
  onSearchChange,
  unitFilter,
  onUnitFilterChange,
}: LeftRailProps) => {
  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-4 border-r border-white/10 bg-slate-950/60 px-4 py-6 transition-all duration-300",
        collapsed ? "w-[88px] px-3" : "w-[260px]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-200 shadow-lg shadow-cyan-500/20">
            <LayoutGrid className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-slate-100">Census Intel</p>
              <p className="text-[11px] text-slate-500">Left rail controls</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className={cn("space-y-3", collapsed && "hidden")}>          
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Quick patient search"
            className="h-9 rounded-xl border-white/10 bg-slate-900/70 pl-9 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-cyan-400/40"
          />
        </div>
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Unit Census</p>
          <div className="flex flex-col gap-2">
            {unitFilters.map((filter) => (
              <Button
                key={filter}
                variant={unitFilter === filter ? "default" : "ghost"}
                size="sm"
                onClick={() => onUnitFilterChange(filter)}
                className={cn(
                  "h-8 justify-start rounded-xl text-xs",
                  unitFilter === filter ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"
                )}
              >
                <Stethoscope className="mr-2 h-3.5 w-3.5" />
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <RailSectionTitle collapsed={collapsed} title="Saved Prompts" icon={<Sparkles className="h-4 w-4" />} />
          <RailList collapsed={collapsed} items={["Daily plan", "Sedation wean", "Sepsis review"]} />
        </div>
        <div className="space-y-2">
          <RailSectionTitle collapsed={collapsed} title="Alerts" icon={<AlertTriangle className="h-4 w-4" />} />
          <RailList collapsed={collapsed} items={["2 critical labs", "Vent alarm", "Fever trend"]} />
        </div>
        <div className="space-y-2">
          <RailSectionTitle collapsed={collapsed} title="To-Do" icon={<ClipboardCheck className="h-4 w-4" />} />
          <RailList collapsed={collapsed} items={["CT head", "Renal consult", "Family update"]} />
        </div>
        <div className="space-y-2">
          <RailSectionTitle collapsed={collapsed} title="AI Tools" icon={<Brain className="h-4 w-4" />} />
          <RailList collapsed={collapsed} items={["Risk scorer", "Handoff builder", "Protocol search"]} />
        </div>
      </div>

      <div className="mt-auto rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 p-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-300" />
          {!collapsed && (
            <div>
              <p className="text-xs font-semibold text-slate-200">AI Signal</p>
              <p className="text-[11px] text-slate-500">Monitoring 12 vitals streams</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

const RailSectionTitle = ({
  collapsed,
  title,
  icon,
}: {
  collapsed: boolean;
  title: string;
  icon: React.ReactNode;
}) => (
  <div className="flex items-center gap-2 text-slate-400">
    <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5">
      {icon}
    </div>
    {!collapsed && <p className="text-xs uppercase tracking-[0.25em]">{title}</p>}
  </div>
);

const RailList = ({ collapsed, items }: { collapsed: boolean; items: string[] }) => (
  <ul className={cn("space-y-1 text-xs text-slate-300", collapsed && "hidden")}>
    {items.map((item) => (
      <li key={item} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70" />
        {item}
      </li>
    ))}
  </ul>
);
