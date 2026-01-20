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
