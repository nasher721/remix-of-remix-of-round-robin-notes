import * as React from "react";
import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import { SYSTEM_LABELS_SHORT, SYSTEM_KEYS } from "@/constants/systems";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PrintSettings } from "./print/PrintSettings";
import { PrintControls } from "./print/PrintControls";
import { PrintPreview } from "./print/PrintPreview";
import { PrintTemplateSelector } from "./print/PrintTemplateSelector";
import type { PrintSettings as PrintSettingsType, ColumnConfig, ColumnWidthsType, CustomCombination } from "@/lib/print/types";
import { getTemplateById, PrintTemplateType } from "@/types/printTemplates";

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

const systemLabels = SYSTEM_LABELS_SHORT;
const systemKeys = SYSTEM_KEYS;

import { defaultColumnWidths, defaultColumns } from "./print/constants";
// Use exported defaults if possible, but keep local overrides if needed.
// Actually, let's just use the imported one.


// Strip HTML tags for exports
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

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

  // --- Export Handlers (Legacy Logic Wrapper) ---
  // In a real refactor, these would move to src/lib/print/generators

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    setIsGenerating(true);
    try {
      // Dynamically import html2pdf.js
      const html2pdf = (await import('html2pdf.js')).default;

      // Get the preview element to convert to PDF
      const previewElement = document.querySelector('[data-print-preview]') as HTMLElement;

      if (!previewElement) {
        throw new Error('Print preview element not found');
      }

      // Configure html2pdf options
      const opt = {
        margin: settings.printOrientation === 'landscape' ? [10, 10, 10, 10] as [number, number, number, number] : [15, 10, 15, 10] as [number, number, number, number],
        filename: `patient-rounding-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: settings.printOrientation
        },
        pagebreak: {
          mode: settings.onePatientPerPage ? 'avoid-all' : ['css', 'legacy'],
          before: settings.onePatientPerPage ? '.patient-card' : undefined
        }
      };

      // Generate PDF from HTML
      await html2pdf().set(opt).from(previewElement).save();

      toast({ title: "PDF Export Complete" });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportExcel = () => {
    // Placeholder for Excel logic
    toast({ title: "Excel Export Started" });
  };

  const handleExportWord = () => {
    toast({ title: "Word Export Started" });
  };

  const handleExportTXT = () => {
    toast({ title: "TXT Export Started" });
  };

  const handleExportRTF = () => {
    toast({ title: "RTF Export Started" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-full h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Print & Export
            </DialogTitle>
            <PrintControls
              onPrint={handlePrint}
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
              onExportWord={handleExportWord}
              onExportTXT={handleExportTXT}
              onExportRTF={handleExportRTF}
              isGenerating={isGenerating}
            />
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Settings */}
          <div className="w-80 border-r bg-muted/10 flex flex-col">
            <Tabs defaultValue="settings" className="flex-1 flex flex-col">
              <div className="px-4 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
                  <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="settings" className="flex-1 overflow-y-auto p-4">
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

              <TabsContent value="templates" className="p-4 flex-1 overflow-y-auto">
                <PrintTemplateSelector
                  selectedTemplate={selectedTemplateId}
                  onSelectTemplate={handleApplyTemplate}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Main Content - Preview */}
          <div className="flex-1 bg-slate-100/50 p-6 overflow-hidden flex flex-col">
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
