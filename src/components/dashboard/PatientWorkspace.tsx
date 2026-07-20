import * as React from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  History,
  Loader2,
  MoreHorizontal,
  Sparkles,
  User,
} from "lucide-react";
import { PatientCard } from "@/components/PatientCard";
import { QuickActionsPanel } from "@/components/QuickActionsPanel";
import { AppleAIAssistant } from "@/components/AppleAIAssistant";
import { FieldHistoryViewer } from "@/components/FieldHistoryViewer";
import { ActivityFeed } from "@/components/patient/ActivityFeed";
import { LengthOfStayBadge } from "@/components/LengthOfStayBadge";
import { OneClickSignOff } from "@/components/OneClickSignOff";
import { ShiftHandoff } from "@/components/ShiftHandoff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
import { useDashboardLayout } from "@/context/DashboardLayoutContext";
import { useTeam } from "@/contexts/TeamContext";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import { usePatientActivity } from "@/hooks/usePatientActivity";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { toLayoutMode, toPrefsMode } from "@/lib/dashboardLayoutModes";
import {
  DOCUMENTATION_SECTIONS,
  getDocumentationSectionStatus,
  getSystemsDocumentationCount,
  type DocumentationSectionId,
  type DocumentationStatus,
} from "@/lib/patientDocumentation";
import type { Patient } from "@/types/patient";
import { cn } from "@/lib/utils";

const STATUS_DOT_CLASS: Record<DocumentationStatus, string> = {
  ready: "rr-st-ready",
  "in-progress": "rr-st-prog",
  "not-started": "rr-st-todo",
};

const TAB_LABELS: Record<DocumentationSectionId, string> = {
  summary: "Summary",
  events: "Events",
  systems: "Systems",
  results: "Labs & Imaging",
  medications: "Medications",
};

const CODE_STATUS_LABELS: Record<string, string> = {
  full: "Full code",
  dnr: "DNR",
  dni: "DNI",
  comfort: "Comfort",
};

const ACUITY_BADGE_CLASS: Record<string, string> = {
  low: "rr-badge-green",
  moderate: "rr-badge-orange",
  high: "rr-badge-orange",
  critical: "rr-badge-red",
};

export interface PatientWorkspaceProps {
  /** Opens the AI command palette (owned by DesktopDashboard). */
  onOpenAIPalette: () => void;
}

/**
 * Focused chart workspace (mockup artboard A): patient header with quiet
 * editable identity fields + badges + actions, a 5-tab documentation navigator
 * with status dots, the selected PatientCard in "workspace" chrome as the
 * scrollable body, and a pinned sign-off readiness bar.
 */
