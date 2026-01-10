import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import type { Json } from "@/integrations/supabase/types";

export interface PatientSystems {
  neuro: string;
  cv: string;
  resp: string;
  renalGU: string;
  gi: string;
  endo: string;
  heme: string;
  infectious: string;
  skinLines: string;
  dispo: string;
}

export interface Patient {
  id: string;
  patient_number: number;
  name: string;
  bed: string;
  clinical_summary: string;
  interval_events: string;
  systems: PatientSystems;
  collapsed: boolean;
  created_at: string;
  last_modified: string;
}

const defaultSystems: PatientSystems = {
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

const parseSystemsJson = (systems: Json | null): PatientSystems => {
  if (!systems || typeof systems !== 'object' || Array.isArray(systems)) {
    return defaultSystems;
  }
  const s = systems as Record<string, unknown>;
  return {
    neuro: String(s.neuro || ''),
    cv: String(s.cv || ''),
    resp: String(s.resp || ''),
    renalGU: String(s.renalGU || ''),
    gi: String(s.gi || ''),
    endo: String(s.endo || ''),
    heme: String(s.heme || ''),
    infectious: String(s.infectious || ''),
    skinLines: String(s.skinLines || ''),
    dispo: String(s.dispo || ''),
  };
};

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
        patient_number: p.patient_number,
        name: p.name,
        bed: p.bed,
        clinical_summary: p.clinical_summary,
        interval_events: p.interval_events,
        systems: parseSystemsJson(p.systems),
        collapsed: p.collapsed,
        created_at: p.created_at,
        last_modified: p.last_modified,
      }));

      setPatients(formattedPatients);
      
      // Set counter to max patient_number + 1
      const maxNumber = formattedPatients.reduce((max, p) => Math.max(max, p.patient_number), 0);
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
          systems: defaultSystems as unknown as Json,
          collapsed: false,
        }])
        .select()
        .single();

      if (error) throw error;

      const newPatient: Patient = {
        id: data.id,
        patient_number: data.patient_number,
        name: data.name,
        bed: data.bed,
        clinical_summary: data.clinical_summary,
        interval_events: data.interval_events,
        systems: parseSystemsJson(data.systems),
        collapsed: data.collapsed,
        created_at: data.created_at,
        last_modified: data.last_modified,
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
          const updated = { ...p, last_modified: new Date().toISOString() };
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
    const updateData: Record<string, unknown> = {};
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      if (parent === "systems") {
        const patient = patients.find((p) => p.id === id);
        if (patient) {
          updateData.systems = { ...patient.systems, [child]: value };
        }
      }
    } else {
      // Map field names to database column names
      const fieldMap: Record<string, string> = {
        clinicalSummary: "clinical_summary",
        intervalEvents: "interval_events",
        clinical_summary: "clinical_summary",
        interval_events: "interval_events",
      };
      updateData[fieldMap[field] || field] = value;
    }

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
          clinical_summary: patient.clinical_summary,
          interval_events: patient.interval_events,
          systems: patient.systems as unknown as Json,
          collapsed: false,
        }])
        .select()
        .single();

      if (error) throw error;

      const newPatient: Patient = {
        id: data.id,
        patient_number: data.patient_number,
        name: data.name,
        bed: data.bed,
        clinical_summary: data.clinical_summary,
        interval_events: data.interval_events,
        systems: parseSystemsJson(data.systems),
        collapsed: data.collapsed,
        created_at: data.created_at,
        last_modified: data.last_modified,
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
  }>) => {
    if (!user) return;

    try {
      let currentCounter = patientCounter;
      const newPatients: Patient[] = [];

      for (const p of patientsToImport) {
        const { data, error } = await supabase
          .from("patients")
          .insert([{
            user_id: user.id,
            patient_number: currentCounter,
            name: p.name,
            bed: p.bed,
            clinical_summary: p.clinicalSummary,
            interval_events: "",
            systems: defaultSystems as unknown as Json,
            collapsed: false,
          }])
          .select()
          .single();

        if (error) throw error;

        newPatients.push({
          id: data.id,
          patient_number: data.patient_number,
          name: data.name,
          bed: data.bed,
          clinical_summary: data.clinical_summary,
          interval_events: data.interval_events,
          systems: parseSystemsJson(data.systems),
          collapsed: data.collapsed,
          created_at: data.created_at,
          last_modified: data.last_modified,
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
    updatePatient,
    removePatient,
    duplicatePatient,
    toggleCollapse,
    clearAll,
    importPatients,
    refetch: fetchPatients,
  };
};
