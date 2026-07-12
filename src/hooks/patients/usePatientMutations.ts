import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/use-notifications";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import type { PatientTodosMap } from "@/hooks/useAllPatientTodos";
import type { Database, Json } from "@/integrations/supabase/types";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import { prepareUpdateData } from "@/lib/mappers/patientMapper";
import {
    buildPatientInsertPayload,
    mapPatientRecord,
    shouldTrackTimestamp,
} from "@/services/patientService";
import {
    deletePatientImageObjects,
    diffPatientImageObjectKeys,
    extractPatientImageObjectKeys,
} from "@/lib/patientImages";
import { logError, logWarn } from "@/lib/observability/logger";

export interface PatientMutationsDeps {
    patientsRef: React.MutableRefObject<Patient[]>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    patientCounter: number;
    setPatientCounter: React.Dispatch<React.SetStateAction<number>>;
    fetchPatients: (options?: { force?: boolean }) => Promise<void>;
}

type PatientUpdateRow = Database["public"]["Tables"]["patients"]["Update"];

function collectReferencedPatientImageKeys(
    patients: ReadonlyArray<Pick<Patient, "imaging">>,
    ownerId: string,
): Set<string> {
    return new Set(
        patients.flatMap((patient) => extractPatientImageObjectKeys(patient.imaging, ownerId)),
    );
}

function restoreUpdatedField(
    currentPatient: Patient,
    previousPatient: Patient,
    field: string,
    tracked: boolean,
    optimisticTimestamp: string,
): Patient {
    const restoredPatient: Patient = { ...currentPatient };

    if (field.includes(".")) {
        const [parent, child] = field.split(".");
        if (parent === "systems") {
            restoredPatient.systems = {
                ...currentPatient.systems,
                [child]: previousPatient.systems[child as keyof PatientSystems],
            };
        } else if (parent === "medications") {
            restoredPatient.medications = {
                ...currentPatient.medications,
                [child]: previousPatient.medications[child as keyof PatientMedications],
            } as PatientMedications;
        }
    } else if (field === "medications") {
        restoredPatient.medications = previousPatient.medications;
    } else {
        (restoredPatient as unknown as Record<string, unknown>)[field] =
            (previousPatient as unknown as Record<string, unknown>)[field];
    }

    if (tracked) {
        const timestamps = {
            ...currentPatient.fieldTimestamps,
        } as Record<string, string | undefined>;
        const previousTimestamp = (
            previousPatient.fieldTimestamps as Record<string, string | undefined>
        )[field];
        if (previousTimestamp === undefined) delete timestamps[field];
        else timestamps[field] = previousTimestamp;
        restoredPatient.fieldTimestamps = timestamps;
    }

    if (currentPatient.lastModified === optimisticTimestamp) {
        restoredPatient.lastModified = previousPatient.lastModified;
    }

    return restoredPatient;
}

function setPatientListCache(queryClient: QueryClient, ownerId: string, patients: Patient[]) {
    queryClient.setQueryData<Patient[]>(QUERY_KEYS.patientList(ownerId), patients);
}

