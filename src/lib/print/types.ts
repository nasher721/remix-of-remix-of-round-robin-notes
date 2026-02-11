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
    todos: number;
    'systems.neuro': number;
    'systems.cv': number;
    'systems.resp': number;
    'systems.renalGU': number;
    'systems.gi': number;
    'systems.endo': number;
    'systems.heme': number;
    'systems.infectious': number;
    'systems.skinLines': number;
    'systems.dispo': number;
    [key: string]: number; // Allow additional system keys
};

export type CombinedColumnWidths = Record<string, number>;

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
    combinedColumnWidths: CombinedColumnWidths;
    margins: 'narrow' | 'normal' | 'wide';
    headerStyle: 'minimal' | 'standard' | 'detailed';
    borderStyle: 'none' | 'light' | 'medium' | 'heavy';
    showPageNumbers: boolean;
    showTimestamp: boolean;
    alternateRowColors: boolean;
    compactMode: boolean;
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
    combinedColumnWidths: CombinedColumnWidths;
    margins: 'narrow' | 'normal' | 'wide';
    headerStyle: 'minimal' | 'standard' | 'detailed';
    borderStyle: 'none' | 'light' | 'medium' | 'heavy';
    showPageNumbers: boolean;
    showTimestamp: boolean;
    alternateRowColors: boolean;
    compactMode: boolean;
    activeTab: string;
    showNotesColumn: boolean;
    showTodosColumn: boolean;
}

export interface PrintDataProps {
    patients: Patient[];
    patientTodos?: Record<string, PatientTodo[]>;
    patientNotes?: Record<string, string>;
}
