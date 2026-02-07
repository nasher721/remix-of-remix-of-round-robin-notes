import * as React from "react";
import { CommandCenterDashboard } from "@/components/command-center";
import type { Patient } from "@/types/patient";
import type { AutoText, Template } from "@/types/autotext";
import type { PatientTodo } from "@/types/todo";
import { PatientFilterType } from "@/constants/config";

interface DesktopDashboardProps {
  user: { email?: string };
  patients: Patient[];
  filteredPatients: Patient[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: PatientFilterType;
  setFilter: (filter: PatientFilterType) => void;
  autotexts: AutoText[];
  templates: Template[];
  customDictionary: Record<string, string>;
  todosMap: Record<string, PatientTodo[]>;
  onAddPatient: () => void;
  onAddPatientWithData: (data: Partial<Patient>) => Promise<void>;
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  onRemovePatient: (id: string) => void;
  onDuplicatePatient: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onCollapseAll: () => void;
  onClearAll: () => void;
  onImportPatients: (patients: Partial<Patient>[]) => Promise<void>;
  onAddAutotext: (shortcut: string, expansion: string, category: string) => Promise<boolean>;
  onRemoveAutotext: (shortcut: string) => Promise<void>;
  onAddTemplate: (name: string, content: string, category: string) => Promise<boolean>;
  onRemoveTemplate: (id: string) => Promise<void>;
  onImportDictionary: (entries: Record<string, string>) => Promise<boolean | void>;
  onSignOut: () => void;
  lastSaved: Date;
}

export const DesktopDashboard = ({
  user,
  patients,
  filteredPatients,
  searchQuery,
  setSearchQuery,
  onSignOut,
  lastSaved,
}: DesktopDashboardProps): React.ReactElement => {
  return (
    <CommandCenterDashboard
      user={user}
      patients={patients}
      filteredPatients={filteredPatients}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onSignOut={onSignOut}
      lastSaved={lastSaved}
    />
  );
};
