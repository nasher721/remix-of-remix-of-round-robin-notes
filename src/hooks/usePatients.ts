import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import type { Patient, PatientSystems, defaultSystems } from "@/types/patient";
import { parseSystemsJson, dbToUiPatient, prepareUpdateData } from "@/lib/mappers/patientMapper";
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

export type { Patient, PatientSystems };

export const usePatients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientCounter, setPatientCounter] = useState(1);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch patients from database
  const fetchPatients = useCallback(async () => {
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
        description: "Failed to load patients.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const addPatient = useCallback(async () => {
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
  }, [user, patientCounter, toast]);

  const updatePatient = useCallback(async (id: string, field: string, value: unknown) => {
    if (!user) return;

    // Optimistic update
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, lastModified: new Date().toISOString() };
          if (field.includes(".")) {
            const [parent, child] = field.split(".");
            if (parent === "systems") {
              updated.systems = { ...p.systems, [child]: value };
            }
          } else {
            (updated as Record<string, unknown>)[field] = value;
          }
          return updated;
        }
        return p;
      })
    );

    // Prepare update object
    const patient = patients.find((p) => p.id === id);
    const updateData = prepareUpdateData(field, value, patient?.systems);

    try {
      const { error } = await supabase
        .from("patients")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating patient:", error);
      // Revert on error
      fetchPatients();
    }
  }, [user, patients, fetchPatients]);

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
  }, [user, patients, patientCounter, toast]);

  const toggleCollapse = useCallback(async (id: string) => {
    const patient = patients.find((p) => p.id === id);
    if (!patient) return;

    await updatePatient(id, "collapsed", !patient.collapsed);
  }, [patients, updatePatient]);

  const importPatients = useCallback(async (patientsToImport: Array<{
    name: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    systems?: PatientSystems;
  }>) => {
    if (!user) return;

    try {
      let currentCounter = patientCounter;
      const newPatients: Patient[] = [];

      for (const p of patientsToImport) {
        const systemsToInsert = p.systems || defaultSystemsValue;
        
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
  }, [user, patientCounter, toast]);

  // Add a patient with pre-populated data (for smart import)
  const addPatientWithData = useCallback(async (patientData: {
    name: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    imaging: string;
    labs: string;
    systems: PatientSystems;
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
  }, [user, patientCounter, toast]);

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
    clearAll,
    importPatients,
    refetch: fetchPatients,
  };
};
