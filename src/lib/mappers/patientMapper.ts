/**
 * Patient Mapper
 * Transforms between database and UI patient representations
 */

import type { DbPatient, Patient, PatientSystems, defaultSystems } from "@/types/patient";
import type { Json } from "@/integrations/supabase/types";

/**
 * Parse systems JSON from database into typed PatientSystems
 */
export const parseSystemsJson = (systems: Json | null): PatientSystems => {
  const defaults: PatientSystems = {
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

  if (!systems || typeof systems !== 'object' || Array.isArray(systems)) {
    return defaults;
  }

  const s = systems as Record<string, unknown>;
  return {
    neuro: String(s.neuro || ''),
    cv: String(s.cv || ''),
    resp: String(s.resp || ''),
    renalGU: String(s.renalGU || ''),
    gi: String(s.gi || ''),
    endo: String(s.endo || ''),
    heme: String(s.heme || ''),
    infectious: String(s.infectious || ''),
    skinLines: String(s.skinLines || ''),
    dispo: String(s.dispo || ''),
  };
};

/**
 * Convert database patient to UI patient (snake_case to camelCase)
 */
export const dbToUiPatient = (dbPatient: DbPatient): Patient => ({
  id: dbPatient.id,
  patientNumber: dbPatient.patient_number,
  name: dbPatient.name,
  bed: dbPatient.bed,
  clinicalSummary: dbPatient.clinical_summary,
  intervalEvents: dbPatient.interval_events,
  imaging: dbPatient.imaging,
  labs: dbPatient.labs,
  systems: dbPatient.systems,
  collapsed: dbPatient.collapsed,
  createdAt: dbPatient.created_at,
  lastModified: dbPatient.last_modified,
});

/**
 * Map field names from UI (camelCase) to DB (snake_case)
 */
export const uiFieldToDbField = (field: string): string => {
  const fieldMap: Record<string, string> = {
    clinicalSummary: "clinical_summary",
    intervalEvents: "interval_events",
    patientNumber: "patient_number",
    createdAt: "created_at",
    lastModified: "last_modified",
  };
  return fieldMap[field] || field;
};

/**
 * Prepare update data for database from UI field update
 */
export const prepareUpdateData = (
  field: string,
  value: unknown,
  currentSystems?: PatientSystems
): Record<string, unknown> => {
  const updateData: Record<string, unknown> = {};

  if (field.includes(".")) {
    const [parent, child] = field.split(".");
    if (parent === "systems" && currentSystems) {
      updateData.systems = { ...currentSystems, [child]: value };
    }
  } else {
    updateData[uiFieldToDbField(field)] = value;
  }

  return updateData;
};
