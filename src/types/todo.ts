import type { SystemKey } from "@/lib/clinicalSections";
export interface PatientTodo {
  id: string;
  patientId: string;
  userId: string;
  section: string | null; // null = patient-wide
  content: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  /** Durable local mutation state. Undefined means the server row is current. */
  syncStatus?: 'queued' | 'sync_failed' | 'conflict';
  /** Distinguishes a client-created row from an overlaid update to a server row. */
  localOnly?: boolean;
}

export type TodoSection = SystemKey | "all" | "clinical_summary" | "interval_events" | "imaging" | "labs";
