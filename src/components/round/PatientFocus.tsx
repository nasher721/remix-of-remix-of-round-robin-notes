import { NoteComposerLauncher } from "@/components/note-composer/NoteComposerLauncher";
import * as React from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Columns2, LayoutList, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/RichTextEditor";
import { BedsideDictateButton } from "./BedsideDictateButton";
import { PatientTodos } from "@/components/PatientTodos";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
import { useRoundSession } from "@/contexts/RoundSessionContext";
import { useSettings } from "@/contexts/SettingsContext";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { cn } from "@/lib/utils";
import { LabFishbone } from "@/components/labs/LabFishbone";
import { MedicationList } from "@/components/MedicationList";
import { ImagePasteEditor } from "@/components/ImagePasteEditor";
import { SmartLabParser } from "@/components/SmartLabParser";
import type { Patient, PatientMedications, PatientSystems } from "@/types/patient";
import { getPatientIdentity } from "@/lib/patientIdentity";
import { DecisionReview } from "@/components/decision-scribe/DecisionReview";
import type { ComposedDraft } from "@/lib/decision-scribe/draftComposer";
import type { DecisionCandidate } from "@/types/decisionScribe";

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
  /** Provisional Decision Scribe output. It is review-only until an explicit attestation. */
  decisionDraft?: ComposedDraft | null;
  onDecisionDraftChange?: (candidates: DecisionCandidate[]) => void;
  onDecisionReviewClose?: () => void;
  onDecisionAttest?: (candidates: DecisionCandidate[]) => void;
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

