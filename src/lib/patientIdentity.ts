import type { Patient } from "@/types/patient";

export function patientSecondaryIdentifier(patient: Patient): string {
  if (patient.mrn?.trim()) return `MRN …${patient.mrn.trim().slice(-4)}`;
  if (patient.bed?.trim()) return `Bed ${patient.bed.trim()}`;
  return `Record …${patient.id.slice(-4)}`;
}

export function patientSafetyLabel(patient: Patient): string {
  return `${patient.name?.trim() || "Unnamed patient"} · ${patientSecondaryIdentifier(patient)}`;
}

export function patientExportIdentifierLine(patient: Patient): string {
  const identifiers: string[] = [];
  if (patient.bed?.trim()) identifiers.push(`Bed ${patient.bed.trim()}`);
  if (patient.mrn?.trim()) identifiers.push(`MRN …${patient.mrn.trim().slice(-4)}`);
  if (identifiers.length === 0) identifiers.push(`Record …${patient.id.slice(-4)}`);
  return identifiers.join(" · ");
}
