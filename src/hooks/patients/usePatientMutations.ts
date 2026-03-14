import * as React from "react";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/use-notifications";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import { prepareUpdateData } from "@/lib/mappers/patientMapper";
import {
    buildPatientInsertPayload,
    mapPatientRecord,
    shouldTrackTimestamp,
} from "@/services/patientService";

export interface PatientMutationsDeps {
    patientsRef: React.MutableRefObject<Patient[]>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    patientCounter: number;
    setPatientCounter: React.Dispatch<React.SetStateAction<number>>;
    fetchPatients: () => Promise<void>;
}

/**
 * Handles add / update / remove / duplicate / collapse / clear operations on patients.
 */
export function usePatientMutations({
    patientsRef,
    setPatients,
    patientCounter,
    setPatientCounter,
    fetchPatients,
}: PatientMutationsDeps) {
    const { user } = useAuth();
    const notifications = useNotifications();

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
            const nextNumber =
                1 +
                Math.max(0, ...patientsRef.current.map((p) => p.patientNumber ?? 0));
            const { data, error } = await supabase
                .from("patients")
                .insert([buildPatientInsertPayload({
                    userId: user.id,
                    patientNumber: nextNumber,
                })])
                .select()
                .single();

            if (error) throw error;
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            setPatients((prev) => [...prev, newPatient]);
            setPatientCounter((prev) => Math.max(prev, nextNumber));

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
    }, [user, notifications, setPatients, setPatientCounter, patientsRef]);

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
        const currentPatients = [...patientsRef.current];
        const patientIndex = currentPatients.findIndex((p) => p.id === id);

        if (patientIndex === -1) return;

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

        setPatients(currentPatients);

        const updateData = prepareUpdateData(field, value, updatedPatient.systems, updatedPatient.medications);
        updateData.last_modified = now;

        if (shouldTrack) {
            updateData.field_timestamps = updatedPatient.fieldTimestamps;
        }

        const serializeForHistory = (v: unknown): string =>
            typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);

        try {
            const { error } = await supabase
                .from("patients")
                .update(updateData)
                .eq("id", id);

            if (error) throw error;

            // Record history entry for trackable fields (non-blocking)
            if (shouldTrack) {
                const newValueStr = isMedicationsField ? serializeForHistory(value) : (value as string);
                const oldValueStr = isMedicationsField ? serializeForHistory(oldPatient.medications) : oldValue;
                if (oldValueStr !== newValueStr) {
                    void (async () => {
                        try {
                            await supabase.from("patient_field_history").insert({
                                patient_id: id,
                                user_id: user.id,
                                field_name: field,
                                old_value: oldValueStr,
                                new_value: newValueStr,
                            });
                        } catch {
                            // Silently ignore history recording errors
                        }
                    })();
                }
            }
        } catch (error) {
            console.error("Error updating patient:", error);
            fetchPatients(); // Revert on error
            notifications.error({
                title: "Update failed",
                description: "Patient changes could not be saved. Please try again.",
            });
        }
    }, [user, fetchPatients, notifications, patientsRef, setPatients]);

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
    }, [user, notifications, setPatients]);

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

        const nextNumber =
            1 +
            Math.max(0, ...patientsRef.current.map((p) => p.patientNumber ?? 0));
        try {
            const { data, error } = await supabase
                .from("patients")
                .insert([buildPatientInsertPayload({
                    userId: user.id,
                    patientNumber: nextNumber,
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
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            setPatients((prev) => [...prev, newPatient]);
            setPatientCounter((prev) => Math.max(prev, nextNumber));

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
    }, [user, notifications, patientsRef, setPatients, setPatientCounter]);

    const toggleCollapse = React.useCallback(async (id: string) => {
        const patient = patientsRef.current.find((p) => p.id === id);
        if (!patient) return;

        await updatePatient(id, "collapsed", !patient.collapsed);
    }, [updatePatient, patientsRef]);

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

        const allCollapsed = currentPatients.every(p => p.collapsed);
        const newCollapseState = !allCollapsed;

        setPatients(prev => prev.map(p => ({ ...p, collapsed: newCollapseState })));

        try {
            const { error } = await supabase
                .from("patients")
                .update({ collapsed: newCollapseState })
                .eq("user_id", user.id);

            if (error) throw error;
        } catch (error) {
            console.error("Error collapsing all patients:", error);
            fetchPatients();
        }
    }, [user, fetchPatients, notifications, patientsRef, setPatients]);

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
    }, [user, notifications, setPatients, setPatientCounter]);

    return {
        addPatient,
        updatePatient,
        removePatient,
        duplicatePatient,
        toggleCollapse,
        collapseAll,
        clearAll,
    };
}
