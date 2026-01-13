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
