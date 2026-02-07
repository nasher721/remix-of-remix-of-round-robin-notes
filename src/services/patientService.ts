import type { Json } from "@/integrations/supabase/types";
import type { Patient, PatientMedications, PatientSystems } from "@/types/patient";
import { parseFieldTimestampsJson, parseMedicationsJson, parseSystemsJson } from "@/lib/mappers/patientMapper";

export const defaultSystemsValue: PatientSystems = {
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

export const defaultMedicationsValue: PatientMedications = {
  infusions: [],
  scheduled: [],
  prn: [],
  rawText: "",
};

export const mapPatientRecord = (record: {
  id: string;
  patient_number: number;
  name: string;
  bed: string;
  clinical_summary: string;
  interval_events: string;
  imaging: string | null;
  labs: string | null;
  systems: Json | null;
  medications: Json | null;
  field_timestamps: Json | null;
  collapsed: boolean;
  created_at: string;
  last_modified: string | null;
}): Patient => ({
  id: record.id,
  patientNumber: record.patient_number,
  name: record.name,
  bed: record.bed,
  clinicalSummary: record.clinical_summary,
  intervalEvents: record.interval_events,
  imaging: record.imaging || "",
  labs: record.labs || "",
  systems: parseSystemsJson(record.systems),
  medications: parseMedicationsJson(record.medications),
  fieldTimestamps: parseFieldTimestampsJson(record.field_timestamps),
  collapsed: record.collapsed,
  createdAt: record.created_at,
  lastModified: record.last_modified,
});

export const buildPatientInsertPayload = (input: {
  userId: string;
  patientNumber: number;
  name?: string;
  bed?: string;
  clinicalSummary?: string;
  intervalEvents?: string;
  imaging?: string;
  labs?: string;
  systems?: PatientSystems;
  medications?: PatientMedications;
}): Record<string, unknown> => ({
  user_id: input.userId,
  patient_number: input.patientNumber,
  name: input.name ?? "",
  bed: input.bed ?? "",
  clinical_summary: input.clinicalSummary ?? "",
  interval_events: input.intervalEvents ?? "",
  imaging: input.imaging ?? "",
  labs: input.labs ?? "",
  systems: (input.systems ?? defaultSystemsValue) as unknown as Json,
  medications: (input.medications ?? defaultMedicationsValue) as unknown as Json,
  collapsed: false,
});

export const shouldTrackTimestamp = (field: string): boolean => {
  const trackableFields = new Set(["clinicalSummary", "intervalEvents", "imaging", "labs", "medications"]);
  return trackableFields.has(field) || field.startsWith("systems.");
};

export const getNextPatientCounter = (patients: Patient[]): number => {
  const maxNumber = patients.reduce((max, patient) => Math.max(max, patient.patientNumber), 0);
  return maxNumber + 1;
};
