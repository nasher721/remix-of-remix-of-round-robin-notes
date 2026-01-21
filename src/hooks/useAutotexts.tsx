import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { defaultAutotexts, defaultTemplates } from "@/data/autotexts";
import type { AutoText, Template } from "@/types/autotext";
import { withRetry } from "@/lib/fetchWithRetry";

export const useCloudAutotexts = () => {
  const [autotexts, setAutotexts] = useState<AutoText[]>(defaultAutotexts);
  const [templates, setTemplates] = useState<Template[]>(defaultTemplates);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch custom autotexts and templates from database with retry logic
  const fetchData = useCallback(async () => {
    if (!user) {
      setAutotexts(defaultAutotexts);
      setTemplates(defaultTemplates);
      setLoading(false);
      return;
    }

    try {
      const [autotextsRes, templatesRes] = await withRetry(async () => {
        const results = await Promise.all([
          supabase.from("autotexts").select("*"),
          supabase.from("templates").select("*"),
        ]);
        
        if (results[0].error) throw results[0].error;
        if (results[1].error) throw results[1].error;
        
        return results;
      }, { maxRetries: 3, baseDelay: 1000 });

      // Merge custom autotexts with defaults
      const customAutotexts: AutoText[] = (autotextsRes.data || []).map((a) => ({
        shortcut: a.shortcut,
        expansion: a.expansion,
        category: a.category,
      }));
      
      // Remove defaults that have been overridden
      const customShortcuts = new Set(customAutotexts.map((a) => a.shortcut.toLowerCase()));
      const filteredDefaults = defaultAutotexts.filter(
        (a) => !customShortcuts.has(a.shortcut.toLowerCase())
      );
      
      setAutotexts([...filteredDefaults, ...customAutotexts]);

      // Merge custom templates with defaults
      const customTemplates: Template[] = (templatesRes.data || []).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        content: t.content,
      }));
      
      setTemplates([...defaultTemplates, ...customTemplates]);
    } catch (error) {
      console.error("Error fetching autotexts:", error);
      // Don't show toast on initial load failures, just use defaults
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addAutotext = useCallback(async (shortcut: string, expansion: string, category: string) => {
    if (!user) return false;

    // Check if exists
    const exists = autotexts.some((a) => a.shortcut.toLowerCase() === shortcut.toLowerCase());
    if (exists) {
      toast({
        title: "Shortcut exists",
        description: "This shortcut already exists.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase.from("autotexts").insert({
        user_id: user.id,
        shortcut: shortcut.toLowerCase(),
        expansion,
        category,
      });

      if (error) throw error;

      setAutotexts((prev) => [...prev, { shortcut: shortcut.toLowerCase(), expansion, category }]);
      toast({ title: "Autotext added" });
      return true;
    } catch (error) {
      console.error("Error adding autotext:", error);
      toast({
        title: "Error",
        description: "Failed to add autotext.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, autotexts, toast]);

  const removeAutotext = useCallback(async (shortcut: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("autotexts")
        .delete()
        .eq("shortcut", shortcut.toLowerCase())
        .eq("user_id", user.id);

      if (error) throw error;

      // If it was a custom one, just remove it. If it was a default, it will show again
      setAutotexts((prev) => {
        const isDefault = defaultAutotexts.some((a) => a.shortcut.toLowerCase() === shortcut.toLowerCase());
        if (isDefault) {
          // Restore default
          const defaultAuto = defaultAutotexts.find((a) => a.shortcut.toLowerCase() === shortcut.toLowerCase());
          return prev.map((a) => 
            a.shortcut.toLowerCase() === shortcut.toLowerCase() && defaultAuto ? defaultAuto : a
          );
        }
        return prev.filter((a) => a.shortcut.toLowerCase() !== shortcut.toLowerCase());
      });
      
      toast({ title: "Autotext removed" });
    } catch (error) {
      console.error("Error removing autotext:", error);
    }
  }, [user, toast]);

  const addTemplate = useCallback(async (name: string, content: string, category: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from("templates")
        .insert({
          user_id: user.id,
          name,
          content,
          category,
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates((prev) => [...prev, { id: data.id, name, content, category }]);
      toast({ title: "Template added" });
      return true;
    } catch (error) {
      console.error("Error adding template:", error);
      toast({
        title: "Error",
        description: "Failed to add template.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast]);

  const removeTemplate = useCallback(async (id: string) => {
    if (!user) return;

    // Check if it's a default template
    const isDefault = defaultTemplates.some((t) => t.id === id);
    if (isDefault) {
      toast({
        title: "Cannot remove",
        description: "Default templates cannot be removed.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "Template removed" });
    } catch (error) {
      console.error("Error removing template:", error);
    }
  }, [user, toast]);

  const getExpansion = useCallback((shortcut: string): string | null => {
    const autotext = autotexts.find((a) => a.shortcut.toLowerCase() === shortcut.toLowerCase());
    return autotext?.expansion || null;
  }, [autotexts]);

  return {
    autotexts,
    templates,
    loading,
    addAutotext,
    removeAutotext,
    addTemplate,
    removeTemplate,
    getExpansion,
    refetch: fetchData,
  };
};