function removePatientScopedCaches(queryClient: QueryClient, ownerId: string, patientId: string) {
    queryClient.removeQueries({
        queryKey: QUERY_KEYS.patientTodosForOwner(ownerId, patientId),
        exact: true,
    });
    queryClient.setQueriesData<PatientTodosMap>(
        { queryKey: [...QUERY_KEYS.allTodos, ownerId] },
        (currentMap) => {
            if (!currentMap || !Object.prototype.hasOwnProperty.call(currentMap, patientId)) {
                return currentMap;
            }

            const { [patientId]: _removed, ...remainingTodos } = currentMap;
            return remainingTodos;
        }
    );
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
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const notifications = useNotifications();
    const activeOwnerIdRef = React.useRef<string | null>(user?.id ?? null);
    activeOwnerIdRef.current = user?.id ?? null;
    const fieldUpdateVersionRef = React.useRef(new Map<string, number>());
    const patientUpdateVersionRef = React.useRef(new Map<string, number>());

    const isCurrentOwner = React.useCallback(
        (requestOwnerId: string) => activeOwnerIdRef.current === requestOwnerId,
        []
    );

    const deleteImagesIfUnreferenced = React.useCallback(async (
        candidateKeys: string[],
        requestOwnerId: string,
        localPatients: Patient[],
        notifyOnFailure: boolean,
    ): Promise<void> => {
        if (candidateKeys.length === 0 || !isCurrentOwner(requestOwnerId)) return;

        try {
            const { data, error } = await supabase
                .from("patients")
                .select("imaging")
                .eq("user_id", requestOwnerId);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;

            const serverPatients = (data ?? []).map((row) => ({ imaging: row.imaging ?? "" }));
            const referencedKeys = collectReferencedPatientImageKeys(
                [...localPatients, ...serverPatients],
                requestOwnerId,
            );
            const unreferencedKeys = candidateKeys.filter((key) => !referencedKeys.has(key));
            if (unreferencedKeys.length === 0) return;

            await deletePatientImageObjects(unreferencedKeys, requestOwnerId);
        } catch {
            if (notifyOnFailure && isCurrentOwner(requestOwnerId)) {
                notifications.warning({
                    title: "Image cleanup deferred",
                    description: "The patient record was saved, but one or more unused images still require cleanup.",
                });
            }
        }
    }, [isCurrentOwner, notifications]);

    const commitPatients = React.useCallback((requestOwnerId: string, nextPatients: Patient[]) => {
        if (!isCurrentOwner(requestOwnerId)) return false;
        patientsRef.current = nextPatients;
        setPatients(nextPatients);
        setPatientListCache(queryClient, requestOwnerId, nextPatients);
        return true;
    }, [isCurrentOwner, patientsRef, queryClient, setPatients]);

    const addPatient = React.useCallback(async () => {
        if (!user) {
            notifications.error({
                title: "Not signed in",
                description: "Please sign in to add patients.",
            });
            return;
        }
        const requestOwnerId = user.id;
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
                    userId: requestOwnerId,
                    patientNumber: nextNumber,
                })])
                .select()
                .single();

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            commitPatients(requestOwnerId, [...patientsRef.current, newPatient]);
            setPatientCounter((prev) => Math.max(prev, nextNumber));

            notifications.success({
                title: "Patient Added",
                description: "New patient card created.",
            });
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.add.failed");
            notifications.error({
                title: "Error",
                description: "Failed to add patient.",
            });
        }
    }, [user, notifications, isCurrentOwner, commitPatients, setPatientCounter, patientsRef]);

    const updatePatient = React.useCallback(async (id: string, field: string, value: unknown) => {
        if (!user) return;
        const requestOwnerId = user.id;
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
        const fieldUpdateKey = `${requestOwnerId}:${id}:${field}`;
        const fieldUpdateVersion = (fieldUpdateVersionRef.current.get(fieldUpdateKey) ?? 0) + 1;
        fieldUpdateVersionRef.current.set(fieldUpdateKey, fieldUpdateVersion);
        const patientUpdateKey = `${requestOwnerId}:${id}`;
        const patientUpdateVersion = (patientUpdateVersionRef.current.get(patientUpdateKey) ?? 0) + 1;
        patientUpdateVersionRef.current.set(patientUpdateKey, patientUpdateVersion);
        const imageDelta = field === "imaging" && typeof value === "string"
            ? diffPatientImageObjectKeys(oldPatient.imaging, value, requestOwnerId)
            : null;

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
        commitPatients(requestOwnerId, currentPatients);

        const updateData = prepareUpdateData(field, value, updatedPatient.systems, updatedPatient.medications) as PatientUpdateRow;
        updateData.last_modified = now;

        if (shouldTrack) {
            updateData.field_timestamps = updatedPatient.fieldTimestamps as PatientUpdateRow["field_timestamps"];
        }

        const serializeForHistory = (v: unknown): string =>
            typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);

        try {
            const [nestedParent, nestedChild] = field.split(".");
            const isAtomicNestedUpdate = Boolean(
                nestedChild
                && (nestedParent === "systems" || nestedParent === "medications")
            );

            if (isAtomicNestedUpdate) {
                const jsonValue = JSON.parse(JSON.stringify(value ?? null)) as Json;
                const { data, error } = await supabase.rpc("update_owned_patient_json_field", {
                    p_patient_id: id,
                    p_parent_field: nestedParent,
                    p_child_field: nestedChild,
                    p_value: jsonValue,
                    p_last_modified: now,
                    p_field_timestamp: shouldTrack ? now : null,
                });

                if (!isCurrentOwner(requestOwnerId)) return;
                if (error) throw error;
                if (data !== true) throw new Error("Patient JSON patch was not applied");
            } else {
                const { error } = await supabase
                    .from("patients")
                    .update(updateData)
                    .eq("id", id);

                if (!isCurrentOwner(requestOwnerId)) return;
                if (error) throw error;
            }

            if (imageDelta?.removed.length) {
                await deleteImagesIfUnreferenced(
                    imageDelta.removed,
                    requestOwnerId,
                    patientsRef.current,
                    true,
                );
                if (!isCurrentOwner(requestOwnerId)) return;
            }

            // Record history entry for trackable fields (non-blocking)
            if (shouldTrack) {
                const newValueStr = isMedicationsField ? serializeForHistory(value) : (value as string);
                const oldValueStr = isMedicationsField ? serializeForHistory(oldPatient.medications) : oldValue;
                if (oldValueStr !== newValueStr) {
                    void (async () => {
                        try {
                            const { error } = await supabase.from("patient_field_history").insert({
                                patient_id: id,
                                user_id: requestOwnerId,
                                field_name: field,
                                old_value: oldValueStr,
                                new_value: newValueStr,
                            });
                            if (!isCurrentOwner(requestOwnerId)) return;
                            if (error) throw error;
                            await queryClient.invalidateQueries({
                                queryKey: QUERY_KEYS.fieldHistoryForOwner(requestOwnerId, id),
                                exact: true,
                            });
                        } catch {
                            logWarn("patient.field_history.failed");
                        }
                    })();
                }
            }
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.update.failed");
            const isLatestFieldUpdate =
                fieldUpdateVersionRef.current.get(fieldUpdateKey) === fieldUpdateVersion;

            if (isLatestFieldUpdate) {
                const rolledBackPatients = patientsRef.current.map((patient) => (
                    patient.id === id
                        ? restoreUpdatedField(patient, oldPatient, field, shouldTrack, now)
                        : patient
                ));
                commitPatients(requestOwnerId, rolledBackPatients);
            }

            if (imageDelta?.added.length) {
                await deleteImagesIfUnreferenced(
                    imageDelta.added,
                    requestOwnerId,
                    patientsRef.current,
                    false,
                );
                if (!isCurrentOwner(requestOwnerId)) return;
            }

            if (patientUpdateVersionRef.current.get(patientUpdateKey) === patientUpdateVersion) {
                void fetchPatients({ force: true });
            }
            if (isLatestFieldUpdate) {
                notifications.error({
                    title: "Update failed",
                    description: "Patient changes could not be saved. Please try again.",
                });
            }
        }
    }, [
        user,
        fetchPatients,
        notifications,
        patientsRef,
        isCurrentOwner,
        commitPatients,
        queryClient,
        deleteImagesIfUnreferenced,
    ]);

    const removePatient = React.useCallback(async (id: string) => {
        if (!user) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }
        const patientToRemove = patientsRef.current.find((patient) => patient.id === id);
        if (!patientToRemove) return;

        try {
            const { error } = await supabase
                .from("patients")
                .delete()
                .eq("id", id);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;

            const remainingPatients = patientsRef.current.filter((patient) => patient.id !== id);
            commitPatients(requestOwnerId, remainingPatients);
            removePatientScopedCaches(queryClient, requestOwnerId, id);

            await deleteImagesIfUnreferenced(
                extractPatientImageObjectKeys(patientToRemove.imaging, requestOwnerId),
                requestOwnerId,
                remainingPatients,
                true,
            );
            if (!isCurrentOwner(requestOwnerId)) return;

            notifications.success({
                title: "Patient Removed",
                description: "Patient has been removed.",
            });
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.remove.failed");
            notifications.error({
                title: "Error",
                description: "Failed to remove patient.",
            });
        }
    }, [
        user,
        notifications,
        patientsRef,
        isCurrentOwner,
        commitPatients,
        queryClient,
        deleteImagesIfUnreferenced,
    ]);

    const duplicatePatient = React.useCallback(async (id: string) => {
        if (!user) return;
        const requestOwnerId = user.id;
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
                    userId: requestOwnerId,
                    patientNumber: nextNumber,
                    name: `${patient.name} (Copy)`,
                    mrn: patient.mrn,
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

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            commitPatients(requestOwnerId, [...patientsRef.current, newPatient]);
            setPatientCounter((prev) => Math.max(prev, nextNumber));

            notifications.success({
                title: "Patient Duplicated",
                description: "Patient card has been duplicated.",
            });
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.duplicate.failed");
            notifications.error({
                title: "Error",
                description: "Failed to duplicate patient.",
            });
        }
    }, [user, notifications, patientsRef, isCurrentOwner, commitPatients, setPatientCounter]);

    const toggleCollapse = React.useCallback(async (id: string) => {
        const patient = patientsRef.current.find((p) => p.id === id);
        if (!patient) return;

        await updatePatient(id, "collapsed", !patient.collapsed);
    }, [updatePatient, patientsRef]);

    const collapseAll = React.useCallback(async () => {
        const currentPatients = patientsRef.current;
        if (!user || currentPatients.length === 0) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }

        const allCollapsed = currentPatients.every(p => p.collapsed);
        const newCollapseState = !allCollapsed;
        const previousCollapseState = new Map(
            currentPatients.map((patient) => [patient.id, patient.collapsed]),
        );
        const collapseUpdateVersions = new Map<string, number>();
        currentPatients.forEach((patient) => {
            const fieldUpdateKey = `${requestOwnerId}:${patient.id}:collapsed`;
            const fieldUpdateVersion = (fieldUpdateVersionRef.current.get(fieldUpdateKey) ?? 0) + 1;
            fieldUpdateVersionRef.current.set(fieldUpdateKey, fieldUpdateVersion);
            collapseUpdateVersions.set(patient.id, fieldUpdateVersion);
        });

        const nextPatients = currentPatients.map(p => ({ ...p, collapsed: newCollapseState }));
        commitPatients(requestOwnerId, nextPatients);

        try {
            const { error } = await supabase
                .from("patients")
                .update({ collapsed: newCollapseState })
                .eq("user_id", requestOwnerId);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.collapse_all.failed");
            const rolledBackPatients = patientsRef.current.map((patient) => {
                const fieldUpdateKey = `${requestOwnerId}:${patient.id}:collapsed`;
                const expectedVersion = collapseUpdateVersions.get(patient.id);
                const previousCollapsed = previousCollapseState.get(patient.id);
                if (
                    expectedVersion === undefined
                    || previousCollapsed === undefined
                    || fieldUpdateVersionRef.current.get(fieldUpdateKey) !== expectedVersion
                ) {
                    return patient;
                }
                return { ...patient, collapsed: previousCollapsed };
            });
            commitPatients(requestOwnerId, rolledBackPatients);
        }
    }, [user, notifications, patientsRef, isCurrentOwner, commitPatients]);

    const clearAll = React.useCallback(async () => {
        if (!user) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }
        const previousPatients = [...patientsRef.current];

        try {
            const { error } = await supabase
                .from("patients")
                .delete()
                .eq("user_id", requestOwnerId);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;

            commitPatients(requestOwnerId, []);
            setPatientCounter(1);
            previousPatients.forEach((patient) => removePatientScopedCaches(queryClient, requestOwnerId, patient.id));
            queryClient.setQueriesData<PatientTodosMap>(
                { queryKey: [...QUERY_KEYS.allTodos, requestOwnerId] },
                () => ({})
            );

            await deleteImagesIfUnreferenced(
                Array.from(collectReferencedPatientImageKeys(previousPatients, requestOwnerId)),
                requestOwnerId,
                [],
                true,
            );
            if (!isCurrentOwner(requestOwnerId)) return;

            notifications.success({
                title: "All Data Cleared",
                description: "All patient data has been removed.",
            });
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.clear_all.failed");
            notifications.error({
                title: "Error",
                description: "Failed to clear patients.",
            });
        }
    }, [
        user,
        notifications,
        patientsRef,
        isCurrentOwner,
        commitPatients,
        setPatientCounter,
        queryClient,
        deleteImagesIfUnreferenced,
    ]);

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
