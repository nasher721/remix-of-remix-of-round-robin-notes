import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, LayoutTemplate } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PrintSettings } from "./print/PrintSettings";
import { PrintControls } from "./print/PrintControls";
import { PrintPreview } from "./print/PrintPreview";
import { PrintTemplateSelector } from "./print/PrintTemplateSelector";
import { PrintDocument } from "./print/PrintDocument";
import { LayoutDesigner } from "./print/layoutDesigner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LayoutConfig } from "@/types/layoutDesigner";
import type { PrintSettings as PrintSettingsType, ColumnConfig, CustomCombination } from "@/lib/print/types";
import { getTemplateById, mergeTemplateCustomizations, PrintTemplatePreset, PrintTemplateType } from "@/types/printTemplates";
import { defaultColumnWidths, defaultColumns, defaultCombinedColumnWidths } from "./print/constants";
import { getPageMetrics } from "@/lib/print/layout";
import { STORAGE_KEYS } from "@/constants/config";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import type { PatientTodo } from "@/types/todo";
import {
  createScopedPrintStorage,
  getAuthenticatedPrintPayload,
  quarantineLegacyPrintPreferences,
} from "@/lib/print/preferences";
import {
  extractPatientImageObjectKeys,
  loadPatientImageSignedUrls,
} from "@/lib/patientImages";
import {
  handleExportExcel,
  handleExportPDF,
  handleExportTXT,
  handleExportRTF,
  handleExportDOC,
  handleExportMarkdown,
  generateExportFilename,
} from "./print/ExportHandlers";
import type { PrintExportModalProps, PatientTodosMap } from "./print/types";

export type { PrintExportModalProps, PatientTodosMap };

const EMPTY_PATIENT_IMAGE_URLS = new Map<string, string>();

interface PatientImagePrintState {
  ownerId: string | null;
  keySignature: string;
  signedUrls: Map<string, string>;
  loading: boolean;
}

