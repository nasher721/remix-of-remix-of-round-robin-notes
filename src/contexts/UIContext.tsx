import React, { createContext, useContext, useMemo } from "react";
import { Patient } from "@/types/patient";

// Context for UI state (selections, modals, panels)
interface UIContextValue {
  // Patient Selection
  selectedPatient: Patient | null;
  onPatientSelect: (patient: Patient | null) => void;
  
  // Mobile Tab
  mobileTab: string;
  setMobileTab: (tab: string) => void;
  
  // Utility Panel (Desktop)
  utilityPanel: string | null;
  setUtilityPanel: (panel: string | null) => void;
  
  // AI Command Palette
  aiCommandPaletteOpen: boolean;
  setAICommandPaletteOpen: (open: boolean) => void;
  
  // Phrase Manager
  showPhraseManager: boolean;
  setShowPhraseManager: (show: boolean) => void;
  
  // Print Dialog
  showPrintDialog: boolean;
  setShowPrintDialog: (show: boolean) => void;
  
  // Comparison Mode
  comparisonPatients: Patient[];
  setComparisonPatients: (patients: Patient[]) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ 
  children, 
  value 
}: { 
  children: React.ReactNode;
  value: UIContextValue;
}) {
  const memoizedValue = useMemo(() => value, [
    value.selectedPatient,
    value.onPatientSelect,
    value.mobileTab,
    value.setMobileTab,
    value.utilityPanel,
    value.setUtilityPanel,
    value.aiCommandPaletteOpen,
    value.setAICommandPaletteOpen,
    value.showPhraseManager,
    value.setShowPhraseManager,
    value.showPrintDialog,
    value.setShowPrintDialog,
    value.comparisonPatients,
    value.setComparisonPatients,
  ]);

  return (
    <UIContext.Provider value={memoizedValue}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}

// Convenience hooks for specific UI state
export function usePatientSelection() {
  const { selectedPatient, onPatientSelect } = useUI();
  return { selectedPatient, onPatientSelect };
}

export function useMobileTab() {
  const { mobileTab, setMobileTab } = useUI();
  return { mobileTab, setMobileTab };
}

export function useUtilityPanel() {
  const { utilityPanel, setUtilityPanel } = useUI();
  return { utilityPanel, setUtilityPanel };
}