export const PatientWorkspace = ({ onOpenAIPalette }: PatientWorkspaceProps) => {
  const {
    patients,
    filteredPatients,
    autotexts,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    onToggleCollapse,
    desktopSelectedPatientId,
    patientSaveStates = {},
    lastSaved,
  } = useDashboard();
  const todosMap = useDashboardTodos();
  const {
    focusModeActive,
    focusModeEditorId,
    enterFocusMode,
    exitFocusMode,
    systemsLayoutMode,
    customSystemsGroupIds,
    setSystemsLayoutMode,
    setCustomSystemsGroup,
  } = useDashboardLayout();
  const { teamMembers } = useTeam();
  const { enabledSystems } = useSystemsConfig();

  const systemKeys = React.useMemo(() => enabledSystems.map((s) => s.key), [enabledSystems]);

  const patient = React.useMemo((): Patient | null => {
    if (filteredPatients.length === 0) return null;
    if (desktopSelectedPatientId) {
      const found = filteredPatients.find((p) => p.id === desktopSelectedPatientId);
      if (found) return found;
    }
    return filteredPatients[0];
  }, [filteredPatients, desktopSelectedPatientId]);

  const [pendingRemove, setPendingRemove] = React.useState(false);
  const removeTriggerRef = React.useRef<HTMLElement | null>(null);
  const [signOffOpen, setSignOffOpen] = React.useState(false);
  const [handoffOpen, setHandoffOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<DocumentationSectionId>("summary");

  const sharedPatientTodos = usePatientTodos(patient?.id ?? null, {
    initialTodos: patient ? (todosMap[patient.id] ?? []) : undefined,
  });

  const { addActivity } = usePatientActivity(patient?.id ?? "");

  // Record sign-offs in the per-patient activity feed (uses the existing
  // 'updated' action since the DB CHECK constraint only allows a fixed set).
  const handleSignOff = React.useCallback(
    (_patientIds: string[], _signature: string) => {
      void addActivity("updated", {
        fieldName: "signoff",
        summary: "Chart signed off",
      });
    },
    [addActivity],
  );

  const handleRemoveRequest = React.useCallback(() => {
    removeTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingRemove(true);
  }, []);

  const handleConfirmRemove = React.useCallback(() => {
    if (patient) onRemovePatient(patient.id);
    setPendingRemove(false);
  }, [onRemovePatient, patient]);

  const jumpToSection = React.useCallback((sectionId: DocumentationSectionId) => {
    setActiveTab(sectionId);
    if (sectionId === "results" || sectionId === "medications") {
      window.dispatchEvent(new Event("rr:reveal-advanced-documentation"));
    }
    window.setTimeout(() => {
      const section = document.querySelector<HTMLElement>(
        `[data-documentation-section="${sectionId}"]`,
      );
      if (!section) return;
      if (typeof section.scrollIntoView === "function") {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      section
        .querySelector<HTMLElement>("[contenteditable='true'], textarea, input, button")
        ?.focus();
    }, sectionId === "results" || sectionId === "medications" ? 50 : 0);
  }, []);

  const sectionStatuses = React.useMemo(() => {
    if (!patient) return null;
    return DOCUMENTATION_SECTIONS.map((section) => ({
      id: section.id,
      status: getDocumentationSectionStatus(patient, section.id, systemKeys),
    }));
  }, [patient, systemKeys]);

  const systemsCount = React.useMemo(
    () => (patient ? getSystemsDocumentationCount(patient, systemKeys) : { filled: 0, total: 0 }),
    [patient, systemKeys],
  );

  if (!patient || !sectionStatuses) return null;

  const readyCount = sectionStatuses.filter((s) => s.status === "ready").length;
  const saveState = patientSaveStates[patient.id] ?? "idle";
  const savedTime = lastSaved.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <section
      className="rr-ws flex min-w-0 flex-1 flex-col"
      style={{ background: "var(--rr-bg-ground)" }}
      aria-label={`Workspace: ${patient.name || "Unnamed patient"}`}
    >
      {/* Patient header */}
      <header
        className="border-b px-5 pb-0 pt-4"
        style={{ borderColor: "var(--rr-sep)", background: "var(--rr-bg-primary)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={patient.name}
            onChange={(e) => onUpdatePatient(patient.id, "name", e.target.value)}
            aria-label="Patient name"
            placeholder="Patient name"
            className="h-9 w-[220px] rounded-[8px] border-transparent bg-transparent px-2 text-[17px] font-semibold shadow-none hover:bg-black/[0.03] focus-visible:bg-background focus-visible:ring-1"
            style={{ color: "var(--rr-label-1)" }}
          />
          <Input
            value={patient.bed}
            onChange={(e) => onUpdatePatient(patient.id, "bed", e.target.value)}
            aria-label="Bed or room number"
            placeholder="Bed / room"
            className="h-7 w-[96px] rounded-[6px] border-transparent px-2 text-[12px] font-medium shadow-none focus-visible:ring-1"
            style={{ background: "var(--rr-f2)", color: "var(--rr-label-2)" }}
          />
          <LengthOfStayBadge createdAt={patient.createdAt} />

          <div className="ml-auto flex flex-wrap items-center gap-1.5 no-print">
            <QuickActionsPanel patient={patient} onUpdatePatient={onUpdatePatient} />
            <AppleAIAssistant patient={patient} onUpdatePatient={onUpdatePatient} compact />
            <button type="button" className="rr-btn rr-btn-outline" onClick={onOpenAIPalette}>
              AI
            </button>
            <FieldHistoryViewer
              patientId={patient.id}
              patientName={patient.name}
              trigger={
                <button type="button" className="rr-btn rr-btn-secondary">
                  <History className="h-4 w-4" aria-hidden="true" />
                  History
                </button>
              }
            />
            <ActivityFeed patientId={patient.id} patientName={patient.name} />
            {teamMembers.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rr-btn rr-btn-outline"
                    aria-label="Assign patient to team member"
                  >
                    <User className="h-4 w-4" aria-hidden="true" />
                    Assign
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-lg">
                  <DropdownMenuLabel className="text-xs">Assign to</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onUpdatePatient(patient.id, "assignedTo", null)}
                    className="text-xs"
                  >
                    Unassigned
                  </DropdownMenuItem>
                  {teamMembers.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => onUpdatePatient(patient.id, "assignedTo", member.id)}
                      className="cursor-pointer text-xs"
                    >
                      <span>{member.name}</span>
                      {patient.assignedTo === member.id && (
                        <span className="ml-auto text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rr-icon-btn"
                  aria-label={`More actions for ${patient.name || "patient"}`}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-lg">
                <DropdownMenuItem onClick={() => onDuplicatePatient(patient.id)}>
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleRemoveRequest}
                  className="text-destructive focus:text-destructive"
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="rr-btn rr-btn-primary"
              onClick={() => setSignOffOpen(true)}
            >
              Sign off
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div
          className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-[18px]"
          style={{ color: "var(--rr-label-3)" }}
        >
          <Input
            value={patient.mrn ?? ""}
            onChange={(e) => onUpdatePatient(patient.id, "mrn", e.target.value)}
            aria-label="Medical record number"
            placeholder="MRN"
            className="h-6 w-[110px] rounded-[6px] border-transparent bg-transparent px-1 text-[12px] shadow-none hover:bg-black/[0.03] focus-visible:bg-background focus-visible:ring-1"
            style={{ color: "var(--rr-label-3)" }}
          />
          {patient.age !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span>{patient.age} y/o</span>
            </>
          )}
          {patient.attendingPhysician && (
            <>
              <span aria-hidden="true">·</span>
              <span>Attending: {patient.attendingPhysician}</span>
            </>
          )}
          {patient.serviceLine && (
            <>
              <span aria-hidden="true">·</span>
              <span>{patient.serviceLine}</span>
            </>
          )}
        </div>

        {/* Badges */}
        {(patient.acuity || patient.codeStatus || (patient.alerts && patient.alerts.length > 0)) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {patient.acuity && (
              <span
                className={cn("rr-badge", ACUITY_BADGE_CLASS[patient.acuity] ?? "rr-badge-neutral")}
              >
                {patient.acuity.charAt(0).toUpperCase() + patient.acuity.slice(1)} acuity
              </span>
            )}
            {patient.codeStatus && (
              <span className="rr-badge rr-badge-neutral" title={`Code status: ${patient.codeStatus}`}>
                {CODE_STATUS_LABELS[patient.codeStatus] ?? patient.codeStatus}
              </span>
            )}
            {patient.alerts && patient.alerts.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="rr-badge rr-badge-red cursor-default">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {patient.alerts.length > 1 ? `${patient.alerts.length} alerts` : patient.alerts[0]}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">Alerts</p>
                      <ul className="space-y-0.5 text-xs">
                        {patient.alerts.map((alert, idx) => (
                          <li key={`${patient.id}-ws-alert-${idx}`} className="flex items-start gap-1">
                            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-destructive" />
                            <span>{alert}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}

        {/* Documentation tabs */}
        <nav className="mt-3 flex items-center gap-1 overflow-x-auto" aria-label="Documentation sections">
          {sectionStatuses.map(({ id, status }) => (
            <button
              key={id}
              type="button"
              className={cn("rr-tab", activeTab === id && "rr-active")}
              onClick={() => jumpToSection(id)}
              aria-pressed={activeTab === id}
            >
              <span className={cn("rr-dot", STATUS_DOT_CLASS[status])} aria-hidden="true" />
              {TAB_LABELS[id]}
            </button>
          ))}
          <div className="ml-auto flex shrink-0 items-center gap-3 pl-2">
            <span className="text-[12px] leading-[18px]" style={{ color: "var(--rr-label-3)" }}>
              {readyCount} of 5 sections ready
            </span>
            <div
              className="flex items-center gap-1.5 text-[12px] leading-[18px]"
              style={{ color: "var(--rr-label-3)" }}
              role="status"
              aria-live="polite"
            >
              {saveState === "saving" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              {saveState === "saved" && (
                <Cloud className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              )}
              {saveState === "queued" && (
                <CloudOff className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              )}
              {saveState === "error" && (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              )}
              {saveState === "idle" && <Check className="h-3 w-3" aria-hidden="true" />}
              <span>
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "queued"
                    ? "Offline queued"
                    : saveState === "error"
                      ? "Save failed"
                      : `Saved ${savedTime}`}
              </span>
            </div>
          </div>
        </nav>
      </header>

      {/* Scrollable chart body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <PatientCard
          key={patient.id}
          chrome="workspace"
          patient={patient}
          onUpdate={onUpdatePatient}
          onRemove={handleRemoveRequest}
          onDuplicate={onDuplicatePatient}
          onToggleCollapse={onToggleCollapse}
          autotexts={autotexts}
          sharedPatientTodos={sharedPatientTodos}
          hidePatientWideTodos={false}
          dashboardFocusModeEnabled={focusModeActive}
          dashboardFocusTarget={focusModeEditorId}
          onRequestDashboardFocusMode={enterFocusMode}
          onExitDashboardFocusMode={exitFocusMode}
          systemsReviewMode={toPrefsMode(systemsLayoutMode)}
          systemsCustomCombineKeys={customSystemsGroupIds}
          onSystemsReviewModeChange={(mode) => setSystemsLayoutMode(toLayoutMode(mode))}
          onSystemsCustomCombineKeysChange={setCustomSystemsGroup}
        />
      </div>

      {/* Pinned sign-off readiness bar */}
      <div className="rr-signoff">
        <span className="text-[12px] font-medium" style={{ color: "var(--rr-label-2)" }}>
          Documentation
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {sectionStatuses.map(({ id, status }) => (
            <span key={id} className="rr-chip">
              <span className={cn("rr-dot", STATUS_DOT_CLASS[status])} aria-hidden="true" />
              {id === "systems"
                ? `Systems ${systemsCount.filled}/${systemsCount.total}`
                : DOCUMENTATION_SECTIONS.find((s) => s.id === id)?.label}
            </span>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rr-btn rr-btn-outline"
            onClick={() => setHandoffOpen(true)}
          >
            Preview handoff
          </button>
          <button
            type="button"
            className="rr-btn rr-btn-primary rr-btn-44"
            onClick={() => setSignOffOpen(true)}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Sign off & mark handoff-ready
          </button>
        </div>
      </div>

      {/* Handoff preview */}
      <Dialog open={handoffOpen} onOpenChange={setHandoffOpen}>
        <DialogContent className="h-[80vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shift handoff</DialogTitle>
          </DialogHeader>
          <ShiftHandoff
            patients={filteredPatients.length > 0 ? filteredPatients : patients}
            onSaveHandoff={() => toast.success("Handoff saved")}
            onCompleteHandoff={() => {
              toast.success("Handoff completed");
              setHandoffOpen(false);
            }}
            onUpdatePatient={onUpdatePatient}
          />
        </DialogContent>
      </Dialog>

      {/* Sign-off flow, pre-focused on this chart */}
      <OneClickSignOff
        open={signOffOpen}
        onOpenChange={setSignOffOpen}
        hideTrigger
        initialSelectedIds={[patient.id]}
        patients={[patient]}
        todosMap={todosMap}
        onSignOff={handleSignOff}
      />

      {/* Remove confirmation */}
      <AlertDialog
        open={pendingRemove}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(false);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            removeTriggerRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Patient</AlertDialogTitle>
            <AlertDialogDescription>
              {patient.name
                ? `Remove ${patient.name} from rounds?`
                : "Remove this patient from rounds?"}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