const PrintExportModalForOwner = ({ open, onOpenChange, patients, patientTodos = {}, onUpdatePatient, totalPatientCount, isFiltered = false }: PrintExportModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const ownerId = user?.id ?? null;
  const printStorage = React.useMemo(() => createScopedPrintStorage(ownerId), [ownerId]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [customCombinations, setCustomCombinations] = React.useState<CustomCombination[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<PrintTemplateType>('standard');
  const [templatePresets, setTemplatePresets] = React.useState<PrintTemplatePreset[]>([]);
  const [templatePresetName, setTemplatePresetName] = React.useState("");
  const [showLayoutDesigner, setShowLayoutDesigner] = React.useState(false);
  const [appliedLayout, setAppliedLayout] = React.useState<LayoutConfig | null>(null);
  const exportRef = React.useRef<HTMLDivElement | null>(null);
  const syncTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSyncOwnerId = React.useRef<string | null | undefined>(undefined);
  const patientImageLoadGeneration = React.useRef(0);
  const [patientImagePrintState, setPatientImagePrintState] =
    React.useState<PatientImagePrintState>({
      ownerId: null,
      keySignature: "",
      signedUrls: EMPTY_PATIENT_IMAGE_URLS,
      loading: false,
    });

  const patientImageKeySignature = React.useMemo(() => {
    if (!user?.id) return "";
    const keys = new Set<string>();
    patients.forEach((patient) => {
      extractPatientImageObjectKeys(patient.imaging, user.id).forEach((key) => keys.add(key));
    });
    return Array.from(keys).sort().join("\n");
  }, [patients, user?.id]);

  React.useEffect(() => {
    const generation = ++patientImageLoadGeneration.current;
    const ownerId = user?.id;
    if (!open || !ownerId || !patientImageKeySignature) {
      setPatientImagePrintState({
        ownerId: open ? ownerId ?? null : null,
        keySignature: patientImageKeySignature,
        signedUrls: EMPTY_PATIENT_IMAGE_URLS,
        loading: false,
      });
      return;
    }

    setPatientImagePrintState({
      ownerId,
      keySignature: patientImageKeySignature,
      signedUrls: EMPTY_PATIENT_IMAGE_URLS,
      loading: true,
    });

    void loadPatientImageSignedUrls(patients, ownerId)
      .then((result) => {
        if (patientImageLoadGeneration.current !== generation) return;
        setPatientImagePrintState({
          ownerId,
          keySignature: patientImageKeySignature,
          signedUrls: result.signedUrls,
          loading: false,
        });
      })
      .catch(() => {
        if (patientImageLoadGeneration.current !== generation) return;
        setPatientImagePrintState({
          ownerId,
          keySignature: patientImageKeySignature,
          signedUrls: EMPTY_PATIENT_IMAGE_URLS,
          loading: false,
        });
      });

    return () => {
      if (patientImageLoadGeneration.current === generation) {
        patientImageLoadGeneration.current += 1;
      }
    };
  }, [open, patientImageKeySignature, patients, user?.id]);

  const patientImageStateMatchesView =
    patientImagePrintState.ownerId === (user?.id ?? null) &&
    patientImagePrintState.keySignature === patientImageKeySignature;
  const patientImageSignedUrls = patientImageStateMatchesView
    ? patientImagePrintState.signedUrls
    : EMPTY_PATIENT_IMAGE_URLS;
  const patientImagesLoading = Boolean(
    open &&
      patientImageKeySignature &&
      (!patientImageStateMatchesView || patientImagePrintState.loading),
  );

  // Settings State
  const defaultSettings = React.useMemo<PrintSettingsType>(() => ({
    columns: defaultColumns,
    combinedColumns: [],
    printOrientation: 'portrait',
    printFontSize: 9,
    printFontFamily: 'system',
    onePatientPerPage: false,
    autoFitFontSize: false,
    columnWidths: defaultColumnWidths,
    combinedColumnWidths: defaultCombinedColumnWidths,
    margins: 'normal',
    headerStyle: 'standard',
    borderStyle: 'light',
    showPageNumbers: true,
    showTimestamp: true,
    alternateRowColors: true,
    compactMode: false,
    activeTab: 'table',
    showNotesColumn: false,
    showTodosColumn: true
  }), []);

  const [settings, setSettings] = React.useState<PrintSettingsType>(defaultSettings);

  const mergeStoredSettings = React.useCallback((stored?: Partial<PrintSettingsType>): PrintSettingsType => ({
    ...defaultSettings,
    ...stored,
    columns: stored?.columns ?? defaultSettings.columns,
    combinedColumns: stored?.combinedColumns ?? [],
    columnWidths: { ...defaultColumnWidths, ...(stored?.columnWidths ?? {}) },
    combinedColumnWidths: { ...defaultCombinedColumnWidths, ...(stored?.combinedColumnWidths ?? {}) },
  }), [defaultSettings]);

  const syncSettingsToLocalStorage = React.useCallback((nextSettings: PrintSettingsType) => {
    printStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_PREFS, JSON.stringify(nextSettings.columns));
    printStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS, JSON.stringify(nextSettings.columnWidths));
    printStorage.setItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS, JSON.stringify(nextSettings.combinedColumns));
    printStorage.setItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS, JSON.stringify(nextSettings.combinedColumnWidths));
    printStorage.setItem(STORAGE_KEYS.PRINT_ORIENTATION, nextSettings.printOrientation);
    printStorage.setItem(STORAGE_KEYS.PRINT_FONT_SIZE, nextSettings.printFontSize.toString());
    printStorage.setItem(STORAGE_KEYS.PRINT_FONT_FAMILY, nextSettings.printFontFamily);
    printStorage.setItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE, nextSettings.onePatientPerPage.toString());
    printStorage.setItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE, nextSettings.autoFitFontSize.toString());
    printStorage.setItem('printMargins', nextSettings.margins);
    printStorage.setItem('printHeaderStyle', nextSettings.headerStyle);
    printStorage.setItem('printBorderStyle', nextSettings.borderStyle);
    printStorage.setItem('printShowPageNumbers', nextSettings.showPageNumbers.toString());
    printStorage.setItem('printShowTimestamp', nextSettings.showTimestamp.toString());
    printStorage.setItem('printAlternateRowColors', nextSettings.alternateRowColors.toString());
    printStorage.setItem('printCompactMode', nextSettings.compactMode.toString());
  }, [printStorage]);

  const buildPrintPayload = React.useCallback(() => ({
    settings,
    customCombinations,
    templatePresets,
    selectedTemplateId,
  }), [settings, customCombinations, templatePresets, selectedTemplateId]);

  const syncPrintSettingsToDb = React.useCallback(async (payload: ReturnType<typeof buildPrintPayload>) => {
    if (!user) return;

    try {
      const payloadJson = JSON.parse(JSON.stringify(payload)) as Json;
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            print_settings: payloadJson,
          },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
    } catch {
      console.error('Failed to sync print settings');
    }
  }, [user]);

  const [patientNotes] = React.useState<Record<string, string>>({});

  // Authenticated settings are DB-authoritative. Local storage is only an
  // owner-scoped cache and is never used to initialize a newly signed-in user.
  React.useEffect(() => {
    if (!open || initialSyncOwnerId.current === ownerId) return;

    let cancelled = false;
    const defaultPayload = {
      settings: defaultSettings,
      customCombinations: [] as CustomCombination[],
      templatePresets: [] as PrintTemplatePreset[],
      selectedTemplateId: 'standard' as PrintTemplateType,
    };

    const parseStoredJson = <T,>(raw: string | null, fallback: T): T => {
      if (!raw) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    };

    const loadAnonymousPayload = () => {
      const savedCols = printStorage.getItem(STORAGE_KEYS.PRINT_COLUMN_PREFS);
      const savedWidths = printStorage.getItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS);
      const savedCombined = printStorage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS);
      const savedCombinedWidths = printStorage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS);

      return {
        settings: mergeStoredSettings({
          columns: parseStoredJson(savedCols, defaultSettings.columns),
          columnWidths: parseStoredJson(savedWidths, defaultSettings.columnWidths),
          combinedColumns: parseStoredJson(savedCombined, defaultSettings.combinedColumns),
          combinedColumnWidths: parseStoredJson(savedCombinedWidths, defaultSettings.combinedColumnWidths),
          printOrientation: (printStorage.getItem(STORAGE_KEYS.PRINT_ORIENTATION) as 'portrait' | 'landscape') || defaultSettings.printOrientation,
          printFontSize: parseInt(printStorage.getItem(STORAGE_KEYS.PRINT_FONT_SIZE) || `${defaultSettings.printFontSize}`, 10),
          printFontFamily: printStorage.getItem(STORAGE_KEYS.PRINT_FONT_FAMILY) || defaultSettings.printFontFamily,
          onePatientPerPage: printStorage.getItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE) === 'true',
          autoFitFontSize: printStorage.getItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE) === 'true',
          margins: (printStorage.getItem('printMargins') as 'narrow' | 'normal' | 'wide') || defaultSettings.margins,
          headerStyle: (printStorage.getItem('printHeaderStyle') as 'minimal' | 'standard' | 'detailed') || defaultSettings.headerStyle,
          borderStyle: (printStorage.getItem('printBorderStyle') as 'none' | 'light' | 'medium' | 'heavy') || defaultSettings.borderStyle,
          showPageNumbers: printStorage.getItem('printShowPageNumbers') !== 'false',
          showTimestamp: printStorage.getItem('printShowTimestamp') !== 'false',
          alternateRowColors: printStorage.getItem('printAlternateRowColors') !== 'false',
          compactMode: printStorage.getItem('printCompactMode') === 'true',
        }),
        customCombinations: parseStoredJson<CustomCombination[]>(
          printStorage.getItem(STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS),
          [],
        ),
        templatePresets: parseStoredJson<PrintTemplatePreset[]>(
          printStorage.getItem(STORAGE_KEYS.PRINT_TEMPLATE_PRESETS),
          [],
        ),
        selectedTemplateId:
          (printStorage.getItem(STORAGE_KEYS.PRINT_SELECTED_TEMPLATE_ID) as PrintTemplateType | null) ??
          defaultPayload.selectedTemplateId,
      };
    };

    const applyPayload = (payload: typeof defaultPayload) => {
      const nextSettings = mergeStoredSettings(payload.settings);
      const nextCombinations = Array.isArray(payload.customCombinations) ? payload.customCombinations : [];
      const nextPresets = Array.isArray(payload.templatePresets) ? payload.templatePresets : [];
      const nextTemplateId = payload.selectedTemplateId || defaultPayload.selectedTemplateId;

      setSettings(nextSettings);
      setCustomCombinations(nextCombinations);
      setTemplatePresets(nextPresets);
      setSelectedTemplateId(nextTemplateId);
    };

    const loadSettings = async () => {
      quarantineLegacyPrintPreferences();

      if (!user) {
        applyPayload(loadAnonymousPayload());
        initialSyncOwnerId.current = null;
        return;
      }

      // Hide any previous in-memory customization while this owner's row loads.
      applyPayload(defaultPayload);

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('print_settings')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;

        const databasePayload = data?.print_settings
          ? data.print_settings as unknown as typeof defaultPayload
          : undefined;
        const decision = getAuthenticatedPrintPayload(databasePayload, defaultPayload);
        applyPayload(decision.payload);
        initialSyncOwnerId.current = user.id;

        if (decision.shouldInitializeDatabase) {
          await syncPrintSettingsToDb(defaultPayload);
        }
      } catch {
        // Defaults remain visible, but no local value is promoted into the DB.
        console.error('Failed to load print settings from DB');
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [
    defaultSettings,
    mergeStoredSettings,
    open,
    ownerId,
    printStorage,
    syncPrintSettingsToDb,
    user,
  ]);

  React.useEffect(() => {
    if (!user || initialSyncOwnerId.current !== user.id) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(() => {
      void syncPrintSettingsToDb(buildPrintPayload());
    }, 1000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [user, buildPrintPayload, syncPrintSettingsToDb]);

  // Debounce the @page CSS update — orientation + margins rarely change rapidly,
  // and forcing a style recalc on every settings mutation causes layout jitter.
  const applyPageStyleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { printOrientation, margins } = settings;
  React.useEffect(() => {
    if (applyPageStyleRef.current) clearTimeout(applyPageStyleRef.current);
    applyPageStyleRef.current = setTimeout(() => {
      const { marginMm } = getPageMetrics({ printOrientation, margins } as typeof settings);
      const styleId = "print-page-style";
      let style = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        document.head.appendChild(style);
      }
      style.textContent = `@page { size: A4 ${printOrientation}; margin: 0; }`;
      document.documentElement.style.setProperty("--print-page-margin", `${marginMm}mm`);
    }, 150);
    return () => { if (applyPageStyleRef.current) clearTimeout(applyPageStyleRef.current); };
  }, [printOrientation, margins]);

  React.useEffect(() => {
    syncSettingsToLocalStorage(settings);
  }, [settings, syncSettingsToLocalStorage]);

  React.useEffect(() => {
    printStorage.setItem(STORAGE_KEYS.PRINT_SELECTED_TEMPLATE_ID, selectedTemplateId);
  }, [printStorage, selectedTemplateId]);

  React.useEffect(() => {
    printStorage.setItem(
      STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS,
      JSON.stringify(customCombinations),
    );
  }, [customCombinations, printStorage]);

  React.useEffect(() => {
    printStorage.setItem(STORAGE_KEYS.PRINT_TEMPLATE_PRESETS, JSON.stringify(templatePresets));
  }, [printStorage, templatePresets]);

  const handleUpdateSettings = React.useCallback((newSettings: Partial<PrintSettingsType>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const handleUpdateColumns = React.useCallback((newColumns: ColumnConfig[]) => {
    setSettings(prev => ({ ...prev, columns: newColumns }));
  }, []);

  // Single atomic setState — avoids the previous 2-render cascade
  // (handleUpdateColumns → re-render 1, then setSettings → re-render 2).
  const applyTemplateSettings = React.useCallback((template: ReturnType<typeof getTemplateById>) => {
    if (!template) return;

    setSettings(prev => {
      // Map template sections to column enabled state
      const newColumns = prev.columns.map(col => {
        const templateSection = template.sections.find(s => s.key === col.key);
        return templateSection
          ? { ...col, enabled: templateSection.enabled }
          : { ...col, enabled: false };
      });

      const updated = {
        ...prev,
        columns: newColumns,
        printOrientation: template.layout.orientation,
        printFontSize: template.styling.fontSize,
        printFontFamily: template.styling.fontFamily,
        onePatientPerPage: template.layout.patientsPerPage === 1,
        activeTab: template.layout.viewType,
        margins: template.layout.margins,
        headerStyle: template.layout.headerStyle,
        showPageNumbers: template.layout.showPageNumbers,
        showTimestamp: template.layout.showTimestamp,
        borderStyle: template.styling.borderStyle,
        alternateRowColors: template.styling.alternateRowColors,
        compactMode: template.styling.compactMode,
      };

      return updated;
    });
  }, []);

  const previewScrollRef = React.useRef<HTMLDivElement | null>(null);
  
  const handleApplyTemplate = React.useCallback((templateId: PrintTemplateType) => {
    const template = getTemplateById(templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    applyTemplateSettings(template);

    // Reset preview scroll position after applying template
    requestAnimationFrame(() => {
      const viewport = previewScrollRef.current?.querySelector<HTMLElement>(
        '[data-radix-scroll-area-viewport]'
      );
      if (viewport) {
        viewport.scrollTop = 0;
      }
    });

    toast({ title: `Applied ${template.name} template` });
  }, [applyTemplateSettings, toast]);

  const handleResetColumns = () => {
    handleUpdateColumns(defaultColumns);
  };

  const handleToggleCombination = (combinationKey: string) => {
    setSettings(prev => {
      const current = prev.combinedColumns || [];
      const updated = current.includes(combinationKey)
        ? current.filter(k => k !== combinationKey)
        : [...current, combinationKey];
      return { ...prev, combinedColumns: updated };
    });
  };

  const handleSaveTemplatePreset = () => {
    if (!templatePresetName.trim()) {
      toast({ title: "Preset name required", variant: "destructive" });
      return;
    }

    const baseTemplate = getTemplateById(selectedTemplateId);
    const now = new Date().toISOString();
    const preset: PrintTemplatePreset = {
      id: Date.now().toString(),
      name: templatePresetName.trim(),
      templateType: selectedTemplateId,
      customizations: {
        layout: {
          orientation: settings.printOrientation,
          margins: settings.margins,
          headerStyle: settings.headerStyle,
          showPageNumbers: settings.showPageNumbers,
          showTimestamp: settings.showTimestamp,
          viewType: settings.activeTab as 'cards' | 'list' | 'table',
          patientsPerPage: settings.onePatientPerPage ? 1 : 'auto',
          columns: baseTemplate?.layout.columns ?? 1,
        },
        styling: {
          fontSize: settings.printFontSize,
          fontFamily: settings.printFontFamily,
          headerColor: '#1a1a2e',
          accentColor: '#4361ee',
          borderStyle: settings.borderStyle,
          alternateRowColors: settings.alternateRowColors,
          compactMode: settings.compactMode,
        },
      },
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    setTemplatePresets(prev => {
      return [...prev, preset];
    });

    setTemplatePresetName("");
    toast({ title: "Template preset saved" });
  };

  const handleLoadTemplatePreset = (preset: PrintTemplatePreset) => {
    const baseTemplate = getTemplateById(preset.templateType);
    if (!baseTemplate) return;
    const mergedTemplate = mergeTemplateCustomizations(baseTemplate, preset.customizations);
    setSelectedTemplateId(preset.templateType);
    applyTemplateSettings(mergedTemplate);
    toast({ title: `Applied ${preset.name}` });
  };

  const handleDeleteTemplatePreset = (presetId: string) => {
    setTemplatePresets(prev => {
      return prev.filter(p => p.id !== presetId);
    });
    toast({ title: "Template preset removed" });
  };

  const handleAddCustomCombination = (combination: CustomCombination) => {
    setCustomCombinations(prev => {
      return [...prev, combination];
    });
    toast({ title: "Custom combination created" });
  };

  const handleUpdateCustomCombination = (combination: CustomCombination) => {
    setCustomCombinations(prev => {
      return prev.map(c => c.key === combination.key ? combination : c);
    });
    toast({ title: "Custom combination updated" });
  };

  const handleDeleteCustomCombination = (combinationKey: string) => {
    setCustomCombinations(prev => {
      return prev.filter(c => c.key !== combinationKey);
    });
    // Also remove from active combinations if it was active
    setSettings(prev => {
      const updatedCombined = (prev.combinedColumns || []).filter(k => k !== combinationKey);
      return { ...prev, combinedColumns: updatedCombined };
    });
    toast({ title: "Custom combination deleted" });
  };

  // --- Export Handlers ---
  const isColumnEnabled = React.useCallback((key: string): boolean => {
    return settings.columns.find(c => c.key === key)?.enabled ?? false;
  }, [settings.columns]);

  const getPatientTodos = React.useCallback((patientId: string): PatientTodo[] => {
    return patientTodos[patientId] || [];
  }, [patientTodos]);

  const getExportContext = React.useCallback(() => ({
    patients,
    patientTodos,
    columns: settings.columns,
    combinedColumns: settings.combinedColumns,
    columnWidths: settings.columnWidths,
    printFontSize: settings.printFontSize,
    printFontFamily: settings.printFontFamily,
    printOrientation: settings.printOrientation,
    onePatientPerPage: settings.onePatientPerPage,
    margins: settings.margins,
    isColumnEnabled,
    getPatientTodos,
    showNotesColumn: settings.showNotesColumn,
    showTodosColumn: settings.showTodosColumn,
    patientNotes,
    isFiltered,
    totalPatientCount,
    patientImageOwnerId: user?.id,
    patientImageSignedUrls,
  }), [patients, patientTodos, settings, isColumnEnabled, getPatientTodos, patientNotes, isFiltered, totalPatientCount, user?.id, patientImageSignedUrls]);

  const handlePrint = () => {
    window.print();
  };

  // Handle applying a layout from the designer
  const handleApplyLayout = React.useCallback((layout: LayoutConfig) => {
    setAppliedLayout(layout);

    // Convert layout sections to column config
    const newColumns = settings.columns.map(col => {
      const layoutSection = layout.sections.find(s => s.id === col.key || s.type === col.key);
      return {
        ...col,
        enabled: layoutSection?.enabled ?? col.enabled,
      };
    });

    // Update settings based on layout
    handleUpdateSettings({
      columns: newColumns,
      printOrientation: layout.pageSettings.orientation,
      printFontSize: layout.globalStyles.fontSize,
      printFontFamily: layout.globalStyles.fontFamily,
      onePatientPerPage: layout.pageSettings.onePatientPerPage,
      margins: typeof layout.pageSettings.margins === 'string'
        ? layout.pageSettings.margins
        : 'normal',
      headerStyle: layout.globalStyles.headerStyle === 'branded'
        ? 'detailed'
        : layout.globalStyles.headerStyle,
      borderStyle: layout.globalStyles.borderStyle,
      showPageNumbers: layout.pageSettings.showPageNumbers,
      showTimestamp: layout.pageSettings.showTimestamp,
      compactMode: layout.globalStyles.spacing === 'compact',
    });

    setShowLayoutDesigner(false);
    toast({
      title: 'Layout Applied',
      description: `"${layout.name}" layout has been applied to your export.`,
    });
  }, [settings.columns, handleUpdateSettings, toast]);

  const onExportPDF = async () => {
    setIsGenerating(true);
    try {
      const fileName = await handleExportPDF(getExportContext(), exportRef.current);
      toast({ title: "PDF Export Complete", description: fileName });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const onExportExcel = () => {
    try {
      const fileName = handleExportExcel(getExportContext());
      toast({ title: "Excel Export Complete", description: fileName });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  const onExportWord = async () => {
    setIsGenerating(true);
    try {
      const fileName = await handleExportDOC(getExportContext());
      toast({ title: "Word Export Complete", description: fileName });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const onExportTXT = () => {
    try {
      const fileName = handleExportTXT(getExportContext());
      toast({ title: "Text Export Complete", description: fileName });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  const onExportRTF = () => {
    try {
      const fileName = handleExportRTF(getExportContext());
      toast({ title: "RTF Export Complete", description: fileName });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  const onExportMarkdown = () => {
    try {
      const fileName = handleExportMarkdown(getExportContext());
      toast({ title: "Markdown Export Complete", description: fileName });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  // If layout designer is open, show it fullscreen
  if (showLayoutDesigner) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] flex flex-col p-0 gap-0 top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Print layout designer</DialogTitle>
            <DialogDescription>
              Arrange sections and columns for printed patient lists. Use drag and drop to reorder.
            </DialogDescription>
          </DialogHeader>
          <LayoutDesigner
            storageOwnerId={ownerId}
            onApplyLayout={handleApplyLayout}
            onClose={() => setShowLayoutDesigner(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] md:w-full h-[95vh] md:h-[90vh] max-h-[95vh] md:max-h-[90vh] flex flex-col p-0 gap-0 top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-2xl border-0 shadow-2xl bg-background/95 backdrop-blur-xl">
        <DialogHeader className="px-5 md:px-6 py-4 pr-14 md:pr-16 border-b border-border/30 flex-shrink-0 bg-gradient-to-b from-muted/20 to-transparent">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2 min-w-0">
            <DialogTitle className="flex items-center gap-2.5 min-w-0 shrink text-lg font-semibold tracking-tight">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Printer className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              </div>
              Print & Export
              {appliedLayout && (
                <span className="text-xs font-normal text-muted-foreground ml-2 px-2 py-0.5 rounded bg-primary/10">
                  Using: {appliedLayout.name}
                </span>
              )}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full justify-end sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowLayoutDesigner(true)}
                className="gap-1.5 shrink-0"
              >
                <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
                Layout Designer
              </Button>
              <PrintControls
                onPrint={handlePrint}
                onExportPDF={onExportPDF}
                onExportExcel={onExportExcel}
                onExportWord={onExportWord}
                onExportTXT={onExportTXT}
                onExportRTF={onExportRTF}
                onExportMarkdown={onExportMarkdown}
                isGenerating={isGenerating || patientImagesLoading}
              />
            </div>
          </div>
          <DialogDescription className="sr-only">
            Configure columns and export patient lists to PDF, Excel, or other formats.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar - Settings (scrollable; cap height on small screens so preview keeps space) */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r bg-muted/5 flex flex-col min-h-0 max-h-[min(42vh,320px)] md:max-h-none overflow-hidden flex-shrink-0">
            <Tabs defaultValue="settings" className="flex-1 flex flex-col min-h-0">
              <div className="px-4 pt-3 md:pt-4 flex-shrink-0">
                <TabsList className="w-full">
                  <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
                  <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="settings" className="flex-1 overflow-y-auto p-4 min-h-0">
                <PrintSettings
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onUpdateColumns={handleUpdateColumns}
                  onResetColumns={handleResetColumns}
                  onToggleCombination={handleToggleCombination}
                  customCombinations={customCombinations}
                  onAddCustomCombination={handleAddCustomCombination}
                  onUpdateCustomCombination={handleUpdateCustomCombination}
                  onDeleteCustomCombination={handleDeleteCustomCombination}
                />
              </TabsContent>

              <TabsContent value="templates" className="p-4 flex-1 overflow-y-auto min-h-0">
                <PrintTemplateSelector
                  selectedTemplate={selectedTemplateId}
                  onSelectTemplate={handleApplyTemplate}
                />
                <div className="mt-6 space-y-3">
                  <h4 className="text-sm font-semibold">Template Presets</h4>
                  <div className="flex gap-2">
                    <Input
                      value={templatePresetName}
                      onChange={(e) => setTemplatePresetName(e.target.value)}
                      placeholder="Preset name"
                    />
                    <Button 
                      onClick={handleSaveTemplatePreset}
                      disabled={!templatePresetName.trim()}
                    >Save</Button>
                  </div>
                  {templatePresets.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No saved presets yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {templatePresets.map(preset => (
                        <div key={preset.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                          <div>
                            <div className="text-sm font-medium">{preset.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Template: {preset.templateType}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleLoadTemplatePreset(preset)}>
                              Apply
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteTemplatePreset(preset.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Main Content - Preview */}
          <div ref={previewScrollRef} className="flex-1 bg-slate-100/50 p-3 md:p-6 min-h-0 overflow-hidden flex flex-col">
            <PrintPreview
              patients={patients}
              patientTodos={patientTodos}
              patientNotes={patientNotes}
              patientImageOwnerId={user?.id}
              patientImageSignedUrls={patientImageSignedUrls}
              settings={settings}
              onViewModeChange={(mode) => handleUpdateSettings({ activeTab: mode })}
            />
          </div>
        </div>
        <div
          className="print-export-sandbox"
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-100000px",
            top: 0,
            width: "210mm",
            pointerEvents: "none",
          }}
        >
          <PrintDocument
            ref={exportRef}
            patients={patients}
            patientTodos={patientTodos}
            patientNotes={patientNotes}
            patientImageOwnerId={user?.id}
            patientImageSignedUrls={patientImageSignedUrls}
            settings={settings}
            documentId="export"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Remount all in-memory print state when the authenticated owner changes. */
export const PrintExportModal = (props: PrintExportModalProps) => {
  const { user } = useAuth();
  return <PrintExportModalForOwner key={user?.id ?? 'anonymous'} {...props} />;
};