const formatUpdatedCue = (value: string | undefined): string => {
  if (!value) return "Update time not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Update time not recorded";
  return `Updated ${parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
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
  decisionDraft,
  onDecisionDraftChange,
  onDecisionReviewClose,
  onDecisionAttest,
}: PatientFocusProps) => {
  const { autotexts, onUpdatePatient } = useDashboard();
  const todosMap = useDashboardTodos();
  const { globalFontSize, systemsColumns, setSystemsColumns } = useSettings();
  const changeTracking = useChangeTracking();
  const { enabledSystems } = useSystemsConfig();
  const {
    round,
    setExpandedSystem,
    setActiveSection,
  } = useRoundSession();

  const [summaryExpanded, setSummaryExpanded] = React.useState(false);
  const [chartReviewExpanded, setChartReviewExpanded] = React.useState(false);
  const [activeChartTab, setActiveChartTab] = React.useState<"events" | "labs" | "imaging" | "medications">("events");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const sharedPatientTodos = usePatientTodos(patient?.id ?? null, {
    initialTodos: patient ? (todosMap[patient.id] ?? []) : undefined,
  });
  // Todos use their own patient_todos durable queue adapter; chart fields use
  // the versioned patient/draft outbox because their conflict models differ.

  React.useEffect(() => {
    setSummaryExpanded(false);
    setChartReviewExpanded(false);
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
            className={cn("gap-2", touchFriendly && "min-h-[44px]")}
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

  const handleEventsChange = (value: string) => {
    onUpdatePatient(patient.id, "intervalEvents", value);
  };

  const handleLabsChange = (value: string) => {
    onUpdatePatient(patient.id, "labs", value);
  };

  const handleImagingChange = (value: string) => {
    onUpdatePatient(patient.id, "imaging", value);
  };

  const handleMedicationsChange = (meds: PatientMedications) => {
    onUpdatePatient(patient.id, "medications", meds);
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

  const identity = getPatientIdentity(patient);

  const summaryCue = toPlainCue(patient.clinicalSummary);
  const showSummary = !touchFriendly || round.activeSection === "clinicalSummary";
  const showSystems = !touchFriendly || round.activeSection === "systems";
  const showTodos = !touchFriendly || round.activeSection === "todos";
  const rowBtnClass = touchFriendly
    ? "flex min-h-[44px] w-full items-center gap-2 px-3 py-3 text-left"
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
      ariaLabelledby="focus-summary-heading"
    />
  );

  const summarySection = touchFriendly ? (
    <section
      className="rounded-lg border border-border/30 bg-card/50 p-3"
      role="tabpanel"
      aria-labelledby="focus-mobile-tab-clinicalSummary"
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
        aria-label={summaryExpanded ? "Collapse clinical summary" : "Expand clinical summary"}
      >
        {summaryExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className={mutedLabelClass}>Clinical summary</span>
        {!summaryExpanded && (
          <span className={cn("ml-auto min-w-0 max-w-[65%] whitespace-normal text-right", cueClass)}>
            {summaryCue || "Not documented"}
          </span>
        )}
      </button>
      <div
        id="focus-summary-body"
        className="border-t border-border/20 px-3 pb-3 pt-2"
        hidden={!summaryExpanded}
      >
        {summaryExpanded && (
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Clinical Summary</span>
            <BedsideDictateButton
              systemLabel="Clinical Summary"
              patientId={patient.id}
              systemKey="clinicalSummary"
              onTranscript={(text) => {
                const current = patient.clinicalSummary || "";
                const updated = current.trim() ? `${current}\n${text}` : text;
                handleSummaryChange(updated);
              }}
            />
          </div>
        )}
        {summaryExpanded ? summaryEditor : null}
      </div>
    </section>
  );

  const eventsCue = toPlainCue(patient.intervalEvents, 40);
  const labsCue = toPlainCue(patient.labs, 40);
  const imagingCue = toPlainCue(patient.imaging, 40);
  const medCount =
    (patient.medications?.infusions?.length ?? 0) +
    (patient.medications?.scheduled?.length ?? 0) +
    (patient.medications?.prn?.length ?? 0);
  const medsCue = medCount > 0 ? `${medCount} meds` : toPlainCue(patient.medications?.rawText, 30);

  const chartReviewCues =
    [
      eventsCue ? "Events" : null,
      labsCue ? "Labs" : null,
      imagingCue ? "Imaging" : null,
      medsCue ? "Meds" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Not documented";

  const CHART_TABS: ReadonlyArray<{
    id: "events" | "labs" | "imaging" | "medications";
    label: string;
    hasData: boolean;
    badge?: string;
  }> = [
    { id: "events", label: "Events", hasData: Boolean(eventsCue) },
    { id: "labs", label: "Labs", hasData: Boolean(labsCue) },
    { id: "imaging", label: "Imaging", hasData: Boolean(imagingCue) },
    {
      id: "medications",
      label: "Meds",
      hasData: Boolean(medsCue),
      badge: medCount > 0 ? String(medCount) : undefined,
    },
  ];

  const chartReviewSection = (
    <section
      id="focus-chart-review-panel"
      className={cn("mb-4 rounded-lg border border-border/30 bg-card/40", touchFriendly && "mb-3")}
      aria-labelledby="focus-chart-review-heading"
      data-testid="focus-chart-review"
    >
      <button
        type="button"
        id="focus-chart-review-heading"
        className={rowBtnClass}
        onClick={() => setChartReviewExpanded((prev) => !prev)}
        aria-expanded={chartReviewExpanded}
        aria-controls="focus-chart-review-body"
        aria-label={chartReviewExpanded ? "Collapse chart review" : "Expand chart review"}
      >
        {chartReviewExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className={mutedLabelClass}>Chart review</span>
        <span className="text-xs text-muted-foreground font-normal">Events · Labs · Imaging · Meds</span>
        {!chartReviewExpanded && (
          <span className={cn("ml-auto min-w-0 max-w-[50%] whitespace-normal text-right", cueClass)}>
            {chartReviewCues}
          </span>
        )}
      </button>

      {chartReviewExpanded && (
        <div id="focus-chart-review-body" className="border-t border-border/20 px-3 pb-3 pt-2">
          <div className="mb-3 flex flex-wrap gap-1.5 border-b border-border/20 pb-2">
            {CHART_TABS.map((tab) => {
              const isSelected = activeChartTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveChartTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    touchFriendly && "min-h-[40px] px-3 text-sm",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-pressed={isSelected}
                  data-testid={`chart-tab-${tab.id}`}
                >
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {tab.badge}
                    </span>
                  ) : tab.hasData ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-label="has content" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {activeChartTab === "events" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Interval Events & Overnight Notes</span>
                <BedsideDictateButton
                  systemLabel="Interval Events"
                  patientId={patient.id}
                  systemKey="intervalEvents"
                  onTranscript={(text) => {
                    const current = patient.intervalEvents || "";
                    const updated = current.trim() ? `${current}\n${text}` : text;
                    handleEventsChange(updated);
                  }}
                />
              </div>
              <RichTextEditor
                value={patient.intervalEvents}
                onChange={handleEventsChange}
                placeholder="Overnight events, consult recommendations, procedures…"
                minHeight="88px"
                autotexts={autotexts}
                fontSize={globalFontSize}
                changeTracking={changeTracking}
                patient={patient}
                section="interval_events"
                ariaLabelledby="focus-chart-review-heading"
              />
            </div>
          )}

          {activeChartTab === "labs" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Labs & Panels</span>
                <SmartLabParser
                  onLabsParsed={(parsed) => {
                    const current = patient.labs || "";
                    const updated = current.trim() ? `${current}\n\n${parsed}` : parsed;
                    handleLabsChange(updated);
                  }}
                />
              </div>
              {patient.labs && patient.labs.trim() ? (
                <div className="overflow-x-auto rounded-lg border border-border/30 bg-muted/20 p-2">
                  <LabFishbone labs={patient.labs} />
                </div>
              ) : null}
              <RichTextEditor
                value={patient.labs}
                onChange={handleLabsChange}
                placeholder="CBC, BMP, LFTs, coags, ABG…"
                minHeight="88px"
                autotexts={autotexts}
                fontSize={globalFontSize}
                changeTracking={changeTracking}
                patient={patient}
                section="labs"
                ariaLabelledby="focus-chart-review-heading"
              />
            </div>
          )}

          {activeChartTab === "imaging" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Imaging & Studies</span>
              </div>
              <ImagePasteEditor
                value={patient.imaging}
                onChange={handleImagingChange}
                placeholder="X-rays, CT, MRI, Echo... (paste images here)"
                minHeight="88px"
                autotexts={autotexts}
                fontSize={globalFontSize}
                changeTracking={changeTracking}
                patient={patient}
                section="imaging"
              />
            </div>
          )}

          {activeChartTab === "medications" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Continuous Infusions & Medications</span>
              </div>
              <MedicationList
                medications={patient.medications ?? { infusions: [], scheduled: [], prn: [] }}
                onMedicationsChange={handleMedicationsChange}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );

  const isMultiColumnActive = !touchFriendly && systemsColumns === 2;

  const systemsSection = (
    <section
      id="focus-system-panel"
      className={cn(!touchFriendly && "mb-4")}
      role={touchFriendly ? "tabpanel" : undefined}
      aria-labelledby={touchFriendly ? "focus-mobile-tab-systems" : "focus-systems-heading"}
      data-active-section={round.activeSection === "systems" ? "true" : undefined}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 id="focus-systems-heading" className={cn(mutedLabelClass)}>
          Systems
        </h2>
        {!touchFriendly && (
          <div className="hidden xl:flex items-center gap-1">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                systemsColumns === 1
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSystemsColumns(1)}
              title="Single column layout"
              aria-label="Single column systems layout"
              aria-pressed={systemsColumns === 1}
              data-testid="systems-layout-single"
            >
              <LayoutList className="h-3.5 w-3.5" aria-hidden="true" />
              <span>1 Col</span>
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                systemsColumns === 2
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSystemsColumns(2)}
              title="Two columns on wide display"
              aria-label="Two columns systems layout"
              aria-pressed={systemsColumns === 2}
              data-testid="systems-layout-double"
            >
              <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>2 Cols</span>
            </button>
          </div>
        )}
      </div>
      <ul
        className={cn(
          "space-y-1",
          isMultiColumnActive && "xl:grid xl:grid-cols-2 xl:gap-2 xl:space-y-0",
        )}
        data-testid="systems-compact-stack"
        data-columns={isMultiColumnActive ? 2 : 1}
      >
        {enabledSystems.map((system) => {
          const systemValue = patient.systems[system.key as keyof PatientSystems] ?? "";
          const isExpanded = round.expandedSystemId === system.key;
          const cue = toPlainCue(systemValue, 64);
          const hasContent = Boolean(cue);
          const updatedAt = patient.fieldTimestamps[`systems.${system.key}`] ?? patient.lastModified;

          return (
            <li
              key={system.key}
              className={cn(
                "rounded-lg border border-border/30 transition-colors",
                isExpanded ? "bg-card/60" : "bg-secondary/15 hover:bg-secondary/25",
                hasContent && !isExpanded && "border-border/45",
                isExpanded && isMultiColumnActive && "xl:col-span-2",
              )}
              data-systems-row={system.key}
              data-expanded={isExpanded ? "true" : "false"}
            >
              <button
                type="button"
                id={`focus-system-heading-${system.key}`}
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
                      "ml-auto flex min-w-0 max-w-[58%] flex-col items-end gap-0.5 whitespace-normal text-right",
                      touchFriendly ? "text-sm" : "text-xs",
                    )}
                  >
                    <span className={hasContent ? "text-foreground/75" : "text-muted-foreground"}>
                      {hasContent ? cue : "Not documented"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Chart note · {formatUpdatedCue(updatedAt)}
                    </span>
                  </span>
                )}
              </button>
              {isExpanded && (
                <div
                  id={`focus-system-${system.key}`}
                  className="border-t border-border/20 px-3 pb-3 pt-2"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {system.label} Notes
                    </span>
                    <BedsideDictateButton
                      systemLabel={system.label}
                      patientId={patient.id}
                      systemKey={system.key}
                      onTranscript={(text) => {
                        const current = systemValue || "";
                        const updated = current.trim() ? `${current}\n${text}` : text;
                        handleSystemChange(system.key, updated);
                      }}
                    />
                  </div>
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
                    ariaLabelledby={`focus-system-heading-${system.key}`}
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
      role={touchFriendly ? "tabpanel" : undefined}
      aria-labelledby={touchFriendly ? "focus-mobile-tab-todos" : undefined}
      aria-label={touchFriendly ? undefined : "Todos"}
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
      <div className="shrink-0 border-b border-border/30 bg-card/30 px-4 py-3 md:px-6">
        {decisionDraft && (
          <div className="mb-3" data-testid="patient-focus-decision-review">
            <DecisionReview
              draft={decisionDraft}
              patientId={patient.id}
              touchFriendly={touchFriendly}
              onChange={onDecisionDraftChange}
              onClose={onDecisionReviewClose}
              onAttest={onDecisionAttest}
            />
          </div>
        )}
        <div className="mb-3"><NoteComposerLauncher patient={patient} /></div>
        <dl className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4" data-testid="patient-focus-identity">
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</dt>
            <dd className={cn("mt-0.5 break-words font-semibold tracking-tight text-foreground", touchFriendly ? "text-xl" : "text-lg")}>
              {identity.name}
            </dd>
          </div>
          {[
            ["MRN", identity.mrn],
            ["Room / bed", identity.room],
            ["DOB", identity.dob],
            ["Sex / gender", identity.gender],
            ["Admission", identity.admissionDate],
            ["Attending", identity.attending],
            ["Diagnosis", identity.diagnosis],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 break-words text-sm text-foreground/90">{value}</dd>
            </div>
          ))}
          <div className="min-w-0 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 sm:col-span-2" data-testid="patient-focus-allergies">
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Allergies
            </dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-amber-950 dark:text-amber-200">{identity.allergies}</dd>
          </div>
          <div className="min-w-0 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 sm:col-span-2" data-testid="patient-focus-code-status">
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-900 dark:text-red-300">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Code status
            </dt>
            <dd className="mt-0.5 break-words text-sm font-semibold text-red-950 dark:text-red-200">{identity.codeStatus}</dd>
          </div>
          {identity.isolation !== "Not documented" ? (
            <div className="min-w-0 rounded-lg border border-orange-500/40 bg-orange-500/10 p-2.5 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-orange-900 dark:text-orange-300">
                Isolation precautions
              </dt>
              <dd className="mt-0.5 break-words text-sm font-semibold text-orange-950 dark:text-orange-200">
                {identity.isolation}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {touchFriendly && (
        <div
          className="flex shrink-0 gap-2 overflow-x-auto border-b border-border/30 bg-muted/20 px-3 py-2"
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
                  "round-section-tab min-h-[44px] shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted/80 hover:text-foreground",
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
        {showSummary && chartReviewSection}
        {showSystems && systemsSection}
        {showTodos && todosSection}
        {touchFriendly && !showSummary ? (
          <div id="focus-summary-panel" role="tabpanel" aria-labelledby="focus-mobile-tab-clinicalSummary" hidden />
        ) : null}
        {touchFriendly && !showSystems ? (
          <div id="focus-system-panel" role="tabpanel" aria-labelledby="focus-mobile-tab-systems" hidden />
        ) : null}
        {touchFriendly && !showTodos ? (
          <div id="focus-todos-panel" role="tabpanel" aria-labelledby="focus-mobile-tab-todos" hidden />
        ) : null}
      </div>
    </div>
  );
};
