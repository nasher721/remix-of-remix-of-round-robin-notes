import * as React from "react";
import { PatientCard } from "./PatientCard";
import type { CommandCenterPatient } from "@/types/command-center";

interface PatientCardGridProps {
  patients: CommandCenterPatient[];
  focusedIds: string[];
  primaryFocusId: string | null;
  onToggleFocus: (id: string) => void;
}

export const PatientCardGrid = ({
  patients,
  focusedIds,
  primaryFocusId,
  onToggleFocus,
}: PatientCardGridProps) => {
  const dimmed = focusedIds.length > 0;
  return (
    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {patients.map((patient) => (
        <PatientCard
          key={patient.id}
          patient={patient}
          focused={focusedIds.includes(patient.id)}
          dimmed={dimmed}
          aiActive={primaryFocusId === patient.id}
          onToggleFocus={() => onToggleFocus(patient.id)}
        />
      ))}
    </div>
  );
};
