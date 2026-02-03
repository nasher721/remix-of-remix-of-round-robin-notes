import * as React from "react";
import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import {
  Dialog,
  DialogContent,
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
import {
  handleExportExcel,
  handleExportPDF,
  handleExportTXT,
  handleExportRTF,
  handleExportDOC,
} from "./print/ExportHandlers";

export interface PatientTodosMap {
  [patientId: string]: PatientTodo[];
}

interface PrintExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  patientTodos?: PatientTodosMap;
  onUpdatePatient?: (id: string, field: string, value: string) => void;
  totalPatientCount?: number;
  isFiltered?: boolean;
}

export const PrintExportModal = ({ open, onOpenChange, patients, patientTodos = {}, onUpdatePatient, totalPatientCount, isFiltered = false }: PrintExportModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [customCombinations, setCustomCombinations] = React.useState<CustomCombination[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<PrintTemplateType>('standard');
  const [templatePresets, setTemplatePresets] = React.useState<PrintTemplatePreset[]>([]);
  const [templatePresetName, setTemplatePresetName] = React.useState("");
  const [showLayoutDesigner, setShowLayoutDesigner] = React.useState(false);
  const [appliedLayout, setAppliedLayout] = React.useState<LayoutConfig | null>(null);
  const exportRef = React.useRef<HTMLDivElement | null>(null);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialSyncDone = React.useRef(false);

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
    localStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_PREFS, JSON.stringify(nextSettings.columns));
    localStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS, JSON.stringify(nextSettings.columnWidths));
    localStorage.setItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS, JSON.stringify(nextSettings.combinedColumns));
    localStorage.setItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS, JSON.stringify(nextSettings.combinedColumnWidths));
    localStorage.setItem(STORAGE_KEYS.PRINT_ORIENTATION, nextSettings.printOrientation);
    localStorage.setItem(STORAGE_KEYS.PRINT_FONT_SIZE, nextSettings.printFontSize.toString());
    localStorage.setItem(STORAGE_KEYS.PRINT_FONT_FAMILY, nextSettings.printFontFamily);
    localStorage.setItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE, nextSettings.onePatientPerPage.toString());
    localStorage.setItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE, nextSettings.autoFitFontSize.toString());
    localStorage.setItem('printMargins', nextSettings.margins);
    localStorage.setItem('printHeaderStyle', nextSettings.headerStyle);
    localStorage.setItem('printBorderStyle', nextSettings.borderStyle);
    localStorage.setItem('printShowPageNumbers', nextSettings.showPageNumbers.toString());
    localStorage.setItem('printShowTimestamp', nextSettings.showTimestamp.toString());
    localStorage.setItem('printAlternateRowColors', nextSettings.alternateRowColors.toString());
    localStorage.setItem('printCompactMode', nextSettings.compactMode.toString());
  }, []);

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
      await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            print_settings: payloadJson,
          },
          { onConflict: 'user_id' }
        );
    } catch (err) {
      console.error('Failed to sync print settings:', err);
    }
  }, [user]);

  const [patientNotes] = React.useState<Record<string, string>>({});

  // Initialize from LocalStorage + sync with DB
  React.useEffect(() => {
    const loadFromLocalStorage = () => {
      const savedCols = localStorage.getItem(STORAGE_KEYS.PRINT_COLUMN_PREFS);
      const savedWidths = localStorage.getItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS);
      const savedCombined = localStorage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS);
      const savedCombinedWidths = localStorage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS);
      const savedCustomCombinations = localStorage.getItem(STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS);
      const savedTemplatePresets = localStorage.getItem(STORAGE_KEYS.PRINT_TEMPLATE_PRESETS);

      const mergedSettings = mergeStoredSettings({
        columns: savedCols ? JSON.parse(savedCols) : undefined,
        columnWidths: savedWidths ? JSON.parse(savedWidths) : undefined,
        combinedColumns: savedCombined ? JSON.parse(savedCombined) : undefined,
        combinedColumnWidths: savedCombinedWidths ? JSON.parse(savedCombinedWidths) : undefined,
        printOrientation: (localStorage.getItem(STORAGE_KEYS.PRINT_ORIENTATION) as 'portrait' | 'landscape') || defaultSettings.printOrientation,
        printFontSize: parseInt(localStorage.getItem(STORAGE_KEYS.PRINT_FONT_SIZE) || `${defaultSettings.printFontSize}`, 10),
        printFontFamily: localStorage.getItem(STORAGE_KEYS.PRINT_FONT_FAMILY) || defaultSettings.printFontFamily,
        onePatientPerPage: localStorage.getItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE) === 'true',
        autoFitFontSize: localStorage.getItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE) === 'true',
        margins: (localStorage.getItem('printMargins') as 'narrow' | 'normal' | 'wide') || defaultSettings.margins,
        headerStyle: (localStorage.getItem('printHeaderStyle') as 'minimal' | 'standard' | 'detailed') || defaultSettings.headerStyle,
        borderStyle: (localStorage.getItem('printBorderStyle') as 'none' | 'light' | 'medium' | 'heavy') || defaultSettings.borderStyle,
        showPageNumbers: localStorage.getItem('printShowPageNumbers') !== 'false',
        showTimestamp: localStorage.getItem('printShowTimestamp') !== 'false',
        alternateRowColors: localStorage.getItem('printAlternateRowColors') !== 'false',
        compactMode: localStorage.getItem('printCompactMode') === 'true',
      });

      setSettings(mergedSettings);

      if (savedCustomCombinations) {
        setCustomCombinations(JSON.parse(savedCustomCombinations));
      }

      if (savedTemplatePresets) {
        setTemplatePresets(JSON.parse(savedTemplatePresets));
      }

      const savedTemplateId = localStorage.getItem(STORAGE_KEYS.PRINT_SELECTED_TEMPLATE_ID);
      if (savedTemplateId) {
        setSelectedTemplateId(savedTemplateId as PrintTemplateType);
      }

      return {
        settings: mergedSettings,
        customCombinations: savedCustomCombinations ? JSON.parse(savedCustomCombinations) : [],
        templatePresets: savedTemplatePresets ? JSON.parse(savedTemplatePresets) : [],
        selectedTemplateId: savedTemplateId as PrintTemplateType | null,
      };
    };

    const loadSettings = async () => {
      const localData = loadFromLocalStorage();
      if (!user || !open || initialSyncDone.current) return;

      try {
        const { data } = await supabase
          .from('user_settings')
          .select('print_settings')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.print_settings) {
          const dbSettings = data.print_settings as {
            settings?: Partial<PrintSettingsType>;
            customCombinations?: CustomCombination[];
            templatePresets?: PrintTemplatePreset[];
            selectedTemplateId?: PrintTemplateType;
          };
          const mergedSettings = mergeStoredSettings(dbSettings.settings);
          setSettings(mergedSettings);
          syncSettingsToLocalStorage(mergedSettings);

          if (dbSettings.customCombinations) {
            setCustomCombinations(dbSettings.customCombinations);
            localStorage.setItem(
              STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS,
              JSON.stringify(dbSettings.customCombinations)
            );
          }

          if (dbSettings.templatePresets) {
            setTemplatePresets(dbSettings.templatePresets);
            localStorage.setItem(
              STORAGE_KEYS.PRINT_TEMPLATE_PRESETS,
              JSON.stringify(dbSettings.templatePresets)
            );
          }

          if (dbSettings.selectedTemplateId) {
            setSelectedTemplateId(dbSettings.selectedTemplateId);
            localStorage.setItem(STORAGE_KEYS.PRINT_SELECTED_TEMPLATE_ID, dbSettings.selectedTemplateId);
          }
        } else if (localData) {
          await syncPrintSettingsToDb({
            settings: localData.settings,
            customCombinations: localData.customCombinations,
            templatePresets: localData.templatePresets,
            selectedTemplateId: localData.selectedTemplateId ?? selectedTemplateId,
          });
        }
        initialSyncDone.current = true;
      } catch (err) {
        console.error('Failed to load print settings from DB:', err);
      }
    };

    if (open) {
      loadSettings();
    }
  }, [open, user, mergeStoredSettings, syncSettingsToLocalStorage, syncPrintSettingsToDb, defaultSettings, selectedTemplateId]);

  React.useEffect(() => {
    if (!user || !initialSyncDone.current) return;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      syncPrintSettingsToDb(buildPrintPayload());
    }, 1000);
  }, [settings, customCombinations, templatePresets, selectedTemplateId, user, buildPrintPayload, syncPrintSettingsToDb]);

  React.useEffect(() => {
    if (!user) {
      initialSyncDone.current = false;
    }
  }, [user]);

  React.useEffect(() => {
    const { marginMm } = getPageMetrics(settings);
    const styleId = "print-page-style";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: A4 ${settings.printOrientation}; margin: 0; }`;
    document.documentElement.style.setProperty("--print-page-margin", `${marginMm}mm`);
  }, [settings]);

  React.useEffect(() => {
    syncSettingsToLocalStorage(settings);
  }, [settings, syncSettingsToLocalStorage]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_SELECTED_TEMPLATE_ID, selectedTemplateId);
  }, [selectedTemplateId]);

  const handleUpdateSettings = (newSettings: Partial<PrintSettingsType>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      // Save changes to localStorage
      if (newSettings.printOrientation !== undefined) localStorage.setItem('printOrientation', newSettings.printOrientation);
      if (newSettings.printFontSize !== undefined) localStorage.setItem('printFontSize', newSettings.printFontSize.toString());
      if (newSettings.printFontFamily !== undefined) localStorage.setItem('printFontFamily', newSettings.printFontFamily);
      if (newSettings.onePatientPerPage !== undefined) localStorage.setItem('printOnePatientPerPage', newSettings.onePatientPerPage.toString());
      if (newSettings.autoFitFontSize !== undefined) localStorage.setItem('printAutoFitFontSize', newSettings.autoFitFontSize.toString());
      if (newSettings.margins !== undefined) localStorage.setItem('printMargins', newSettings.margins);
      if (newSettings.headerStyle !== undefined) localStorage.setItem('printHeaderStyle', newSettings.headerStyle);
      if (newSettings.borderStyle !== undefined) localStorage.setItem('printBorderStyle', newSettings.borderStyle);
      if (newSettings.showPageNumbers !== undefined) localStorage.setItem('printShowPageNumbers', newSettings.showPageNumbers.toString());
      if (newSettings.showTimestamp !== undefined) localStorage.setItem('printShowTimestamp', newSettings.showTimestamp.toString());
      if (newSettings.alternateRowColors !== undefined) localStorage.setItem('printAlternateRowColors', newSettings.alternateRowColors.toString());
      if (newSettings.compactMode !== undefined) localStorage.setItem('printCompactMode', newSettings.compactMode.toString());
      if (newSettings.combinedColumnWidths !== undefined) {
        localStorage.setItem('printCombinedColumnWidths', JSON.stringify(newSettings.combinedColumnWidths));
      }

      return updated;
    });
  };

  const handleUpdateColumns = (newColumns: ColumnConfig[]) => {
    setSettings(prev => ({ ...prev, columns: newColumns }));
    localStorage.setItem('printColumnPrefs', JSON.stringify(newColumns));
  };

  const applyTemplateSettings = React.useCallback((template: ReturnType<typeof getTemplateById>) => {
    if (!template) return;

    // Map template sections to columns
    const newColumns = settings.columns.map(col => {
      const templateSection = template.sections.find(s => s.key === col.key);
      if (templateSection) {
        return { ...col, enabled: templateSection.enabled };
      }
      return { ...col, enabled: false };
    });

    handleUpdateColumns(newColumns);

    // Update other settings
    setSettings(prev => ({
      ...prev,
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
    }));
  }, [handleUpdateColumns, settings.columns]);

  const handleApplyTemplate = (templateId: PrintTemplateType) => {
    const template = getTemplateById(templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    applyTemplateSettings(template);

    toast({ title: `Applied ${template.name} template` });
  };

  const handleResetColumns = () => {
    handleUpdateColumns(defaultColumns);
  };

  const handleToggleCombination = (combinationKey: string) => {
    setSettings(prev => {
      const current = prev.combinedColumns || [];
      const updated = current.includes(combinationKey)
        ? current.filter(k => k !== combinationKey)
        : [...current, combinationKey];
      localStorage.setItem('printCombinedColumns', JSON.stringify(updated));
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
      const updated = [...prev, preset];
      localStorage.setItem(STORAGE_KEYS.PRINT_TEMPLATE_PRESETS, JSON.stringify(updated));
      return updated;
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
      const updated = prev.filter(p => p.id !== presetId);
      localStorage.setItem(STORAGE_KEYS.PRINT_TEMPLATE_PRESETS, JSON.stringify(updated));
      return updated;
    });
    toast({ title: "Template preset removed" });
  };

  const handleAddCustomCombination = (combination: CustomCombination) => {
    setCustomCombinations(prev => {
      const updated = [...prev, combination];
      localStorage.setItem(STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS, JSON.stringify(updated));
      return updated;
    });
    toast({ title: "Custom combination created" });
  };

  const handleUpdateCustomCombination = (combination: CustomCombination) => {
    setCustomCombinations(prev => {
      const updated = prev.map(c => c.key === combination.key ? combination : c);
      localStorage.setItem(STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS, JSON.stringify(updated));
      return updated;
    });
    toast({ title: "Custom combination updated" });
  };

  const handleDeleteCustomCombination = (combinationKey: string) => {
    setCustomCombinations(prev => {
      const updated = prev.filter(c => c.key !== combinationKey);
      localStorage.setItem(STORAGE_KEYS.PRINT_CUSTOM_COMBINATIONS, JSON.stringify(updated));
      return updated;
    });
    // Also remove from active combinations if it was active
    setSettings(prev => {
      const updatedCombined = (prev.combinedColumns || []).filter(k => k !== combinationKey);
      localStorage.setItem('printCombinedColumns', JSON.stringify(updatedCombined));
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
  }), [patients, patientTodos, settings, isColumnEnabled, getPatientTodos, patientNotes, isFiltered, totalPatientCount]);

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

  const onExportWord = () => {
    try {
      const fileName = handleExportDOC(getExportContext());
      toast({ title: "Word Export Complete", description: fileName });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
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

  // If layout designer is open, show it fullscreen
  if (showLayoutDesigner) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] flex flex-col p-0 gap-0 top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] overflow-hidden">
          <LayoutDesigner
            onApplyLayout={handleApplyLayout}
            onClose={() => setShowLayoutDesigner(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] md:w-full h-[95vh] md:h-[90vh] max-h-[95vh] md:max-h-[90vh] flex flex-col p-0 gap-0 top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] overflow-hidden">
        <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Print & Export
              {appliedLayout && (
                <span className="text-xs font-normal text-muted-foreground ml-2 px-2 py-0.5 rounded bg-primary/10">
                  Using: {appliedLayout.name}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLayoutDesigner(true)}
                className="gap-1.5"
              >
                <LayoutTemplate className="h-4 w-4" />
                Layout Designer
              </Button>
              <PrintControls
                onPrint={handlePrint}
                onExportPDF={onExportPDF}
                onExportExcel={onExportExcel}
                onExportWord={onExportWord}
                onExportTXT={onExportTXT}
                onExportRTF={onExportRTF}
                isGenerating={isGenerating}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar - Settings (collapsible on mobile) */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r bg-muted/10 flex flex-col max-h-[40vh] md:max-h-none overflow-hidden flex-shrink-0">
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
                    <Button onClick={handleSaveTemplatePreset}>Save</Button>
                  </div>
                  {templatePresets.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No saved presets yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {templatePresets.map(preset => (
                        <div key={preset.id} className="flex items-center justify-between rounded-md border p-2">
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
          <div className="flex-1 bg-slate-100/50 p-3 md:p-6 min-h-0 overflow-hidden flex flex-col">
            <PrintPreview
              patients={patients}
              patientTodos={patientTodos}
              patientNotes={patientNotes}
              settings={settings}
            />
          </div>
        </div>
        <div className="print-export-sandbox" aria-hidden="true">
          <PrintDocument
            ref={exportRef}
            patients={patients}
            patientTodos={patientTodos}
            patientNotes={patientNotes}
            settings={settings}
            documentId="export"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
