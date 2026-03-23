import * as React from "react";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/use-notifications";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import {
    buildPatientInsertPayload,
    defaultSystemsValue,
    getNextPatientCounter,
    mapPatientRecord,
} from "@/services/patientService";
import { parseMedicationsJson, parseSystemsJson } from "@/lib/mappers/patientMapper";
import type { Json } from "@/integrations/supabase/types";

export interface PatientImportDeps {
    patientsRef: React.MutableRefObject<Patient[]>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
}

/**
 * Handles importing patients from external sources (Epic handoff, smart import).
 */
export function usePatientImport({
    patientsRef,
    setPatients,
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
            let currentCounter = getNextPatientCounter(patientsRef.current);
            const newPatients: Patient[] = [];

            for (const p of patientsToImport) {
                const systems = parseSystemsJson({
                    ...defaultSystemsValue,
                    ...(p.systems ?? {}),
                } as unknown as Json);
                const medications = parseMedicationsJson(
                    (p.medications ?? null) as unknown as Json,
                );
                const { data, error } = await supabase
                    .from("patients")
                    .insert([buildPatientInsertPayload({
                        userId: user.id,
                        patientNumber: currentCounter,
                        name: p.name,
                        bed: p.bed,
                        clinicalSummary: p.clinicalSummary,
                        intervalEvents: p.intervalEvents || "",
                        systems,
                        medications,
                    })])
                    .select()
                    .single();

                if (error) throw error;
                if (data == null) throw new Error("No data returned from insert");

                newPatients.push(mapPatientRecord(data));

                currentCounter++;
            }

            setPatients((prev) => [...prev, ...newPatients]);

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
    }, [user, notifications, setPatients, patientsRef]);

    const addPatientWithData = React.useCallback(async (patientData: {
        name: string;
        mrn?: string;
        bed: string;
        clinicalSummary: string;
        intervalEvents: string;
        imaging: string;
        labs: string;
        systems: PatientSystems;
        medications?: PatientMedications;
    }) => {
        if (!user) {
            notifications.error({
                title: "Not signed in",
                description: "Please sign in to add patients.",
            });
            throw new Error("Not signed in");
        }
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            throw new Error("Supabase not configured");
        }

        try {
            const nextNumber = getNextPatientCounter(patientsRef.current);
            const systems = parseSystemsJson({
                ...defaultSystemsValue,
                ...(patientData.systems ?? {}),
            } as unknown as Json);
            const medications = parseMedicationsJson(
                (patientData.medications ?? null) as unknown as Json,
            );
            const { data, error } = await supabase
                .from("patients")
                .insert([buildPatientInsertPayload({
                    userId: user.id,
                    patientNumber: nextNumber,
                    name: patientData.name || "",
                    mrn: patientData.mrn ?? "",
                    bed: patientData.bed || "",
                    clinicalSummary: patientData.clinicalSummary || "",
                    intervalEvents: patientData.intervalEvents || "",
                    imaging: patientData.imaging || "",
                    labs: patientData.labs || "",
                    systems,
                    medications,
                })])
                .select()
                .single();

            if (error) throw error;
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            setPatients((prev) => [...prev, newPatient]);

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
    }, [user, notifications, setPatients, patientsRef]);

    return {
        importPatients,
        addPatientWithData,
    };
}
