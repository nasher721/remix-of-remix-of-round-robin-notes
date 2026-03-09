import React, { createContext, useContext, ReactNode } from "react";
import { Patient } from "@/types/patient";
import { AutoText, Template } from "@/types/autotext";
import { MobileTab } from "@/components/layout";
import { PatientTodo } from "@/types/todo";
import { PatientFilterType } from "@/constants/config";

interface DashboardContextType {
    // Data
    user: { email?: string } | null;
    patients: Patient[];
    filteredPatients: Patient[];
    autotexts: AutoText[];
    templates: Template[];
    customDictionary: Record<string, string>;
    todosMap: Record<string, PatientTodo[]>;

    // State
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filter: PatientFilterType;
    setFilter: (filter: PatientFilterType) => void;
    selectedPatient: Patient | null;
    mobileTab: MobileTab;
    setMobileTab: (tab: MobileTab) => void;
    lastSaved: Date;

    // Actions
    onAddPatient: () => void;
    onAddPatientWithData: (data: Partial<Patient>) => Promise<void>;
    onUpdatePatient: (id: string, field: string, value: unknown) => void;
    onRemovePatient: (id: string) => void;
    onDuplicatePatient: (id: string) => void;
    onToggleCollapse: (id: string) => void;
    onCollapseAll: () => void;
    onClearAll: () => void;
    onImportPatients: (patients: Partial<Patient>[]) => Promise<void>;

    // Autotext Actions
    onAddAutotext: (shortcut: string, expansion: string, category: string) => Promise<boolean>;
    onRemoveAutotext: (shortcut: string) => Promise<void>;
    onAddTemplate: (name: string, content: string, category: string) => Promise<boolean>;
    onRemoveTemplate: (id: string) => Promise<void>;
    onImportDictionary: (entries: Record<string, string>) => Promise<boolean | void>;

    // Auth
    onSignOut: () => void;
    onPatientSelect: (patient: Patient | null) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error("useDashboard must be used within a DashboardProvider");
    }
    return context;
};

interface DashboardProviderProps extends DashboardContextType {
    children: ReactNode;
}

export const DashboardProvider = ({ children, ...props }: DashboardProviderProps) => {
    return (
        <DashboardContext.Provider value={props}>
            {children}
        </DashboardContext.Provider>
    );
};
