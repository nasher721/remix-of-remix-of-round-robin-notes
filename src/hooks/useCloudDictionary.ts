import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export type DictionaryEntry = {
  misspelling: string;
  correction: string;
};

export const useCloudDictionary = () => {
  const [customDictionary, setCustomDictionary] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDictionary = useCallback(async () => {
    if (!user) {
      setCustomDictionary({});
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_dictionary")
        .select("misspelling, correction");

      if (error) throw error;

      const dict: Record<string, string> = {};
      (data || []).forEach((entry) => {
        dict[entry.misspelling.toLowerCase()] = entry.correction;
      });
      setCustomDictionary(dict);
    } catch (error) {
      console.error("Error fetching dictionary:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDictionary();
  }, [fetchDictionary]);

  const addEntry = useCallback(async (misspelling: string, correction: string) => {
    if (!user) return false;

    const key = misspelling.toLowerCase();
    
    try {
      const { error } = await supabase.from("user_dictionary").upsert({
        user_id: user.id,
        misspelling: key,
        correction,
      }, { onConflict: "user_id,misspelling" });

      if (error) throw error;

      setCustomDictionary((prev) => ({ ...prev, [key]: correction }));
      return true;
    } catch (error) {
      console.error("Error adding dictionary entry:", error);
      toast({
        title: "Error",
        description: "Failed to save dictionary entry.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast]);

  const removeEntry = useCallback(async (misspelling: string) => {
    if (!user) return;

    const key = misspelling.toLowerCase();

    try {
      const { error } = await supabase
        .from("user_dictionary")
        .delete()
        .eq("misspelling", key)
        .eq("user_id", user.id);

      if (error) throw error;

      setCustomDictionary((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    } catch (error) {
      console.error("Error removing dictionary entry:", error);
    }
  }, [user]);

  const importDictionary = useCallback(async (entries: Record<string, string>) => {
    if (!user) return false;

    try {
      const upsertData = Object.entries(entries).map(([misspelling, correction]) => ({
        user_id: user.id,
        misspelling: misspelling.toLowerCase(),
        correction,
      }));

      // Batch upsert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < upsertData.length; i += chunkSize) {
        const chunk = upsertData.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("user_dictionary")
          .upsert(chunk, { onConflict: "user_id,misspelling" });

        if (error) throw error;
      }

      // Refresh dictionary
      await fetchDictionary();
      toast({ title: "Dictionary imported", description: `${upsertData.length} entries saved.` });
      return true;
    } catch (error) {
      console.error("Error importing dictionary:", error);
      toast({
        title: "Error",
        description: "Failed to import dictionary.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast, fetchDictionary]);

  return {
    customDictionary,
    loading,
    addEntry,
    removeEntry,
    importDictionary,
    refetch: fetchDictionary,
  };
};
