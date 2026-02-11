import * as React from "react";
import { PatientCard } from "@/components/PatientCard";
import type { Patient } from "@/types/patient";
import type { AutoText } from "@/types/autotext";

interface VirtualizedPatientListProps {
  patients: Patient[];
  autotexts: AutoText[];
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  onRemovePatient: (id: string) => void;
  onDuplicatePatient: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

/**
 * Patient list component that renders all patient cards.
 * 
 * Note: We intentionally avoid virtualization here because patient cards
 * have highly dynamic content (rich text editors, images, expandable sections)
 * that makes accurate height measurement unreliable. The trade-off of
 * rendering all cards is acceptable for typical patient list sizes (10-30 patients).
 */
export const VirtualizedPatientList = React.memo(({
  patients,
  autotexts,
  onUpdatePatient,
  onRemovePatient,
  onDuplicatePatient,
  onToggleCollapse,
}: VirtualizedPatientListProps) => {
  // Stable callback for remove with confirmation
  const handleRemove = React.useCallback((id: string) => {
    if (confirm('Remove this patient from rounds?')) {
      onRemovePatient(id);
    }
  }, [onRemovePatient]);

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
    <div className="w-full space-y-4">
      {patients.map((patient) => (
        <PatientCard
          key={patient.id}
          patient={patient}
          onUpdate={onUpdatePatient}
          onRemove={handleRemove}
          onDuplicate={onDuplicatePatient}
          onToggleCollapse={onToggleCollapse}
          autotexts={autotexts}
        />
      ))}
    </div>
  );
});

VirtualizedPatientList.displayName = "VirtualizedPatientList";
