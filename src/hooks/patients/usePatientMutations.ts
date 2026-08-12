import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/use-notifications";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import type { PatientTodosMap } from "@/hooks/useAllPatientTodos";
import type { Database } from "@/integrations/supabase/types";
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
import { indexedDBQueue } from "@/lib/offline/indexedDBQueue";
import { CircuitOpenError } from "@/lib/circuitBreaker";

export interface PatientMutationsDeps {
    patientsRef: React.MutableRefObject<Patient[]>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    patientCounter: number;
    setPatientCounter: React.Dispatch<React.SetStateAction<number>>;
    fetchPatients: (options?: { force?: boolean }) => Promise<void>;
}

type PatientUpdateRow = Database["public"]["Tables"]["patients"]["Update"];

export type PatientSaveState = "idle" | "saving" | "saved" | "queued" | "error";

class PatientWriteConflictError extends Error {
    constructor() {
        super("Patient changed in another tab or device");
        this.name = "PatientWriteConflictError";
    }
}

function isRetryablePatientWriteError(error: unknown): boolean {
    if (error instanceof PatientWriteConflictError) return false;
    const candidate = error as { status?: number; code?: string; message?: string; cause?: unknown } | null;
    const status = candidate?.status;
    if (status === 408 || status === 429 || (typeof status === "number" && status >= 500)) return true;
    const message = candidate?.message?.toLowerCase() ?? "";
    if (error instanceof TypeError || /network|fetch|timeout|connection|temporar/.test(message)) return true;
    // The API circuit breaker opens on transient connectivity/backend failures
    // — exactly the writes the durable offline queue exists to protect.
    // apiFetch wraps CircuitOpenError in an ApiError, so check both the error
    // and its cause.
    if (error instanceof CircuitOpenError || candidate?.cause instanceof CircuitOpenError) return true;
    // While the browser reports offline, any failure without an HTTP status is
    // connectivity-driven and queueable. (Strict === false: outside browsers
    // navigator.onLine is undefined, not offline.)
    return typeof navigator !== "undefined" && navigator.onLine === false && typeof status !== "number";
}

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
    const patientWriteChainsRef = React.useRef(new Map<string, Promise<void>>());
    const patientServerRevisionRef = React.useRef(new Map<string, number>());
    const [patientSaveStates, setPatientSaveStates] = React.useState<Record<string, PatientSaveState>>({});

    const setPatientSaveState = React.useCallback((patientId: string, state: PatientSaveState) => {
        setPatientSaveStates((current) => current[patientId] === state
            ? current
            : { ...current, [patientId]: state });
    }, []);

    const isCurrentOwner = React.useCallback(
        (requestOwnerId: string) => activeOwnerIdRef.current === requestOwnerId,
        []
    );

    // Reconcile per-patient save states with the durable offline queue: a
    // queued write that disappears from the queue has drained successfully;
    // one that exhausted its retries surfaces as an error. Without this the
    // header would claim "Offline queued" forever after a successful sync.
    const patientSaveStatesRef = React.useRef(patientSaveStates);
    React.useEffect(() => {
        patientSaveStatesRef.current = patientSaveStates;
    }, [patientSaveStates]);

    React.useEffect(() => {
        const unsubscribe = indexedDBQueue.subscribe((queue) => {
            const current = patientSaveStatesRef.current;
            const drained: string[] = [];
            const failed: string[] = [];
            for (const [patientId, state] of Object.entries(current)) {
                if (state !== "queued") continue;
                const record = queue.find(
                    (mutation) => mutation.type === "patient" && mutation.entityId === patientId,
                );
                if (!record) drained.push(patientId);
                else if (record.status === "failed") failed.push(patientId);
            }
            if (drained.length === 0 && failed.length === 0) return;
            setPatientSaveStates((prev) => {
                const next = { ...prev };
                for (const id of drained) if (next[id] === "queued") next[id] = "saved";
                for (const id of failed) if (next[id] === "queued") next[id] = "error";
                return next;
            });
            // The replay bumped the server revision outside this hook's write
            // path; drop the cached expected revision and refetch so the next
            // edit does not hit a spurious conflict.
            const ownerId = activeOwnerIdRef.current;
            for (const patientId of drained) {
                if (ownerId) {
                    patientServerRevisionRef.current.delete(`${ownerId}:${patientId}`);
                }
            }
            if (drained.length > 0) {
                void fetchPatients({ force: true });
            }
        });
        return unsubscribe;
    }, [fetchPatients]);

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
        setPatientSaveState(id, "saving");

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

        // Serialize this tab's writes per patient. Each request then compares the
        // revision produced by its predecessor, while other tabs are rejected.
        const previousWrite = patientWriteChainsRef.current.get(patientUpdateKey) ?? Promise.resolve();
        let releaseWrite!: () => void;
        const writeGate = new Promise<void>((resolve) => {
            releaseWrite = resolve;
        });
        const writeChain = previousWrite.catch(() => undefined).then(() => writeGate);
        patientWriteChainsRef.current.set(patientUpdateKey, writeChain);
        await previousWrite.catch(() => undefined);

        const serializeForHistory = (v: unknown): string =>
            typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
        let persistenceData = updateData;

        try {
            const latestPatient = patientsRef.current.find((patient) => patient.id === id) ?? updatedPatient;
            persistenceData = prepareUpdateData(
                field,
                value,
                latestPatient.systems,
                latestPatient.medications,
            ) as PatientUpdateRow;
            persistenceData.last_modified = now;
            if (shouldTrack) {
                persistenceData.field_timestamps = latestPatient.fieldTimestamps as PatientUpdateRow["field_timestamps"];
            }
            const expectedRevision = patientServerRevisionRef.current.get(patientUpdateKey)
                ?? oldPatient.revision
                ?? 0;
            const { error, count } = await supabase
                .from("patients")
                .update(persistenceData, { count: "exact" })
                .eq("id", id)
                .eq("revision", expectedRevision);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
            if (count === 0) throw new PatientWriteConflictError();
            const nextRevision = expectedRevision + 1;
            patientServerRevisionRef.current.set(patientUpdateKey, nextRevision);
            const revisionPatients = patientsRef.current.map((patient) => (
                patient.id === id ? { ...patient, revision: nextRevision } : patient
            ));
            commitPatients(requestOwnerId, revisionPatients);

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
            if (patientUpdateVersionRef.current.get(patientUpdateKey) === patientUpdateVersion) {
                setPatientSaveState(id, "saved");
            }
        } catch (error) {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.update.failed");
            const isLatestFieldUpdate =
                fieldUpdateVersionRef.current.get(fieldUpdateKey) === fieldUpdateVersion;

            if (isLatestFieldUpdate && isRetryablePatientWriteError(error)) {
                try {
                    await indexedDBQueue.enqueue({
                        type: "patient",
                        operation: "update",
                        table: "patients",
                        entityId: id,
                        payload: persistenceData as Record<string, unknown>,
                        conflictData: {
                            last_modified: oldPatient.lastModified,
                            revision: patientServerRevisionRef.current.get(patientUpdateKey)
                                ?? oldPatient.revision
                                ?? 0,
                        },
                    });
                    setPatientSaveState(id, "queued");
                    notifications.warning({
                        title: "Offline — change queued",
                        description: "Change is stored on this device and will retry when connection recovers.",
                    });
                    return;
                } catch {
                    // Durable queue unavailable: fall through to rollback and persistent error.
                }
            }

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
            if (error instanceof PatientWriteConflictError) {
                patientServerRevisionRef.current.delete(patientUpdateKey);
            }
            if (isLatestFieldUpdate) {
                setPatientSaveState(id, "error");
                notifications.error(error instanceof PatientWriteConflictError
                    ? {
                        title: "Save conflict",
                        description: "This patient changed in another tab or device. Your edit was not allowed to overwrite it; review the refreshed chart.",
                    }
                    : {
                        title: "Save failed",
                        description: "Patient changes could not be saved or queued. Copy your text before retrying.",
                    });
            }
        } finally {
            releaseWrite();
            if (patientWriteChainsRef.current.get(patientUpdateKey) === writeChain) {
                void writeChain.finally(() => {
                    if (patientWriteChainsRef.current.get(patientUpdateKey) === writeChain) {
                        patientWriteChainsRef.current.delete(patientUpdateKey);
                    }
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
        setPatientSaveState,
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
            patientServerRevisionRef.current.delete(`${requestOwnerId}:${id}`);

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
            currentPatients.forEach((patient) => {
                patientServerRevisionRef.current.delete(`${requestOwnerId}:${patient.id}`);
            });
            await fetchPatients({ force: true });
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
    }, [user, notifications, patientsRef, isCurrentOwner, commitPatients, fetchPatients]);

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
            previousPatients.forEach((patient) => {
                patientServerRevisionRef.current.delete(`${requestOwnerId}:${patient.id}`);
            });
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
        patientSaveStates,
    };
}
