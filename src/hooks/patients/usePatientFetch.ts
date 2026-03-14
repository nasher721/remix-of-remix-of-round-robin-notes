import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "../useAuth";
import { useNotifications } from "../use-notifications";
import type { Patient } from "@/types/patient";
import { logMetric } from "@/lib/observability/logger";
import {
    getNextPatientCounter,
    mapPatientRecord,
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
    fetchPatients: () => Promise<void>;
}

async function fetchPatientsFromSupabase(): Promise<Patient[]> {
    const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("patient_number", { ascending: true });

    if (error) throw error;
    const patients = (data || []).map(mapPatientRecord);
    return patients;
}

/**
 * Handles fetching patients from Supabase via React Query and exposes core list state.
 * Single source of truth: QUERY_KEYS.patients cache (Patient[]).
 */
export function usePatientFetch(): PatientFetchState {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const notifications = useNotifications();

    const query = useQuery({
        queryKey: QUERY_KEYS.patients,
        queryFn: fetchPatientsFromSupabase,
        enabled: hasSupabaseConfig && !!user,
        staleTime: CACHE_CONFIG.staleTime.patients,
        gcTime: CACHE_CONFIG.queries.patients,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 2,
    });

    const patients: Patient[] = query.data ?? [];
    const loading = query.isPending;
    const patientCounter = React.useMemo(
        () => getNextPatientCounter(patients),
        [patients]
    );

    const patientsRef = React.useRef<Patient[]>([]);
    React.useEffect(() => {
        patientsRef.current = patients;
    }, [patients]);

    const fetchPatients = React.useCallback(async () => {
        if (!user) return;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }
        try {
            await query.refetch();
        } catch (error) {
            console.error("Error fetching patients:", error);
            logMetric("patients.fetch.error", 1, "count", { userId: user.id });
            notifications.error({
                title: "Error",
                description: "Failed to load patients.",
            });
        }
    }, [user, notifications, query]);

    React.useEffect(() => {
        if (!user) {
            queryClient.setQueryData(QUERY_KEYS.patients, []);
        }
    }, [user, queryClient]);

    React.useEffect(() => {
        if (query.isError && user) {
            logMetric("patients.fetch.error", 1, "count", { userId: user.id });
            notifications.error({
                title: "Error",
                description: "Failed to load patients.",
            });
        }
    }, [query.isError, query.error, user, notifications]);

    const setPatients = React.useCallback(
        (action: React.SetStateAction<Patient[]>) => {
            queryClient.setQueryData<Patient[]>(QUERY_KEYS.patients, (old) => {
                const prev = old ?? [];
                const next = typeof action === "function" ? action(prev) : action;
                return next;
            });
        },
        [queryClient]
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
