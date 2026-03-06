import React, { createContext, useContext, useMemo } from "react";
import { Patient } from "@/types/patient";

// Focused context for patient data and CRUD operations
interface PatientDataContextValue {
  // Data
  patients: Patient[];
  filteredPatients: Patient[];
  
  // CRUD Actions
  onAddPatient: () => void;
  onAddPatientWithData: (data: Partial<Patient>) => void;
  onUpdatePatient: (id: string, updates: Partial<Patient>) => void;
  onRemovePatient: (id: string) => void;
  onDuplicatePatient: (id: string) => void;
  onImportPatients: (importedPatients: Patient[]) => void;
  
  // Bulk Operations
  onBatchUpdatePatients: (updates: Array<{ id: string; updates: Partial<Patient> }>) => void;
}

const PatientDataContext = createContext<PatientDataContextValue | null>(null);

export function PatientDataProvider({ 
  children, 
  value 
}: { 
  children: React.ReactNode;
  value: PatientDataContextValue;
}) {
  const memoizedValue = useMemo(() => value, [
    value.patients,
    value.filteredPatients,
    value.onAddPatient,
    value.onAddPatientWithData,
    value.onUpdatePatient,
    value.onRemovePatient,
    value.onDuplicatePatient,
    value.onImportPatients,
    value.onBatchUpdatePatients,
  ]);

  return (
    <PatientDataContext.Provider value={memoizedValue}>
      {children}
    </PatientDataContext.Provider>
  );
}

export function usePatientData() {
  const context = useContext(PatientDataContext);
  if (!context) {
    throw new Error("usePatientData must be used within a PatientDataProvider");
  }
  return context;
}

// Hook for read-only access (optimization for components that don't need CRUD)
export function usePatientList() {
  const { patients, filteredPatients } = usePatientData();
  return { patients, filteredPatients };
}
