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
import { ListTodo, PanelRightClose, PanelRightOpen } from "lucide-react";

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
  } = useDashboard();
  const todosMap = useDashboardTodos();

  const [pendingRemoveId, setPendingRemoveId] = React.useState<string | null>(null);
  const [tasksRailOpen, setTasksRailOpen] = React.useState(true);

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

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <span className="text-3xl">🏥</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Ready to Start Rounds</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Click &quot;Add Patient&quot; to add your first patient to the list.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full flex flex-col lg:flex-row gap-4 min-h-[min(65vh,640px)] lg:min-h-0 lg:flex-1">
        <aside
          className="flex-shrink-0 w-full lg:w-[min(100%,280px)] lg:max-w-[320px] border border-border/30 rounded-lg bg-card/60 flex flex-col min-h-[200px] lg:min-h-0 lg:max-h-[calc(100vh-14rem)]"
          aria-label="Patient list"
        >
          <div className="px-3 py-2 border-b border-border/20 text-xs font-medium text-muted-foreground">
            Patients ({patients.length})
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-2 space-y-1">
              {patients.map((patient) => {
                const isActive = selectedPatient?.id === patient.id;
                return (
                  <li key={patient.id}>
                    <button
                      type="button"
                      onClick={() => setDesktopSelectedPatientId(patient.id)}
                      className={cn(
                        "w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start gap-2 border",
                        isActive
                          ? "bg-primary/12 border-primary/35 shadow-sm"
                          : "border-transparent hover:bg-secondary/70",
                      )}
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/15 text-sm font-semibold text-primary">
                        {patient.name ? patient.name.charAt(0).toUpperCase() : "#"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-foreground leading-tight">
                          {patient.name || "Unnamed"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
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

        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto pr-1">
          {selectedPatient ? (
            <PatientCard
              key={selectedPatient.id}
              patient={selectedPatient}
              onUpdate={onUpdatePatient}
              onRemove={handleRemoveRequest}
              onDuplicate={onDuplicatePatient}
              onToggleCollapse={onToggleCollapse}
              autotexts={autotexts}
              sharedPatientTodos={sharedPatientTodos}
              hidePatientWideTodos
            />
          ) : null}
        </div>

        {tasksRailOpen ? (
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
                onClick={() => setTasksRailOpen(false)}
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
        ) : (
          <div className="hidden lg:flex flex-col shrink-0 w-11 border border-border/30 rounded-lg bg-card/60 items-center py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => setTasksRailOpen(true)}
              aria-label="Expand tasks panel"
              title="Expand tasks panel"
            >
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
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
