import * as React from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  Filter,
  PanelLeftClose,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LiveRegion } from "@/components/LiveRegion";
import { SectionVisibilityContent } from "@/components/SectionVisibilityPanel";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
import { useDashboardLayout } from "@/context/DashboardLayoutContext";
import { useSettings } from "@/contexts/SettingsContext";
import { PatientFilterType } from "@/constants/config";
import {
  DOCUMENTATION_SECTIONS,
  DOCUMENTATION_STATUS_LABELS,
  getDocumentationSectionStatus,
  type DocumentationStatus,
} from "@/lib/patientDocumentation";
import { cn } from "@/lib/utils";

const STATUS_SEGMENT_CLASS: Record<DocumentationStatus, string> = {
  ready: "rr-st-ready",
  "in-progress": "rr-st-prog",
  "not-started": "rr-st-todo",
};

const ACUITY_DOT_CLASS: Record<string, string> = {
  low: "rr-st-ready",
  moderate: "rr-st-prog",
  high: "rr-st-prog",
  critical: "rr-st-todo",
};

/** Collapse rich-text field content to a single plain-text line for the diagnosis row. */
const toOneLine = (value: string | undefined): string =>
  (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface PatientRosterRailProps {
  /** Shared with DesktopDashboard so keyboard shortcuts keep focusing this input. */
  searchInputRef: React.RefObject<HTMLInputElement>;
  onOpenCompare: () => void;
  onRequestClearAll: () => void;
  onOpenSyncHistory: () => void;
  syncingList: boolean;
  onSyncNow: () => void;
}

/**
 * 288px roster rail (mockup artboard A/B): search, filter/sort menu, per-patient
 * rows with 5-segment documentation progress, and a footer with view mode +
 * sync controls. Replaces the old control band + stacked card list; the rail
 * reads DashboardContext directly so behavior (filter, sort, search, view mode)
 * is identical to what it replaces.
 */
export const PatientRosterRail = ({
  searchInputRef,
  onOpenCompare,
  onRequestClearAll,
  onOpenSyncHistory,
  syncingList,
  onSyncNow,
}: PatientRosterRailProps) => {
  const {
    patients,
    filteredPatients,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    desktopSelectedPatientId,
    setDesktopSelectedPatientId,
    patientListViewMode,
    setPatientListViewMode,
    onCollapseAll,
    lastSaved,
  } = useDashboard();
  const todosMap = useDashboardTodos();
  const { sortBy, setSortBy } = useSettings();
  const { setLeftPanelCollapsed } = useDashboardLayout();

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) + (filter !== PatientFilterType.All ? 1 : 0);

  const filterLabel = React.useMemo(() => {
    if (filter === PatientFilterType.Filled) return "With notes";
    if (filter === PatientFilterType.Empty) return "Empty notes";
    if (filter === PatientFilterType.MyPatients) return "My patients";
    return "All patients";
  }, [filter]);

  const isDefaultListScope =
    patients.length > 0 && !searchQuery.trim() && filter === PatientFilterType.All;

  /** Mirrors the workspace's selection fallback so aria-current tracks the open chart. */
  const effectiveSelectedId = React.useMemo(() => {
    if (filteredPatients.length === 0) return null;
    if (
      desktopSelectedPatientId &&
      filteredPatients.some((p) => p.id === desktopSelectedPatientId)
    ) {
      return desktopSelectedPatientId;
    }
    return filteredPatients[0].id;
  }, [filteredPatients, desktopSelectedPatientId]);

  const clearFilters = React.useCallback(() => {
    setSearchQuery("");
    setFilter(PatientFilterType.All);
  }, [setSearchQuery, setFilter]);

  return (
    <aside
      className="rr-ws flex h-full min-h-0 w-[288px] flex-none flex-col border-r"
      style={{ background: "var(--rr-bg-secondary)", borderColor: "var(--rr-sep)" }}
      aria-label="Patient list"
    >
      {/* Header: title + filter/sort menu */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h2
          className="text-[14px] font-medium leading-5"
          style={{ color: "var(--rr-label-1)" }}
        >
          Patients{" "}
          <span className="font-normal" style={{ color: "var(--rr-label-3)" }}>
            · {patients.length}
          </span>
        </h2>
        <div className="flex items-center gap-1">
        <button
          type="button"
          className="rr-icon-btn"
          aria-label="Collapse patient list"
          title="Collapse patient list"
          onClick={() => setLeftPanelCollapsed(true)}
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rr-icon-btn relative"
              aria-label="Filter and sort patients"
              aria-haspopup="menu"
              title="Filter by status, sort order, and section visibility"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white"
                  style={{ background: "var(--rr-blue)" }}
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-modal">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Filter</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filter}
              onValueChange={(v) => setFilter(v as typeof filter)}
            >
              <DropdownMenuRadioItem value={PatientFilterType.All}>All patients</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={PatientFilterType.Filled}>With notes</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={PatientFilterType.Empty}>Empty notes</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={PatientFilterType.MyPatients}>My patients</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sortBy}
              onValueChange={(v) => setSortBy(v as "number" | "room" | "name")}
            >
              <DropdownMenuRadioItem value="number">Order added</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="room">Room</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Sections</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-72 rounded-lg shadow-modal p-3" sideOffset={4}>
                <SectionVisibilityContent />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenCompare}>
              <Users className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
              Compare patients
            </DropdownMenuItem>
            {patients.length > 0 && (
              <DropdownMenuItem onClick={onCollapseAll}>
                <ChevronsUpDown className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                {patients.every((p) => p.collapsed) ? "Expand all" : "Collapse all"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRequestClearAll}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
              Clear all patients…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2" role="search">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--rr-label-3)" }}
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
            id="desktop-patient-search"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search patients"
            autoComplete="off"
            autoFocus
            className="h-8 rounded-[8px] border-transparent pl-8 text-[13px] shadow-none focus-visible:ring-1"
            style={{ background: "var(--rr-f1)", color: "var(--rr-label-1)" }}
          />
        </div>
      </div>

      {/* Meta row: count + active filters */}
      <div className="space-y-1.5 px-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[11px] leading-snug" style={{ color: "var(--rr-label-2)" }}>
            {isDefaultListScope ? (
              <>All patients</>
            ) : (
              <>
                {filteredPatients.length}
                {patients.length !== filteredPatients.length ? ` of ${patients.length}` : ""} patient
                {filteredPatients.length === 1 ? "" : "s"}
                {searchQuery.trim() ? (
                  <span style={{ color: "var(--rr-label-3)" }}>
                    {" "}
                    · &ldquo;
                    <span className="inline-block max-w-[8rem] truncate align-bottom">
                      {searchQuery}
                    </span>
                    &rdquo;
                  </span>
                ) : null}
              </>
            )}
          </span>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              className="shrink-0 text-[11px] font-medium hover:underline"
              style={{ color: "var(--rr-blue)" }}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
        {activeFilterCount > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {filterLabel}
            </Badge>
            {searchQuery.trim() ? (
              <Badge variant="secondary" className="max-w-[10rem] truncate text-[10px]">
                Search: {searchQuery}
              </Badge>
            ) : null}
          </div>
        ) : null}
        <p className="text-[10px] leading-[14px]" style={{ color: "var(--rr-label-4)" }}>
          Doc progress: Summary · Events · Systems · Results · Meds
        </p>
      </div>

      {/* Patient rows */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {filteredPatients.length === 0 ? (
          <p
            className="px-2 py-8 text-center text-[12px] leading-[18px]"
            style={{ color: "var(--rr-label-3)" }}
          >
            No patients in this view
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filteredPatients.map((patient) => {
              const isActive = patient.id === effectiveSelectedId;
              const openTodoCount = (todosMap[patient.id] ?? []).filter(
                (todo) => !todo.completed,
              ).length;
              const locationLabel = patient.bed?.trim() || "Unassigned";
              const diagnosis = toOneLine(patient.clinicalSummary);
              const compact = patientListViewMode === "compact";
              return (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => setDesktopSelectedPatientId(patient.id)}
                    aria-current={isActive ? "true" : undefined}
                    aria-label={`Select ${patient.name || "unnamed patient"}, ${locationLabel}${openTodoCount > 0 ? `, ${openTodoCount} open tasks` : ""}`}
                    className={cn(
                      "rr-roster-item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive && "rr-sel",
                      compact && "!py-1.5",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="rr-bed-chip">
                        {locationLabel.slice(0, 3).toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate font-medium",
                          compact ? "text-[12px] leading-[18px]" : "text-[13px] leading-[19px]",
                        )}
                        style={{ color: "var(--rr-label-1)" }}
                      >
                        {patient.name || "Unnamed"}
                      </span>
                      {patient.acuity ? (
                        <span
                          className={cn("rr-dot", ACUITY_DOT_CLASS[patient.acuity] ?? "rr-st-todo")}
                          title={`Acuity: ${patient.acuity}`}
                          style={
                            patient.acuity === "critical"
                              ? { background: "var(--rr-danger)" }
                              : undefined
                          }
                        />
                      ) : null}
                      {openTodoCount > 0 ? (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                          style={{ background: "var(--rr-f2)", color: "var(--rr-label-2)" }}
                        >
                          {openTodoCount}
                        </span>
                      ) : null}
                    </span>
                    {!compact && diagnosis ? (
                      <span
                        className="mt-0.5 block truncate text-[12px] leading-[18px]"
                        style={{ color: "var(--rr-label-3)" }}
                      >
                        {diagnosis}
                      </span>
                    ) : null}
                    <span className={cn("flex items-center gap-1", compact ? "mt-1" : "mt-1.5")}>
                      {DOCUMENTATION_SECTIONS.map((section) => {
                        const status = getDocumentationSectionStatus(patient, section.id);
                        return (
                          <span
                            key={section.id}
                            className={cn("rr-seg", STATUS_SEGMENT_CLASS[status])}
                            title={`${section.label}: ${DOCUMENTATION_STATUS_LABELS[status]}`}
                          />
                        );
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer: view mode + sync */}
      <div
        className="space-y-2 border-t px-3 py-2.5"
        style={{ borderColor: "var(--rr-sep)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: "var(--rr-label-3)" }}>
            View
          </span>
          <Select
            value={patientListViewMode}
            onValueChange={(value) => setPatientListViewMode(value as "rich" | "compact")}
          >
            <SelectTrigger
              aria-label="Patient list view"
              className="h-7 w-[104px] rounded-[8px] border-transparent text-[12px] shadow-none"
            >
              <SelectValue placeholder="View mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rich">Rich</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenSyncHistory}
              className="text-left"
              aria-label="View sync history"
            >
              <Badge
                variant="secondary"
                className="gap-1.5 text-[11px] font-medium transition-colors hover:bg-secondary/80"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                  aria-hidden="true"
                />
                <time
                  dateTime={lastSaved.toISOString()}
                  title={`Last sync at ${lastSaved.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
                >
                  History
                </time>
              </Badge>
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0 border-border/60"
                  onClick={onSyncNow}
                  disabled={syncingList}
                  aria-busy={syncingList}
                  aria-label="Retry sync and refresh patient list"
                >
                  <RefreshCw
                    className={cn("h-3 w-3", syncingList && "animate-spin")}
                    aria-hidden="true"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Retry sync now</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <LiveRegion
          message={
            searchQuery
              ? `Search results: ${filteredPatients.length} patient${filteredPatients.length === 1 ? "" : "s"} found.`
              : `Showing ${filterLabel.toLowerCase()}: ${filteredPatients.length} patient${filteredPatients.length === 1 ? "" : "s"}.`
          }
          politeness="polite"
        />
      </div>
    </aside>
  );
};
