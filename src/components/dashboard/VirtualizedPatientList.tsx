import * as React from "react";
import { PatientCard } from "@/components/PatientCard";
import { PatientTodos } from "@/components/PatientTodos";
import type { Patient } from "@/types/patient";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
import { usePatientTodos } from "@/hooks/usePatientTodos";
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
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { shouldRunAnime, useAnimeTimeline } from "@/lib/anime";
import { useMotionPreference } from "@/hooks/useReducedMotion";
import { useDashboardLayout } from "@/context/DashboardLayoutContext";
import { toLayoutMode, toPrefsMode } from "@/lib/dashboardLayoutModes";
import { ListTodo, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

/**
 * Desktop workspace: left = selectable list, right = full card for the selected patient.
 *
 * Note: We intentionally avoid window virtualization; cards are rich and heights vary.
 */
export const VirtualizedPatientList = React.memo(() => {
  const {
    filteredPatients: patients,
    autotexts,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    onToggleCollapse,
    desktopSelectedPatientId,
    setDesktopSelectedPatientId,
    patientListViewMode,
  } = useDashboard();
  const todosMap = useDashboardTodos();

  const {
    panelLeftCollapsed,
    panelRightCollapsed,
    focusModeActive,
    focusModeEditorId,
    enterFocusMode,
    exitFocusMode,
    setLeftPanelCollapsed,
    setRightPanelCollapsed,
    systemsLayoutMode,
    customSystemsGroupIds,
    setSystemsLayoutMode,
    setCustomSystemsGroup,
    patientRosterLayoutMode,
  } = useDashboardLayout();

  const [pendingRemoveId, setPendingRemoveId] = React.useState<string | null>(null);

  const handleRemoveRequest = React.useCallback((id: string) => {
    setPendingRemoveId(id);
  }, []);

  const handleConfirmRemove = React.useCallback(() => {
    if (pendingRemoveId) {
      onRemovePatient(pendingRemoveId);
      setPendingRemoveId(null);
    }
  }, [pendingRemoveId, onRemovePatient]);

  const handleCancelRemove = React.useCallback(() => {
    setPendingRemoveId(null);
  }, []);

  const pendingPatient = React.useMemo(
    () => patients.find((p) => p.id === pendingRemoveId),
    [patients, pendingRemoveId],
  );

  const selectedPatient = React.useMemo((): Patient | null => {
    if (patients.length === 0) return null;
    if (desktopSelectedPatientId) {
      const found = patients.find((p) => p.id === desktopSelectedPatientId);
      if (found) return found;
    }
    return patients[0];
  }, [patients, desktopSelectedPatientId]);

  const sharedPatientTodos = usePatientTodos(selectedPatient?.id ?? null, {
    initialTodos: selectedPatient ? todosMap[selectedPatient.id] : undefined,
  });

  const { prefersReducedMotion } = useMotionPreference();
  const animeEnabled = shouldRunAnime(prefersReducedMotion);
  const patientListKey = React.useMemo(
    () => patients.map((p) => p.id).join("|"),
    [patients],
  );
  const listStaggerRef = React.useRef<HTMLUListElement>(null);

  useAnimeTimeline(
    ({ createTimeline, stagger }) => {
      const root = listStaggerRef.current;
      if (!root) return null;
      const items = root.querySelectorAll<HTMLElement>("[data-anime-stagger-item]");
      if (items.length === 0) return null;
      const tl = createTimeline({ defaults: { ease: "outCubic" } });
      tl.add(items, {
        opacity: { from: 0, to: 1 },
        y: { from: 8, to: 0 },
        duration: 340,
        delay: stagger(40, { from: "first" }),
      });
      return tl;
    },
    [patientListKey],
    { enabled: animeEnabled, afterLayout: true },
  );

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gradient-mesh-empty rounded-xl">
        <div className="w-20 h-20 rounded-3xl bg-secondary/30 border border-border/40 flex items-center justify-center mb-6 depth-shadow-hover">
          <span className="text-4xl">🏥</span>
        </div>
        <h3 className="text-2xl font-semibold mb-2 text-foreground tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Ready to Start Rounds
        </h3>
        <p className="text-muted-foreground text-base max-w-sm leading-relaxed">
          Click &quot;Add Patient&quot; to add your first patient to the list.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full flex flex-col lg:flex-row gap-4 min-h-[min(65vh,640px)] lg:min-h-0 lg:flex-1">
        {patientRosterLayoutMode === "sidebar" && !focusModeActive && (
          !panelLeftCollapsed ? (
            <aside
              className="flex-shrink-0 w-full lg:w-[min(100%,280px)] lg:max-w-[320px] border border-border/30 rounded-lg bg-card/60 flex flex-col min-h-[200px] lg:min-h-0 lg:max-h-[calc(100vh-14rem)]"
              aria-label="Patient list"
              role="region"
              aria-labelledby="desktop-patient-list-heading"
            >
              <div className="px-3 py-2 border-b border-border/20 text-xs font-medium text-muted-foreground flex items-center justify-between gap-2">
                <h2 id="desktop-patient-list-heading" className="truncate">Patients ({patients.length})</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  onClick={() => setLeftPanelCollapsed(true)}
                  aria-label="Collapse patient list"
                  title="Collapse patient list"
                  aria-expanded
                  aria-controls="desktop-patient-list-content"
                >
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <ScrollArea className="flex-1" id="desktop-patient-list-content">
                <ul ref={listStaggerRef} className="p-2 space-y-1">
                  {patients.map((patient) => {
                    const isActive = selectedPatient?.id === patient.id;
                    return (
                      <li key={patient.id}>
                        <button
                          type="button"
                          data-anime-stagger-item
                          onClick={() => setDesktopSelectedPatientId(patient.id)}
                          className={cn(
                            "w-full text-left rounded-lg transition-all flex items-start gap-2 border",
                            patientListViewMode === "compact" ? "px-2.5 py-2" : "px-3 py-2.5",
                            isActive
                              ? "bg-primary/12 border-primary/35 shadow-sm border-l-[3px] border-l-primary/60"
                              : "border-transparent hover:bg-secondary/70 hover:shadow-md hover:border-l-[3px] hover:border-l-primary/40",
                          )}
                        >
                          <div className={cn(
                            "rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/15 font-semibold text-primary",
                            patientListViewMode === "compact" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm",
                          )}>
                            {patient.name ? patient.name.charAt(0).toUpperCase() : "#"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "font-medium truncate text-foreground leading-tight",
                              patientListViewMode === "compact" ? "text-xs" : "text-sm",
                            )}>
                              {patient.name || "Unnamed"}
                            </p>
                            <p className={cn(
                              "text-muted-foreground truncate font-mono",
                              patientListViewMode === "compact" ? "text-[10px] mt-0" : "text-[11px] mt-0.5",
                            )}>
                              {[patient.mrn?.trim(), patient.bed?.trim()].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </aside>
          ) : (
            <div className="hidden lg:flex flex-col shrink-0 w-11 border border-border/30 rounded-lg bg-card/60 items-center py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                onClick={() => setLeftPanelCollapsed(false)}
                aria-label="Expand patient list"
                title="Expand patient list"
                aria-expanded={false}
              >
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )
        )}

        <div className={cn("flex-1 min-w-0 min-h-0", focusModeActive ? "px-1" : "pr-1")}>
          {patientRosterLayoutMode === "topbar" && !focusModeActive && (
            <div className="mb-3">
              {panelLeftCollapsed ? (
                <div className="flex items-center justify-start">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 h-8 px-3"
                    onClick={() => setLeftPanelCollapsed(false)}
                    aria-label="Expand patient roster"
                    title="Expand patient roster"
                  >
                    <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                    Roster
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 border border-border/30 rounded-lg bg-card/60">
                  <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                    Patients
                  </span>
                  <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin">
                    <div className="flex items-center gap-2">
                      {patients.map((patient) => {
                        const isActive = selectedPatient?.id === patient.id;
                        return (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => setDesktopSelectedPatientId(patient.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border transition-colors whitespace-nowrap",
                              patientListViewMode === "compact" ? "px-2 py-0.5" : "px-2 py-1",
                              isActive
                                ? "bg-primary/12 border-primary/35 shadow-sm"
                                : "border-transparent hover:bg-secondary/70",
                            )}
                            aria-label={`Select patient ${patient.name || patient.bed || patient.id}`}
                            title={patient.name || patient.bed || "Patient"}
                          >
                            <div className={cn(
                              "rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/15 text-xs font-semibold text-primary",
                              patientListViewMode === "compact" ? "h-5 w-5" : "h-6 w-6",
                            )}>
                              {patient.name ? patient.name.charAt(0).toUpperCase() : "#"}
                            </div>
                            <span className={cn(
                              "font-medium truncate max-w-[10rem]",
                              patientListViewMode === "compact" ? "text-[10px]" : "text-[11px]",
                            )}>
                              {patient.name || "Unnamed"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => setLeftPanelCollapsed(true)}
                    aria-label="Collapse patient roster"
                    title="Collapse patient roster"
                  >
                    <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {selectedPatient ? (
            <div className={cn("w-full", focusModeActive && "mx-auto max-w-[980px]")}>
              <PatientCard
                key={selectedPatient.id}
                patient={selectedPatient}
                onUpdate={onUpdatePatient}
                onRemove={handleRemoveRequest}
                onDuplicate={onDuplicatePatient}
                onToggleCollapse={onToggleCollapse}
                autotexts={autotexts}
                sharedPatientTodos={sharedPatientTodos}
                hidePatientWideTodos={panelRightCollapsed}
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
          ) : null}
        </div>

        {!focusModeActive && (
          panelRightCollapsed ? (
            <div className="hidden lg:flex flex-col shrink-0 w-11 border border-border/30 rounded-lg bg-card/60 items-center py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                onClick={() => setRightPanelCollapsed(false)}
                aria-label="Expand tasks panel"
                title="Expand tasks panel"
              >
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <aside
              className="hidden lg:flex flex-shrink-0 flex-col w-[min(100%,280px)] max-w-[300px] border border-border/30 rounded-lg bg-card/60 min-h-0 max-h-[calc(100vh-14rem)]"
              role="region"
              aria-labelledby="desktop-tasks-rail-heading"
            >
              <div className="px-3 py-2 border-b border-border/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ListTodo className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <h2 id="desktop-tasks-rail-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                    Tasks
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  onClick={() => setRightPanelCollapsed(true)}
                  aria-label="Collapse tasks panel"
                  title="Collapse tasks panel"
                >
                  <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3">
                  {selectedPatient ? (
                    <PatientTodos
                      todos={sharedPatientTodos.todos}
                      section={null}
                      patient={selectedPatient}
                      generating={sharedPatientTodos.generating}
                      onAddTodo={sharedPatientTodos.addTodo}
                      onToggleTodo={sharedPatientTodos.toggleTodo}
                      onDeleteTodo={sharedPatientTodos.deleteTodo}
                      onGenerateTodos={sharedPatientTodos.generateTodos}
                      alwaysVisible
                    />
                  ) : null}
                </div>
              </ScrollArea>
            </aside>
          )
        )}
      </div>

      <AlertDialog open={pendingRemoveId !== null} onOpenChange={(open) => !open && handleCancelRemove()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Patient</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPatient?.name
                ? `Remove ${pendingPatient.name} from rounds?`
                : "Remove this patient from rounds?"}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRemove}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

VirtualizedPatientList.displayName = "VirtualizedPatientList";
