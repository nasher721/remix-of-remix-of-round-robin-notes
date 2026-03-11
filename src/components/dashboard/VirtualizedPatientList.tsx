import * as React from "react";
import { PatientCard } from "@/components/PatientCard";
import type { Patient } from "@/types/patient";
import type { AutoText } from "@/types/autotext";

import { useDashboard } from "@/contexts/DashboardContext";
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

/**
 * Patient list component that renders all patient cards.
 *
 * Note: We intentionally avoid virtualization here because patient cards
 * have highly dynamic content (rich text editors, images, expandable sections)
 * that makes accurate height measurement unreliable. The trade-off of
 * rendering all cards is acceptable for typical patient list sizes (10-30 patients).
 */
export const VirtualizedPatientList = React.memo(() => {
  const {
    filteredPatients: patients,
    autotexts,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    onToggleCollapse
  } = useDashboard();

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
    [patients, pendingRemoveId]
  );

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <span className="text-3xl">🏥</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Ready to Start Rounds</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Click "Add Patient" to add your first patient to the list.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full space-y-4">
        {patients.map((patient) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            onUpdate={onUpdatePatient}
            onRemove={handleRemoveRequest}
            onDuplicate={onDuplicatePatient}
            onToggleCollapse={onToggleCollapse}
            autotexts={autotexts}
          />
        ))}
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
