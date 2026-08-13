import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "../useAuth";
import { useNotifications } from "../use-notifications";
import type { Patient } from "@/types/patient";
import { logMetric, generateRequestId } from "@/lib/observability/logger";
import {
    getNextPatientCounter,
    mapPatientRecord,
    PATIENT_SELECT_COLUMNS,
    PATIENT_SELECT_COLUMNS_LEGACY,
    type PatientRecord,
    isMissingPatientContractColumnError,
} from "@/services/patientService";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import { CACHE_CONFIG } from "@/lib/cache/cacheConfig";

export interface PatientFetchState {
    patients: Patient[];
    loading: boolean;
    patientCounter: number;
    /** Ref that always holds the latest patients array (avoids stale closures). */
    patientsRef: React.MutableRefObject<Patient[]>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    setPatientCounter: React.Dispatch<React.SetStateAction<number>>;
    fetchPatients: (options?: { force?: boolean }) => Promise<void>;
}

async function fetchPatientsFromSupabase(ownerId: string): Promise<Patient[]> {
    const requestId = generateRequestId();
    const start = performance.now();

    try {
        let { data, error } = await supabase
            .from("patients")
            .select(PATIENT_SELECT_COLUMNS)
            .eq("user_id", ownerId)
            .order("patient_number", { ascending: true });

        if (error && isMissingPatientContractColumnError(error)) {
            ({ data, error } = await supabase
                .from("patients")
                .select(PATIENT_SELECT_COLUMNS_LEGACY)
                .eq("user_id", ownerId)
                .order("patient_number", { ascending: true }));
        }

        if (error) throw error;
        const patients = (data || []).map((record) => mapPatientRecord(record as unknown as PatientRecord));
        const durationMs = Math.round(performance.now() - start);
        logMetric("patients.fetch.duration_ms", durationMs, "ms", {
            requestId,
            count: patients.length,
            status: "success",
        });
        logMetric("patients.fetch.success", 1, "count", { requestId });
        return patients;
    } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        logMetric("patients.fetch.duration_ms", durationMs, "ms", {
            requestId,
            status: "error",
        });
        throw err;
    }
}

/**
 * Handles fetching patients from Supabase via React Query and exposes core list state.
 * Single source of truth: the authenticated owner's patient-list cache (Patient[]).
 */
export function usePatientFetch(): PatientFetchState {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const notifications = useNotifications();
    const ownerId = user?.id ?? null;
    const activeOwnerIdRef = React.useRef<string | null>(ownerId);
    activeOwnerIdRef.current = ownerId;
    const patientListQueryKey = React.useMemo(
        () => QUERY_KEYS.patientList(ownerId),
        [ownerId]
    );

    const query = useQuery({
        queryKey: patientListQueryKey,
        queryFn: async () => {
            if (!ownerId) return [];
            const patients = await fetchPatientsFromSupabase(ownerId);
            return activeOwnerIdRef.current === ownerId ? patients : [];
        },
        enabled: hasSupabaseConfig && !!user,
        staleTime: CACHE_CONFIG.staleTime.patients,
        gcTime: CACHE_CONFIG.queries.patients,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 2,
    });

    const patients: Patient[] = React.useMemo(() => query.data ?? [], [query.data]);
    const loading = !!user && query.isPending;
    const refetchPatientsQuery = query.refetch;
    const patientCounter = React.useMemo(
        () => getNextPatientCounter(patients),
        [patients]
    );

    const patientsRef = React.useRef<Patient[]>([]);
    const patientsOwnerIdRef = React.useRef<string | null>(ownerId);
    if (patientsOwnerIdRef.current !== ownerId) {
        patientsOwnerIdRef.current = ownerId;
        patientsRef.current = [];
    }
    React.useEffect(() => {
        patientsRef.current = patients;
    }, [patients]);

    const fetchPatients = React.useCallback(async (options?: { force?: boolean }) => {
        if (!ownerId) return;
        const requestOwnerId = ownerId;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }
        const cachedPatients = queryClient.getQueryData<Patient[]>(patientListQueryKey);
        const patientsQueryState = queryClient.getQueryState(patientListQueryKey);
        const hasFreshPatientCache =
            cachedPatients !== undefined &&
            patientsQueryState?.dataUpdatedAt !== undefined &&
            Date.now() - patientsQueryState.dataUpdatedAt < CACHE_CONFIG.staleTime.patients;

        if (!options?.force && hasFreshPatientCache) return;

        try {
            const result = await refetchPatientsQuery();
            if (activeOwnerIdRef.current !== requestOwnerId) return;
            if (result.error) throw result.error;
        } catch {
            if (activeOwnerIdRef.current !== requestOwnerId) return;
            console.error("Patient fetch failed");
            logMetric("patients.fetch.error", 1, "count", {
                userId: requestOwnerId,
                requestId: generateRequestId(),
            });
            notifications.error({
                title: "Error",
                description: "Failed to load patients.",
            });
        }
    }, [ownerId, notifications, refetchPatientsQuery, queryClient, patientListQueryKey]);

    React.useEffect(() => {
        if (!ownerId) {
            queryClient.setQueryData<Patient[]>(patientListQueryKey, [], {
                updatedAt: 0,
            });
        }
    }, [ownerId, patientListQueryKey, queryClient]);

    React.useEffect(() => {
        if (query.isError && user) {
            logMetric("patients.fetch.error", 1, "count", {
                userId: user.id,
                requestId: generateRequestId(),
            });
            notifications.error({
                title: "Error",
                description: "Failed to load patients.",
            });
        }
    }, [query.isError, query.error, user, notifications]);

    const setPatients = React.useCallback(
        (action: React.SetStateAction<Patient[]>) => {
            if (!ownerId || activeOwnerIdRef.current !== ownerId) return;
            queryClient.setQueryData<Patient[]>(patientListQueryKey, (old) => {
                const prev = old ?? [];
                const next = typeof action === "function" ? action(prev) : action;
                return next;
            });
        },
        [ownerId, patientListQueryKey, queryClient]
    );

    const setPatientCounter = React.useCallback(() => {
        /* no-op: patientCounter is derived from patients */
    }, []);

    return {
        patients,
        loading,
        patientCounter,
        patientsRef,
        setPatients,
        setPatientCounter,
        fetchPatients,
    };
}
