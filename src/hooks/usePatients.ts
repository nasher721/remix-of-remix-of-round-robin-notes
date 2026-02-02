import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useNotifications } from "./use-notifications";
import type { Patient, PatientSystems, PatientMedications, FieldTimestamps } from "@/types/patient";
import { parseSystemsJson, parseFieldTimestampsJson, parseMedicationsJson, prepareUpdateData } from "@/lib/mappers/patientMapper";
import type { Json } from "@/integrations/supabase/types";

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
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [patientCounter, setPatientCounter] = React.useState(1);
  const { user } = useAuth();
  const notifications = useNotifications();
  
  // Ref to track latest patients for use in callbacks without stale closures
  const patientsRef = React.useRef<Patient[]>([]);
  React.useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);

  // Fetch patients from database
  const fetchPatients = React.useCallback(async () => {
    if (!user) {
      setPatients([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("patient_number", { ascending: true });

      if (error) throw error;

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
      notifications.error({
        title: "Error",
        description: "Failed to load patients.",
      });
    } finally {
      setLoading(false);
    }
  }, [user, notifications]);

  React.useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const addPatient = React.useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("patients")
        .insert([{
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
        }])
        .select()
        .single();

      if (error) throw error;

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

      notifications.success({
        title: "Patient Added",
        description: "New patient card created.",
      });
    } catch (error) {
      console.error("Error adding patient:", error);
      notifications.error({
        title: "Error",
        description: "Failed to add patient.",
      });
    }
  }, [user, patientCounter, notifications]);

  const updatePatient = React.useCallback(async (id: string, field: string, value: unknown) => {
    if (!user) return;

    const now = new Date().toISOString();

    // Fields that should track timestamps (content fields only)
    const trackableFields = ['clinicalSummary', 'intervalEvents', 'imaging', 'labs', 'medications'];
    const isSystemField = field.startsWith('systems.');
    const isMedicationsField = field === 'medications';
    const shouldTrackTimestamp = trackableFields.includes(field) || isSystemField;

    // Get old value for history tracking - use ref to avoid stale closure
    const patient = patientsRef.current.find((p) => p.id === id);
    let oldValue: string | null = null;

    if (shouldTrackTimestamp && patient && !isMedicationsField) {
      if (isSystemField) {
        const systemKey = field.split('.')[1] as keyof PatientSystems;
        oldValue = patient.systems[systemKey] || null;
      } else {
        oldValue = (patient[field as keyof typeof patient] as string) || null;
      }
    }

    // Optimistic update - using functional update to avoid stale state
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

    // Prepare update object - use ref for current patient data
    const currentPatient = patientsRef.current.find((p) => p.id === id);
    const updateData = prepareUpdateData(field, value, currentPatient?.systems, currentPatient?.medications);

    // Add field timestamp update if trackable
    if (shouldTrackTimestamp && currentPatient) {
      updateData.field_timestamps = {
        ...currentPatient.fieldTimestamps,
        [field]: now,
      };
    }

    try {
      const { error } = await supabase
        .from("patients")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      // Record history entry for trackable fields (non-blocking, ignore errors)
      if (shouldTrackTimestamp && oldValue !== (value as string)) {
        // Fire and forget - don't await, ignore all errors
        void (async () => {
          try {
            await supabase.from("patient_field_history").insert({
              patient_id: id,
              user_id: user.id,
              field_name: field,
              old_value: oldValue,
              new_value: value as string,
            });
          } catch {
            // Silently ignore history recording errors
          }
        })();
      }
    } catch (error) {
      console.error("Error updating patient:", error);
      // Revert on error
      fetchPatients();
    }
  }, [user, fetchPatients]);

  const removePatient = React.useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("patients")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPatients((prev) => prev.filter((p) => p.id !== id));

      notifications.success({
        title: "Patient Removed",
        description: "Patient has been removed.",
      });
    } catch (error) {
      console.error("Error removing patient:", error);
      notifications.error({
        title: "Error",
        description: "Failed to remove patient.",
      });
    }
  }, [user, notifications]);

  const duplicatePatient = React.useCallback(async (id: string) => {
    if (!user) return;

    const patient = patientsRef.current.find((p) => p.id === id);
    if (!patient) return;

    try {
      const { data, error } = await supabase
        .from("patients")
        .insert([{
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
        }])
        .select()
        .single();

      if (error) throw error;

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

      notifications.success({
        title: "Patient Duplicated",
        description: "Patient card has been duplicated.",
      });
    } catch (error) {
      console.error("Error duplicating patient:", error);
      notifications.error({
        title: "Error",
        description: "Failed to duplicate patient.",
      });
    }
  }, [user, patientCounter, notifications]);

  const toggleCollapse = React.useCallback(async (id: string) => {
    const patient = patientsRef.current.find((p) => p.id === id);
    if (!patient) return;

    await updatePatient(id, "collapsed", !patient.collapsed);
  }, [updatePatient]);

  const collapseAll = React.useCallback(async () => {
    const currentPatients = patientsRef.current;
    if (!user || currentPatients.length === 0) return;

    // Check if all are already collapsed
    const allCollapsed = currentPatients.every(p => p.collapsed);
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
  }, [user, fetchPatients]);

  const importPatients = React.useCallback(async (patientsToImport: Array<{
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

        const { data, error } = await supabase
          .from("patients")
          .insert([{
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
          }])
          .select()
          .single();

        if (error) throw error;

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

      notifications.success({
        title: "Import Complete",
        description: `${newPatients.length} patient(s) imported from Epic handoff.`,
      });
    } catch (error) {
      console.error("Error importing patients:", error);
      notifications.error({
        title: "Import Error",
        description: "Failed to import some patients.",
      });
      throw error;
    }
  }, [user, patientCounter, notifications]);

  // Add a patient with pre-populated data (for smart import)
  const addPatientWithData = React.useCallback(async (patientData: {
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
      const { data, error } = await supabase
        .from("patients")
        .insert([{
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
        }])
        .select()
        .single();

      if (error) throw error;

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

      notifications.success({
        title: "Patient Imported",
        description: `${patientData.name || 'New patient'} added successfully.`,
      });
    } catch (error) {
      console.error("Error adding patient with data:", error);
      notifications.error({
        title: "Error",
        description: "Failed to import patient.",
      });
      throw error;
    }
  }, [user, patientCounter, notifications]);

  const clearAll = React.useCallback(async () => {
    if (!user) return;

    try {
      // Delete all patients for the current user
      const { error } = await supabase
        .from("patients")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setPatients([]);
      setPatientCounter(1);

      notifications.success({
        title: "All Data Cleared",
        description: "All patient data has been removed.",
      });
    } catch (error) {
      console.error("Error clearing patients:", error);
      notifications.error({
        title: "Error",
        description: "Failed to clear patients.",
      });
    }
  }, [user, notifications]);

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

