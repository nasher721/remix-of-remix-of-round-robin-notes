import * as React from "react";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useNotifications } from "./use-notifications";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import { prepareUpdateData } from "@/lib/mappers/patientMapper";
import { logMetric } from "@/lib/observability/logger";
import {
  buildPatientInsertPayload,
  defaultMedicationsValue,
  defaultSystemsValue,
  getNextPatientCounter,
  mapPatientRecord,
  shouldTrackTimestamp,
} from "@/services/patientService";

export type { Patient, PatientSystems, PatientMedications };

export const usePatients = () => {
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [patientCounter, setPatientCounter] = React.useState(1);
  const { user } = useAuth();
  const notifications = useNotifications();
  const fetchIdRef = React.useRef(0);

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

    if (!hasSupabaseConfig) {
      setPatients([]);
      setLoading(false);
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

    const currentFetchId = fetchIdRef.current + 1;
    fetchIdRef.current = currentFetchId;

    const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("patient_number", { ascending: true });

      if (error) throw error;

      if (fetchIdRef.current !== currentFetchId) {
        return;
      }

      const formattedPatients: Patient[] = (data || []).map(mapPatientRecord);

      setPatients(formattedPatients);

      // Set counter to max patient_number + 1
      setPatientCounter(getNextPatientCounter(formattedPatients));

      const durationMs = Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime
      );
      logMetric("patients.fetch.duration_ms", durationMs, "ms", {
        userId: user.id,
        resultCount: formattedPatients.length,
      });
    } catch (error) {
      console.error("Error fetching patients:", error);
      logMetric("patients.fetch.error", 1, "count", { userId: user.id });
      notifications.error({
        title: "Error",
        description: "Failed to load patients.",
      });
    } finally {
      if (fetchIdRef.current === currentFetchId) {
        setLoading(false);
      }
    }
  }, [user, notifications]);

  React.useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const addPatient = React.useCallback(async () => {
    if (!user) return;
    if (!hasSupabaseConfig) {
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("patients")
        .insert([buildPatientInsertPayload({
          userId: user.id,
          patientNumber: patientCounter,
        })])
        .select()
        .single();

      if (error) throw error;

      const newPatient = mapPatientRecord(data);

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
    if (!hasSupabaseConfig) {
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

    const now = new Date().toISOString();

    const isSystemField = field.startsWith('systems.');
    const isMedicationsField = field === 'medications';
    const shouldTrack = shouldTrackTimestamp(field);

    // Get current state from ref to ensure sequential updates see each other
    // We clone the array to avoid mutating the previous state reference directly
    const currentPatients = [...patientsRef.current];
    const patientIndex = currentPatients.findIndex((p) => p.id === id);

    if (patientIndex === -1) return;

    // Clone the patient to avoid mutation
    const oldPatient = currentPatients[patientIndex];
    const updatedPatient = { ...oldPatient };

    let oldValue: string | null = null;
    if (shouldTrack && !isMedicationsField) {
      if (isSystemField) {
        const systemKey = field.split('.')[1] as keyof PatientSystems;
        oldValue = updatedPatient.systems[systemKey] || null;
      } else {
        oldValue = (updatedPatient[field as keyof typeof updatedPatient] as string) || null;
      }
    }

    // Apply updates to the cloned patient object
    updatedPatient.lastModified = now;

    if (shouldTrack) {
      updatedPatient.fieldTimestamps = {
        ...updatedPatient.fieldTimestamps,
        [field]: now,
      };
    }

    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      if (parent === "systems") {
        updatedPatient.systems = { ...updatedPatient.systems, [child]: value };
      } else if (parent === "medications") {
        updatedPatient.medications = { ...updatedPatient.medications, [child]: value };
      }
    } else if (field === "medications") {
      updatedPatient.medications = value as PatientMedications;
    } else {
      (updatedPatient as Record<string, unknown>)[field] = value;
    }

    // Synchronously update the ref so next call sees this change immediately
    currentPatients[patientIndex] = updatedPatient;
    patientsRef.current = currentPatients;

    // Update React state
    setPatients(currentPatients);

    // Prepare update object using the FULLY UPDATED patient object
    // This ensures we don't send stale partial data to Supabase
    const updateData = prepareUpdateData(field, value, updatedPatient.systems, updatedPatient.medications);

    if (shouldTrack) {
      updateData.field_timestamps = updatedPatient.fieldTimestamps;
    }

    try {
      const { error } = await supabase
        .from("patients")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      // Record history entry for trackable fields (non-blocking, ignore errors)
      if (shouldTrack && oldValue !== (value as string)) {
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
      // Revert on error by fetching fresh data
      fetchPatients();
    }
  }, [user, fetchPatients]);

  const removePatient = React.useCallback(async (id: string) => {
    if (!user) return;
    if (!hasSupabaseConfig) {
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

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
    if (!hasSupabaseConfig) {
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

    const patient = patientsRef.current.find((p) => p.id === id);
    if (!patient) return;

    try {
      const { data, error } = await supabase
        .from("patients")
        .insert([buildPatientInsertPayload({
          userId: user.id,
          patientNumber: patientCounter,
          name: `${patient.name} (Copy)`,
          bed: patient.bed,
          clinicalSummary: patient.clinicalSummary,
          intervalEvents: patient.intervalEvents,
          imaging: patient.imaging,
          labs: patient.labs,
          systems: patient.systems,
          medications: patient.medications,
        })])
        .select()
        .single();

      if (error) throw error;

      const newPatient = mapPatientRecord(data);

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
    if (!hasSupabaseConfig) {
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

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
    if (!hasSupabaseConfig) {
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

    try {
      let currentCounter = patientCounter;
      const newPatients: Patient[] = [];

      for (const p of patientsToImport) {
        const { data, error } = await supabase
          .from("patients")
          .insert([buildPatientInsertPayload({
            userId: user.id,
            patientNumber: currentCounter,
            name: p.name,
            bed: p.bed,
            clinicalSummary: p.clinicalSummary,
            intervalEvents: p.intervalEvents || "",
            systems: p.systems ?? defaultSystemsValue,
            medications: p.medications ?? defaultMedicationsValue,
          })])
          .select()
          .single();

        if (error) throw error;

        newPatients.push(mapPatientRecord(data));

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
    if (!hasSupabaseConfig) {
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("patients")
        .insert([buildPatientInsertPayload({
          userId: user.id,
          patientNumber: patientCounter,
          name: patientData.name || "",
          bed: patientData.bed || "",
          clinicalSummary: patientData.clinicalSummary || "",
          intervalEvents: patientData.intervalEvents || "",
          imaging: patientData.imaging || "",
          labs: patientData.labs || "",
          systems: patientData.systems,
          medications: patientData.medications || defaultMedicationsValue,
        })])
        .select()
        .single();

      if (error) throw error;

      const newPatient = mapPatientRecord(data);

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
    if (!hasSupabaseConfig) {
      notifications.error({
        title: "Configuration Error",
        description: "Supabase is not configured. Please check environment variables.",
      });
      return;
    }

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
