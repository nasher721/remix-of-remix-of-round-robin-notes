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
    const activeOwnerIdRef = React.useRef<string | null>(user?.id ?? null);
    activeOwnerIdRef.current = user?.id ?? null;

    const isCurrentOwner = React.useCallback(
        (requestOwnerId: string) => activeOwnerIdRef.current === requestOwnerId,
        []
    );

    const appendPatients = React.useCallback((requestOwnerId: string, patientsToAppend: Patient[]) => {
        if (!isCurrentOwner(requestOwnerId)) return;
        if (patientsToAppend.length === 0) return;

        const mergePatients = (existingPatients: Patient[]) => {
            const existingIds = new Set(existingPatients.map((patient) => patient.id));
            const uniqueNewPatients = patientsToAppend.filter((patient) => !existingIds.has(patient.id));
            return uniqueNewPatients.length === 0
                ? existingPatients
                : [...existingPatients, ...uniqueNewPatients];
        };

        patientsRef.current = mergePatients(patientsRef.current);
        setPatients((prev) => {
            const mergedPatients = mergePatients(prev);
            patientsRef.current = mergedPatients;
            return mergedPatients;
        });
    }, [isCurrentOwner, patientsRef, setPatients]);

    const isPatientNumberConflict = React.useCallback((error: unknown): boolean => {
        if (typeof error !== "object" || error === null) return false;
        const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
        if (maybeCode !== "23505") return false;
        const maybeDetails = "details" in error ? (error as { details?: unknown }).details : undefined;
        const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined;
        const combinedText = `${String(maybeDetails ?? "")} ${String(maybeMessage ?? "")}`.toLowerCase();
        return combinedText.includes("patient_number");
    }, []);

    const getLatestPatientNumber = React.useCallback(async (): Promise<number> => {
        const { data, error } = await supabase
            .from("patients")
            .select("patient_number")
            .order("patient_number", { ascending: false })
            .limit(1);
        if (error) throw error;
        return data?.[0]?.patient_number ?? 0;
    }, []);

    const importPatients = React.useCallback(async (patientsToImport: Array<{
        name: string;
        bed: string;
        clinicalSummary: string;
        intervalEvents: string;
        systems?: PatientSystems;
        medications?: PatientMedications;
    }>) => {
        if (!user) return;
        const requestOwnerId = user.id;
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
            const failedPatients: { name: string; error: unknown }[] = [];

            for (const p of patientsToImport) {
                const systems = parseSystemsJson({
                    ...defaultSystemsValue,
                    ...(p.systems ?? {}),
                } as unknown as Json);
                const medications = parseMedicationsJson(
                    (p.medications ?? null) as unknown as Json,
                );
                let insertNumber = currentCounter;
                let { data, error } = await supabase
                    .from("patients")
                    .insert([buildPatientInsertPayload({
                        userId: requestOwnerId,
                        patientNumber: insertNumber,
                        name: p.name,
                        bed: p.bed,
                        clinicalSummary: p.clinicalSummary,
                        intervalEvents: p.intervalEvents || "",
                        systems,
                        medications,
                    })])
                    .select()
                    .single();

                if (!isCurrentOwner(requestOwnerId)) return;
                if (error && isPatientNumberConflict(error)) {
                    const latestNumber = await getLatestPatientNumber();
                    if (!isCurrentOwner(requestOwnerId)) return;
                    insertNumber = latestNumber + 1;
                    const retryResult = await supabase
                        .from("patients")
                        .insert([buildPatientInsertPayload({
                            userId: requestOwnerId,
                            patientNumber: insertNumber,
                            name: p.name,
                            bed: p.bed,
                            clinicalSummary: p.clinicalSummary,
                            intervalEvents: p.intervalEvents || "",
                            systems,
                            medications,
                        })])
                        .select()
                        .single();
                    if (!isCurrentOwner(requestOwnerId)) return;
                    data = retryResult.data;
                    error = retryResult.error;
                }

                if (error) {
                    failedPatients.push({ name: p.name, error });
                    currentCounter = insertNumber + 1;
                    continue;
                }
                if (data == null) {
                    failedPatients.push({ name: p.name, error: new Error("No data returned from insert") });
                    currentCounter = insertNumber + 1;
                    continue;
                }

                newPatients.push(mapPatientRecord(data));

                currentCounter = insertNumber + 1;
            }

            appendPatients(requestOwnerId, newPatients);

            if (failedPatients.length > 0) {
                if (newPatients.length === 0) {
                    notifications.error({
                        title: "Import Failed",
                        description: `Failed to import all ${patientsToImport.length} patients.`,
                    });
                    throw new Error(`Failed to import all patients`);
                }
                notifications.success({
                    title: "Partial Import Complete",
                    description: `${newPatients.length} patient(s) imported, ${failedPatients.length} failed.`,
                });
            } else {
                notifications.success({
                    title: "Import Complete",
                    description: `${newPatients.length} patient(s) imported from Epic handoff.`,
                });
            }
        } catch (error) {
            if (!isCurrentOwner(requestOwnerId)) return;
            console.error("Patient import failed");
            notifications.error({
                title: "Import Error",
                description: "Failed to import some patients.",
            });
            throw error;
        }
    }, [user, notifications, patientsRef, getLatestPatientNumber, isPatientNumberConflict, isCurrentOwner, appendPatients]);

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
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            throw new Error("Supabase not configured");
        }

        try {
            let insertNumber = getNextPatientCounter(patientsRef.current);
            const systems = parseSystemsJson({
                ...defaultSystemsValue,
                ...(patientData.systems ?? {}),
            } as unknown as Json);
            const medications = parseMedicationsJson(
                (patientData.medications ?? null) as unknown as Json,
            );
            let { data, error } = await supabase
                .from("patients")
                .insert([buildPatientInsertPayload({
                    userId: requestOwnerId,
                    patientNumber: insertNumber,
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

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error && isPatientNumberConflict(error)) {
                const latestNumber = await getLatestPatientNumber();
                if (!isCurrentOwner(requestOwnerId)) return;
                insertNumber = latestNumber + 1;
                const retryResult = await supabase
                    .from("patients")
                    .insert([buildPatientInsertPayload({
                        userId: requestOwnerId,
                        patientNumber: insertNumber,
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
                if (!isCurrentOwner(requestOwnerId)) return;
                data = retryResult.data;
                error = retryResult.error;
            }

            if (error) throw error;
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            appendPatients(requestOwnerId, [newPatient]);

            notifications.success({
                title: "Patient Imported",
                description: `${patientData.name || 'New patient'} added successfully.`,
            });
        } catch (error) {
            if (!isCurrentOwner(requestOwnerId)) return;
            console.error("Patient import failed");
            notifications.error({
                title: "Error",
                description: "Failed to import patient.",
            });
            throw error;
        }
    }, [user, notifications, patientsRef, getLatestPatientNumber, isPatientNumberConflict, isCurrentOwner, appendPatients]);

    return {
        importPatients,
        addPatientWithData,
    };
}
