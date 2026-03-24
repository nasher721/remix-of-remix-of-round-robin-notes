import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Patient } from "@/types/patient";

interface CurrentPatientsContextType {
  patients: Patient[];
  setPatients: (patients: Patient[]) => void;
}

const CurrentPatientsContext = createContext<CurrentPatientsContextType | undefined>(undefined);

export function useCurrentPatients(): Patient[] {
  const ctx = useContext(CurrentPatientsContext);
  return ctx?.patients ?? [];
}

export function useSetCurrentPatients(): (patients: Patient[]) => void {
  const ctx = useContext(CurrentPatientsContext);
  return ctx?.setPatients ?? (() => {});
}

interface CurrentPatientsProviderProps {
  children: ReactNode;
}

export function CurrentPatientsProvider({ children }: CurrentPatientsProviderProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const stableSet = useCallback((next: Patient[]) => {
    setPatients(next);
  }, []);
  const value = React.useMemo(
    () => ({ patients, setPatients: stableSet }),
    [patients, stableSet]
  );
  return (
    <CurrentPatientsContext.Provider value={value}>
      {children}
    </CurrentPatientsContext.Provider>
  );
}
