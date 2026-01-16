import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface FieldHistoryEntry {
  id: string;
  patientId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export const useFieldHistory = (patientId: string) => {
  const [history, setHistory] = useState<FieldHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchHistory = useCallback(async (fieldName?: string) => {
    if (!user || !patientId) return;

    setLoading(true);
    try {
      let query = supabase
        .from("patient_field_history")
        .select("*")
        .eq("patient_id", patientId)
        .order("changed_at", { ascending: false })
        .limit(50);

      if (fieldName) {
        query = query.eq("field_name", fieldName);
      }

      const { data, error } = await query;

      if (error) throw error;

      setHistory(
        (data || []).map((entry) => ({
          id: entry.id,
          patientId: entry.patient_id,
          fieldName: entry.field_name,
          oldValue: entry.old_value,
          newValue: entry.new_value,
          changedAt: entry.changed_at,
        }))
      );
    } catch (error) {
      console.error("Error fetching field history:", error);
    } finally {
      setLoading(false);
    }
  }, [user, patientId]);

  const addHistoryEntry = useCallback(async (
    fieldName: string,
    oldValue: string | null,
    newValue: string | null
  ) => {
    if (!user || !patientId) return;

    // Don't record if values are the same
    if (oldValue === newValue) return;

    try {
      await supabase.from("patient_field_history").insert({
        patient_id: patientId,
        user_id: user.id,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
      });
    } catch (error) {
      console.error("Error adding history entry:", error);
    }
  }, [user, patientId]);

  const clearHistory = useCallback(async (fieldName?: string) => {
    if (!user || !patientId) return;

    try {
      let query = supabase
        .from("patient_field_history")
        .delete()
        .eq("patient_id", patientId);

      if (fieldName) {
        query = query.eq("field_name", fieldName);
      }

      await query;
      setHistory([]);
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  }, [user, patientId]);

  return {
    history,
    loading,
    fetchHistory,
    addHistoryEntry,
    clearHistory,
  };
};
