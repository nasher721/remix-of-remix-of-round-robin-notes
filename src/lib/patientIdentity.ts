import type { Patient } from "@/types/patient";

export const NOT_DOCUMENTED = "Not documented";

const TEMPLATE_TOKEN = /^\s*\[[^\]]+\]\s*$/;

/** Return a display-safe value for a patient identity field. */
export const normalizePatientIdentityValue = (
  value: unknown,
  fallback = NOT_DOCUMENTED,
): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return !normalized || TEMPLATE_TOKEN.test(normalized) ? fallback : normalized;
};

export const patientSecondaryIdentifier = (patient: Patient): string => {
  const mrn = normalizePatientIdentityValue(patient.mrn, "");
  if (mrn) return `MRN …${mrn.slice(-4)}`;
  const bed = normalizePatientIdentityValue(patient.bed, "");
  if (bed) return `Bed ${bed}`;
  return `Record …${patient.id.slice(-4)}`;
};

export const patientSafetyLabel = (patient: Patient): string =>
  `${normalizePatientIdentityValue(patient.name, "Unnamed patient")} · ${patientSecondaryIdentifier(patient)}`;

export const patientExportIdentifierLine = (patient: Patient): string => {
  const identifiers: string[] = [];
  const bed = normalizePatientIdentityValue(patient.bed, "");
  const mrn = normalizePatientIdentityValue(patient.mrn, "");
  if (bed) identifiers.push(`Bed ${bed}`);
  if (mrn) identifiers.push(`MRN …${mrn.slice(-4)}`);
  return identifiers.length > 0 ? identifiers.join(" · ") : `Record …${patient.id.slice(-4)}`;
};

export const normalizePatientAlerts = (alerts: Patient["alerts"]): string[] => {
  const seen = new Set<string>();
  return (alerts ?? [])
    .map((alert) => normalizePatientIdentityValue(alert, ""))
    .filter((alert): alert is string => Boolean(alert))
    .filter((alert) => {
      const key = alert.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

};

const formatAllergies = (alerts: Patient["alerts"]): string => {
  const allergies = normalizePatientAlerts(alerts);
  return allergies.length > 0 ? allergies.join(", ") : NOT_DOCUMENTED;
};

const CODE_STATUS_LABELS: Record<string, string> = {
  full: "Full code",
  dnr: "DNR",
  dni: "DNI",
  comfort: "Comfort-focused",
};

export interface PatientIdentity {
  name: string;
  mrn: string;
  room: string;
  dob: string;
  allergies: string;
  codeStatus: string;
  attending: string;
  diagnosis: string;
}

/**
 * Build the explicitly available identity fields. Patient has no DOB or
 * diagnosis field, so those remain Not documented rather than inferred.
 */
export const getPatientIdentity = (patient: Patient): PatientIdentity => ({
  name: normalizePatientIdentityValue(patient.name),
  mrn: normalizePatientIdentityValue(patient.mrn),
  room: normalizePatientIdentityValue(patient.bed),
  dob: NOT_DOCUMENTED,
  allergies: formatAllergies(patient.alerts),
  codeStatus: CODE_STATUS_LABELS[patient.codeStatus ?? ""] ?? normalizePatientIdentityValue(patient.codeStatus),
  attending: normalizePatientIdentityValue(patient.attendingPhysician),
  diagnosis: NOT_DOCUMENTED,
});
