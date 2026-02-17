import * as React from "react";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "../useAuth";
import { useNotifications } from "../use-notifications";
import type { Patient } from "@/types/patient";
import { logMetric } from "@/lib/observability/logger";
import {
    getNextPatientCounter,
    mapPatientRecord,
} from "@/services/patientService";

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

/**
 * Handles fetching patients from Supabase and maintaining core list state.
 */
export function usePatientFetch(): PatientFetchState {
    const [patients, setPatients] = React.useState<Patient[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [patientCounter, setPatientCounter] = React.useState(1);
    const { user } = useAuth();
    const notifications = useNotifications();
    const fetchIdRef = React.useRef(0);

    // Ref to track latest patients for use in callbacks without stale closures
    const patientsRef = React.useRef<Patient[]>([]);
    React.useEffect(() => {
        patientsRef.current = patients;
    }, [patients]);

    const fetchPatients = React.useCallback(async () => {
        if (!user) {
            setPatients([]);
            setLoading(false);
            return;
        }

        if (!hasSupabaseConfig) {
            setPatients([]);
            setLoading(false);
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }

        const currentFetchId = fetchIdRef.current + 1;
        fetchIdRef.current = currentFetchId;

        const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

        try {
            const { data, error } = await supabase
                .from("patients")
                .select("*")
                .order("patient_number", { ascending: true });

            if (error) throw error;

            if (fetchIdRef.current !== currentFetchId) {
                return;
            }

            const formattedPatients: Patient[] = (data || []).map(mapPatientRecord);

            setPatients(formattedPatients);
            setPatientCounter(getNextPatientCounter(formattedPatients));

            const durationMs = Math.round(
                (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime
            );
            logMetric("patients.fetch.duration_ms", durationMs, "ms", {
                userId: user.id,
                resultCount: formattedPatients.length,
            });
        } catch (error) {
            console.error("Error fetching patients:", error);
            logMetric("patients.fetch.error", 1, "count", { userId: user.id });
            notifications.error({
                title: "Error",
                description: "Failed to load patients.",
            });
        } finally {
            if (fetchIdRef.current === currentFetchId) {
                setLoading(false);
            }
        }
    }, [user, notifications]);

    React.useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

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
