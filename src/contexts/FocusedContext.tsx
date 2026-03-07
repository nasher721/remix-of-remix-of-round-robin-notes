import React, { createContext, useContext, useMemo } from "react";
import { Patient } from "@/types/patient";
import { PatientTodo } from "@/types/todo";
import { AutoText } from "@/types/autotext";
import { PatientFilterType } from "@/constants/config";

import { DashboardContext as LegacyContext } from "./DashboardContext";
import { MobileTab } from "@/components/layout";
import { getGlobalState, setGlobalState } from "@/lib/globalState";

// Types for the new focused contexts

export interface PatientDataState {
  // Patient data
  patients: Patient[];
  filteredPatients: Patient[];
  autotexts: AutoText[];
  templates: string[];
  customDictionary: string[];
  todosMap: Record<string, PatientTodo[]>;
  
  // Patient CRUD operations
  onAddPatient: () => void;
  onAddPatientWithData: (data: Partial<Patient>) => void;
  onImportPatients: (patients: Patient[]) => void;
  onUpdatePatient: (id: string, updates: Partial<Patient>) => void;
  onRemovePatient: (id: string) => void;
  onDuplicatePatient: (id: string) => void;
  onBatchUpdatePatients: (updates: Array<{ id: string; updates: Partial<Patient> }>) => void;
  
  // Autotext operations
  onAddAutotext: (autotext: AutoText) => void;
  onRemoveAutotext: (trigger: string) => void;
  onAddTemplate: (template: string) => void;
  onRemoveTemplate: (template: string) => void;
  onImportDictionary: (words: string[]) => void;
}

export interface FilterState {
  // Filter/search state
  searchQuery: string;
  filter: PatientFilterType;
  sortBy: string;
  
  // Filter actions
  setSearchQuery: (query: string) => void;
  setFilter: (filter: PatientFilterType) => void;
  setSortBy: (sortBy: string) => void;
  resetFilters: () => void;
}

export interface UIState {
  // UI state
  selectedPatient: Patient | null;
  mobileTab: MobileTab;
  utilityPanel: string | null;
  
  // UI actions
  setSelectedPatient: (patient: Patient | null) => void;
  setMobileTab: (tab: MobileTab) => void;
  setUtilityPanel: (panel: string | null) => void;
  
  // Modal state
  showPhraseManager: boolean;
  showAICommandPalette: boolean;
  setShowPhraseManager: (show: boolean) => void;
  setShowAICommandPalette: (show: boolean) => void;
  
  // App state
  isOnline: boolean;
  user: { id: string; email: string } | null;
  onSignOut: () => void;
}


class GenericProvider<T> extends React.Component<{ children: React.ReactNode }> {
  static Context = createContext<T | null>(null);
  
  // Inner context that provides both new and legacy access
  private static LegacyContext = LegacyContext;
  
  constructor(props: { children: React.ReactNode; value: T }, private contextName: string) {
    super(props);
    this.state = { value: props.value };
    this.Context = GenericProvider.createContext<T>(contextName);
  }
  
  static getDerivedStateFromProps<T>(props: { value: T }) {
    return { value: props.value };
  }
  
  componentDidMount() {
    // Sync with legacy context for backward compatibility
    const legacyContext = this.context as any;
    if (legacyContext && typeof legacyContext === 'object') {
      Object.assign(legacyContext, this.state.value);
    }
  }
  
  componentDidUpdate() {
    // Sync with legacy context for backward compatibility
    const legacyContext = this.context as any;
    if (legacyContext && typeof legacyContext === 'object') {
      Object.assign(legacyContext, this.state.value);
    }
  }
  
  render() {
    const { children } = this.props;
    const { value } = this.state;
    
    return (
      <this.Context.Provider value={value}>
        {children}
      </this.Context.Provider>
    );
  }
}

// Wrapper component for backward compatibility
export const CompatProvider = ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => {
  const { Provider } = useContext(LegacyContext);
  
  return (
    <Provider {...props}>
      {children}
    </Provider>
  );
};

export const usePatientData = () => {
  const context = useContext(PatientDataContext.Provider.Context);
  if (!context) {
    throw new Error("usePatientData must be used within a PatientDataProvider");
  }
  return context as PatientDataState;
};

export const useFilters = () => {
  const context = useContext(FilterContext.Provider.Context);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context as FilterState;
};

export const useUI = () => {
  const component = useContext(UIContext.Provider.Context);
  if (!component) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return component as UIState;
};

export const PatientDataContext = {
  Provider: new GenericProvider<PatientDataState>({ children: null, value: {} as PatientDataState }, 'PatientData'),
};

export const FilterContext = {
  Provider: new GenericProvider<FilterState>({ children: null, value: {} as FilterState }, 'Filter'),
};

export const UIContext = {
  Provider: new GenericProvider<UIState>({ children: null, value: {} as UIState }, 'UI'),
};

// Utility to create these providers easily
export const createProviders = (props: { children: React.ReactNode } & { patientData: PatientDataState; filter: FilterState; ui: UIState }) => {
  return (
    <PatientDataContext.Provider value={props.patientData}>
      <FilterContext.Provider value={props.filter}>
        <UIContext.Provider value={props.ui}>
          {props.children}
        </UIContext.Provider>
      </FilterContext.Provider>
    </PatientDataContext.Provider>
  );
};
