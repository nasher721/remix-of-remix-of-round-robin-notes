import * as React from "react";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "../useAuth";
import { useNotifications } from "../use-notifications";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import {
    buildPatientInsertPayload,
    defaultMedicationsValue,
    defaultSystemsValue,
    mapPatientRecord,
} from "@/services/patientService";

export interface PatientImportDeps {
    patientCounter: number;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    setPatientCounter: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Handles importing patients from external sources (Epic handoff, smart import).
 */
export function usePatientImport({
    patientCounter,
    setPatients,
    setPatientCounter,
}: PatientImportDeps) {
    const { user } = useAuth();
    const notifications = useNotifications();

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
    }, [user, patientCounter, notifications, setPatients, setPatientCounter]);

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
    }, [user, patientCounter, notifications, setPatients, setPatientCounter]);

    return {
        importPatients,
        addPatientWithData,
    };
}
