/**
 * Normalize AI/tabular parse results into chart-ready patient payloads.
 */

import type { PatientMedications, PatientSystems } from "@/types/patient";
import { defaultMedications, defaultSystems } from "@/types/patient";

export interface ParsedImportPatient {
  bed?: string;
  room?: string;
  name?: string;
  mrn?: string;
  age?: string;
  sex?: string;
  handoffSummary?: string;
  clinicalSummary?: string;
  intervalEvents?: string;
  imaging?: string;
  labs?: string;
  systems?: Partial<PatientSystems> | null;
  medications?: Partial<PatientMedications> | null;
  /** Extra labeled fragments from spreadsheets / exports */
  [extraField: string]: unknown;
}

export interface ChartReadyImportPatient {
  name: string;
  mrn: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
}

const emptySystems = (): PatientSystems => ({ ...defaultSystems });

const emptyMedications = (): PatientMedications => ({
  infusions: [...defaultMedications.infusions],
  scheduled: [...defaultMedications.scheduled],
  prn: [...defaultMedications.prn],
  rawText: defaultMedications.rawText ?? "",
});

/**
 * Decide which chart section a free-text clinical fragment belongs in.
 *
 * Trade-off: putting imaging/labs into system sections keeps the ICU note
 * problem-oriented; keeping dedicated imaging/labs fields preserves Epic-like
 * layout. Your choice here shapes every imported chart.
 *
 * Return one of:
 * - "clinicalSummary" | "intervalEvents" | "imaging" | "labs"
 * - "systems.neuro" | "systems.cv" | "systems.resp" | "systems.renalGU"
 *   | "systems.gi" | "systems.endo" | "systems.heme" | "systems.infectious"
 *   | "systems.skinLines" | "systems.dispo"
 * - "skip" to ignore the fragment
 */
export const classifyClinicalFragmentToChartSection = (
  label: string,
  _value: string,
): keyof ChartReadyImportPatient | `systems.${keyof PatientSystems}` | "skip" => {
  // TODO: map imported field labels → chart sections (5–10 lines).
  // Normalize with: label.toLowerCase().replace(/[^a-z0-9]+/g, "")
  // Suggested anchors: rounds/events → intervalEvents; pulm/vent → systems.resp;
  // access/lines → systems.skinLines; assessment/one-liner → clinicalSummary.
  void label;
  return "clinicalSummary";
};

const appendSectionText = (current: string, next: string): string => {
  const incoming = next.trim();
  if (!incoming) return current;
  if (!current.trim()) return incoming;
  if (current.includes(incoming)) return current;
  return `${current.trim()}\n${incoming}`;
};

export const formatImportedPatientDisplayName = (patient: ParsedImportPatient): string => {
  const baseName = (patient.name ?? "").trim() || "Unknown patient";
  const details = [
    patient.mrn ? `(${patient.mrn})` : "",
    patient.age ? String(patient.age).trim() : "",
    patient.sex ? String(patient.sex).trim() : "",
  ]
    .filter(Boolean)
    .join(" ");

  return details ? `${baseName} ${details}`.trim() : baseName;
};

export const organizeImportedPatient = (
  patient: ParsedImportPatient,
): ChartReadyImportPatient => {
  const systems = emptySystems();
  const medications = emptyMedications();

  if (patient.systems) {
    for (const key of Object.keys(systems) as Array<keyof PatientSystems>) {
      systems[key] = String(patient.systems[key] ?? "").trim();
    }
  }

  if (patient.medications) {
    medications.infusions = Array.isArray(patient.medications.infusions)
      ? patient.medications.infusions.map(String).filter(Boolean)
      : [];
    medications.scheduled = Array.isArray(patient.medications.scheduled)
      ? patient.medications.scheduled.map(String).filter(Boolean)
      : [];
    medications.prn = Array.isArray(patient.medications.prn)
      ? patient.medications.prn.map(String).filter(Boolean)
      : [];
    medications.rawText = String(patient.medications.rawText ?? "");
  }

  const bed = String(patient.bed || patient.room || "").trim();
  let clinicalSummary = String(patient.clinicalSummary || patient.handoffSummary || "").trim();
  let intervalEvents = String(patient.intervalEvents || "").trim();
  let imaging = String(patient.imaging || "").trim();
  let labs = String(patient.labs || "").trim();

  // Apply label classification for any leftover free-form keys on the object.
  for (const [label, value] of Object.entries(patient)) {
    if (
      label === "bed" ||
      label === "room" ||
      label === "name" ||
      label === "mrn" ||
      label === "age" ||
      label === "sex" ||
      label === "handoffSummary" ||
      label === "clinicalSummary" ||
      label === "intervalEvents" ||
      label === "imaging" ||
      label === "labs" ||
      label === "systems" ||
      label === "medications"
    ) {
      continue;
    }
    if (typeof value !== "string" || !value.trim()) continue;

    const target = classifyClinicalFragmentToChartSection(label, value);
    if (target === "skip") continue;
    if (target === "clinicalSummary") {
      clinicalSummary = appendSectionText(clinicalSummary, value);
      continue;
    }
    if (target === "intervalEvents") {
      intervalEvents = appendSectionText(intervalEvents, value);
      continue;
    }
    if (target === "imaging") {
      imaging = appendSectionText(imaging, value);
      continue;
    }
    if (target === "labs") {
      labs = appendSectionText(labs, value);
      continue;
    }
    if (target.startsWith("systems.")) {
      const systemKey = target.replace("systems.", "") as keyof PatientSystems;
      systems[systemKey] = appendSectionText(systems[systemKey], value);
    }
  }

  return {
    name: formatImportedPatientDisplayName(patient),
    mrn: String(patient.mrn ?? "").trim(),
    bed,
    clinicalSummary,
    intervalEvents,
    imaging,
    labs,
    systems,
    medications,
  };
};
