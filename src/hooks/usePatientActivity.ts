import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type ActivityAction = 'created' | 'updated' | 'assigned' | 'exported' | 'ai_used';

interface PatientActivityRow {
  id: string;
  patient_id: string;
  user_id: string | null;
  action: string;
  field_name: string | null;
  summary: string | null;
  created_at: string;
}

export interface PatientActivityEntry {
  id: string;
  patientId: string;
  userId: string | null;
  action: ActivityAction;
  fieldName: string | null;
  summary: string | null;
  createdAt: string;
  userName?: string;
}

export const usePatientActivity = (patientId: string) => {
  const [activities, setActivities] = React.useState<PatientActivityEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { user } = useAuth();

  const fetchActivities = React.useCallback(async (limit: number = 10) => {
    if (!patientId) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from("patient_activity" as never)
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(limit) as unknown as Promise<{ data: PatientActivityRow[] | null; error: Error | null }>);

      if (error) throw error;

      setActivities(
        (data || []).map((entry) => ({
          id: entry.id,
          patientId: entry.patient_id,
          userId: entry.user_id,
          action: entry.action as ActivityAction,
          fieldName: entry.field_name,
          summary: entry.summary,
          createdAt: entry.created_at,
        }))
      );
    } catch (error) {
      console.error("Error fetching patient activity:", error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const addActivity = React.useCallback(async (
    action: ActivityAction,
    options?: {
      fieldName?: string;
      summary?: string;
    }
  ) => {
    if (!user || !patientId) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("patient_activity").insert({
        patient_id: patientId,
        user_id: user.id,
        action,
        field_name: options?.fieldName || null,
        summary: options?.summary || null,
      });
    } catch (error) {
      console.error("Error adding activity entry:", error);
    }
  }, [user, patientId]);

  const recordPatientCreated = React.useCallback(async () => {
    await addActivity('created');
  }, [addActivity]);

  const recordFieldUpdate = React.useCallback(async (fieldName: string) => {
    await addActivity('updated', { fieldName });
  }, [addActivity]);

  const recordAssignment = React.useCallback(async (assignedTo: string) => {
    await addActivity('assigned', { summary: assignedTo });
  }, [addActivity]);

  const recordExport = React.useCallback(async (exportType: string) => {
    await addActivity('exported', { summary: exportType });
  }, [addActivity]);

  const recordAIUse = React.useCallback(async (action: string) => {
    await addActivity('ai_used', { summary: action });
  }, [addActivity]);

  return {
    activities,
    loading,
    fetchActivities,
    addActivity,
    recordPatientCreated,
    recordFieldUpdate,
    recordAssignment,
    recordExport,
    recordAIUse,
  };
};
