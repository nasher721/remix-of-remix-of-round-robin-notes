export type PatientStatus = "stable" | "watch" | "critical";

export interface CommandCenterPatient {
  id: string;
  name: string;
  room: string;
  status: PatientStatus;
  ventilation: string;
  neuroSummary: string;
  activeProblems: string[];
  labs: {
    name: string;
    value: string;
    trend: "up" | "down" | "flat";
  }[];
  vitals: {
    label: string;
    value: string;
    trend: "up" | "down" | "flat";
  }[];
  imagingSummary: string;
  ordersDue: string[];
  nursingAlerts: string[];
  sparkline: number[];
}
