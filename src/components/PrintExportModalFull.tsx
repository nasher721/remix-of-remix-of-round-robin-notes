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
import type { PrintSettings as PrintSettingsType, ColumnConfig, ColumnWidthsType, CustomCombination } from "@/lib/print/types";

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

const defaultColumns: ColumnConfig[] = [
  { key: "patient", label: "Patient/Bed", enabled: true },
  { key: "clinicalSummary", label: "Clinical Summary", enabled: true },
  { key: "intervalEvents", label: "Interval Events", enabled: true },
  { key: "imaging", label: "Imaging", enabled: true },
  { key: "labs", label: "Labs", enabled: true },
  ...systemKeys.map(key => ({ key: `systems.${key}`, label: systemLabels[key], enabled: true })),
  { key: "todos", label: "Todos", enabled: true },
  { key: "notes", label: "Notes (blank for rounding)", enabled: false },
];

const defaultColumnWidths: ColumnWidthsType = {
  patient: 100,
  summary: 150,
  events: 150,
  imaging: 120,
  labs: 120,
  notes: 140,
  'systems.neuro': 90,
  'systems.cv': 90,
  'systems.resp': 90,
  'systems.renalGU': 90,
  'systems.gi': 90,
  'systems.endo': 90,
  'systems.heme': 90,
  'systems.infectious': 90,
  'systems.skinLines': 90,
  'systems.dispo': 90,
};

// Strip HTML tags for exports
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

export const PrintExportModal = ({ open, onOpenChange, patients, patientTodos = {}, onUpdatePatient, totalPatientCount, isFiltered = false }: PrintExportModalProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [customCombinations, setCustomCombinations] = React.useState<CustomCombination[]>([]);

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
      const doc = new jsPDF({
        orientation: settings.printOrientation,
        unit: 'mm',
        format: 'a4'
      });

      // Basic PDF Generation Logic (Ported minimal version for now)
      doc.setFontSize(16);
      doc.text("Patient Rounding Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

      // Very basic table for now to prove structure
      const headers = settings.columns.filter(c => c.enabled).map(c => c.label);
      const data = patients.map(p => settings.columns.filter(c => c.enabled).map(c => {
        if (c.key === 'patient') return p.name || 'Unnamed';
        if (c.key.startsWith('systems.')) {
          const key = c.key.replace('systems.', '') as keyof typeof p.systems;
          return stripHtml(p.systems[key] || '');
        }
        return stripHtml((p as any)[c.key] || '');
      }));

      autoTable(doc, {
        head: [headers],
        body: data,
        startY: 30,
        styles: { fontSize: 8 }
      });

      doc.save(`patient-rounding-${new Date().toISOString().split('T')[0]}.pdf`);
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
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print & Export
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Settings */}
          <div className="w-80 border-r bg-muted/10 flex flex-col">
            <div className="p-4 border-b">
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

            <Tabs defaultValue="settings" className="flex-1 flex flex-col">
              <div className="px-4 pt-2">
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

              <TabsContent value="templates" className="p-4">
                <div className="text-sm text-muted-foreground text-center py-8">
                  No templates saved yet.
                </div>
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
