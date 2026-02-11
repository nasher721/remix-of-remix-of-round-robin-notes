export interface PatientTodo {
  id: string;
  patientId: string;
  userId: string;
  section: string | null; // null = patient-wide
  content: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TodoSection = 
  | 'all' 
  | 'clinical_summary' 
  | 'interval_events' 
  | 'imaging' 
  | 'labs'
  | 'cv'
  | 'resp'
  | 'neuro'
  | 'gi'
  | 'renalGU'
  | 'heme'
  | 'infectious'
  | 'endo'
  | 'skinLines'
  | 'dispo';
