import type { Patient } from "@/types/patient";

export const samplePatient: Patient = {
  id: "patient-1",
  patientNumber: 3,
  name: "Alex Smith",
  bed: "ICU-2",
  clinicalSummary: "Stable",
  intervalEvents: "No acute events",
  imaging: "",
  labs: "",
  systems: {
    neuro: "Alert",
    cv: "Sinus",
    resp: "Room air",
    renalGU: "Normal",
    gi: "Tolerating diet",
    endo: "Glucose controlled",
    heme: "No bleeding",
    infectious: "Afebrile",
    skinLines: "PICC",
    dispo: "Continue ICU",
  },
  medications: {
    infusions: ["Propofol"],
    scheduled: ["Heparin"],
    prn: ["Ondansetron"],
    rawText: "",
  },
  fieldTimestamps: {
    clinicalSummary: "2024-01-01T00:00:00Z",
  },
  collapsed: false,
  createdAt: "2024-01-01T00:00:00Z",
  lastModified: "2024-01-02T00:00:00Z",
};

export const sampleDbRecord = {
  id: "patient-1",
  patient_number: 3,
  name: "Alex Smith",
  bed: "ICU-2",
  clinical_summary: "Stable",
  interval_events: "No acute events",
  imaging: null,
  labs: null,
  systems: {
    neuro: "Alert",
    cv: "Sinus",
  },
  medications: {
    infusions: ["Propofol"],
    scheduled: ["Heparin"],
    prn: ["Ondansetron"],
    rawText: "",
  },
  field_timestamps: {
    clinicalSummary: "2024-01-01T00:00:00Z",
  },
  collapsed: false,
  created_at: "2024-01-01T00:00:00Z",
  last_modified: "2024-01-02T00:00:00Z",
};
