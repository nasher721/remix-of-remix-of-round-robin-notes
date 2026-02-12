import { RxJsonSchema } from 'rxdb';

/**
 * RxDB schema for patients collection
 * Flattened structure for RxDB compatibility (no nested objects)
 * Syncs with Supabase patients table
 */
export const patientSchema: RxJsonSchema<PatientDocType> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    user_id: { type: 'string', maxLength: 36 },
    patient_number: { type: 'number' },
    name: { type: 'string' },
    bed: { type: 'string' },
    clinical_summary: { type: 'string' },
    interval_events: { type: 'string' },
    imaging: { type: 'string' },
    labs: { type: 'string' },
    // Flattened systems (10 fields)
    systems_neuro: { type: 'string' },
    systems_cv: { type: 'string' },
    systems_resp: { type: 'string' },
    systems_renal_gu: { type: 'string' },
    systems_gi: { type: 'string' },
    systems_endo: { type: 'string' },
    systems_heme: { type: 'string' },
    systems_infectious: { type: 'string' },
    systems_skin_lines: { type: 'string' },
    systems_dispo: { type: 'string' },
    // Flattened medications (stored as JSON strings)
    medications_infusions: { type: 'string' },
    medications_scheduled: { type: 'string' },
    medications_prn: { type: 'string' },
    medications_raw_text: { type: 'string' },
    // Field timestamps (stored as JSON string)
    field_timestamps: { type: 'string' },
    collapsed: { type: 'boolean', default: false },
    created_at: { type: 'string' },
    // Replication fields
    _modified: { type: 'number', default: 0 },
    _deleted: { type: 'boolean', default: false },
  },
  required: ['id', 'user_id', 'patient_number', 'name'],
  indexes: ['user_id', 'patient_number'],
};

/**
 * Flattened patient document type for RxDB
 */
export interface PatientDocType {
  id: string;
  user_id: string;
  patient_number: number;
  name: string;
  bed: string;
  clinical_summary: string;
  interval_events: string;
  imaging: string;
  labs: string;
  // Flattened systems
  systems_neuro: string;
  systems_cv: string;
  systems_resp: string;
  systems_renal_gu: string;
  systems_gi: string;
  systems_endo: string;
  systems_heme: string;
  systems_infectious: string;
  systems_skin_lines: string;
  systems_dispo: string;
  // Flattened medications
  medications_infusions: string;
  medications_scheduled: string;
  medications_prn: string;
  medications_raw_text: string;
  field_timestamps: string;
  collapsed: boolean;
  created_at: string;
  _modified: number;
  _deleted: boolean;
}

/**
 * Nested patient type for UI (matches existing Patient type)
 */
export interface PatientNested {
  id: string;
  userId: string;
  patientNumber: number;
  name: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: {
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
  };
  medications: {
    infusions: string[];
    scheduled: string[];
    prn: string[];
    rawText?: string;
  };
  fieldTimestamps?: Record<string, string>;
  collapsed: boolean;
  createdAt: string;
  lastModified?: string;
}

/**
 * Convert nested Patient to flat RxDB document
 */
export function flattenPatient(patient: PatientNested): PatientDocType {
  return {
    id: patient.id,
    user_id: patient.userId,
    patient_number: patient.patientNumber,
    name: patient.name,
    bed: patient.bed ?? '',
    clinical_summary: patient.clinicalSummary ?? '',
    interval_events: patient.intervalEvents ?? '',
    imaging: patient.imaging ?? '',
    labs: patient.labs ?? '',
    systems_neuro: patient.systems?.neuro ?? '',
    systems_cv: patient.systems?.cv ?? '',
    systems_resp: patient.systems?.resp ?? '',
    systems_renal_gu: patient.systems?.renalGU ?? '',
    systems_gi: patient.systems?.gi ?? '',
    systems_endo: patient.systems?.endo ?? '',
    systems_heme: patient.systems?.heme ?? '',
    systems_infectious: patient.systems?.infectious ?? '',
    systems_skin_lines: patient.systems?.skinLines ?? '',
    systems_dispo: patient.systems?.dispo ?? '',
    medications_infusions: JSON.stringify(patient.medications?.infusions ?? []),
    medications_scheduled: JSON.stringify(patient.medications?.scheduled ?? []),
    medications_prn: JSON.stringify(patient.medications?.prn ?? []),
    medications_raw_text: patient.medications?.rawText ?? '',
    field_timestamps: JSON.stringify(patient.fieldTimestamps ?? {}),
    collapsed: patient.collapsed ?? false,
    created_at: patient.createdAt ?? new Date().toISOString(),
    _modified: Date.now(),
    _deleted: false,
  };
}

/**
 * Convert flat RxDB document to nested Patient
 */
export function unflattenPatient(doc: PatientDocType): PatientNested {
  return {
    id: doc.id,
    userId: doc.user_id,
    patientNumber: doc.patient_number,
    name: doc.name,
    bed: doc.bed,
    clinicalSummary: doc.clinical_summary,
    intervalEvents: doc.interval_events,
    imaging: doc.imaging,
    labs: doc.labs,
    systems: {
      neuro: doc.systems_neuro,
      cv: doc.systems_cv,
      resp: doc.systems_resp,
      renalGU: doc.systems_renal_gu,
      gi: doc.systems_gi,
      endo: doc.systems_endo,
      heme: doc.systems_heme,
      infectious: doc.systems_infectious,
      skinLines: doc.systems_skin_lines,
      dispo: doc.systems_dispo,
    },
    medications: {
      infusions: JSON.parse(doc.medications_infusions || '[]'),
      scheduled: JSON.parse(doc.medications_scheduled || '[]'),
      prn: JSON.parse(doc.medications_prn || '[]'),
      rawText: doc.medications_raw_text,
    },
    fieldTimestamps: JSON.parse(doc.field_timestamps || '{}'),
    collapsed: doc.collapsed,
    createdAt: doc.created_at,
    lastModified: doc._modified ? new Date(doc._modified).toISOString() : undefined,
  };
}
