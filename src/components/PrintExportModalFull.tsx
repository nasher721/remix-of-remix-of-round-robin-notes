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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { LayoutConfig } from "@/types/layoutDesigner";
import type {
  PrintSettings as PrintSettingsType,
  ColumnConfig,
  CustomCombination,
  PrintFormat,
} from "@/lib/print/types";
import {
  DEFAULT_ROUNDS_SINGLE,
  DEFAULT_ROUNDS_TWO_COLUMN,
  ROUNDS_PAGE_SIZE_CSS,
  getRoundsPageMetrics,
  normalizeRoundsSettings,
  type RoundsSettings,
} from "@/lib/print/roundsTypes";
import { RoundsSettingsPanel } from "./print/RoundsSettingsPanel";
import { PrintFormatPicker, type PrintFormatChoice } from "./print/PrintFormatPicker";
import { getTemplateById, mergeTemplateCustomizations, PrintTemplatePreset, PrintTemplateType } from "@/types/printTemplates";
import { defaultColumns } from "./print/constants";
import {
  getPageCss,
  getPageMetrics,
} from "@/lib/print/layout";
import { useAuth } from "@/hooks/useAuth";
import type { PatientTodo } from "@/types/todo";
import { usePrintPreferences } from "@/hooks/usePrintPreferences";
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
import { printElement } from "@/lib/print/printElement";
import { downloadTwoColumnRoundsText } from "@/lib/print/twoColumnRoundsText";
import { downloadRoundsWordDocument } from "@/lib/print/roundsWordExport";

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
  const {
    settings, setSettings,
    customCombinations, setCustomCombinations,
    templatePresets, setTemplatePresets,
    selectedTemplateId, setSelectedTemplateId,
  } = usePrintPreferences(ownerId, open);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [templatePresetName, setTemplatePresetName] = React.useState("");
  const [showLayoutDesigner, setShowLayoutDesigner] = React.useState(false);
  const [appliedLayout, setAppliedLayout] = React.useState<LayoutConfig | null>(null);
  const exportRef = React.useRef<HTMLDivElement | null>(null);
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

  const [patientNotes] = React.useState<Record<string, string>>({});

  // Debounce the @page CSS update — page settings rarely change rapidly,
  // and forcing a style recalc on every settings mutation causes layout jitter.
  // This keeps native Ctrl+P (while the modal is open) consistent with the
  // selected paper size, orientation, and margins; printElement() also injects
  // the same rule itself for the modal-driven Print button.
  const applyPageStyleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { printOrientation, margins, paperSize, activeTab } = settings;
  const roundsSettings = React.useMemo(
    () => normalizeRoundsSettings(settings.rounds, settings.rounds?.variant ?? 'single'),
    [settings.rounds],
  );
  // The rounds document owns its own paper size, so `@page` has to follow the
  // active format — printing a Letter layout onto an A4 sheet reflows it.
  const isRoundsFormat = activeTab === 'rounds';
  const pageCss = isRoundsFormat
    ? `size: ${ROUNDS_PAGE_SIZE_CSS[roundsSettings.pageSize]} ${roundsSettings.orientation}; margin: 0;`
    : getPageCss({ printOrientation, margins, paperSize });
  const pageMarginMm = isRoundsFormat
    ? getRoundsPageMetrics(roundsSettings).marginMm
    : getPageMetrics({ printOrientation, margins, paperSize }).marginMm;
  React.useEffect(() => {
    if (applyPageStyleRef.current) clearTimeout(applyPageStyleRef.current);
    applyPageStyleRef.current = setTimeout(() => {
      const styleId = "print-page-style";
      let style = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        document.head.appendChild(style);
      }
      style.textContent = `@page { ${pageCss} }`;
      document.documentElement.style.setProperty("--print-page-margin", `${pageMarginMm}mm`);
    }, 150);
    return () => { if (applyPageStyleRef.current) clearTimeout(applyPageStyleRef.current); };
  }, [pageCss, pageMarginMm]);

  const handleUpdateSettings = React.useCallback((newSettings: Partial<PrintSettingsType>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, [setSettings]);

  const handleUpdateColumns = React.useCallback((newColumns: ColumnConfig[]) => {
    setSettings(prev => ({ ...prev, columns: newColumns }));
  }, [setSettings]);

  const handleUpdateRounds = React.useCallback((patch: Partial<RoundsSettings>) => {
    setSettings(prev => {
      const current = normalizeRoundsSettings(prev.rounds, prev.rounds?.variant ?? 'single');
      return { ...prev, rounds: normalizeRoundsSettings({ ...current, ...patch }, current.variant) };
    });
  }, [setSettings]);

  /**
   * Switching to a rounds variant seeds that variant's house defaults the first
   * time it is chosen, then preserves whatever the clinician tuned afterwards.
   */
  const handleSelectFormat = React.useCallback((choice: PrintFormatChoice) => {
    setSettings(prev => {
      if (choice.format !== 'rounds') {
        return { ...prev, activeTab: choice.format };
      }

      const current = prev.rounds
        ? normalizeRoundsSettings(prev.rounds, prev.rounds.variant)
        : null;

      if (current && current.variant === choice.variant) {
        return { ...prev, activeTab: 'rounds' };
      }

      const base =
        choice.variant === 'twoColumn' ? DEFAULT_ROUNDS_TWO_COLUMN : DEFAULT_ROUNDS_SINGLE;

      return {
        ...prev,
        activeTab: 'rounds',
        rounds: normalizeRoundsSettings(
          {
            ...base,
            // Section choices are the clinician's content decisions and survive
            // a switch between the one- and two-column variants.
            sections: current
              ? current.sections.map(section => ({ ...section }))
              : base.sections.map(section => ({ ...section })),
          },
          choice.variant,
        ),
      };
    });
  }, [setSettings]);

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
  }, [setSettings]);

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
  }, [applyTemplateSettings, setSelectedTemplateId, toast]);

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
    paperSize: settings.paperSize,
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
    physicianName: settings.physicianName,
    showPageNumbers: settings.showPageNumbers,
    showTimestamp: settings.showTimestamp,
    roundsDocument: isRoundsFormat
      ? { pageSize: roundsSettings.pageSize, orientation: roundsSettings.orientation }
      : undefined,
  }), [patients, patientTodos, settings, isColumnEnabled, getPatientTodos, patientNotes, isFiltered, totalPatientCount, user?.id, patientImageSignedUrls, isRoundsFormat, roundsSettings.pageSize, roundsSettings.orientation]);

  const handlePrint = () => {
    const pageStyle = getPageCss(settings);
    const title = settings.physicianName?.trim()
      ? `Patient Rounding Report — ${settings.physicianName.trim()}`
      : "Patient Rounding Report";

    void printElement(exportRef.current, { pageStyle, title })
      .then(() => {
        toast({ title: "Print complete", description: title });
      })
      .catch((error) => {
        console.error(error);
        toast({
          title: "Print Failed",
          description: error instanceof Error ? error.message : "The print report could not be prepared.",
          variant: "destructive",
        });
      });
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

  const onExportExcel = async () => {
    setIsGenerating(true);
    try {
      const fileName = await handleExportExcel(getExportContext());
      toast({ title: "Excel Export Complete", description: fileName });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const onExportWord = async () => {
    setIsGenerating(true);
    try {
      // Exports follow the previewed format: the rounds layout has its own
      // Word writer so paper size, columns and colour bars survive the round trip.
      const fileName = isRoundsFormat
        ? downloadRoundsWordDocument(patients, patientTodos, roundsSettings, settings.physicianName)
        : await handleExportDOC(getExportContext());
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

  const onExportTwoColumnText = () => {
    try {
      const fileName = downloadTwoColumnRoundsText(patients, patientTodos);
      toast({ title: "Two-Column Text Export Complete", description: fileName });
    } catch (error) {
      console.error(error);
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

  /** One-line description of what the current settings will actually print. */
  const formatSummary = isRoundsFormat
    ? [
        `Rounds · ${roundsSettings.variant === 'twoColumn' ? `${roundsSettings.columnCount}-column` : 'single column'}`,
        roundsSettings.pageSize === 'a4' ? 'A4' : roundsSettings.pageSize === 'legal' ? 'Legal' : 'Letter',
        roundsSettings.orientation,
        `${roundsSettings.bodyPt}pt`,
        roundsSettings.onePatientPerPage ? 'one patient per page' : 'continuous',
      ].join(' · ')
    : [
        settings.activeTab === 'cards' ? 'Cards' : settings.activeTab === 'list' ? 'List' : 'Table',
        'A4',
        settings.printOrientation,
        `${settings.printFontSize}pt`,
      ].join(' · ');

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
            <div className="min-w-0 shrink">
              <DialogTitle className="flex items-center gap-2.5 min-w-0 text-lg font-semibold tracking-tight">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Printer className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                </div>
                Print &amp; Export
              </DialogTitle>
              <p className="mt-0.5 truncate pl-[2.4rem] text-xs text-muted-foreground">
                {formatSummary}
                {appliedLayout ? ` · layout: ${appliedLayout.name}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full justify-end sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowLayoutDesigner(true)}
                className="gap-1.5 shrink-0"
              >
                <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden lg:inline">Layout Designer</span>
              </Button>
              <PrintControls
                onPrint={handlePrint}
                onExportPDF={onExportPDF}
                onExportExcel={onExportExcel}
                onExportWord={onExportWord}
                onExportTXT={onExportTXT}
                onExportRTF={onExportRTF}
                onExportMarkdown={onExportMarkdown}
                onExportTwoColumnText={onExportTwoColumnText}
                isGenerating={isGenerating || patientImagesLoading}
                filenamePreview={generateExportFilename('pdf', {
                  physicianName: settings.physicianName,
                  patientCount: patients.length,
                })}
              />
            </div>
          </div>
          <DialogDescription className="sr-only">
            Configure columns and export patient lists to PDF, Excel, or other formats.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar - Settings (scrollable; cap height on small screens so preview keeps space) */}
          <div className="w-full md:w-[21rem] border-b md:border-b-0 md:border-r bg-muted/5 flex flex-col min-h-0 max-h-[min(46vh,360px)] md:max-h-none overflow-hidden flex-shrink-0">
            <Tabs defaultValue="format" className="flex-1 flex flex-col min-h-0">
              <div className="px-4 pt-3 md:pt-4 flex-shrink-0">
                <TabsList className="w-full">
                  <TabsTrigger value="format" className="flex-1">Format</TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1">
                    {isRoundsFormat ? 'Rounds' : 'Columns'}
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="format" className="flex-1 overflow-y-auto p-4 min-h-0 space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Document format
                  </h4>
                  <PrintFormatPicker
                    format={settings.activeTab as PrintFormat}
                    roundsVariant={roundsSettings.variant}
                    onSelect={handleSelectFormat}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="print-team-name" className="text-xs font-medium">
                    Physician / team name
                  </Label>
                  <Input
                    id="print-team-name"
                    value={settings.physicianName || ''}
                    onChange={(event) => handleUpdateSettings({ physicianName: event.target.value })}
                    placeholder="e.g. Dr. Smith — ICU Team A"
                    className="h-8 text-xs"
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Printed in the document header when one is enabled.
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-background p-3 text-[11px] leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground">{patients.length}</span>
                  {' '}patient{patients.length === 1 ? '' : 's'} in this export
                  {isFiltered && totalPatientCount ? ` (filtered from ${totalPatientCount})` : ''}.
                </div>
              </TabsContent>

              <TabsContent value="settings" className="flex-1 overflow-y-auto p-4 min-h-0">
                {isRoundsFormat ? (
                  <RoundsSettingsPanel settings={roundsSettings} onChange={handleUpdateRounds} />
                ) : (
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
                )}
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
            // Rasterized exports read the sandbox's real width, so it has to
            // match the paper the active format targets.
            width: isRoundsFormat ? `${getRoundsPageMetrics(roundsSettings).widthMm}mm` : "210mm",
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
