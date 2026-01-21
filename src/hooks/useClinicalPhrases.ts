import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { withRetry } from '@/lib/fetchWithRetry';
import type { 
  ClinicalPhrase, 
  PhraseField, 
  PhraseFolder, 
  PhraseVersion,
  ContextTriggers,
  FieldOption,
  FieldValidation,
  ConditionalLogic,
  PatientDataSource
} from '@/types/phrases';

// DB to UI mappers
const mapFolder = (row: Record<string, unknown>): PhraseFolder => ({
  id: row.id as string,
  userId: row.user_id as string,
  teamId: row.team_id as string | null,
  parentId: row.parent_id as string | null,
  name: row.name as string,
  description: row.description as string | null,
  icon: row.icon as string || 'folder',
  sortOrder: row.sort_order as number || 0,
  isShared: row.is_shared as boolean || false,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const mapPhrase = (row: Record<string, unknown>): ClinicalPhrase => ({
  id: row.id as string,
  userId: row.user_id as string,
  folderId: row.folder_id as string | null,
  name: row.name as string,
  description: row.description as string | null,
  content: row.content as string,
  shortcut: row.shortcut as string | null,
  hotkey: row.hotkey as string | null,
  contextTriggers: (row.context_triggers as ContextTriggers) || {},
  isActive: row.is_active as boolean ?? true,
  isShared: row.is_shared as boolean || false,
  usageCount: row.usage_count as number || 0,
  lastUsedAt: row.last_used_at as string | null,
  version: row.version as number || 1,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const mapField = (row: Record<string, unknown>): PhraseField => ({
  id: row.id as string,
  phraseId: row.phrase_id as string,
  fieldKey: row.field_key as string,
  fieldType: row.field_type as PhraseField['fieldType'],
  label: row.label as string,
  placeholder: row.placeholder as string | null,
  defaultValue: row.default_value as string | null,
  options: row.options as FieldOption[] | PatientDataSource | null,
  validation: row.validation as FieldValidation | null,
  conditionalLogic: row.conditional_logic as ConditionalLogic | null,
  calculationFormula: row.calculation_formula as string | null,
  sortOrder: row.sort_order as number || 0,
  createdAt: row.created_at as string,
});

const mapVersion = (row: Record<string, unknown>): PhraseVersion => ({
  id: row.id as string,
  phraseId: row.phrase_id as string,
  version: row.version as number,
  content: row.content as string,
  fieldsSnapshot: row.fields_snapshot as PhraseField[] | null,
  changedBy: row.changed_by as string | null,
  changeNote: row.change_note as string | null,
  createdAt: row.created_at as string,
});

export const useClinicalPhrases = () => {
  const [phrases, setPhrases] = useState<ClinicalPhrase[]>([]);
  const [folders, setFolders] = useState<PhraseFolder[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all phrases and folders with retry logic
  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPhrases([]);
        setFolders([]);
        setLoading(false);
        return;
      }

      const [phrasesRes, foldersRes] = await withRetry(async () => {
        const results = await Promise.all([
          supabase.from('clinical_phrases').select('*').order('name'),
          supabase.from('phrase_folders').select('*').order('sort_order'),
        ]);
        
        if (results[0].error) throw results[0].error;
        if (results[1].error) throw results[1].error;
        
        return results;
      }, { maxRetries: 3, baseDelay: 1000 });


      setPhrases((phrasesRes.data || []).map(mapPhrase));
      setFolders((foldersRes.data || []).map(mapFolder));
    } catch (error) {
      console.error('Error fetching phrases:', error);
      toast.error('Failed to load clinical phrases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get phrase by shortcut (for autotext expansion)
  const getPhraseByShortcut = useCallback((shortcut: string): ClinicalPhrase | undefined => {
    return phrases.find(p => p.shortcut === shortcut && p.isActive);
  }, [phrases]);

  // Get phrase by hotkey
  const getPhraseByHotkey = useCallback((hotkey: string): ClinicalPhrase | undefined => {
    return phrases.find(p => p.hotkey === hotkey && p.isActive);
  }, [phrases]);

  // Get phrases matching context
  const getPhrasesByContext = useCallback((context: {
    noteType?: string;
    section?: string;
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
  }): ClinicalPhrase[] => {
    return phrases.filter(p => {
      if (!p.isActive) return false;
      const triggers = p.contextTriggers;
      if (!triggers) return false;

      const matchesNoteType = !triggers.noteType?.length || 
        (context.noteType && triggers.noteType.includes(context.noteType));
      const matchesSection = !triggers.section?.length || 
        (context.section && triggers.section.includes(context.section));
      const matchesTime = !triggers.timeOfDay?.length || 
        (context.timeOfDay && triggers.timeOfDay.includes(context.timeOfDay));

      return matchesNoteType && matchesSection && matchesTime;
    });
  }, [phrases]);

  // Create a new phrase
  const createPhrase = useCallback(async (phrase: Omit<ClinicalPhrase, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'usageCount' | 'version'>): Promise<ClinicalPhrase | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return null;
      }

      const { data, error } = await supabase
        .from('clinical_phrases')
        .insert([{
          user_id: user.id,
          folder_id: phrase.folderId,
          name: phrase.name,
          description: phrase.description,
          content: phrase.content,
          shortcut: phrase.shortcut,
          hotkey: phrase.hotkey,
          context_triggers: JSON.parse(JSON.stringify(phrase.contextTriggers || {})),
          is_active: phrase.isActive ?? true,
          is_shared: phrase.isShared ?? false,
        }])
        .select()
        .single();

      if (error) throw error;

      const newPhrase = mapPhrase(data);
      setPhrases(prev => [...prev, newPhrase]);
      toast.success('Phrase created');
      return newPhrase;
    } catch (error) {
      console.error('Error creating phrase:', error);
      toast.error('Failed to create phrase');
      return null;
    }
  }, []);

  // Update a phrase
  const updatePhrase = useCallback(async (
    id: string, 
    updates: Partial<ClinicalPhrase>,
    saveVersion = true
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Get current phrase for version history
      const currentPhrase = phrases.find(p => p.id === id);
      if (!currentPhrase) return false;

      // Save version before updating
      if (saveVersion && updates.content && updates.content !== currentPhrase.content) {
        await supabase.from('phrase_versions').insert({
          phrase_id: id,
          version: currentPhrase.version,
          content: currentPhrase.content,
          changed_by: user.id,
        });
      }

      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.content !== undefined) {
        dbUpdates.content = updates.content;
        dbUpdates.version = currentPhrase.version + 1;
      }
      if (updates.shortcut !== undefined) dbUpdates.shortcut = updates.shortcut;
      if (updates.hotkey !== undefined) dbUpdates.hotkey = updates.hotkey;
      if (updates.contextTriggers !== undefined) dbUpdates.context_triggers = updates.contextTriggers;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.isShared !== undefined) dbUpdates.is_shared = updates.isShared;
      if (updates.folderId !== undefined) dbUpdates.folder_id = updates.folderId;

      const { error } = await supabase
        .from('clinical_phrases')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setPhrases(prev => prev.map(p => 
        p.id === id ? { ...p, ...updates, version: updates.content ? p.version + 1 : p.version } : p
      ));
      toast.success('Phrase updated');
      return true;
    } catch (error) {
      console.error('Error updating phrase:', error);
      toast.error('Failed to update phrase');
      return false;
    }
  }, [phrases]);

  // Delete a phrase
  const deletePhrase = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('clinical_phrases')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPhrases(prev => prev.filter(p => p.id !== id));
      toast.success('Phrase deleted');
      return true;
    } catch (error) {
      console.error('Error deleting phrase:', error);
      toast.error('Failed to delete phrase');
      return false;
    }
  }, []);

  // Get fields for a phrase
  const getPhraseFields = useCallback(async (phraseId: string): Promise<PhraseField[]> => {
    try {
      const { data, error } = await supabase
        .from('phrase_fields')
        .select('*')
        .eq('phrase_id', phraseId)
        .order('sort_order');

      if (error) throw error;
      return (data || []).map(mapField);
    } catch (error) {
      console.error('Error fetching phrase fields:', error);
      return [];
    }
  }, []);

  // Add field to phrase
  const addPhraseField = useCallback(async (field: Omit<PhraseField, 'id' | 'createdAt'>): Promise<PhraseField | null> => {
    try {
      const { data, error } = await supabase
        .from('phrase_fields')
        .insert([{
          phrase_id: field.phraseId,
          field_key: field.fieldKey,
          field_type: field.fieldType,
          label: field.label,
          placeholder: field.placeholder,
          default_value: field.defaultValue,
          options: field.options ? JSON.parse(JSON.stringify(field.options)) : null,
          validation: field.validation ? JSON.parse(JSON.stringify(field.validation)) : null,
          conditional_logic: field.conditionalLogic ? JSON.parse(JSON.stringify(field.conditionalLogic)) : null,
          calculation_formula: field.calculationFormula,
          sort_order: field.sortOrder,
        }])
        .select()
        .single();

      if (error) throw error;
      return mapField(data);
    } catch (error) {
      console.error('Error adding field:', error);
      toast.error('Failed to add field');
      return null;
    }
  }, []);

  // Update field
  const updatePhraseField = useCallback(async (id: string, updates: Partial<PhraseField>): Promise<boolean> => {
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.fieldKey !== undefined) dbUpdates.field_key = updates.fieldKey;
      if (updates.fieldType !== undefined) dbUpdates.field_type = updates.fieldType;
      if (updates.label !== undefined) dbUpdates.label = updates.label;
      if (updates.placeholder !== undefined) dbUpdates.placeholder = updates.placeholder;
      if (updates.defaultValue !== undefined) dbUpdates.default_value = updates.defaultValue;
      if (updates.options !== undefined) dbUpdates.options = updates.options;
      if (updates.validation !== undefined) dbUpdates.validation = updates.validation;
      if (updates.conditionalLogic !== undefined) dbUpdates.conditional_logic = updates.conditionalLogic;
      if (updates.calculationFormula !== undefined) dbUpdates.calculation_formula = updates.calculationFormula;
      if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

      const { error } = await supabase
        .from('phrase_fields')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating field:', error);
      return false;
    }
  }, []);

  // Delete field
  const deletePhraseField = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('phrase_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting field:', error);
      return false;
    }
  }, []);

  // Get version history
  const getPhraseVersions = useCallback(async (phraseId: string): Promise<PhraseVersion[]> => {
    try {
      const { data, error } = await supabase
        .from('phrase_versions')
        .select('*')
        .eq('phrase_id', phraseId)
        .order('version', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapVersion);
    } catch (error) {
      console.error('Error fetching versions:', error);
      return [];
    }
  }, []);

  // Restore to a version
  const restoreVersion = useCallback(async (phraseId: string, version: PhraseVersion): Promise<boolean> => {
    return updatePhrase(phraseId, {
      content: version.content,
    });
  }, [updatePhrase]);

  // Log phrase usage
  const logUsage = useCallback(async (
    phraseId: string,
    patientId?: string,
    targetField?: string,
    inputValues?: Record<string, unknown>,
    insertedContent?: string
  ): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update usage count
      await supabase
        .from('clinical_phrases')
        .update({ 
          usage_count: phrases.find(p => p.id === phraseId)?.usageCount ?? 0 + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', phraseId);

      // Log usage
      await supabase.from('phrase_usage_log').insert([{
        user_id: user.id,
        phrase_id: phraseId,
        patient_id: patientId,
        target_field: targetField,
        input_values: inputValues ? JSON.parse(JSON.stringify(inputValues)) : null,
        inserted_content: insertedContent,
      }]);

      // Update local state
      setPhrases(prev => prev.map(p => 
        p.id === phraseId
          ? { ...p, usageCount: p.usageCount + 1, lastUsedAt: new Date().toISOString() }
          : p
      ));
    } catch (error) {
      console.error('Error logging usage:', error);
    }
  }, [phrases]);

  // Folder operations
  const createFolder = useCallback(async (folder: Omit<PhraseFolder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<PhraseFolder | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('phrase_folders')
        .insert({
          user_id: user.id,
          team_id: folder.teamId,
          parent_id: folder.parentId,
          name: folder.name,
          description: folder.description,
          icon: folder.icon,
          sort_order: folder.sortOrder,
          is_shared: folder.isShared,
        })
        .select()
        .single();

      if (error) throw error;

      const newFolder = mapFolder(data);
      setFolders(prev => [...prev, newFolder]);
      toast.success('Folder created');
      return newFolder;
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
      return null;
    }
  }, []);

  const updateFolder = useCallback(async (id: string, updates: Partial<PhraseFolder>): Promise<boolean> => {
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
      if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
      if (updates.isShared !== undefined) dbUpdates.is_shared = updates.isShared;

      const { error } = await supabase
        .from('phrase_folders')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      return true;
    } catch (error) {
      console.error('Error updating folder:', error);
      return false;
    }
  }, []);

  const deleteFolder = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('phrase_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFolders(prev => prev.filter(f => f.id !== id));
      toast.success('Folder deleted');
      return true;
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
      return false;
    }
  }, []);

  // Build folder tree
  const getFolderTree = useCallback((): PhraseFolder[] => {
    const map = new Map<string, PhraseFolder>();
    const roots: PhraseFolder[] = [];

    folders.forEach(f => {
      map.set(f.id, { ...f, children: [] });
    });

    folders.forEach(f => {
      const folder = map.get(f.id)!;
      if (f.parentId && map.has(f.parentId)) {
        map.get(f.parentId)!.children!.push(folder);
      } else {
        roots.push(folder);
      }
    });

    return roots;
  }, [folders]);

  return {
    phrases,
    folders,
    loading,
    refetch: fetchData,
    // Phrase operations
    getPhraseByShortcut,
    getPhraseByHotkey,
    getPhrasesByContext,
    createPhrase,
    updatePhrase,
    deletePhrase,
    // Field operations
    getPhraseFields,
    addPhraseField,
    updatePhraseField,
    deletePhraseField,
    // Version operations
    getPhraseVersions,
    restoreVersion,
    // Usage tracking
    logUsage,
    // Folder operations
    createFolder,
    updateFolder,
    deleteFolder,
    getFolderTree,
  };
};
