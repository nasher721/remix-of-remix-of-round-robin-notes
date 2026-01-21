import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import type { Patient, PatientSystems, PatientMedications, FieldTimestamps } from "@/types/patient";
import { parseSystemsJson, parseFieldTimestampsJson, parseMedicationsJson, prepareUpdateData } from "@/lib/mappers/patientMapper";
import type { Json } from "@/integrations/supabase/types";
import { withRetry } from "@/lib/fetchWithRetry";

const UNKNOWN_COLUMN_CODES = new Set(["42703", "PGRST204"]);
const MISSING_COLUMN_PATTERNS = [
  /column \"?([^\"]+)\"? does not exist/i,
  /Could not find the '([^']+)' column/i,
];

const extractMissingColumn = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const { code, message } = error as { code?: string; message?: string };
  if (!message || (code && !UNKNOWN_COLUMN_CODES.has(code))) {
    return null;
  }

  for (const pattern of MISSING_COLUMN_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const stripMissingColumn = (
  payload: Record<string, unknown>,
  error: unknown
): Record<string, unknown> | null => {
  const missingColumn = extractMissingColumn(error);
  if (!missingColumn || !(missingColumn in payload)) {
    return null;
  }

  const nextPayload = { ...payload };
  delete nextPayload[missingColumn];
  return nextPayload;
};

const defaultSystemsValue: PatientSystems = {
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

const defaultMedicationsValue: PatientMedications = {
  infusions: [],
  scheduled: [],
  prn: [],
  rawText: "",
};

export type { Patient, PatientSystems, PatientMedications };

export const usePatients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientCounter, setPatientCounter] = useState(1);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch patients from database with retry logic
  const fetchPatients = useCallback(async () => {
    if (!user) {
      setPatients([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await withRetry(async () => {
        const result = await supabase
          .from("patients")
          .select("*")
          .order("patient_number", { ascending: true });
        
        if (result.error) throw result.error;
        return result;
      }, { maxRetries: 3, baseDelay: 1000 });

      const formattedPatients: Patient[] = (data || []).map((p) => ({
        id: p.id,
        patientNumber: p.patient_number,
        name: p.name,
        bed: p.bed,
        clinicalSummary: p.clinical_summary,
        intervalEvents: p.interval_events,
        imaging: p.imaging || '',
        labs: p.labs || '',
        systems: parseSystemsJson(p.systems),
        medications: parseMedicationsJson(p.medications),
        fieldTimestamps: parseFieldTimestampsJson(p.field_timestamps),
        collapsed: p.collapsed,
        createdAt: p.created_at,
        lastModified: p.last_modified,
      }));

      setPatients(formattedPatients);
      
      // Set counter to max patient_number + 1
      const maxNumber = formattedPatients.reduce((max, p) => Math.max(max, p.patientNumber), 0);
      setPatientCounter(maxNumber + 1);
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast({
        title: "Error",
        description: "Failed to load patients. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const insertPatientRow = useCallback(async (payload: {
    user_id: string;
    patient_number: number;
    name: string;
    bed: string;
    clinical_summary: string;
    interval_events: string;
    imaging: string;
    labs: string;
    systems: Json;
    medications: Json;
    collapsed: boolean;
  }) => {
    let attemptPayload: Record<string, unknown> = { ...payload };
    let lastError: unknown;

    // Wrap the entire insert logic with retry for network failures
    return await withRetry(async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data, error } = await supabase
          .from("patients")
          .insert([attemptPayload as typeof payload])
          .select()
          .single();

        if (!error) {
          return data;
        }

        lastError = error;
        const nextPayload = stripMissingColumn(attemptPayload, error);
        if (!nextPayload) {
          throw error;
        }

        attemptPayload = nextPayload;
      }

      throw lastError;
    }, { maxRetries: 3, baseDelay: 1000 });
  }, []);

  const updatePatientRow = useCallback(async (id: string, payload: Record<string, unknown>) => {
    let attemptPayload = { ...payload };
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (Object.keys(attemptPayload).length === 0) {
        return;
      }

      const { error } = await supabase
        .from("patients")
        .update(attemptPayload)
        .eq("id", id);

      if (!error) {
        return;
      }

      lastError = error;
      const nextPayload = stripMissingColumn(attemptPayload, error);
      if (!nextPayload) {
        throw error;
      }

      attemptPayload = nextPayload;
    }

    throw lastError;
  }, []);

  const addPatient = useCallback(async () => {
    if (!user) return;

    try {
      const data = await insertPatientRow({
        user_id: user.id,
        patient_number: patientCounter,
        name: "",
        bed: "",
        clinical_summary: "",
        interval_events: "",
        imaging: "",
        labs: "",
        systems: defaultSystemsValue as unknown as Json,
        medications: defaultMedicationsValue as unknown as Json,
        collapsed: false,
      });

      const newPatient: Patient = {
        id: data.id,
        patientNumber: data.patient_number,
        name: data.name,
        bed: data.bed,
        clinicalSummary: data.clinical_summary,
        intervalEvents: data.interval_events,
        imaging: data.imaging || '',
        labs: data.labs || '',
        systems: parseSystemsJson(data.systems),
        medications: parseMedicationsJson(data.medications),
        fieldTimestamps: parseFieldTimestampsJson(data.field_timestamps),
        collapsed: data.collapsed,
        createdAt: data.created_at,
        lastModified: data.last_modified,
      };

      setPatients((prev) => [...prev, newPatient]);
      setPatientCounter((prev) => prev + 1);
      
      toast({
        title: "Patient Added",
        description: "New patient card created.",
      });
    } catch (error) {
      console.error("Error adding patient:", error);
      toast({
        title: "Error",
        description: "Failed to add patient.",
        variant: "destructive",
      });
    }
  }, [user, patientCounter, toast, insertPatientRow]);

  const updatePatient = useCallback(async (id: string, field: string, value: unknown) => {
    if (!user) return;

    const now = new Date().toISOString();
    
    // Fields that should track timestamps (content fields only)
    const trackableFields = ['clinicalSummary', 'intervalEvents', 'imaging', 'labs', 'medications'];
    const isSystemField = field.startsWith('systems.');
    const isMedicationsField = field === 'medications';
    const shouldTrackTimestamp = trackableFields.includes(field) || isSystemField;

    // Get old value for history tracking
    const patient = patients.find((p) => p.id === id);
    let oldValue: string | null = null;
    
    if (shouldTrackTimestamp && patient && !isMedicationsField) {
      if (isSystemField) {
        const systemKey = field.split('.')[1] as keyof PatientSystems;
        oldValue = patient.systems[systemKey] || null;
      } else {
        oldValue = (patient[field as keyof typeof patient] as string) || null;
      }
    }

    // Optimistic update
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, lastModified: now };
          
          // Update field timestamps if this is a trackable field
          if (shouldTrackTimestamp) {
            updated.fieldTimestamps = {
              ...p.fieldTimestamps,
              [field]: now,
            };
          }
          
          if (field.includes(".")) {
            const [parent, child] = field.split(".");
            if (parent === "systems") {
              updated.systems = { ...p.systems, [child]: value };
            } else if (parent === "medications") {
              updated.medications = { ...p.medications, [child]: value };
            }
          } else if (field === "medications") {
            updated.medications = value as PatientMedications;
          } else {
            (updated as Record<string, unknown>)[field] = value;
          }
          return updated;
        }
        return p;
      })
    );

    // Prepare update object
    const updateData = prepareUpdateData(field, value, patient?.systems, patient?.medications);
    
    // Add field timestamp update if trackable
    if (shouldTrackTimestamp && patient) {
      updateData.field_timestamps = {
        ...patient.fieldTimestamps,
        [field]: now,
      };
    }

    try {
      await updatePatientRow(id, updateData);

      // Record history entry for trackable fields (non-blocking)
      if (shouldTrackTimestamp && oldValue !== (value as string)) {
        supabase.from("patient_field_history").insert({
          patient_id: id,
          user_id: user.id,
          field_name: field,
          old_value: oldValue,
          new_value: value as string,
        }).then(({ error: historyError }) => {
          if (historyError) {
            console.error("Error recording field history:", historyError);
          }
        });
      }
    } catch (error) {
      console.error("Error updating patient:", error);
      // Revert on error
      fetchPatients();
    }
  }, [user, patients, fetchPatients, updatePatientRow]);

  const removePatient = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("patients")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPatients((prev) => prev.filter((p) => p.id !== id));
      
      toast({
        title: "Patient Removed",
        description: "Patient has been removed.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error removing patient:", error);
      toast({
        title: "Error",
        description: "Failed to remove patient.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  const duplicatePatient = useCallback(async (id: string) => {
    if (!user) return;

    const patient = patients.find((p) => p.id === id);
    if (!patient) return;

    try {
      const data = await insertPatientRow({
        user_id: user.id,
        patient_number: patientCounter,
        name: patient.name + " (Copy)",
        bed: patient.bed,
        clinical_summary: patient.clinicalSummary,
        interval_events: patient.intervalEvents,
        imaging: patient.imaging,
        labs: patient.labs,
        systems: patient.systems as unknown as Json,
        medications: patient.medications as unknown as Json,
        collapsed: false,
      });

      const newPatient: Patient = {
        id: data.id,
        patientNumber: data.patient_number,
        name: data.name,
        bed: data.bed,
        clinicalSummary: data.clinical_summary,
        intervalEvents: data.interval_events,
        imaging: data.imaging || '',
        labs: data.labs || '',
        systems: parseSystemsJson(data.systems),
        medications: parseMedicationsJson(data.medications),
        fieldTimestamps: parseFieldTimestampsJson(data.field_timestamps),
        collapsed: data.collapsed,
        createdAt: data.created_at,
        lastModified: data.last_modified,
      };

      setPatients((prev) => [...prev, newPatient]);
      setPatientCounter((prev) => prev + 1);
      
      toast({
        title: "Patient Duplicated",
        description: "Patient card has been duplicated.",
      });
    } catch (error) {
      console.error("Error duplicating patient:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate patient.",
        variant: "destructive",
      });
    }
  }, [user, patients, patientCounter, toast, insertPatientRow]);

  const toggleCollapse = useCallback(async (id: string) => {
    const patient = patients.find((p) => p.id === id);
    if (!patient) return;

    await updatePatient(id, "collapsed", !patient.collapsed);
  }, [patients, updatePatient]);

  const collapseAll = useCallback(async () => {
    if (!user || patients.length === 0) return;

    // Check if all are already collapsed
    const allCollapsed = patients.every(p => p.collapsed);
    const newCollapseState = !allCollapsed;

    // Optimistic update
    setPatients(prev => prev.map(p => ({ ...p, collapsed: newCollapseState })));

    try {
      const { error } = await supabase
        .from("patients")
        .update({ collapsed: newCollapseState })
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error collapsing all patients:", error);
      fetchPatients(); // Revert on error
    }
  }, [user, patients, fetchPatients]);

  const importPatients = useCallback(async (patientsToImport: Array<{
    name: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    systems?: PatientSystems;
    medications?: PatientMedications;
  }>) => {
    if (!user) return;

    try {
      let currentCounter = patientCounter;
      const newPatients: Patient[] = [];

      for (const p of patientsToImport) {
        const systemsToInsert = p.systems || defaultSystemsValue;
        const medicationsToInsert = p.medications || defaultMedicationsValue;
        
        const data = await insertPatientRow({
          user_id: user.id,
          patient_number: currentCounter,
          name: p.name,
          bed: p.bed,
          clinical_summary: p.clinicalSummary,
          interval_events: p.intervalEvents || "",
          imaging: "",
          labs: "",
          systems: systemsToInsert as unknown as Json,
          medications: medicationsToInsert as unknown as Json,
          collapsed: false,
        });

        newPatients.push({
          id: data.id,
          patientNumber: data.patient_number,
          name: data.name,
          bed: data.bed,
          clinicalSummary: data.clinical_summary,
          intervalEvents: data.interval_events,
          imaging: data.imaging || '',
          labs: data.labs || '',
          systems: parseSystemsJson(data.systems),
          medications: parseMedicationsJson(data.medications),
          fieldTimestamps: parseFieldTimestampsJson(data.field_timestamps),
          collapsed: data.collapsed,
          createdAt: data.created_at,
          lastModified: data.last_modified,
        });

        currentCounter++;
      }

      setPatients((prev) => [...prev, ...newPatients]);
      setPatientCounter(currentCounter);

      toast({
        title: "Import Complete",
        description: `${newPatients.length} patient(s) imported from Epic handoff.`,
      });
    } catch (error) {
      console.error("Error importing patients:", error);
      toast({
        title: "Import Error",
        description: "Failed to import some patients.",
        variant: "destructive",
      });
      throw error;
    }
  }, [user, patientCounter, toast, insertPatientRow]);

  // Add a patient with pre-populated data (for smart import)
  const addPatientWithData = useCallback(async (patientData: {
    name: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    imaging: string;
    labs: string;
    systems: PatientSystems;
    medications?: PatientMedications;
  }) => {
    if (!user) return;

    try {
      const data = await insertPatientRow({
        user_id: user.id,
        patient_number: patientCounter,
        name: patientData.name || "",
        bed: patientData.bed || "",
        clinical_summary: patientData.clinicalSummary || "",
        interval_events: patientData.intervalEvents || "",
        imaging: patientData.imaging || "",
        labs: patientData.labs || "",
        systems: patientData.systems as unknown as Json,
        medications: (patientData.medications || defaultMedicationsValue) as unknown as Json,
        collapsed: false,
      });

      const newPatient: Patient = {
        id: data.id,
        patientNumber: data.patient_number,
        name: data.name,
        bed: data.bed,
        clinicalSummary: data.clinical_summary,
        intervalEvents: data.interval_events,
        imaging: data.imaging || '',
        labs: data.labs || '',
        systems: parseSystemsJson(data.systems),
        medications: parseMedicationsJson(data.medications),
        fieldTimestamps: parseFieldTimestampsJson(data.field_timestamps),
        collapsed: data.collapsed,
        createdAt: data.created_at,
        lastModified: data.last_modified,
      };

      setPatients((prev) => [...prev, newPatient]);
      setPatientCounter((prev) => prev + 1);
      
      toast({
        title: "Patient Imported",
        description: `${patientData.name || 'New patient'} added successfully.`,
      });
    } catch (error) {
      console.error("Error adding patient with data:", error);
      toast({
        title: "Error",
        description: "Failed to import patient.",
        variant: "destructive",
      });
      throw error;
    }
  }, [user, patientCounter, toast, insertPatientRow]);

  const clearAll = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("patients")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;

      setPatients([]);
      setPatientCounter(1);
      
      toast({
        title: "All Data Cleared",
        description: "All patient data has been removed.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error clearing patients:", error);
      toast({
        title: "Error",
        description: "Failed to clear patients.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  return {
    patients,
    loading,
    addPatient,
    addPatientWithData,
    updatePatient,
    removePatient,
    duplicatePatient,
    toggleCollapse,
    collapseAll,
    clearAll,
    importPatients,
    refetch: fetchPatients,
  };
};
