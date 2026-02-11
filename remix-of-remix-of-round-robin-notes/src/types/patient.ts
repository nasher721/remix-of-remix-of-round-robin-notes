/**
 * Unified Patient Types
 * Single source of truth for all patient-related type definitions
 */

// System-by-system review structure
export interface PatientSystems {
  neuro: string;
  cv: string;
  resp: string;
  renalGU: string;
  gi: string;
  endo: string;
  heme: string;
  infectious: string;
  skinLines: string;
  dispo: string;
}

// Structured medication categories
export interface PatientMedications {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText?: string; // Keep original text as backup
}

// Default empty medications object
export const defaultMedications: PatientMedications = {
  infusions: [],
  scheduled: [],
  prn: [],
  rawText: "",
};

// Field timestamps tracking when each field was last modified
export interface FieldTimestamps {
  clinicalSummary?: string;
  intervalEvents?: string;
  imaging?: string;
  labs?: string;
  medications?: string;
  [key: `systems.${string}`]: string | undefined;
}

// Default empty systems object
export const defaultSystems: PatientSystems = {
  neuro: "",
  cv: "",
  resp: "",
  renalGU: "",
  gi: "",
  endo: "",
  heme: "",
  infectious: "",
  skinLines: "",
  dispo: "",
};

/**
 * Database Patient - matches Supabase table schema
 * Uses snake_case to match database columns
 */
export interface DbPatient {
  id: string;
  user_id: string;
  patient_number: number;
  name: string;
  bed: string;
  clinical_summary: string;
  interval_events: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
  field_timestamps: FieldTimestamps;
  collapsed: boolean;
  created_at: string;
  last_modified: string;
}

/**
 * UI Patient - used in components
 * Uses camelCase for React conventions
 */
export interface Patient {
  id: string;
  patientNumber: number;
  name: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
  fieldTimestamps: FieldTimestamps;
  collapsed: boolean;
  createdAt: string;
  lastModified: string;
}

/**
 * Settings configuration for the app
 */
export interface SettingsType {
  fontSize: string;
  orientation: string;
  margins: string;
  includeSystems: string;
  includeTimestamps: string;
  theme: string;
  cardView: string;
  autoSaveInterval: number;
}
