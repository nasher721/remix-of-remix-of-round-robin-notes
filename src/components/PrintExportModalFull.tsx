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
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PrintSettings } from "./print/PrintSettings";
import { PrintControls } from "./print/PrintControls";
import { PrintPreview } from "./print/PrintPreview";
import { PrintTemplateSelector } from "./print/PrintTemplateSelector";
import type { PrintSettings as PrintSettingsType, ColumnConfig, CustomCombination } from "@/lib/print/types";
import { getTemplateById, PrintTemplateType } from "@/types/printTemplates";
import { defaultColumnWidths, defaultColumns } from "./print/constants";
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
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [customCombinations, setCustomCombinations] = React.useState<CustomCombination[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<PrintTemplateType>('standard');

  // Settings State
  const [settings, setSettings] = React.useState<PrintSettingsType>({
    columns: defaultColumns,
    combinedColumns: [],
    printOrientation: 'portrait',
    printFontSize: 9,
    printFontFamily: 'system',
    onePatientPerPage: false,
    autoFitFontSize: false,
    columnWidths: defaultColumnWidths,
    activeTab: 'table',
    showNotesColumn: false,
    showTodosColumn: true
  });

  const [patientNotes] = React.useState<Record<string, string>>({});

  // Initialize from LocalStorage
  React.useEffect(() => {
    const loadSettings = () => {
      const savedCols = localStorage.getItem('printColumnPrefs');
      const savedWidths = localStorage.getItem('printColumnWidths');
      const savedCombined = localStorage.getItem('printCombinedColumns');
      const savedCustomCombinations = localStorage.getItem('printCustomCombinations');

      setSettings(prev => ({
        ...prev,
        columns: savedCols ? JSON.parse(savedCols) : defaultColumns,
        columnWidths: savedWidths ? { ...defaultColumnWidths, ...JSON.parse(savedWidths) } : defaultColumnWidths,
        combinedColumns: savedCombined ? JSON.parse(savedCombined) : [],
        printOrientation: (localStorage.getItem('printOrientation') as 'portrait' | 'landscape') || 'portrait',
        printFontSize: parseInt(localStorage.getItem('printFontSize') || '9'),
        printFontFamily: localStorage.getItem('printFontFamily') || 'system',
        onePatientPerPage: localStorage.getItem('printOnePatientPerPage') === 'true',
        autoFitFontSize: localStorage.getItem('printAutoFitFontSize') === 'true',
      }));

      if (savedCustomCombinations) {
        setCustomCombinations(JSON.parse(savedCustomCombinations));
      }
    };
    loadSettings();
  }, [open]);

  const handleUpdateSettings = (newSettings: Partial<PrintSettingsType>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      // Save changes to localStorage
      if (newSettings.printOrientation) localStorage.setItem('printOrientation', newSettings.printOrientation);
      if (newSettings.printFontSize) localStorage.setItem('printFontSize', newSettings.printFontSize.toString());
      if (newSettings.printFontFamily) localStorage.setItem('printFontFamily', newSettings.printFontFamily);
      if (newSettings.onePatientPerPage !== undefined) localStorage.setItem('printOnePatientPerPage', newSettings.onePatientPerPage.toString());
      if (newSettings.autoFitFontSize !== undefined) localStorage.setItem('printAutoFitFontSize', newSettings.autoFitFontSize.toString());

      return updated;
    });
  };

  const handleUpdateColumns = (newColumns: ColumnConfig[]) => {
    setSettings(prev => ({ ...prev, columns: newColumns }));
    localStorage.setItem('printColumnPrefs', JSON.stringify(newColumns));
  };

  const handleApplyTemplate = (templateId: PrintTemplateType) => {
    const template = getTemplateById(templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);

    // Map template sections to columns
    const newColumns = settings.columns.map(col => {
      // Find matching section in template

      const templateSection = template.sections.find(s => s.key === col.key);
      if (templateSection) {
        return { ...col, enabled: templateSection.enabled };
      }

      // If column exists in settings but not in template explicitly, disable it by default for cleaner view
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
      // Map viewType to activeTab
      activeTab: template.layout.viewType,
    }));

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

  const handleAddCustomCombination = (combination: CustomCombination) => {
    setCustomCombinations(prev => {
      const updated = [...prev, combination];
      localStorage.setItem('printCustomCombinations', JSON.stringify(updated));
      return updated;
    });
    toast({ title: "Custom combination created" });
  };

  const handleUpdateCustomCombination = (combination: CustomCombination) => {
    setCustomCombinations(prev => {
      const updated = prev.map(c => c.key === combination.key ? combination : c);
      localStorage.setItem('printCustomCombinations', JSON.stringify(updated));
      return updated;
    });
    toast({ title: "Custom combination updated" });
  };

  const handleDeleteCustomCombination = (combinationKey: string) => {
    setCustomCombinations(prev => {
      const updated = prev.filter(c => c.key !== combinationKey);
      localStorage.setItem('printCustomCombinations', JSON.stringify(updated));
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
    printOrientation: settings.printOrientation,
    onePatientPerPage: settings.onePatientPerPage,
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

  const onExportPDF = async () => {
    setIsGenerating(true);
    try {
      const fileName = handleExportPDF(getExportContext());
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] md:w-full h-[95vh] md:h-[90vh] max-h-[95vh] md:max-h-[90vh] flex flex-col p-0 gap-0 top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] overflow-hidden">
        <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Print & Export
            </DialogTitle>
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
      </DialogContent>
    </Dialog>
  );
};
