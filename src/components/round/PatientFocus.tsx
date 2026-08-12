import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/RichTextEditor";
import { PatientTodos } from "@/components/PatientTodos";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
import { useRoundSession } from "@/contexts/RoundSessionContext";
import { useSettings } from "@/contexts/SettingsContext";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { cn } from "@/lib/utils";
import type { Patient, PatientSystems } from "@/types/patient";

export interface PatientFocusProps {
  patient: Patient | null;
  className?: string;
  /**
   * Phone: ≥44px section targets, scroll reset on patient open,
   * mount only the active mid-rounds section (no stacked chart screens).
   */
  touchFriendly?: boolean;
  /** Empty-state coaching: jump to Round Home for Import. */
  onGoHome?: () => void;
}

const toPlainCue = (value: string | undefined, max = 80): string => {
  const plain = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1)}…`;
};

const CODE_STATUS_LABELS: Record<string, string> = {
  full: "Full code",
  dnr: "DNR",
  dni: "DNI",
  comfort: "Comfort",
};

type MobileSectionTab = "clinicalSummary" | "systems" | "todos";

const MOBILE_SECTION_TABS: ReadonlyArray<{ id: MobileSectionTab; label: string }> = [
  { id: "clinicalSummary", label: "Summary" },
  { id: "systems", label: "Systems" },
  { id: "todos", label: "Todos" },
];

/**
 * Default mid-rounds surface: identity, compact clinical summary,
 * systems compact stack (one expanded via Round store), and todos.
 */
export const PatientFocus = ({
  patient,
  className,
  touchFriendly = false,
  onGoHome,
}: PatientFocusProps) => {
  const { autotexts, onUpdatePatient } = useDashboard();
  const todosMap = useDashboardTodos();
  const { globalFontSize } = useSettings();
  const changeTracking = useChangeTracking();
  const { enabledSystems } = useSystemsConfig();
  const {
    round,
    setExpandedSystem,
    setActiveSection,
  } = useRoundSession();

  const [summaryExpanded, setSummaryExpanded] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const sharedPatientTodos = usePatientTodos(patient?.id ?? null, {
    initialTodos: patient ? (todosMap[patient.id] ?? []) : undefined,
  });
  /*
   * Todos stay on patient_todos row CRUD (usePatientTodos), not the versioned
   * draft_field outbox used for clinicalSummary / systems.*. Enqueue deferred:
   * that path patches the patients table; todos need a separate outbox kind +
   * remote adapter. Online/offline todo edits still use the existing hook.
   */

  React.useEffect(() => {
    setSummaryExpanded(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [patient?.id]);

  if (!patient) {
    return (
      <div
        className={cn("flex h-full flex-col items-center justify-center gap-3 px-6 text-center", className)}
        data-testid="patient-focus-empty"
      >
        <p className="text-sm font-medium text-foreground">No patient in this Round</p>
        <p
          className={cn(
            "max-w-sm",
            touchFriendly ? "text-sm text-foreground/75" : "text-xs text-muted-foreground",
          )}
        >
          Import a patient list or add a patient to start bed-by-bed Focus.
        </p>
        {onGoHome && (
          <Button
            type="button"
            className={cn("gap-2", touchFriendly && "min-h-11")}
            onClick={onGoHome}
            aria-label="Go to Round Home to import patient list"
            data-testid="patient-focus-go-home"
          >
            Round Home · Import
          </Button>
        )}
      </div>
    );
  }

  const handleToggleSummary = () => {
    setSummaryExpanded((prev) => !prev);
    setActiveSection("clinicalSummary");
  };

  const handleExpandSystem = (systemKey: string) => {
    const nextId = round.expandedSystemId === systemKey ? null : systemKey;
    setExpandedSystem(nextId);
    setActiveSection("systems");
  };

  const handleSummaryChange = (value: string) => {
    // Single writer: updatePatient owns clinicalSummary (optimistic local
    // state, revision-guarded save, durable offline queue). A parallel
    // draft_field outbox write raced with it and each flagged the other as a
    // same-field conflict — the per-keystroke "Field conflict" popup storm.
    onUpdatePatient(patient.id, "clinicalSummary", value);
  };

  const handleSystemChange = (systemKey: string, value: string) => {
    const fieldKey = `systems.${systemKey}` as `systems.${string}`;
    // Same single-writer rule as handleSummaryChange.
    onUpdatePatient(patient.id, fieldKey, value);
  };

  const handleFocusTodos = () => {
    setActiveSection("todos");
  };

  const handleSelectMobileSection = (section: MobileSectionTab) => {
    setActiveSection(section);
    if (section === "clinicalSummary") {
      setSummaryExpanded(true);
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  const focusMobileTab = (section: MobileSectionTab) => {
    handleSelectMobileSection(section);
    window.requestAnimationFrame(() => {
      const button = document.getElementById(`focus-mobile-tab-${section}`);
      button?.focus();
    });
  };

  const handleMobileSectionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    tabId: MobileSectionTab,
  ) => {
    if (MOBILE_SECTION_TABS.length === 0) return;
    const currentIndex = MOBILE_SECTION_TABS.findIndex((tab) => tab.id === tabId);
    if (currentIndex === -1) return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % MOBILE_SECTION_TABS.length;
      focusMobileTab(MOBILE_SECTION_TABS[nextIndex].id);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const previousIndex = (currentIndex - 1 + MOBILE_SECTION_TABS.length) % MOBILE_SECTION_TABS.length;
      focusMobileTab(MOBILE_SECTION_TABS[previousIndex].id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusMobileTab(MOBILE_SECTION_TABS[0].id);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusMobileTab(MOBILE_SECTION_TABS[MOBILE_SECTION_TABS.length - 1].id);
    }
  };

  const stableIdentifier = patient.mrn?.trim()
    ? `MRN …${patient.mrn.trim().slice(-4)}`
    : patient.bed?.trim()
      ? `Bed ${patient.bed.trim()}`
      : `Record …${patient.id.slice(-4)}`;
  const metaBits = [
    stableIdentifier,
    patient.mrn?.trim() && patient.bed?.trim() ? `Bed ${patient.bed.trim()}` : null,
    patient.age !== undefined && patient.age !== null ? `${patient.age}y` : null,
    patient.codeStatus ? CODE_STATUS_LABELS[patient.codeStatus] ?? patient.codeStatus : null,
    patient.acuity ? patient.acuity : null,
  ].filter(Boolean);

  const summaryCue = toPlainCue(patient.clinicalSummary);
  const showSummary = !touchFriendly || round.activeSection === "clinicalSummary";
  const showSystems = !touchFriendly || round.activeSection === "systems";
  const showTodos = !touchFriendly || round.activeSection === "todos";
  const rowBtnClass = touchFriendly
    ? "flex min-h-11 w-full items-center gap-2 px-3 py-3 text-left"
    : "flex w-full items-center gap-2 px-3 py-2.5 text-left";
  const cueClass = touchFriendly ? "text-sm text-foreground/75" : "text-xs text-foreground/70";
  const mutedLabelClass = touchFriendly
    ? "text-xs font-semibold uppercase tracking-wide text-foreground/70"
    : "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  const summaryEditor = (
    <RichTextEditor
      value={patient.clinicalSummary}
      onChange={handleSummaryChange}
      placeholder="Clinical summary…"
      minHeight="96px"
      autotexts={autotexts}
      fontSize={globalFontSize}
      changeTracking={changeTracking}
      patient={patient}
      section="clinical_summary"
    />
  );

  const summarySection = touchFriendly ? (
    <section
      className="rounded-lg border border-border/30 bg-card/50 p-3"
      aria-labelledby="focus-summary-heading"
      id="focus-summary-panel"
      data-active-section="true"
    >
      <h2 id="focus-summary-heading" className={cn("mb-2", mutedLabelClass)}>
        Clinical summary
      </h2>
      {summaryEditor}
    </section>
  ) : (
    <section
      id="focus-summary-panel"
      className="mb-4 rounded-lg border border-border/30 bg-card/40"
      aria-labelledby="focus-summary-heading"
      data-active-section={round.activeSection === "clinicalSummary" ? "true" : undefined}
    >
      <button
        type="button"
        id="focus-summary-heading"
        className={rowBtnClass}
        onClick={handleToggleSummary}
        aria-expanded={summaryExpanded}
        aria-controls="focus-summary-body"
      >
        {summaryExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className={mutedLabelClass}>Clinical summary</span>
        {!summaryExpanded && summaryCue && (
          <span className={cn("ml-auto max-w-[60%] truncate", cueClass)}>
            {summaryCue}
          </span>
        )}
      </button>
      {summaryExpanded && (
        <div id="focus-summary-body" className="border-t border-border/20 px-3 pb-3 pt-2">
          {summaryEditor}
        </div>
      )}
    </section>
  );

  const systemsSection = (
    <section
      id="focus-system-panel"
      className={cn(!touchFriendly && "mb-4")}
      aria-labelledby="focus-systems-heading"
      data-active-section={round.activeSection === "systems" ? "true" : undefined}
    >
      <h2 id="focus-systems-heading" className={cn("mb-2", mutedLabelClass)}>
        Systems
      </h2>
      <ul className="space-y-1" data-testid="systems-compact-stack">
        {enabledSystems.map((system) => {
          const systemValue = patient.systems[system.key as keyof PatientSystems] ?? "";
          const isExpanded = round.expandedSystemId === system.key;
          const cue = toPlainCue(systemValue, 64);
          const hasContent = Boolean(cue);

          return (
            <li
              key={system.key}
              className={cn(
                "rounded-lg border border-border/30 transition-colors",
                isExpanded ? "bg-card/60" : "bg-secondary/15 hover:bg-secondary/25",
                hasContent && !isExpanded && "border-border/45",
              )}
              data-systems-row={system.key}
              data-expanded={isExpanded ? "true" : "false"}
            >
              <button
                type="button"
                className={rowBtnClass}
                onClick={() => handleExpandSystem(system.key)}
                aria-expanded={isExpanded}
                aria-controls={`focus-system-${system.key}`}
                aria-label={`${system.label}${hasContent ? ", has notes" : ""}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-foreground/65" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground/65" aria-hidden="true" />
                )}
                <span className="text-sm" aria-hidden="true">
                  {system.icon}
                </span>
                <span
                  className={cn(
                    "font-medium",
                    touchFriendly ? "text-base text-foreground" : "text-sm text-foreground/90",
                  )}
                >
                  {system.label}
                </span>
                {!isExpanded && (
                  <span
                    className={cn(
                      "ml-auto max-w-[55%] truncate",
                      touchFriendly ? "text-sm" : "text-xs",
                      hasContent
                        ? touchFriendly
                          ? "text-foreground/75"
                          : "text-foreground/65"
                        : touchFriendly
                          ? "text-foreground/55"
                          : "text-muted-foreground/70",
                    )}
                  >
                    {hasContent ? cue : "—"}
                  </span>
                )}
              </button>
              {isExpanded && (
                <div
                  id={`focus-system-${system.key}`}
                  className="border-t border-border/20 px-3 pb-3 pt-2"
                >
                  <RichTextEditor
                    value={systemValue}
                    onChange={(value) => handleSystemChange(system.key, value)}
                    placeholder={`${system.label}…`}
                    minHeight="88px"
                    autotexts={autotexts}
                    fontSize={globalFontSize}
                    changeTracking={changeTracking}
                    patient={patient}
                    section={system.key}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  const todosSection = (
    <section
      id="focus-todos-panel"
      className={cn(!touchFriendly && "pb-6")}
      aria-label="Todos"
      onFocusCapture={handleFocusTodos}
      data-active-section={round.activeSection === "todos" ? "true" : undefined}
      data-testid="focus-todos"
    >
      <PatientTodos
        todos={sharedPatientTodos.todos}
        section={null}
        patient={patient}
        generating={sharedPatientTodos.generating}
        onAddTodo={sharedPatientTodos.addTodo}
        onToggleTodo={sharedPatientTodos.toggleTodo}
        onDeleteTodo={sharedPatientTodos.deleteTodo}
        onGenerateTodos={sharedPatientTodos.generateTodos}
        alwaysVisible
        showAiGenerate={false}
      />
    </section>
  );

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col", className)}
      data-testid="patient-focus"
      data-patient-id={patient.id}
      data-touch-friendly={touchFriendly ? "true" : undefined}
    >
      <div className="shrink-0 border-b border-border/25 px-4 py-3 md:px-6">
        <h1
          className={cn(
            "truncate font-semibold tracking-tight text-foreground",
            touchFriendly ? "text-xl" : "text-lg",
          )}
        >
          {patient.name?.trim() || "Unnamed patient"}
        </h1>
        {metaBits.length > 0 && (
          <p
            className={cn(
              "mt-0.5 truncate",
              touchFriendly ? "text-sm text-foreground/75" : "text-xs text-muted-foreground",
            )}
          >
            {metaBits.join(" · ")}
          </p>
        )}
      </div>

      {touchFriendly && (
        <div
          className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border/25 px-3 py-2"
          role="tablist"
          aria-label="Mid-rounds sections"
          data-testid="focus-mobile-section-tabs"
        >
          {MOBILE_SECTION_TABS.map((tab) => {
            const isActive = round.activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`focus-mobile-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={
                  tab.id === "clinicalSummary"
                    ? "focus-summary-panel"
                    : tab.id === "systems"
                      ? "focus-system-panel"
                      : "focus-todos-panel"
                }
                tabIndex={isActive ? 0 : -1}
                className={cn(
                  "min-h-11 shrink-0 rounded-lg px-3.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/40 text-foreground/85 hover:bg-secondary/55",
                )}
                onClick={() => handleSelectMobileSection(tab.id)}
                onKeyDown={(event) => handleMobileSectionKeyDown(event, tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6",
          touchFriendly && "pb-2",
        )}
      >
        {showSummary && summarySection}
        {showSystems && systemsSection}
        {showTodos && todosSection}
      </div>
    </div>
  );
};
