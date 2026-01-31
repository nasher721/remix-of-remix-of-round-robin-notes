import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";

export interface ColumnConfig {
    key: string;
    label: string;
    enabled: boolean;
    combinedWith?: string;
}

export interface ColumnCombination {
    key: string;
    label: string;
    columns: string[];
    isCustom?: boolean;
}

export interface CustomCombination extends ColumnCombination {
    isCustom: true;
    createdAt: string;
}

export type ColumnWidthsType = {
    patient: number;
    summary: number;
    events: number;
    imaging: number;
    labs: number;
    notes: number;
    [key: string]: number; // Allow system keys
};

export interface PrintPreset {
    id: string;
    name: string;
    columns: ColumnConfig[];
    combinedColumns: string[];
    printOrientation: 'portrait' | 'landscape';
    printFontSize: number;
    printFontFamily: string;
    onePatientPerPage: boolean;
    autoFitFontSize: boolean;
    columnWidths: ColumnWidthsType;
    createdAt: string;
}

export interface PrintSettings {
    columns: ColumnConfig[];
    combinedColumns: string[];
    printOrientation: 'portrait' | 'landscape';
    printFontSize: number;
    printFontFamily: string;
    onePatientPerPage: boolean;
    autoFitFontSize: boolean;
    columnWidths: ColumnWidthsType;
    activeTab: string;
    showNotesColumn: boolean;
    showTodosColumn: boolean;
}

export interface PrintDataProps {
    patients: Patient[];
    patientTodos?: Record<string, PatientTodo[]>;
    patientNotes?: Record<string, string>;
}
