import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import { SYSTEM_LABELS_SHORT, SYSTEM_KEYS } from "@/constants/systems";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Printer, 
  FileText, 
  Grid3X3, 
  List, 
  Maximize2, 
  Minimize2, 
  Edit3,
  FileSpreadsheet,
  Download,
  Settings2,
  ChevronDown,
  Columns,
  RotateCcw,
  GripVertical,
  Fullscreen,
  X,
  Type,
  CheckSquare,
  Square,
  Bookmark,
  Plus,
  Check
} from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface PatientTodosMap {
  [patientId: string]: PatientTodo[];
}

interface PrintExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  patientTodos?: PatientTodosMap;
  onUpdatePatient?: (id: string, field: string, value: string) => void;
}

const systemLabels = SYSTEM_LABELS_SHORT;
const systemKeys = SYSTEM_KEYS;

// All available columns for customization
interface ColumnConfig {
  key: string;
  label: string;
  enabled: boolean;
  combinedWith?: string; // Key of another column to combine with
}

// Column combination presets
interface ColumnCombination {
  key: string;
  label: string;
  columns: string[];
}

// All system column keys for the "Systems Review" combination
const allSystemColumnKeys = systemKeys.map(key => `systems.${key}`);

const columnCombinations: ColumnCombination[] = [
  { key: "summaryEvents", label: "Summary + Events", columns: ["clinicalSummary", "intervalEvents"] },
  { key: "imagingLabs", label: "Imaging + Labs", columns: ["imaging", "labs"] },
  { key: "allContent", label: "All Clinical Data", columns: ["clinicalSummary", "intervalEvents", "imaging", "labs"] },
  { key: "systemsReview", label: "Systems Review (All Systems)", columns: allSystemColumnKeys },
];

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

interface ExpandedCell {
  patientId: string;
  field: string;
}

// Column widths type - includes individual system columns
type ColumnWidthsType = {
  patient: number;
  summary: number;
  events: number;
  imaging: number;
  labs: number;
  notes: number;
  // Individual system widths
  'systems.neuro': number;
  'systems.cv': number;
  'systems.resp': number;
  'systems.renalGU': number;
  'systems.gi': number;
  'systems.endo': number;
  'systems.heme': number;
  'systems.infectious': number;
  'systems.skinLines': number;
  'systems.dispo': number;
};

// Custom print preset structure
interface PrintPreset {
  id: string;
  name: string;
  columns: ColumnConfig[];
  combinedColumns: string[];
  printOrientation: 'portrait' | 'landscape';
  printFontSize: number;
  printFontFamily: string;
  onePatientPerPage: boolean;
  autoFitFontSize: boolean;
  columnWidths: ColumnWidthsType;
  createdAt: string;
}

// Strip HTML tags for exports
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

// Clean inline font styles from HTML while preserving structure (bold, italic, lists, etc.)
const cleanInlineStyles = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Remove font-size and font-family from all elements
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach(el => {
    const element = el as HTMLElement;
    if (element.style) {
      element.style.fontSize = '';
      element.style.fontFamily = '';
      element.style.lineHeight = '';
      // Remove the style attribute if it's now empty
      if (element.getAttribute('style')?.trim() === '') {
        element.removeAttribute('style');
      }
    }
    // Remove font tags completely, keep content
    if (element.tagName === 'FONT') {
      const parent = element.parentNode;
      while (element.firstChild) {
        parent?.insertBefore(element.firstChild, element);
      }
      parent?.removeChild(element);
    }
  });
  
  return doc.body.innerHTML;
};

export const PrintExportModal = ({ open, onOpenChange, patients, patientTodos = {}, onUpdatePatient }: PrintExportModalProps) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fullPreviewRef = useRef<HTMLDivElement>(null);
  const [expandedCell, setExpandedCell] = useState<ExpandedCell | null>(null);
  const [editingCell, setEditingCell] = useState<ExpandedCell | null>(null);
  const [editValue, setEditValue] = useState("");
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
  const [columnWidths, setColumnWidths] = useState<ColumnWidthsType>(() => {
    const saved = localStorage.getItem('printColumnWidths');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultColumnWidths, ...parsed };
      } catch {
        return defaultColumnWidths;
      }
    }
    return defaultColumnWidths;
  });
  const [columnWidthsOpen, setColumnWidthsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('printColumnPrefs');
    if (saved) {
      try {
        const savedCols = JSON.parse(saved) as ColumnConfig[];
        // Merge saved preferences with defaults (in case new columns were added)
        return defaultColumns.map(col => {
          const savedCol = savedCols.find(s => s.key === col.key);
          return savedCol ? { ...col, enabled: savedCol.enabled } : col;
        });
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });
  const [patientNotes] = useState<Record<string, string>>({});
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [resizing, setResizing] = useState<{ column: string; startX: number; startWidth: number } | null>(null);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("table");
  const [printFontSize, setPrintFontSize] = useState(() => {
    const saved = localStorage.getItem('printFontSize');
    return saved ? parseInt(saved, 10) : 9;
  });
  const [printFontFamily, setPrintFontFamily] = useState(() => {
    return localStorage.getItem('printFontFamily') || 'system';
  });
  const [typographyOpen, setTypographyOpen] = useState(false);
  const [onePatientPerPage, setOnePatientPerPage] = useState(() => {
    return localStorage.getItem('printOnePatientPerPage') === 'true';
  });
  const [autoFitFontSize, setAutoFitFontSize] = useState(() => {
    return localStorage.getItem('printAutoFitFontSize') === 'true';
  });
  const [combinedColumns, setCombinedColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('printCombinedColumns');
    return saved ? JSON.parse(saved) : [];
  });
  const [systemsReviewColumnCount, setSystemsReviewColumnCount] = useState<number>(() => {
    const saved = localStorage.getItem('printSystemsReviewColumnCount');
    return saved ? parseInt(saved, 10) : 2;
  });
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>(() => {
    return (localStorage.getItem('printOrientation') as 'portrait' | 'landscape') || 'portrait';
  });
  
  // Custom presets state
  const [customPresets, setCustomPresets] = useState<PrintPreset[]>(() => {
    const saved = localStorage.getItem('printCustomPresets');
    return saved ? JSON.parse(saved) : [];
  });
  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  
  const { toast } = useToast();

  // Save one patient per page preference
  useEffect(() => {
    localStorage.setItem('printOnePatientPerPage', onePatientPerPage.toString());
  }, [onePatientPerPage]);

  // Save auto-fit preference
  useEffect(() => {
    localStorage.setItem('printAutoFitFontSize', autoFitFontSize.toString());
  }, [autoFitFontSize]);

  // Save combined columns preference
  useEffect(() => {
    localStorage.setItem('printCombinedColumns', JSON.stringify(combinedColumns));
  }, [combinedColumns]);

  // Save systems review column count preference
  useEffect(() => {
    localStorage.setItem('printSystemsReviewColumnCount', systemsReviewColumnCount.toString());
  }, [systemsReviewColumnCount]);

  // Save print orientation preference
  useEffect(() => {
    localStorage.setItem('printOrientation', printOrientation);
  }, [printOrientation]);

  // Save custom presets
  useEffect(() => {
    localStorage.setItem('printCustomPresets', JSON.stringify(customPresets));
  }, [customPresets]);

  // Save current settings as a preset
  const saveCurrentAsPreset = useCallback(() => {
    if (!newPresetName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your preset.",
        variant: "destructive"
      });
      return;
    }
    
    const preset: PrintPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      columns: columns,
      combinedColumns: combinedColumns,
      printOrientation: printOrientation,
      printFontSize: printFontSize,
      printFontFamily: printFontFamily,
      onePatientPerPage: onePatientPerPage,
      autoFitFontSize: autoFitFontSize,
      columnWidths: columnWidths,
      createdAt: new Date().toISOString()
    };
    
    setCustomPresets(prev => [...prev, preset]);
    setNewPresetName('');
    setShowSavePreset(false);
    
    toast({
      title: "Preset saved",
      description: `"${preset.name}" has been saved for quick access.`
    });
  }, [newPresetName, columns, combinedColumns, printOrientation, printFontSize, printFontFamily, onePatientPerPage, autoFitFontSize, columnWidths, toast]);

  // Load a preset
  const loadPreset = useCallback((preset: PrintPreset) => {
    setColumns(preset.columns);
    setCombinedColumns(preset.combinedColumns);
    setPrintOrientation(preset.printOrientation);
    setPrintFontSize(preset.printFontSize);
    setPrintFontFamily(preset.printFontFamily);
    setOnePatientPerPage(preset.onePatientPerPage);
    setAutoFitFontSize(preset.autoFitFontSize);
    setColumnWidths(preset.columnWidths);
    
    toast({
      title: "Preset loaded",
      description: `"${preset.name}" settings applied.`
    });
  }, [toast]);

  // Delete a preset
  const deletePreset = useCallback((presetId: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== presetId));
    toast({
      title: "Preset deleted",
      description: "The preset has been removed."
    });
  }, [toast]);

  // Font family options
  const fontFamilies = [
    { value: 'system', label: 'System Default', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    { value: 'arial', label: 'Arial', css: "Arial, Helvetica, sans-serif" },
    { value: 'times', label: 'Times New Roman', css: "'Times New Roman', Times, serif" },
    { value: 'georgia', label: 'Georgia', css: "Georgia, 'Times New Roman', serif" },
    { value: 'courier', label: 'Courier New', css: "'Courier New', Courier, monospace" },
    { value: 'verdana', label: 'Verdana', css: "Verdana, Geneva, sans-serif" },
    { value: 'trebuchet', label: 'Trebuchet MS', css: "'Trebuchet MS', Helvetica, sans-serif" },
  ];

  const getFontFamilyCSS = () => fontFamilies.find(f => f.value === printFontFamily)?.css || fontFamilies[0].css;

  // Save typography preferences
  useEffect(() => {
    localStorage.setItem('printFontSize', printFontSize.toString());
    localStorage.setItem('printFontFamily', printFontFamily);
  }, [printFontSize, printFontFamily]);

  // Save column widths preference
  useEffect(() => {
    localStorage.setItem('printColumnWidths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  // Drag-to-resize handlers
  const handleResizeStart = useCallback((column: string, startWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing({ column, startX: e.clientX, startWidth });
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(50, Math.min(400, resizing.startWidth + diff));
    setColumnWidths(prev => ({ ...prev, [resizing.column]: newWidth } as ColumnWidthsType));
  }, [resizing]);

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);

  // Attach/detach mouse events for resizing
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  // ResizableHeader component with improved visual feedback
  const ResizableHeader = ({ 
    column, 
    width, 
    children, 
    className = "" 
  }: { 
    column: string; 
    width: number; 
    children: React.ReactNode; 
    className?: string;
  }) => (
    <th 
      className={cn(
        "border border-border p-2 text-left font-bold relative select-none group",
        resizing?.column === column && "bg-primary/80",
        className
      )}
      style={{ width }}
    >
      {children}
      <div
        className={cn(
          "absolute top-0 right-0 h-full w-4 cursor-col-resize flex items-center justify-center no-print transition-all",
          "hover:bg-white/30 group-hover:opacity-100 opacity-60",
          resizing?.column === column && "bg-white/40 opacity-100"
        )}
        onMouseDown={(e) => handleResizeStart(column, width, e)}
        title="Drag to resize column"
      >
        <GripVertical className="h-4 w-4 text-white/80" />
      </div>
    </th>
  );

  const showNotesColumn = columns.find(c => c.key === "notes")?.enabled ?? false;
  const showTodosColumn = columns.find(c => c.key === "todos")?.enabled ?? true;

  // Helper to get todos for a patient
  const getPatientTodos = (patientId: string) => patientTodos[patientId] || [];
  
  // Format todos for display
  const formatTodosForDisplay = (todos: PatientTodo[]) => {
    if (todos.length === 0) return '';
    return todos.map(t => `${t.completed ? '☑' : '☐'} ${t.content}`).join('\n');
  };
  
  const formatTodosHtml = (todos: PatientTodo[]) => {
    if (todos.length === 0) return '<span class="empty">No todos</span>';
    return `<ul class="todos-list">${todos.map(t => 
      `<li class="todo-item ${t.completed ? 'completed' : ''}">
        <span class="todo-checkbox">${t.completed ? '☑' : '☐'}</span>
        <span class="todo-content">${t.content}</span>
      </li>`
    ).join('')}</ul>`;
  };

  const isColumnEnabled = (key: string): boolean => {
    return columns.find(c => c.key === key)?.enabled ?? false;
  };

  // Calculate optimal font size for a patient based on content length
  const calculateOptimalFontSize = useCallback((patient: Patient): number => {
    // Estimate content length (characters)
    let totalContent = '';
    if (isColumnEnabled("clinicalSummary")) totalContent += stripHtml(patient.clinicalSummary);
    if (isColumnEnabled("intervalEvents")) totalContent += stripHtml(patient.intervalEvents);
    if (isColumnEnabled("imaging")) totalContent += stripHtml(patient.imaging);
    if (isColumnEnabled("labs")) totalContent += stripHtml(patient.labs);
    
    const enabledSystems = systemKeys.filter(key => isColumnEnabled(`systems.${key}`));
    enabledSystems.forEach(key => {
      totalContent += stripHtml(patient.systems[key as keyof typeof patient.systems]);
    });
    
    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      todos.forEach(t => totalContent += t.content);
    }
    
    const charCount = totalContent.length;
    
    // Landscape A4: ~900x600 usable pixels at 96dpi
    // Estimate: at 9px font, ~100 chars per line, ~50 lines per page = 5000 chars
    // Scale font based on content density
    const baseCapacity = activeTab === 'table' ? 2000 : 4000; // Table is denser
    const density = charCount / baseCapacity;
    
    // Map density to font size: more content = smaller font
    if (density <= 0.3) return 12;
    if (density <= 0.5) return 11;
    if (density <= 0.7) return 10;
    if (density <= 1.0) return 9;
    if (density <= 1.5) return 8;
    return 7; // Minimum font size
  }, [activeTab, showTodosColumn, isColumnEnabled]);

  // Get the global minimum font size across all patients (for consistent sizing)
  const getAutoFitGlobalFontSize = useCallback((): number => {
    if (!autoFitFontSize || !onePatientPerPage || patients.length === 0) {
      return printFontSize;
    }
    
    // Find the patient with most content and use that font size for all
    const fontSizes = patients.map(p => calculateOptimalFontSize(p));
    return Math.min(...fontSizes);
  }, [autoFitFontSize, onePatientPerPage, patients, printFontSize, calculateOptimalFontSize]);

  // Get effective font size (auto-calculated or manual)
  const getEffectiveFontSize = useCallback((): number => {
    if (autoFitFontSize && onePatientPerPage) {
      return getAutoFitGlobalFontSize();
    }
    return printFontSize;
  }, [autoFitFontSize, onePatientPerPage, getAutoFitGlobalFontSize, printFontSize]);

  const toggleColumn = (key: string) => {
    setColumns(prev => {
      const updated = prev.map(col => 
        col.key === key ? { ...col, enabled: !col.enabled } : col
      );
      localStorage.setItem('printColumnPrefs', JSON.stringify(updated));
      return updated;
    });
  };

  const selectAllColumns = () => {
    setColumns(prev => {
      const updated = prev.map(col => ({ ...col, enabled: true }));
      localStorage.setItem('printColumnPrefs', JSON.stringify(updated));
      return updated;
    });
  };

  const deselectAllColumns = () => {
    setColumns(prev => {
      const updated = prev.map(col => 
        col.key === "patient" ? col : { ...col, enabled: false }
      );
      localStorage.setItem('printColumnPrefs', JSON.stringify(updated));
      return updated;
    });
  };

  // Toggle column combination
  const toggleColumnCombination = (combinationKey: string) => {
    setCombinedColumns(prev => {
      if (prev.includes(combinationKey)) {
        return prev.filter(k => k !== combinationKey);
      } else {
        return [...prev, combinationKey];
      }
    });
  };

  // Check if a column is part of an active combination
  const isColumnCombined = (columnKey: string): string | null => {
    for (const combo of columnCombinations) {
      if (combinedColumns.includes(combo.key) && combo.columns.includes(columnKey)) {
        return combo.key;
      }
    }
    return null;
  };

  // Get combined content for a patient
  const getCombinedContent = (patient: Patient, combinationKey: string): string => {
    const combination = columnCombinations.find(c => c.key === combinationKey);
    if (!combination) return '';
    
    const sections: string[] = [];
    combination.columns.forEach(colKey => {
      const value = getCellValue(patient, colKey);
      if (value) {
        const label = columns.find(c => c.key === colKey)?.label || colKey;
        sections.push(`<div class="combined-section"><strong>${label}:</strong> ${cleanInlineStyles(value)}</div>`);
      }
    });
    
    return sections.join('');
  };

  const handleCellClick = (patientId: string, field: string) => {
    if (expandedCell?.patientId === patientId && expandedCell?.field === field) {
      setExpandedCell(null);
    } else {
      setExpandedCell({ patientId, field });
    }
  };

  const handleDoubleClick = (patientId: string, field: string, currentValue: string) => {
    if (!onUpdatePatient) return;
    setEditingCell({ patientId, field });
    setEditValue(currentValue || "");
  };

  const handleEditSave = () => {
    if (editingCell && onUpdatePatient) {
      onUpdatePatient(editingCell.patientId, editingCell.field, editValue);
    }
    setEditingCell(null);
    setEditValue("");
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const isExpanded = (patientId: string, field: string) => 
    expandedCell?.patientId === patientId && expandedCell?.field === field;

  const isEditing = (patientId: string, field: string) =>
    editingCell?.patientId === patientId && editingCell?.field === field;

  const getCellValue = (patient: Patient, field: string): string => {
    if (field === "clinicalSummary") return patient.clinicalSummary;
    if (field === "intervalEvents") return patient.intervalEvents;
    if (field === "imaging") return patient.imaging;
    if (field === "labs") return patient.labs;
    if (field === "notes") return patientNotes[patient.id] || "";
    if (field.startsWith("systems.")) {
      const systemKey = field.replace("systems.", "") as keyof typeof patient.systems;
      return patient.systems[systemKey];
    }
    return "";
  };


  const getEnabledSystemKeys = () => systemKeys.filter(key => isColumnEnabled(`systems.${key}`));

  // Export to Excel - respects column selection
  const handleExportExcel = () => {
    const data = patients.map(patient => {
      const row: Record<string, string> = {};
      
      if (isColumnEnabled("patient")) {
        row["Patient Name"] = patient.name || "Unnamed";
        row["Bed/Room"] = patient.bed;
      }
      if (isColumnEnabled("clinicalSummary")) {
        row["Clinical Summary"] = stripHtml(patient.clinicalSummary);
      }
      if (isColumnEnabled("intervalEvents")) {
        row["Interval Events"] = stripHtml(patient.intervalEvents);
      }
      if (isColumnEnabled("imaging")) {
        row["Imaging"] = stripHtml(patient.imaging);
      }
      if (isColumnEnabled("labs")) {
        row["Labs"] = stripHtml(patient.labs);
      }
      
      systemKeys.forEach(key => {
        if (isColumnEnabled(`systems.${key}`)) {
          row[systemLabels[key]] = stripHtml(patient.systems[key as keyof typeof patient.systems]);
        }
      });
      
      if (showTodosColumn) {
        const todos = getPatientTodos(patient.id);
        row["Todos"] = formatTodosForDisplay(todos);
      }
      
      if (isColumnEnabled("notes")) {
        row["Notes"] = patientNotes[patient.id] || "";
      }
      
      row["Created"] = new Date(patient.createdAt).toLocaleString();
      row["Last Modified"] = new Date(patient.lastModified).toLocaleString();
      
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Patient Rounding");
    
    const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Excel Export Complete",
      description: `Saved as ${fileName}`
    });
  };

  // Export to PDF - respects column selection
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Patient Rounding Report", 14, 15);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Total Patients: ${patients.length}`, 14, 27);

    // Build headers based on enabled columns
    const headers: string[] = [];
    if (isColumnEnabled("patient")) headers.push("Patient", "Bed");
    if (isColumnEnabled("clinicalSummary")) headers.push("Summary");
    if (isColumnEnabled("intervalEvents")) headers.push("Events");
    if (isColumnEnabled("imaging")) headers.push("Imaging");
    if (isColumnEnabled("labs")) headers.push("Labs");
    systemKeys.forEach(key => {
      if (isColumnEnabled(`systems.${key}`)) headers.push(systemLabels[key]);
    });
    if (showTodosColumn) headers.push("Todos");
    if (isColumnEnabled("notes")) headers.push("Notes");

    // Table data - show full text, let autoTable handle wrapping
    const tableData = patients.map(patient => {
      const row: string[] = [];
      
      if (isColumnEnabled("patient")) {
        row.push(patient.name || "Unnamed");
        row.push(patient.bed || "-");
      }
      if (isColumnEnabled("clinicalSummary")) {
        row.push(stripHtml(patient.clinicalSummary));
      }
      if (isColumnEnabled("intervalEvents")) {
        row.push(stripHtml(patient.intervalEvents));
      }
      if (isColumnEnabled("imaging")) {
        row.push(stripHtml(patient.imaging));
      }
      if (isColumnEnabled("labs")) {
        row.push(stripHtml(patient.labs));
      }
      systemKeys.forEach(key => {
        if (isColumnEnabled(`systems.${key}`)) {
          row.push(stripHtml(patient.systems[key as keyof typeof patient.systems]));
        }
      });
      if (showTodosColumn) {
        const todos = getPatientTodos(patient.id);
        row.push(formatTodosForDisplay(todos));
      }
      if (isColumnEnabled("notes")) {
        row.push(patientNotes[patient.id] || "");
      }
      
      return row;
    });

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 32,
      styles: {
        fontSize: 6,
        cellPadding: 2,
        overflow: 'linebreak',
        lineWidth: 0.1,
        cellWidth: 'wrap',
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 6
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        // Allow text to wrap in all columns
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 'auto' },
      },
      margin: { top: 32, left: 10, right: 10 },
      tableWidth: 'auto',
      showHead: 'everyPage',
      rowPageBreak: 'auto',
    });

    // Add detailed pages for each patient
    patients.forEach((patient, index) => {
      doc.addPage();
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${patient.name || "Unnamed Patient"}`, 14, 15);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Bed: ${patient.bed || "N/A"} | Patient ${index + 1} of ${patients.length}`, 14, 22);
      
      let yPos = 32;
      
      // Clinical Summary
      if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
        doc.setFont("helvetica", "bold");
        doc.text("Clinical Summary:", 14, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        const summaryLines = doc.splitTextToSize(stripHtml(patient.clinicalSummary), 270);
        doc.text(summaryLines, 14, yPos);
        yPos += summaryLines.length * 4 + 5;
      }
      
      // Interval Events
      if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
        doc.setFont("helvetica", "bold");
        doc.text("Interval Events:", 14, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        const eventsLines = doc.splitTextToSize(stripHtml(patient.intervalEvents), 270);
        doc.text(eventsLines, 14, yPos);
        yPos += eventsLines.length * 4 + 5;
      }
      
      // Imaging
      if (isColumnEnabled("imaging") && patient.imaging) {
        doc.setFont("helvetica", "bold");
        doc.text("Imaging:", 14, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        const imagingLines = doc.splitTextToSize(stripHtml(patient.imaging), 270);
        doc.text(imagingLines, 14, yPos);
        yPos += imagingLines.length * 4 + 5;
      }
      
      // Labs
      if (isColumnEnabled("labs") && patient.labs) {
        doc.setFont("helvetica", "bold");
        doc.text("Labs:", 14, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        const labsLines = doc.splitTextToSize(stripHtml(patient.labs), 270);
        doc.text(labsLines, 14, yPos);
        yPos += labsLines.length * 4 + 5;
      }
      
      // Systems
      const enabledSystems = getEnabledSystemKeys();
      if (enabledSystems.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("Systems Review:", 14, yPos);
        yPos += 5;
        
        enabledSystems.forEach(key => {
          const value = patient.systems[key as keyof typeof patient.systems];
          if (value) {
            doc.setFont("helvetica", "bold");
            doc.text(`${systemLabels[key]}:`, 14, yPos);
            doc.setFont("helvetica", "normal");
            const sysLines = doc.splitTextToSize(stripHtml(value), 250);
            doc.text(sysLines, 40, yPos);
            yPos += Math.max(sysLines.length * 4, 5) + 2;
            
            if (yPos > 190) {
              doc.addPage();
              yPos = 15;
            }
          }
        });
      }
      
      // Todos
      if (showTodosColumn) {
        const todos = getPatientTodos(patient.id);
        if (todos.length > 0) {
          if (yPos > 170) {
            doc.addPage();
            yPos = 15;
          }
          doc.setFont("helvetica", "bold");
          doc.text("Todos:", 14, yPos);
          yPos += 5;
          doc.setFont("helvetica", "normal");
          todos.forEach(todo => {
            const todoText = `${todo.completed ? '☑' : '☐'} ${todo.content}`;
            const todoLines = doc.splitTextToSize(todoText, 270);
            doc.text(todoLines, 14, yPos);
            yPos += todoLines.length * 4 + 2;
            
            if (yPos > 190) {
              doc.addPage();
              yPos = 15;
            }
          });
        }
      }
      
      // Notes
      if (isColumnEnabled("notes") && patientNotes[patient.id]) {
        if (yPos > 170) {
          doc.addPage();
          yPos = 15;
        }
        doc.setFont("helvetica", "bold");
        doc.text("Notes:", 14, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        const notesLines = doc.splitTextToSize(patientNotes[patient.id], 270);
        doc.text(notesLines, 14, yPos);
      }
    });

    const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    toast({
      title: "PDF Export Complete",
      description: `Saved as ${fileName}`
    });
  };

  // Export to TXT - plain text format
  const handleExportTXT = () => {
    let content = `PATIENT ROUNDING REPORT\n`;
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `Total Patients: ${patients.length}\n`;
    content += `${'='.repeat(60)}\n\n`;

    patients.forEach((patient, index) => {
      content += `${'─'.repeat(60)}\n`;
      content += `PATIENT ${index + 1}: ${patient.name || 'Unnamed'}\n`;
      content += `Bed/Room: ${patient.bed || 'N/A'}\n`;
      content += `${'─'.repeat(60)}\n\n`;

      if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
        content += `CLINICAL SUMMARY:\n${stripHtml(patient.clinicalSummary)}\n\n`;
      }
      if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
        content += `INTERVAL EVENTS:\n${stripHtml(patient.intervalEvents)}\n\n`;
      }
      if (isColumnEnabled("imaging") && patient.imaging) {
        content += `IMAGING:\n${stripHtml(patient.imaging)}\n\n`;
      }
      if (isColumnEnabled("labs") && patient.labs) {
        content += `LABS:\n${stripHtml(patient.labs)}\n\n`;
      }

      const enabledSystems = getEnabledSystemKeys();
      if (enabledSystems.length > 0) {
        content += `SYSTEMS REVIEW:\n`;
        enabledSystems.forEach(key => {
          const value = patient.systems[key as keyof typeof patient.systems];
          if (value) {
            content += `  ${systemLabels[key]}: ${stripHtml(value)}\n`;
          }
        });
        content += `\n`;
      }

      if (showTodosColumn) {
        const todos = getPatientTodos(patient.id);
        if (todos.length > 0) {
          content += `TODOS:\n`;
          todos.forEach(todo => {
            content += `  ${todo.completed ? '[x]' : '[ ]'} ${todo.content}\n`;
          });
          content += `\n`;
        }
      }

      if (isColumnEnabled("notes") && patientNotes[patient.id]) {
        content += `NOTES:\n${patientNotes[patient.id]}\n\n`;
      }

      content += `\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.txt`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Text Export Complete",
      description: `Saved as ${fileName}`
    });
  };

  // Export to RTF - Rich Text Format
  const handleExportRTF = () => {
    // RTF header with font table
    let rtf = `{\\rtf1\\ansi\\deff0\n`;
    rtf += `{\\fonttbl{\\f0\\fswiss Arial;}{\\f1\\fmodern Courier New;}}\n`;
    rtf += `{\\colortbl;\\red0\\green0\\blue0;\\red59\\green130\\blue246;\\red100\\green100\\blue100;}\n\n`;

    // Title
    rtf += `\\f0\\fs32\\b PATIENT ROUNDING REPORT\\b0\\par\n`;
    rtf += `\\fs20\\cf3 Generated: ${new Date().toLocaleString()}\\par\n`;
    rtf += `Total Patients: ${patients.length}\\cf1\\par\n`;
    rtf += `\\line\n`;

    patients.forEach((patient, index) => {
      // Patient header
      rtf += `\\pard\\sb200\\sa100\\brdrb\\brdrs\\brdrw10\\brsp20\n`;
      rtf += `\\fs28\\b\\cf2 Patient ${index + 1}: ${escapeRTF(patient.name || 'Unnamed')}\\cf1\\b0\\par\n`;
      rtf += `\\fs20 Bed/Room: ${escapeRTF(patient.bed || 'N/A')}\\par\n`;
      rtf += `\\pard\\sa100\n`;

      if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
        rtf += `\\fs22\\b Clinical Summary:\\b0\\par\n`;
        rtf += `\\fs20 ${escapeRTF(stripHtml(patient.clinicalSummary))}\\par\\par\n`;
      }
      if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
        rtf += `\\fs22\\b Interval Events:\\b0\\par\n`;
        rtf += `\\fs20 ${escapeRTF(stripHtml(patient.intervalEvents))}\\par\\par\n`;
      }
      if (isColumnEnabled("imaging") && patient.imaging) {
        rtf += `\\fs22\\b Imaging:\\b0\\par\n`;
        rtf += `\\fs20 ${escapeRTF(stripHtml(patient.imaging))}\\par\\par\n`;
      }
      if (isColumnEnabled("labs") && patient.labs) {
        rtf += `\\fs22\\b Labs:\\b0\\par\n`;
        rtf += `\\fs20 ${escapeRTF(stripHtml(patient.labs))}\\par\\par\n`;
      }

      const enabledSystems = getEnabledSystemKeys();
      if (enabledSystems.length > 0) {
        rtf += `\\fs22\\b Systems Review:\\b0\\par\n`;
        enabledSystems.forEach(key => {
          const value = patient.systems[key as keyof typeof patient.systems];
          if (value) {
            rtf += `\\fs20\\b ${escapeRTF(systemLabels[key])}:\\b0  ${escapeRTF(stripHtml(value))}\\par\n`;
          }
        });
        rtf += `\\par\n`;
      }

      if (showTodosColumn) {
        const todos = getPatientTodos(patient.id);
        if (todos.length > 0) {
          rtf += `\\fs22\\b Todos:\\b0\\par\n`;
          todos.forEach(todo => {
            rtf += `\\fs20 ${todo.completed ? '[X]' : '[ ]'} ${escapeRTF(todo.content)}\\par\n`;
          });
          rtf += `\\par\n`;
        }
      }

      if (isColumnEnabled("notes") && patientNotes[patient.id]) {
        rtf += `\\fs22\\b Notes:\\b0\\par\n`;
        rtf += `\\fs20 ${escapeRTF(patientNotes[patient.id])}\\par\\par\n`;
      }

      rtf += `\\par\n`;
    });

    rtf += `}`;

    const blob = new Blob([rtf], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.rtf`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "RTF Export Complete",
      description: `Saved as ${fileName}`
    });
  };

  // Helper to escape RTF special characters
  const escapeRTF = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\n/g, '\\par\n');
  };

  // Export to DOC (Word-compatible HTML)
  const handleExportDOC = () => {
    const dateStr = new Date().toLocaleDateString();
    
    let html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Patient Rounding Report</title>
  <style>
    @page { margin: 1in; }
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
    h1 { color: #3b82f6; font-size: 18pt; margin-bottom: 5pt; }
    h2 { color: #3b82f6; font-size: 14pt; border-bottom: 2px solid #3b82f6; padding-bottom: 5pt; margin-top: 20pt; }
    h3 { font-size: 12pt; color: #333; margin-top: 10pt; margin-bottom: 5pt; }
    .meta { color: #666; font-size: 10pt; margin-bottom: 15pt; }
    .patient-card { border: 1px solid #ccc; margin: 15pt 0; padding: 10pt; page-break-inside: avoid; }
    .patient-header { background: #3b82f6; color: white; padding: 8pt; margin: -10pt -10pt 10pt -10pt; }
    .section { margin: 10pt 0; }
    .section-title { font-weight: bold; color: #333; }
    .todo-item { margin: 3pt 0; }
    .completed { text-decoration: line-through; color: #888; }
    table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
    th, td { border: 1px solid #ddd; padding: 5pt; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Patient Rounding Report</h1>
  <div class="meta">Generated: ${new Date().toLocaleString()} | Total Patients: ${patients.length}</div>
`;

    patients.forEach((patient, index) => {
      html += `
  <div class="patient-card">
    <div class="patient-header">
      <strong>Patient ${index + 1}: ${patient.name || 'Unnamed'}</strong>
      ${patient.bed ? ` | Bed: ${patient.bed}` : ''}
    </div>
`;

      if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
        html += `
    <div class="section">
      <div class="section-title">Clinical Summary</div>
      <div>${patient.clinicalSummary}</div>
    </div>`;
      }
      if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
        html += `
    <div class="section">
      <div class="section-title">Interval Events</div>
      <div>${patient.intervalEvents}</div>
    </div>`;
      }
      if (isColumnEnabled("imaging") && patient.imaging) {
        html += `
    <div class="section">
      <div class="section-title">Imaging</div>
      <div>${patient.imaging}</div>
    </div>`;
      }
      if (isColumnEnabled("labs") && patient.labs) {
        html += `
    <div class="section">
      <div class="section-title">Labs</div>
      <div>${patient.labs}</div>
    </div>`;
      }

      const enabledSystems = getEnabledSystemKeys();
      if (enabledSystems.length > 0) {
        html += `
    <div class="section">
      <div class="section-title">Systems Review</div>
      <table>
        <tr>`;
        enabledSystems.forEach(key => {
          html += `<th>${systemLabels[key]}</th>`;
        });
        html += `</tr><tr>`;
        enabledSystems.forEach(key => {
          const value = patient.systems[key as keyof typeof patient.systems];
          html += `<td>${value || '-'}</td>`;
        });
        html += `</tr></table>
    </div>`;
      }

      if (showTodosColumn) {
        const todos = getPatientTodos(patient.id);
        if (todos.length > 0) {
          html += `
    <div class="section">
      <div class="section-title">Todos</div>`;
          todos.forEach(todo => {
            html += `
      <div class="todo-item ${todo.completed ? 'completed' : ''}">
        ${todo.completed ? '☑' : '☐'} ${todo.content}
      </div>`;
          });
          html += `
    </div>`;
        }
      }

      if (isColumnEnabled("notes") && patientNotes[patient.id]) {
        html += `
    <div class="section">
      <div class="section-title">Notes</div>
      <div>${patientNotes[patient.id]}</div>
    </div>`;
      }

      html += `
  </div>`;
    });

    html += `
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.doc`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Word Export Complete",
      description: `Saved as ${fileName}`
    });
  };

  // Generate print-ready HTML for each view type
  const generatePrintHTML = () => {
    
    let contentHTML = '';
    
    // Track which columns we've already rendered as part of a combination
    const renderedCombinations = new Set<string>();
    
    // Helper to check if column should be rendered (not combined or is the first in combination)
    const shouldRenderColumn = (colKey: string): { render: boolean; asCombined?: string } => {
      const comboKey = isColumnCombined(colKey);
      if (comboKey) {
        if (renderedCombinations.has(comboKey)) {
          return { render: false };
        }
        renderedCombinations.add(comboKey);
        return { render: true, asCombined: comboKey };
      }
      return { render: true };
    };
    
    if (activeTab === 'table') {
      // Reset for header generation
      renderedCombinations.clear();
      
      // Table view HTML
      let tableHeaders = '';
      if (isColumnEnabled("patient")) {
        tableHeaders += `<th style="width: ${columnWidths.patient}px;">Patient</th>`;
      }
      
      // Check for Summary + Events combination
      const summaryRender = shouldRenderColumn("clinicalSummary");
      if (isColumnEnabled("clinicalSummary") && summaryRender.render) {
        if (summaryRender.asCombined) {
          const combo = columnCombinations.find(c => c.key === summaryRender.asCombined);
          tableHeaders += `<th style="width: ${columnWidths.summary + columnWidths.events}px;" class="combined-header">${combo?.label || 'Combined'}</th>`;
        } else {
          tableHeaders += `<th style="width: ${columnWidths.summary}px;">Clinical Summary</th>`;
        }
      }
      
      const eventsRender = shouldRenderColumn("intervalEvents");
      if (isColumnEnabled("intervalEvents") && eventsRender.render && !eventsRender.asCombined) {
        tableHeaders += `<th style="width: ${columnWidths.events}px;">Interval Events</th>`;
      }
      
      const imagingRender = shouldRenderColumn("imaging");
      if (isColumnEnabled("imaging") && imagingRender.render) {
        if (imagingRender.asCombined) {
          const combo = columnCombinations.find(c => c.key === imagingRender.asCombined);
          tableHeaders += `<th style="width: ${columnWidths.imaging + columnWidths.labs}px;" class="combined-header">${combo?.label || 'Combined'}</th>`;
        } else {
          tableHeaders += `<th style="width: ${columnWidths.imaging}px;">Imaging</th>`;
        }
      }
      
      const labsRender = shouldRenderColumn("labs");
      if (isColumnEnabled("labs") && labsRender.render && !labsRender.asCombined) {
        tableHeaders += `<th style="width: ${columnWidths.labs}px;">Labs</th>`;
      }
      
      // Check for Systems Review combination
      const firstSystemKey = enabledSystemKeys[0];
      const systemsComboKey = firstSystemKey ? isColumnCombined(`systems.${firstSystemKey}`) : null;
      
      if (systemsComboKey && enabledSystemKeys.length > 0) {
        // Render combined systems header
        const combo = columnCombinations.find(c => c.key === systemsComboKey);
        const totalSystemWidth = enabledSystemKeys.reduce((sum, key) => 
          sum + (columnWidths[`systems.${key}` as keyof ColumnWidthsType] || 90), 0
        );
        tableHeaders += `<th style="width: ${totalSystemWidth}px;" class="combined-header">${combo?.label || 'Systems Review'}</th>`;
        // Mark all system columns as rendered for this combination
        renderedCombinations.add(systemsComboKey);
      } else {
        // Render individual system headers
        enabledSystemKeys.forEach(key => {
          const sysWidth = columnWidths[`systems.${key}` as keyof ColumnWidthsType] || 90;
          tableHeaders += `<th style="width: ${sysWidth}px;">${systemLabels[key]}</th>`;
        });
      }
      if (showTodosColumn) {
        tableHeaders += `<th class="todos-header" style="width: ${columnWidths.notes}px;">Todos</th>`;
      }
      if (showNotesColumn) {
        tableHeaders += `<th class="notes-header" style="width: ${columnWidths.notes}px;">Notes</th>`;
      }
      
      let tableRows = '';
      patients.forEach((patient, idx) => {
        // Reset rendered combinations for each row
        renderedCombinations.clear();
        
        // Helper to generate cell content considering combinations
        const generateRowCells = (): string => {
          let cells = '';
          
          if (isColumnEnabled("patient")) {
            cells += `<td class="patient-cell">
              <div class="patient-name">${patient.name || 'Unnamed'}</div>
              <div class="bed">Bed: ${patient.bed || 'N/A'}</div>
            </td>`;
          }
          
          // Check for Summary combination
          const summaryCell = shouldRenderColumn("clinicalSummary");
          if (isColumnEnabled("clinicalSummary") && summaryCell.render) {
            if (summaryCell.asCombined) {
              cells += `<td class="content-cell combined-cell">${getCombinedContent(patient, summaryCell.asCombined)}</td>`;
            } else {
              cells += `<td class="content-cell">${cleanInlineStyles(patient.clinicalSummary) || ''}</td>`;
            }
          }
          
          const eventsCell = shouldRenderColumn("intervalEvents");
          if (isColumnEnabled("intervalEvents") && eventsCell.render && !eventsCell.asCombined) {
            cells += `<td class="content-cell">${cleanInlineStyles(patient.intervalEvents) || ''}</td>`;
          }
          
          const imagingCell = shouldRenderColumn("imaging");
          if (isColumnEnabled("imaging") && imagingCell.render) {
            if (imagingCell.asCombined) {
              cells += `<td class="content-cell combined-cell">${getCombinedContent(patient, imagingCell.asCombined)}</td>`;
            } else {
              cells += `<td class="content-cell">${cleanInlineStyles(patient.imaging) || ''}</td>`;
            }
          }
          
          const labsCell = shouldRenderColumn("labs");
          if (isColumnEnabled("labs") && labsCell.render && !labsCell.asCombined) {
            cells += `<td class="content-cell">${cleanInlineStyles(patient.labs) || ''}</td>`;
          }
          
          // Check for Systems Review combination
          const firstSysKey = enabledSystemKeys[0];
          const sysComboKey = firstSysKey ? isColumnCombined(`systems.${firstSysKey}`) : null;
          
          if (sysComboKey && enabledSystemKeys.length > 0) {
            // Render combined systems cell
            const systemsSections = enabledSystemKeys.map(key => {
              const value = cleanInlineStyles(patient.systems[key as keyof typeof patient.systems]) || '';
              if (value) {
                return `<div class="combined-section"><strong>${systemLabels[key]}:</strong> ${value}</div>`;
              }
              return '';
            }).filter(Boolean).join('');
            cells += `<td class="content-cell combined-cell">${systemsSections}</td>`;
          } else {
            // Render individual system cells
            enabledSystemKeys.forEach(key => {
              cells += `<td class="content-cell system-cell">${cleanInlineStyles(patient.systems[key as keyof typeof patient.systems]) || ''}</td>`;
            });
          }
          
          if (showTodosColumn) {
            const todos = getPatientTodos(patient.id);
            cells += `<td class="content-cell todos-cell">${formatTodosHtml(todos)}</td>`;
          }
          
          if (showNotesColumn) {
            cells += `<td class="notes-cell">
              <div class="notes-lines">
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
              </div>
            </td>`;
          }
          
          return cells;
        };
        
        // For one-per-page in table view, wrap each row in a separate table
        if (onePatientPerPage) {
          renderedCombinations.clear(); // Reset for this patient
          const singleRow = `<tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">${generateRowCells()}</tr>`;
          
          tableRows += `
            <div class="patient-page-wrapper">
              <table class="data-table single-patient-table">
                <thead><tr>${tableHeaders}</tr></thead>
                <tbody>${singleRow}</tbody>
              </table>
            </div>
          `;
        } else {
          renderedCombinations.clear(); // Reset for this patient
          const row = `<tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">${generateRowCells()}</tr>`;
          tableRows += row;
        }
      });
      
      if (onePatientPerPage) {
        contentHTML = tableRows;
      } else {
        contentHTML = `
          <table class="data-table">
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        `;
      }
    } else if (activeTab === 'cards') {
      // Card view HTML - use different container when one per page
      let cardsHTML = onePatientPerPage ? '<div class="cards-single-page">' : '<div class="cards-grid">';
      patients.forEach((patient, idx) => {
        let cardContent = '';
        
        if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
          cardContent += `
            <div class="section section-summary">
              <div class="section-header">Clinical Summary</div>
              <div class="section-body">${cleanInlineStyles(patient.clinicalSummary)}</div>
            </div>
          `;
        }
        
        if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
          cardContent += `
            <div class="section section-events">
              <div class="section-header">Interval Events</div>
              <div class="section-body">${cleanInlineStyles(patient.intervalEvents)}</div>
            </div>
          `;
        }
        
        let imagingLabsRow = '';
        if (isColumnEnabled("imaging") && patient.imaging) {
          imagingLabsRow += `
            <div class="section section-imaging">
              <div class="section-header imaging-header">Imaging</div>
              <div class="section-body imaging-body">${cleanInlineStyles(patient.imaging)}</div>
            </div>
          `;
        }
        if (isColumnEnabled("labs") && patient.labs) {
          imagingLabsRow += `
            <div class="section section-labs">
              <div class="section-header labs-header">Labs</div>
              <div class="section-body labs-body">${cleanInlineStyles(patient.labs)}</div>
            </div>
          `;
        }
        if (imagingLabsRow) {
          cardContent += `<div class="imaging-labs-row">${imagingLabsRow}</div>`;
        }
        
        if (enabledSystemKeys.length > 0) {
          let systemsGrid = '<div class="systems-grid">';
          enabledSystemKeys.forEach(key => {
            const value = patient.systems[key as keyof typeof patient.systems];
            if (value) {
              systemsGrid += `
                <div class="system-item">
                  <div class="system-header">${systemLabels[key]}</div>
                  <div class="system-body">${cleanInlineStyles(value)}</div>
                </div>
              `;
            }
          });
          systemsGrid += '</div>';
          cardContent += systemsGrid;
        }
        
        if (showTodosColumn) {
          const todos = getPatientTodos(patient.id);
          if (todos.length > 0) {
            cardContent += `
              <div class="section section-todos">
                <div class="section-header todos-header">Todos</div>
                <div class="section-body todos-body">${formatTodosHtml(todos)}</div>
              </div>
            `;
          }
        }
        
        if (showNotesColumn) {
          cardContent += `
            <div class="section section-notes">
              <div class="section-header notes-header">Rounding Notes</div>
              <div class="section-body notes-body">
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
              </div>
            </div>
          `;
        }
        
        // For one per page mode, wrap the card in a page wrapper div
        if (onePatientPerPage) {
          cardsHTML += `
            <div class="patient-page-wrapper">
              <div class="patient-card patient-card-fullpage">
                <div class="card-header">
                  <span class="patient-number">${idx + 1}</span>
                  <span class="patient-name">${patient.name || 'Unnamed'}</span>
                  ${patient.bed ? `<span class="patient-bed">Bed: ${patient.bed}</span>` : ''}
                </div>
                <div class="card-body">${cardContent}</div>
              </div>
            </div>
          `;
        } else {
          cardsHTML += `
            <div class="patient-card">
              <div class="card-header">
                <span class="patient-number">${idx + 1}</span>
                <span class="patient-name">${patient.name || 'Unnamed'}</span>
                ${patient.bed ? `<span class="patient-bed">Bed: ${patient.bed}</span>` : ''}
              </div>
              <div class="card-body">${cardContent}</div>
            </div>
          `;
        }
      });
      cardsHTML += '</div>';
      contentHTML = cardsHTML;
    } else {
      // List view HTML
      let listHTML = '<div class="list-view">';
      patients.forEach((patient, index) => {
        let sections = '';
        
        let summaryEventsRow = '';
        if (isColumnEnabled("clinicalSummary")) {
          summaryEventsRow += `
            <div class="section section-summary">
              <div class="section-header">Clinical Summary</div>
              <div class="section-body">${cleanInlineStyles(patient.clinicalSummary) || '<span class="empty">None documented</span>'}</div>
            </div>
          `;
        }
        if (isColumnEnabled("intervalEvents")) {
          summaryEventsRow += `
            <div class="section section-events">
              <div class="section-header">Interval Events</div>
              <div class="section-body">${cleanInlineStyles(patient.intervalEvents) || '<span class="empty">None documented</span>'}</div>
            </div>
          `;
        }
        if (summaryEventsRow) {
          sections += `<div class="two-col-row">${summaryEventsRow}</div>`;
        }
        
        let imagingLabsRow = '';
        if (isColumnEnabled("imaging")) {
          imagingLabsRow += `
            <div class="section section-imaging">
              <div class="section-header imaging-header">Imaging</div>
              <div class="section-body imaging-body">${cleanInlineStyles(patient.imaging) || '<span class="empty">None documented</span>'}</div>
            </div>
          `;
        }
        if (isColumnEnabled("labs")) {
          imagingLabsRow += `
            <div class="section section-labs">
              <div class="section-header labs-header">Labs</div>
              <div class="section-body labs-body">${cleanInlineStyles(patient.labs) || '<span class="empty">None documented</span>'}</div>
            </div>
          `;
        }
        if (imagingLabsRow) {
          sections += `<div class="two-col-row">${imagingLabsRow}</div>`;
        }
        
        if (enabledSystemKeys.length > 0) {
          let systemsHTML = '<div class="systems-section">';
          systemsHTML += '<div class="systems-header">Systems Review</div>';
          systemsHTML += '<div class="systems-grid">';
          enabledSystemKeys.forEach(key => {
            const value = patient.systems[key as keyof typeof patient.systems];
            systemsHTML += `
              <div class="system-item">
                <div class="system-header">${systemLabels[key]}</div>
                <div class="system-body">${cleanInlineStyles(value) || '<span class="empty">-</span>'}</div>
              </div>
            `;
          });
          systemsHTML += '</div></div>';
          sections += systemsHTML;
        }
        
        if (showTodosColumn) {
          const todos = getPatientTodos(patient.id);
          if (todos.length > 0) {
            sections += `
              <div class="section section-todos">
                <div class="section-header todos-header">Todos</div>
                <div class="section-body todos-body">${formatTodosHtml(todos)}</div>
              </div>
            `;
          }
        }
        
        if (showNotesColumn) {
          sections += `
            <div class="section section-notes">
              <div class="section-header notes-header">Rounding Notes</div>
              <div class="section-body notes-body">
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
              </div>
            </div>
          `;
        }
        
        listHTML += `
          <div class="patient-item${onePatientPerPage ? ' patient-page-wrapper' : ''}">
            <div class="item-header">
              <span class="patient-number">${index + 1}</span>
              <span class="patient-name">${patient.name || 'Unnamed'}</span>
              ${patient.bed ? `<span class="patient-bed">Bed: ${patient.bed}</span>` : ''}
            </div>
            <div class="item-body">${sections}</div>
          </div>
        `;
      });
      listHTML += '</div>';
      contentHTML = listHTML;
    }
    
    return contentHTML;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Print Error",
        description: "Could not open print window. Please check your popup blocker.",
        variant: "destructive"
      });
      return;
    }

    const fontCSS = getFontFamilyCSS();
    const baseFontSize = autoFitFontSize && onePatientPerPage ? getEffectiveFontSize() : printFontSize;
    const headerFontSize = Math.max(baseFontSize + 6, 14);
    const smallerFontSize = Math.max(baseFontSize - 1, 7);
    const patientNameSize = Math.max(baseFontSize + 1, 9);
    
    const baseViewLabel = activeTab === 'table' ? 'Dense Table View' : activeTab === 'cards' ? 'Card View' : 'Detailed List View';
    const autoFitLabel = autoFitFontSize && onePatientPerPage ? ` (Auto-fit: ${baseFontSize}px)` : '';
    const viewLabel = onePatientPerPage ? `${baseViewLabel} (One Per Page)${autoFitLabel}` : baseViewLabel;
    const dateStr = new Date().toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
    });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Patient Rounding Report - ${new Date().toLocaleDateString()}</title>
          <style>
            @page {
              size: ${printOrientation};
              margin: 0.5in;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: ${fontCSS}; 
              font-size: ${baseFontSize}px; 
              line-height: 1.4; 
              color: #1a1a1a; 
              padding: 12px;
              background: #fff;
            }
            /* CRITICAL: Force consistent font on ALL elements including those with inline styles */
            body *, body *[style], body span, body div, body p, body td, body li, body ul, body ol {
              font-family: ${fontCSS} !important;
              font-size: inherit !important;
              line-height: inherit !important;
            }
            /* Override any remaining inline font-size styles */
            [style*="font-size"], [style*="font-family"] {
              font-family: ${fontCSS} !important;
              font-size: inherit !important;
            }
            
            /* Header */
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 16px;
              border-bottom: 3px solid #1e40af;
              padding-bottom: 12px;
            }
            .report-title {
              font-size: ${headerFontSize}px;
              font-weight: 700;
              color: #1e40af;
            }
            .report-subtitle {
              font-size: ${smallerFontSize}px;
              color: #6b7280;
              margin-top: 4px;
            }
            .report-meta {
              text-align: right;
              font-size: ${smallerFontSize}px;
            }
            .report-date {
              font-weight: 600;
              font-size: ${baseFontSize}px;
            }
            
            /* TABLE VIEW STYLES */
            .data-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            .data-table th {
              background: #1e40af;
              color: #fff;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 10px 8px;
              text-align: left;
              border: 2px solid #1e3a8a;
              font-size: ${baseFontSize}px;
            }
            .data-table td {
              padding: 8px;
              border: 1px solid #d1d5db;
              vertical-align: top;
              font-size: ${baseFontSize}px;
              word-wrap: break-word;
              overflow-wrap: anywhere;
            }
            .data-table .even-row td { background: #fff; }
            .data-table .odd-row td { background: #f8fafc; }
            .data-table tr { 
              border-bottom: 3px solid #1e40af; 
              page-break-inside: avoid;
            }
            .data-table .patient-cell .patient-name {
              font-weight: 700;
              color: #1e40af;
              font-size: ${patientNameSize + 1}px;
              margin-bottom: 4px;
            }
            .data-table .patient-cell .bed {
              font-size: ${smallerFontSize}px;
              color: #374151;
              background: #e0e7ff;
              padding: 2px 6px;
              border-radius: 3px;
              display: inline-block;
            }
            .data-table .notes-header {
              background: #f59e0b !important;
            }
            .data-table .notes-cell {
              background: #fffbeb !important;
            }
            .notes-lines { padding: 4px; }
            .note-line {
              border-bottom: 1px solid #fcd34d;
              height: 16px;
              width: 100%;
            }
            
            /* Combined Column Styles */
            .combined-header {
              background: #6366f1 !important;
            }
            .combined-cell {
              background: #eef2ff;
            }
            .combined-section {
              margin-bottom: 8px;
              padding-bottom: 8px;
              border-bottom: 1px dashed #c7d2fe;
            }
            .combined-section:last-child {
              margin-bottom: 0;
              padding-bottom: 0;
              border-bottom: none;
            }
            .combined-section strong {
              color: #4338ca;
              display: block;
              margin-bottom: 2px;
              font-size: ${Math.max(baseFontSize - 1, 7)}px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            
            /* CARD VIEW STYLES */
            .cards-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
            }
            .patient-card {
              border: 3px solid #1e40af;
              border-radius: 8px;
              overflow: hidden;
              page-break-inside: avoid;
              background: #fff;
            }
            .card-header {
              background: #1e40af;
              color: #fff;
              padding: 12px 16px;
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .card-header .patient-number {
              background: #fff;
              color: #1e40af;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: ${baseFontSize}px;
            }
            .card-header .patient-name {
              font-weight: 700;
              font-size: ${patientNameSize + 2}px;
              flex: 1;
            }
            .card-header .patient-bed {
              background: rgba(255,255,255,0.2);
              padding: 4px 12px;
              border-radius: 4px;
              font-size: ${smallerFontSize}px;
            }
            .card-body {
              padding: 12px;
            }
            .card-body .section {
              margin-bottom: 12px;
              border: 2px solid #d1d5db;
              border-radius: 6px;
              overflow: hidden;
            }
            .card-body .section-header {
              background: #1e40af;
              color: #fff;
              font-weight: 700;
              text-transform: uppercase;
              padding: 8px 12px;
              font-size: ${baseFontSize}px;
              letter-spacing: 0.5px;
            }
            .card-body .section-body {
              padding: 10px 12px;
              background: #f8fafc;
              font-size: ${baseFontSize}px;
            }
            .imaging-labs-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            .imaging-header { background: #3b82f6 !important; }
            .imaging-body { background: #eff6ff !important; }
            .labs-header { background: #22c55e !important; }
            .labs-body { background: #f0fdf4 !important; }
            .notes-header { background: #f59e0b !important; }
            .notes-body { background: #fffbeb !important; padding: 8px !important; }
            .todos-header { background: #8b5cf6 !important; }
            .todos-body { background: #f5f3ff !important; padding: 8px !important; }
            .todos-cell { background: #f5f3ff; }
            
            /* Todo list styles */
            .todos-list {
              list-style: none;
              margin: 0;
              padding: 0;
            }
            .todo-item {
              display: flex;
              align-items: flex-start;
              gap: 6px;
              padding: 3px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .todo-item:last-child {
              border-bottom: none;
            }
            .todo-item.completed {
              text-decoration: line-through;
              color: #9ca3af;
            }
            .todo-checkbox {
              flex-shrink: 0;
              font-size: ${baseFontSize}px;
            }
            .todo-content {
              flex: 1;
              font-size: ${baseFontSize}px;
            }
            
            .systems-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-top: 12px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .system-item {
              border: 2px solid #1e40af;
              border-radius: 6px;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .system-header {
              background: #1e40af;
              color: #fff;
              font-weight: 700;
              text-transform: uppercase;
              padding: 6px 8px;
              font-size: ${Math.max(baseFontSize - 1, 7)}px;
              text-align: center;
              letter-spacing: 0.3px;
            }
            .system-body {
              padding: 6px 8px;
              background: #f8fafc;
              font-size: ${Math.max(baseFontSize - 1, 7)}px;
              min-height: 30px;
            }
            
            /* LIST VIEW STYLES */
            .list-view .patient-item {
              border: 4px solid #1e40af;
              border-radius: 8px;
              overflow: hidden;
              margin-bottom: 16px;
              page-break-inside: avoid;
            }
            .list-view .item-header {
              background: #1e40af;
              color: #fff;
              padding: 12px 16px;
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .list-view .item-header .patient-number {
              background: #fff;
              color: #1e40af;
              width: 36px;
              height: 36px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: ${patientNameSize}px;
            }
            .list-view .item-header .patient-name {
              font-weight: 700;
              font-size: ${patientNameSize + 3}px;
              flex: 1;
            }
            .list-view .item-header .patient-bed {
              background: rgba(255,255,255,0.2);
              padding: 6px 16px;
              border-radius: 4px;
              font-size: ${baseFontSize}px;
            }
            .list-view .item-body {
              padding: 16px;
              background: #fff;
            }
            .list-view .two-col-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 16px;
            }
            .list-view .section {
              border: 2px solid #d1d5db;
              border-radius: 6px;
              overflow: hidden;
            }
            .list-view .section-header {
              background: #1e40af;
              color: #fff;
              font-weight: 700;
              text-transform: uppercase;
              padding: 8px 12px;
              font-size: ${baseFontSize}px;
              letter-spacing: 0.5px;
            }
            .list-view .section-body {
              padding: 12px;
              background: #f8fafc;
              font-size: ${baseFontSize}px;
            }
            .list-view .systems-section {
              margin-bottom: 16px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .list-view .systems-header {
              background: #1e40af;
              color: #fff;
              font-weight: 700;
              text-transform: uppercase;
              padding: 8px 12px;
              font-size: ${baseFontSize}px;
              letter-spacing: 0.5px;
              border-radius: 6px 6px 0 0;
            }
            .list-view .systems-section .systems-grid {
              border: 2px solid #1e40af;
              border-top: none;
              border-radius: 0 0 6px 6px;
              margin-top: 0;
              grid-template-columns: repeat(5, 1fr);
              gap: 0;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .list-view .systems-section .system-item {
              border: none;
              border-right: 1px solid #d1d5db;
              border-bottom: 1px solid #d1d5db;
              border-radius: 0;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            
            .empty {
              color: #9ca3af;
              font-style: italic;
            }
            
            .footer {
              margin-top: 16px;
              padding-top: 8px;
              border-top: 1px solid #d1d5db;
              font-size: ${Math.max(baseFontSize - 2, 7)}px;
              color: #6b7280;
              text-align: center;
            }
            
            /* One Patient Per Page Styles */
            .patient-page-wrapper {
              page-break-after: always !important;
              page-break-before: auto;
              page-break-inside: avoid !important;
              break-after: page !important;
              break-before: auto;
              break-inside: avoid !important;
              display: block;
              margin-bottom: 0;
            }
            .patient-page-wrapper:first-child {
              page-break-before: avoid;
              break-before: avoid;
            }
            .patient-page-wrapper:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .single-patient-table {
              width: 100%;
              height: auto;
              max-height: none;
              table-layout: fixed;
            }
            .single-patient-table td {
              vertical-align: top;
              overflow-wrap: break-word;
              word-wrap: break-word;
            }
            ${onePatientPerPage ? `
            /* Single page container - no grid, just stacked */
            .cards-single-page {
              display: block;
            }
            .cards-single-page .patient-page-wrapper {
              display: block;
              width: 100%;
              height: auto;
              overflow: visible;
            }
            .cards-single-page .patient-card-fullpage {
              width: 100%;
              margin: 0;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .cards-single-page .patient-card-fullpage .card-body {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .cards-single-page .patient-card-fullpage .systems-grid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .cards-grid {
              display: block;
            }
            .cards-grid .patient-card {
              margin-bottom: 0;
            }
            .list-view {
              display: block;
            }
            .list-view .patient-item {
              margin-bottom: 0;
            }
            ` : ''}
            
            @media print {
              @page { size: landscape; margin: 0.4in; }
              body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
              .data-table th { background: #1e40af !important; color: #fff !important; }
              .card-header, .item-header, .section-header, .system-header, .systems-header { 
                background: #1e40af !important; 
                color: #fff !important; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .imaging-header { background: #3b82f6 !important; }
              .labs-header { background: #22c55e !important; }
              .notes-header { background: #f59e0b !important; }
              ${onePatientPerPage ? `
              .patient-page-wrapper {
                page-break-after: always !important;
                page-break-inside: avoid !important;
                break-after: page !important;
                break-inside: avoid !important;
                height: auto;
                min-height: 0;
                display: block !important;
                overflow: visible !important;
              }
              .patient-page-wrapper:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .patient-card-fullpage {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                display: block !important;
                overflow: visible !important;
              }
              .patient-card-fullpage .card-body {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .patient-card-fullpage .card-body > * {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .cards-single-page {
                display: block !important;
              }
              .report-header {
                page-break-after: avoid;
                break-after: avoid;
              }
              ` : `
              tr, .patient-card, .patient-item { page-break-inside: avoid !important; break-inside: avoid !important; }
              `}
              .systems-grid, .systems-section, .system-item { page-break-inside: avoid !important; break-inside: avoid !important; }
              .section, .two-col-row, .imaging-labs-row { page-break-inside: avoid !important; break-inside: avoid !important; }
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <div class="report-title">🏥 Patient Rounding Report</div>
              <div class="report-subtitle">${viewLabel}</div>
            </div>
            <div class="report-meta">
              <div class="report-date">${dateStr}</div>
              <div>${timeStr} • ${patients.length} patients</div>
            </div>
          </div>
          
          ${generatePrintHTML()}
          
          <div class="footer">
            Generated by Patient Rounding Assistant • ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Download PDF from print view (same configuration as print preview)
  const handleDownloadPDFFromPrintView = () => {
    const fontCSS = getFontFamilyCSS();
    const baseFontSize = autoFitFontSize && onePatientPerPage ? getEffectiveFontSize() : printFontSize;
    
    const doc = new jsPDF({
      orientation: printOrientation,
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - (margin * 2);

    // Set default font
    doc.setFont("helvetica", "normal");

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175); // Primary blue
    doc.text("Patient Rounding Report", margin, 15);
    
    const viewLabel = activeTab === 'table' ? 'Dense Table View' : activeTab === 'cards' ? 'Card View' : 'Detailed List View';
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`${viewLabel}${onePatientPerPage ? ' (One Per Page)' : ''}`, margin, 21);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(new Date().toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
    }), pageWidth - margin, 15, { align: 'right' });
    doc.setFontSize(9);
    doc.text(`${patients.length} patients`, pageWidth - margin, 21, { align: 'right' });

    // Build headers and data based on enabled columns AND column combinations
    const headers: string[] = [];
    const columnKeys: string[] = [];
    
    const summaryEventsCombo = combinedColumns.includes('summaryEvents');
    const imagingLabsCombo = combinedColumns.includes('imagingLabs');
    const allContentCombo = combinedColumns.includes('allContent');
    const systemsReviewCombo = combinedColumns.includes('systemsReview');
    
    if (isColumnEnabled("patient")) {
      headers.push("Patient");
      columnKeys.push("patient");
    }
    
    // Handle column combinations for summary, events, imaging, labs
    if (allContentCombo && (isColumnEnabled("clinicalSummary") || isColumnEnabled("intervalEvents") || isColumnEnabled("imaging") || isColumnEnabled("labs"))) {
      headers.push("All Clinical Data");
      columnKeys.push("allContent");
    } else {
      if (summaryEventsCombo && (isColumnEnabled("clinicalSummary") || isColumnEnabled("intervalEvents"))) {
        headers.push("Summary + Events");
        columnKeys.push("summaryEvents");
      } else {
        if (isColumnEnabled("clinicalSummary")) {
          headers.push("Summary");
          columnKeys.push("clinicalSummary");
        }
        if (isColumnEnabled("intervalEvents")) {
          headers.push("Events");
          columnKeys.push("intervalEvents");
        }
      }
      
      if (imagingLabsCombo && (isColumnEnabled("imaging") || isColumnEnabled("labs"))) {
        headers.push("Imaging + Labs");
        columnKeys.push("imagingLabs");
      } else {
        if (isColumnEnabled("imaging")) {
          headers.push("Imaging");
          columnKeys.push("imaging");
        }
        if (isColumnEnabled("labs")) {
          headers.push("Labs");
          columnKeys.push("labs");
        }
      }
    }
    
    // Handle systems combination
    if (systemsReviewCombo && enabledSystemKeys.length > 0) {
      headers.push("Systems Review");
      columnKeys.push("systemsReview");
    } else {
      systemKeys.forEach(key => {
        if (isColumnEnabled(`systems.${key}`)) {
          headers.push(systemLabels[key]);
          columnKeys.push(`systems.${key}`);
        }
      });
    }
    
    if (showTodosColumn) {
      headers.push("Todos");
      columnKeys.push("todos");
    }
    if (showNotesColumn) {
      headers.push("Notes");
      columnKeys.push("notes");
    }

    // Generate table data with combination support
    const tableData = patients.map(patient => {
      return columnKeys.map(key => {
        if (key === "patient") {
          return `${patient.name || 'Unnamed'}\nBed: ${patient.bed || 'N/A'}`;
        }
        if (key === "allContent") {
          const parts: string[] = [];
          if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
            parts.push(`Summary: ${stripHtml(patient.clinicalSummary)}`);
          }
          if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
            parts.push(`Events: ${stripHtml(patient.intervalEvents)}`);
          }
          if (isColumnEnabled("imaging") && patient.imaging) {
            parts.push(`Imaging: ${stripHtml(patient.imaging)}`);
          }
          if (isColumnEnabled("labs") && patient.labs) {
            parts.push(`Labs: ${stripHtml(patient.labs)}`);
          }
          return parts.join('\n\n');
        }
        if (key === "summaryEvents") {
          const parts: string[] = [];
          if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
            parts.push(`Summary: ${stripHtml(patient.clinicalSummary)}`);
          }
          if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
            parts.push(`Events: ${stripHtml(patient.intervalEvents)}`);
          }
          return parts.join('\n\n');
        }
        if (key === "imagingLabs") {
          const parts: string[] = [];
          if (isColumnEnabled("imaging") && patient.imaging) {
            parts.push(`Imaging: ${stripHtml(patient.imaging)}`);
          }
          if (isColumnEnabled("labs") && patient.labs) {
            parts.push(`Labs: ${stripHtml(patient.labs)}`);
          }
          return parts.join('\n\n');
        }
        if (key === "systemsReview") {
          const parts: string[] = [];
          enabledSystemKeys.forEach(sysKey => {
            const value = patient.systems[sysKey as keyof typeof patient.systems];
            if (value) {
              parts.push(`${systemLabels[sysKey]}: ${stripHtml(value)}`);
            }
          });
          return parts.join('\n');
        }
        if (key === "clinicalSummary") return stripHtml(patient.clinicalSummary);
        if (key === "intervalEvents") return stripHtml(patient.intervalEvents);
        if (key === "imaging") return stripHtml(patient.imaging);
        if (key === "labs") return stripHtml(patient.labs);
        if (key === "todos") {
          const todos = getPatientTodos(patient.id);
          return formatTodosForDisplay(todos);
        }
        if (key === "notes") return "";
        if (key.startsWith("systems.")) {
          const systemKey = key.replace("systems.", "") as keyof typeof patient.systems;
          return stripHtml(patient.systems[systemKey] || "");
        }
        return "";
      });
    });

    // Use autoTable for the main table
    if (onePatientPerPage) {
      // One patient per page mode
      patients.forEach((patient, idx) => {
        if (idx > 0) doc.addPage();
        
        // Patient header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 64, 175);
        doc.text(`${patient.name || 'Unnamed Patient'}`, margin, 35);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(`Bed: ${patient.bed || 'N/A'} • Patient ${idx + 1} of ${patients.length}`, margin, 42);
        
        let yPos = 50;
        const lineHeight = 5;
        const maxWidth = usableWidth;
        
        // Clinical Summary
        if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("Clinical Summary:", margin, yPos);
          yPos += lineHeight;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(baseFontSize > 9 ? 9 : baseFontSize);
          const lines = doc.splitTextToSize(stripHtml(patient.clinicalSummary), maxWidth);
          doc.text(lines, margin, yPos);
          yPos += lines.length * (baseFontSize > 9 ? 4 : 3.5) + 5;
        }
        
        // Interval Events
        if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
          if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("Interval Events:", margin, yPos);
          yPos += lineHeight;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(baseFontSize > 9 ? 9 : baseFontSize);
          const lines = doc.splitTextToSize(stripHtml(patient.intervalEvents), maxWidth);
          doc.text(lines, margin, yPos);
          yPos += lines.length * (baseFontSize > 9 ? 4 : 3.5) + 5;
        }
        
        // Imaging
        if (isColumnEnabled("imaging") && patient.imaging) {
          if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("Imaging:", margin, yPos);
          yPos += lineHeight;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(baseFontSize > 9 ? 9 : baseFontSize);
          const lines = doc.splitTextToSize(stripHtml(patient.imaging), maxWidth);
          doc.text(lines, margin, yPos);
          yPos += lines.length * (baseFontSize > 9 ? 4 : 3.5) + 5;
        }
        
        // Labs
        if (isColumnEnabled("labs") && patient.labs) {
          if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("Labs:", margin, yPos);
          yPos += lineHeight;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(baseFontSize > 9 ? 9 : baseFontSize);
          const lines = doc.splitTextToSize(stripHtml(patient.labs), maxWidth);
          doc.text(lines, margin, yPos);
          yPos += lines.length * (baseFontSize > 9 ? 4 : 3.5) + 5;
        }
        
        // Systems
        const enabledSystems = getEnabledSystemKeys();
        if (enabledSystems.length > 0) {
          if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("Systems Review:", margin, yPos);
          yPos += lineHeight + 2;
          
          enabledSystems.forEach(key => {
            const value = patient.systems[key as keyof typeof patient.systems];
            if (value) {
              if (yPos > pageHeight - 20) { doc.addPage(); yPos = 20; }
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9);
              doc.text(`${systemLabels[key]}:`, margin, yPos);
              doc.setFont("helvetica", "normal");
              const systemLines = doc.splitTextToSize(stripHtml(value), maxWidth - 30);
              doc.text(systemLines, margin + 30, yPos);
              yPos += Math.max(systemLines.length * 3.5, 4) + 2;
            }
          });
          yPos += 3;
        }
        
        // Todos
        if (showTodosColumn) {
          const todos = getPatientTodos(patient.id);
          if (todos.length > 0) {
            if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("Todos:", margin, yPos);
            yPos += lineHeight;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            todos.forEach(todo => {
              if (yPos > pageHeight - 15) { doc.addPage(); yPos = 20; }
              const todoText = `${todo.completed ? '☑' : '☐'} ${todo.content}`;
              const todoLines = doc.splitTextToSize(todoText, maxWidth);
              doc.text(todoLines, margin, yPos);
              yPos += todoLines.length * 3.5 + 1;
            });
          }
        }
      });
    } else {
      // Table mode - use autoTable
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 28,
        styles: {
          fontSize: Math.min(baseFontSize, 7),
          cellPadding: 2,
          overflow: 'linebreak',
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: Math.min(baseFontSize, 7)
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { top: 28, left: margin, right: margin },
        tableWidth: 'auto',
        showHead: 'everyPage',
        rowPageBreak: 'auto',
      });
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generated by Patient Rounding Assistant • ${new Date().toLocaleString()} • Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );
    }

    const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    toast({
      title: "PDF Downloaded",
      description: `Saved as ${fileName}`
    });
  };

  const dateStr = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
  });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const ExpandableCell = ({ 
    patient, 
    field, 
    className = "" 
  }: { 
    patient: Patient; 
    field: string; 
    className?: string;
  }) => {
    const value = getCellValue(patient, field);
    const expanded = isExpanded(patient.id, field);
    const editing = isEditing(patient.id, field);
    const plainText = stripHtml(value);

    if (editing) {
      return (
        <td className={cn("p-1 align-top", className)}>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full min-h-[60px] text-xs p-1 border rounded resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") handleEditCancel();
              if (e.key === "Enter" && e.ctrlKey) handleEditSave();
            }}
          />
          <div className="flex gap-1 mt-1">
            <Button size="sm" variant="outline" onClick={handleEditCancel} className="h-5 text-xs px-2">
              Cancel
            </Button>
            <Button size="sm" onClick={handleEditSave} className="h-5 text-xs px-2">
              Save
            </Button>
          </div>
        </td>
      );
    }

    return (
      <td 
        className={cn(
          "p-1 align-top cursor-pointer transition-all hover:bg-muted/50",
          expanded && "bg-primary/10",
          className
        )}
        onClick={() => handleCellClick(patient.id, field)}
        onDoubleClick={() => isEditMode && handleDoubleClick(patient.id, field, value)}
        title={isEditMode ? "Double-click to edit" : "Click to expand"}
      >
        <div 
          className={cn(
            "whitespace-pre-wrap break-words",
            !expanded && "line-clamp-3"
          )}
          style={{ fontSize: 'inherit' }}
          dangerouslySetInnerHTML={{ __html: expanded ? value : plainText }}
        />
        {plainText && plainText.length > 50 && (
          <div className="flex justify-end mt-1 no-print">
            {expanded ? (
              <Minimize2 className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Maximize2 className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        )}
      </td>
    );
  };

  // Notes cell - displays blank lined space for handwritten notes (no textarea)
  const NotesCell = ({ patient }: { patient: Patient }) => {
    return (
      <td className="border border-border p-1 align-top bg-amber-50/50">
        <div className="min-h-[60px] w-full relative">
          {/* Lined paper effect for handwritten notes */}
          <div className="absolute inset-0 flex flex-col justify-start pt-1">
            {[...Array(4)].map((_, i) => (
              <div 
                key={i} 
                className="border-b border-amber-200/60 h-[14px] w-full"
              />
            ))}
          </div>
        </div>
      </td>
    );
  };

  const enabledSystemKeys = getEnabledSystemKeys();

  // Render the appropriate content based on active tab for full preview
  const renderFullPreviewContent = () => {
    const fontCSS = getFontFamilyCSS();
    
    if (activeTab === 'table') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed', fontFamily: fontCSS }}>
            <thead>
              <tr className="bg-primary text-primary-foreground">
                {isColumnEnabled("patient") && (
                  <th className="border border-border p-3 text-left font-bold uppercase" style={{ width: columnWidths.patient, fontSize: `${printFontSize + 1}px` }}>
                    Patient
                  </th>
                )}
                {isColumnEnabled("clinicalSummary") && (
                  <th className="border border-border p-3 text-left font-bold uppercase" style={{ width: columnWidths.summary, fontSize: `${printFontSize + 1}px` }}>
                    Clinical Summary
                  </th>
                )}
                {isColumnEnabled("intervalEvents") && (
                  <th className="border border-border p-3 text-left font-bold uppercase" style={{ width: columnWidths.events, fontSize: `${printFontSize + 1}px` }}>
                    Interval Events
                  </th>
                )}
                {isColumnEnabled("imaging") && (
                  <th className="border border-border p-3 text-left font-bold uppercase" style={{ width: columnWidths.imaging, fontSize: `${printFontSize + 1}px` }}>
                    Imaging
                  </th>
                )}
                {isColumnEnabled("labs") && (
                  <th className="border border-border p-3 text-left font-bold uppercase" style={{ width: columnWidths.labs, fontSize: `${printFontSize + 1}px` }}>
                    Labs
                  </th>
                )}
                {enabledSystemKeys.map(key => (
                  <th 
                    key={key} 
                    className="border border-border p-3 text-left font-bold uppercase"
                    style={{ width: columnWidths[`systems.${key}` as keyof ColumnWidthsType] || 90, fontSize: `${printFontSize}px` }}
                  >
                    {systemLabels[key]}
                  </th>
                ))}
                {showNotesColumn && (
                  <th 
                    className="border border-border p-3 text-left font-bold bg-amber-500 text-white uppercase"
                    style={{ width: columnWidths.notes, fontSize: `${printFontSize + 1}px` }}
                  >
                    Notes
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {patients.map((patient, idx) => (
                <tr key={patient.id} className={cn("border-b-2 border-primary/40", idx % 2 === 0 ? "bg-white" : "bg-muted/20")}>
                  {isColumnEnabled("patient") && (
                    <td className="border border-border p-3 align-top">
                      <div className="font-bold text-primary" style={{ fontSize: `${printFontSize + 1}px` }}>{patient.name || 'Unnamed'}</div>
                      <div className="text-muted-foreground" style={{ fontSize: `${printFontSize - 1}px` }}>Bed: {patient.bed || 'N/A'}</div>
                    </td>
                  )}
                  {isColumnEnabled("clinicalSummary") && (
                    <td className="border border-border p-3 align-top">
                      <div 
                        className="whitespace-pre-wrap break-words"
                        style={{ fontSize: `${printFontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: patient.clinicalSummary }}
                      />
                    </td>
                  )}
                  {isColumnEnabled("intervalEvents") && (
                    <td className="border border-border p-3 align-top">
                      <div 
                        className="whitespace-pre-wrap break-words"
                        style={{ fontSize: `${printFontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: patient.intervalEvents }}
                      />
                    </td>
                  )}
                  {isColumnEnabled("imaging") && (
                    <td className="border border-border p-3 align-top">
                      <div 
                        className="whitespace-pre-wrap break-words"
                        style={{ fontSize: `${printFontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: patient.imaging }}
                      />
                    </td>
                  )}
                  {isColumnEnabled("labs") && (
                    <td className="border border-border p-3 align-top">
                      <div 
                        className="whitespace-pre-wrap break-words"
                        style={{ fontSize: `${printFontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: patient.labs }}
                      />
                    </td>
                  )}
                  {enabledSystemKeys.map(key => (
                    <td key={key} className="border border-border p-2 align-top">
                      <div 
                        className="whitespace-pre-wrap break-words"
                        style={{ fontSize: `${printFontSize - 1}px` }}
                        dangerouslySetInnerHTML={{ __html: patient.systems[key as keyof typeof patient.systems] }}
                      />
                    </td>
                  ))}
                  {showNotesColumn && (
                    <td className="border border-border p-2 align-top bg-amber-50/50">
                      <div className="min-h-[80px] w-full relative">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="border-b border-amber-200/60 h-[16px] w-full" />
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    if (activeTab === 'cards') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ fontFamily: fontCSS }}>
          {patients.map((patient, idx) => (
            <div key={patient.id} className="border-3 border-primary rounded-lg overflow-hidden bg-card shadow-lg break-inside-avoid">
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-white text-primary rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </span>
                  <span className="font-bold" style={{ fontSize: `${printFontSize + 3}px` }}>
                    {patient.name || 'Unnamed'}
                  </span>
                </div>
                {patient.bed && (
                  <span className="bg-white/20 px-3 py-1 rounded text-sm font-medium">
                    Bed: {patient.bed}
                  </span>
                )}
              </div>
              
              <div className="p-4 space-y-4">
                {isColumnEnabled("clinicalSummary") && patient.clinicalSummary && (
                  <div className="border-2 border-primary/30 rounded-lg overflow-hidden">
                    <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                      Clinical Summary
                    </div>
                    <div 
                      className="bg-muted/30 p-3"
                      style={{ fontSize: `${printFontSize}px` }}
                      dangerouslySetInnerHTML={{ __html: patient.clinicalSummary }}
                    />
                  </div>
                )}
                
                {isColumnEnabled("intervalEvents") && patient.intervalEvents && (
                  <div className="border-2 border-primary/30 rounded-lg overflow-hidden">
                    <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                      Interval Events
                    </div>
                    <div 
                      className="bg-muted/30 p-3"
                      style={{ fontSize: `${printFontSize}px` }}
                      dangerouslySetInnerHTML={{ __html: patient.intervalEvents }}
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {isColumnEnabled("imaging") && patient.imaging && (
                    <div className="border-2 border-blue-400 rounded-lg overflow-hidden">
                      <div className="bg-blue-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                        Imaging
                      </div>
                      <div 
                        className="bg-blue-50 p-3"
                        style={{ fontSize: `${printFontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: patient.imaging }}
                      />
                    </div>
                  )}
                  {isColumnEnabled("labs") && patient.labs && (
                    <div className="border-2 border-green-400 rounded-lg overflow-hidden">
                      <div className="bg-green-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                        Labs
                      </div>
                      <div 
                        className="bg-green-50 p-3"
                        style={{ fontSize: `${printFontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: patient.labs }}
                      />
                    </div>
                  )}
                </div>
                
                {enabledSystemKeys.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {enabledSystemKeys.map(key => {
                      const value = patient.systems[key as keyof typeof patient.systems];
                      if (!value) return null;
                      return (
                        <div key={key} className="border-2 border-primary rounded-lg overflow-hidden">
                          <div 
                            className="bg-primary text-white font-bold uppercase px-2 py-1.5 text-center" 
                            style={{ fontSize: `${printFontSize}px`, letterSpacing: '0.5px' }}
                          >
                            {systemLabels[key]}
                          </div>
                          <div className="p-2 bg-muted/20" style={{ fontSize: `${printFontSize - 1}px` }} dangerouslySetInnerHTML={{ __html: value }} />
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {showTodosColumn && getPatientTodos(patient.id).length > 0 && (
                  <div className="border-2 border-violet-400 rounded-lg overflow-hidden">
                    <div className="bg-violet-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                      Todos
                    </div>
                    <div className="p-3 bg-violet-50">
                      <ul className="space-y-1">
                        {getPatientTodos(patient.id).map(todo => (
                          <li key={todo.id} className={cn("flex items-start gap-2", todo.completed && "line-through text-muted-foreground")}>
                            {todo.completed ? <CheckSquare className="h-4 w-4 mt-0.5 text-green-500" /> : <Square className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                            <span style={{ fontSize: `${printFontSize}px` }}>{todo.content}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {showNotesColumn && (
                  <div className="border-2 border-amber-400 rounded-lg overflow-hidden">
                    <div className="bg-amber-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                      Rounding Notes
                    </div>
                    <div className="min-h-[60px] w-full relative p-3 bg-amber-50">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="border-b border-amber-300 h-[14px] w-full" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // List view
    return (
      <div className="space-y-6" style={{ fontFamily: fontCSS }}>
        {patients.map((patient, index) => (
          <div key={patient.id} className="border-4 border-primary rounded-lg overflow-hidden mb-4 break-inside-avoid shadow-md">
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-white text-primary rounded-full w-10 h-10 flex items-center justify-center font-bold" style={{ fontSize: `${printFontSize + 2}px` }}>
                  {index + 1}
                </span>
                <span className="font-bold" style={{ fontSize: `${printFontSize + 4}px` }}>{patient.name || 'Unnamed'}</span>
              </div>
              {patient.bed && (
                <span className="bg-white/20 px-4 py-1.5 rounded font-medium" style={{ fontSize: `${printFontSize}px` }}>
                  Bed: {patient.bed}
                </span>
              )}
            </div>
            
            <div className="p-4 space-y-4 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isColumnEnabled("clinicalSummary") && (
                  <div className="border-2 border-primary/40 rounded-lg overflow-hidden">
                    <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                      Clinical Summary
                    </div>
                    <div 
                      className="p-3 bg-muted/20"
                      style={{ fontSize: `${printFontSize}px` }}
                      dangerouslySetInnerHTML={{ __html: patient.clinicalSummary || '<span class="text-muted-foreground italic">None documented</span>' }}
                    />
                  </div>
                )}
                {isColumnEnabled("intervalEvents") && (
                  <div className="border-2 border-primary/40 rounded-lg overflow-hidden">
                    <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                      Interval Events
                    </div>
                    <div 
                      className="p-3 bg-muted/20"
                      style={{ fontSize: `${printFontSize}px` }}
                      dangerouslySetInnerHTML={{ __html: patient.intervalEvents || '<span class="text-muted-foreground italic">None documented</span>' }}
                    />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isColumnEnabled("imaging") && (
                  <div className="border-2 border-blue-400 rounded-lg overflow-hidden">
                    <div className="bg-blue-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                      Imaging
                    </div>
                    <div 
                      className="p-3 bg-blue-50"
                      style={{ fontSize: `${printFontSize}px` }}
                      dangerouslySetInnerHTML={{ __html: patient.imaging || '<span class="text-muted-foreground italic">None documented</span>' }}
                    />
                  </div>
                )}
                {isColumnEnabled("labs") && (
                  <div className="border-2 border-green-400 rounded-lg overflow-hidden">
                    <div className="bg-green-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                      Labs
                    </div>
                    <div 
                      className="p-3 bg-green-50"
                      style={{ fontSize: `${printFontSize}px` }}
                      dangerouslySetInnerHTML={{ __html: patient.labs || '<span class="text-muted-foreground italic">None documented</span>' }}
                    />
                  </div>
                )}
              </div>
              
              {enabledSystemKeys.length > 0 && (
                <div>
                  <div className="bg-primary text-white font-bold uppercase px-3 py-2 rounded-t-lg" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                    Systems Review
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 border-2 border-t-0 border-primary rounded-b-lg overflow-hidden">
                    {enabledSystemKeys.map((key, sysIdx) => {
                      const value = patient.systems[key as keyof typeof patient.systems];
                      return (
                        <div key={key} className={cn(
                          "border-r border-b border-primary/30",
                          sysIdx % 5 === 4 && "border-r-0"
                        )}>
                          <div 
                            className="bg-primary/90 text-white font-bold uppercase px-2 py-1.5 text-center" 
                            style={{ fontSize: `${printFontSize}px`, letterSpacing: '0.3px' }}
                          >
                            {systemLabels[key]}
                          </div>
                          <div 
                            className="p-2 bg-muted/10 min-h-[40px]"
                            style={{ fontSize: `${printFontSize - 1}px` }}
                            dangerouslySetInnerHTML={{ __html: value || '<span class="text-muted-foreground">-</span>' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {showTodosColumn && getPatientTodos(patient.id).length > 0 && (
                <div className="border-2 border-violet-400 rounded-lg overflow-hidden">
                  <div className="bg-violet-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                    Todos
                  </div>
                  <div className="p-3 bg-violet-50">
                    <ul className="space-y-1">
                      {getPatientTodos(patient.id).map(todo => (
                        <li key={todo.id} className={cn("flex items-start gap-2", todo.completed && "line-through text-muted-foreground")}>
                          {todo.completed ? <CheckSquare className="h-4 w-4 mt-0.5 text-green-500" /> : <Square className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                          <span style={{ fontSize: `${printFontSize}px` }}>{todo.content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {showNotesColumn && (
                <div className="border-2 border-amber-400 rounded-lg overflow-hidden">
                  <div className="bg-amber-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                    Rounding Notes
                  </div>
                  <div className="min-h-[60px] w-full relative p-3 bg-amber-50">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="border-b border-amber-300 h-[14px] w-full" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Get the view type label for the full preview header
  const getViewTypeLabel = () => {
    switch (activeTab) {
      case 'table': return 'Dense Table View';
      case 'cards': return 'Card View';
      case 'list': return 'Detailed List View';
      default: return 'Table View';
    }
  };

  // Full-page preview modal
  if (isFullPreview) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-auto print:overflow-visible">
        {/* Full preview header */}
        <div className="sticky top-0 z-10 bg-white border-b shadow-sm p-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Fullscreen className="h-5 w-5 text-primary" />
              Full Page Preview - {getViewTypeLabel()}
            </h2>
            <span className="text-sm text-muted-foreground">
              This is exactly how your document will look when printed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Now
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsFullPreview(false)}>
              <X className="h-4 w-4" />
              Close Preview
            </Button>
          </div>
        </div>
        
        {/* Full preview content */}
        <div className="p-8 max-w-[1200px] mx-auto" ref={fullPreviewRef}>
          <div className="header flex justify-between items-center mb-6 border-b-2 border-primary pb-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">🏥 Patient Rounding Report</h1>
              <div className="text-sm text-muted-foreground mt-1">{getViewTypeLabel()}</div>
            </div>
            <div className="text-right">
              <div className="font-medium text-lg">{dateStr}</div>
              <div className="text-sm text-muted-foreground">{timeStr} • {patients.length} patients</div>
            </div>
          </div>
          
          {renderFullPreviewContent()}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Print / Export Patient Data
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullPreview(true)}
                className="gap-2"
              >
                <Fullscreen className="h-4 w-4" />
                Full Preview
              </Button>
              {onUpdatePatient && (
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  {isEditMode ? "Editing On" : "Edit Mode"}
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-2 items-center border-b pb-3 mb-2">
          <span className="text-sm font-medium">Export:</span>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <Download className="h-4 w-4 text-red-600" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportDOC} className="gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Word
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportRTF} className="gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            RTF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportTXT} className="gap-2">
            <FileText className="h-4 w-4 text-gray-600" />
            Text
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="border-b pb-3 mb-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Presets:</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                // Enable Systems Review combination
                if (!combinedColumns.includes('systemsReview')) {
                  setCombinedColumns(prev => [...prev.filter(c => c !== 'allContent'), 'systemsReview']);
                }
                // Set landscape orientation
                setPrintOrientation('landscape');
                // Enable smaller font for compactness
                setPrintFontSize(8);
              }}
              className="gap-2 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 border-primary/30"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M7 9h10M7 13h6" />
              </svg>
              Compact Mode
            </Button>
            
            {/* Custom presets */}
            {customPresets.map(preset => (
              <div key={preset.id} className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => loadPreset(preset)}
                  className="gap-2 bg-secondary/50 hover:bg-secondary"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {preset.name}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deletePreset(preset.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            
            {/* Save preset button */}
            {!showSavePreset ? (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowSavePreset(true)}
                className="gap-1 text-xs border border-dashed border-muted-foreground/30 hover:border-primary/50"
              >
                <Plus className="h-3 w-3" />
                Save Current
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="h-7 w-32 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCurrentAsPreset();
                    if (e.key === 'Escape') {
                      setShowSavePreset(false);
                      setNewPresetName('');
                    }
                  }}
                  autoFocus
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveCurrentAsPreset}
                  className="h-7 px-2"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSavePreset(false);
                    setNewPresetName('');
                  }}
                  className="h-7 px-2"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                // Reset to defaults
                setCombinedColumns([]);
                setPrintOrientation('portrait');
                setPrintFontSize(10);
                setColumns(defaultColumns);
                setColumnWidths(defaultColumnWidths);
                setOnePatientPerPage(false);
                setAutoFitFontSize(false);
              }}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All
            </Button>
          </div>
          
          {customPresets.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {customPresets.length} saved preset{customPresets.length !== 1 ? 's' : ''} • Click to apply, × to delete
            </p>
          )}
        </div>

        {/* Column Selection */}
        <Collapsible open={columnsOpen} onOpenChange={setColumnsOpen} className="border-b pb-2 mb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="font-medium">Customize Columns</span>
                <span className="text-xs text-muted-foreground">
                  ({columns.filter(c => c.enabled).length} of {columns.length} selected)
                </span>
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", columnsOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={selectAllColumns}>Select All</Button>
              <Button variant="outline" size="sm" onClick={deselectAllColumns}>Deselect All</Button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {columns.map(col => (
                <label 
                  key={col.key} 
                  className={cn(
                    "flex items-center gap-2 text-xs p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors",
                    col.enabled ? "bg-primary/10 border-primary" : "bg-muted/20 border-muted",
                    col.key === "notes" && "bg-amber-50 border-amber-300"
                  )}
                >
                  <Checkbox 
                    checked={col.enabled}
                    onCheckedChange={() => toggleColumn(col.key)}
                    disabled={col.key === "patient"}
                  />
                  <span className={cn(col.key === "patient" && "text-muted-foreground")}>{col.label}</span>
                </label>
              ))}
            </div>
            
            {/* Column Combinations */}
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Columns className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Combine Columns for Compact Print</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Merge related columns into a single column to reduce table width and fit more on each page.
              </p>
              <div className="flex flex-wrap gap-2">
                {columnCombinations.map(combo => (
                  <label 
                    key={combo.key}
                    className={cn(
                      "flex items-center gap-2 text-xs p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors",
                      combinedColumns.includes(combo.key) 
                        ? "bg-primary/20 border-primary text-primary-foreground" 
                        : "bg-muted/20 border-muted"
                    )}
                  >
                    <Checkbox 
                      checked={combinedColumns.includes(combo.key)}
                      onCheckedChange={() => toggleColumnCombination(combo.key)}
                    />
                    <span className={cn(combinedColumns.includes(combo.key) && "font-medium")}>{combo.label}</span>
                  </label>
                ))}
                {combinedColumns.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCombinedColumns([])}
                    className="h-8 text-xs gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Clear
                  </Button>
                )}
              </div>
              
              {/* Systems Review Column Count - only show when Systems Review is active */}
              {combinedColumns.includes('systemsReview') && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <div className="flex items-center gap-4">
                    <Label className="text-xs font-medium whitespace-nowrap">Systems Review Columns:</Label>
                    <div className="flex gap-1">
                      {[2, 3, 4].map(count => (
                        <Button
                          key={count}
                          variant={systemsReviewColumnCount === count ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSystemsReviewColumnCount(count)}
                          className="h-7 w-8 text-xs"
                        >
                          {count}
                        </Button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      More columns = higher density
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Column Width Controls */}
        <Collapsible open={columnWidthsOpen} onOpenChange={setColumnWidthsOpen} className="border-b pb-2 mb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
              <div className="flex items-center gap-2">
                <Columns className="h-4 w-4" />
                <span className="font-medium">Adjust Column Widths</span>
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", columnWidthsOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Drag sliders to adjust column widths for print preview</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setColumnWidths(defaultColumnWidths)}
                className="h-7 text-xs gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {isColumnEnabled("patient") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Patient</Label>
                    <span className="text-xs text-muted-foreground">{columnWidths.patient}px</span>
                  </div>
                  <Slider
                    value={[columnWidths.patient]}
                    onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, patient: value }))}
                    min={60}
                    max={180}
                    step={5}
                    className="w-full"
                  />
                </div>
              )}
              
              {isColumnEnabled("clinicalSummary") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Summary</Label>
                    <span className="text-xs text-muted-foreground">{columnWidths.summary}px</span>
                  </div>
                  <Slider
                    value={[columnWidths.summary]}
                    onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, summary: value }))}
                    min={100}
                    max={400}
                    step={10}
                    className="w-full"
                  />
                </div>
              )}
              
              {isColumnEnabled("intervalEvents") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Events</Label>
                    <span className="text-xs text-muted-foreground">{columnWidths.events}px</span>
                  </div>
                  <Slider
                    value={[columnWidths.events]}
                    onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, events: value }))}
                    min={100}
                    max={400}
                    step={10}
                    className="w-full"
                  />
                </div>
              )}
              
              {isColumnEnabled("imaging") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-blue-600">Imaging</Label>
                    <span className="text-xs text-muted-foreground">{columnWidths.imaging}px</span>
                  </div>
                  <Slider
                    value={[columnWidths.imaging]}
                    onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, imaging: value }))}
                    min={80}
                    max={300}
                    step={10}
                    className="w-full"
                  />
                </div>
              )}
              
              {isColumnEnabled("labs") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-green-600">Labs</Label>
                    <span className="text-xs text-muted-foreground">{columnWidths.labs}px</span>
                  </div>
                  <Slider
                    value={[columnWidths.labs]}
                    onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, labs: value }))}
                    min={80}
                    max={300}
                    step={10}
                    className="w-full"
                  />
                </div>
              )}
              
              {/* Individual System Column Widths */}
              {enabledSystemKeys.length > 0 && (
                <div className="col-span-full">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">System Columns</Label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        const resetSystems: Partial<ColumnWidthsType> = {};
                        systemKeys.forEach(key => {
                          resetSystems[`systems.${key}` as keyof ColumnWidthsType] = 90;
                        });
                        setColumnWidths(prev => ({ ...prev, ...resetSystems }));
                      }}
                      className="h-6 text-xs gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset Systems
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {enabledSystemKeys.map(key => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium truncate" title={systemLabels[key]}>
                            {SYSTEM_LABELS_SHORT[key]}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {columnWidths[`systems.${key}` as keyof ColumnWidthsType] || 90}px
                          </span>
                        </div>
                        <Slider
                          value={[columnWidths[`systems.${key}` as keyof ColumnWidthsType] || 90]}
                          onValueChange={([value]) => setColumnWidths(prev => ({ 
                            ...prev, 
                            [`systems.${key}`]: value 
                          } as ColumnWidthsType))}
                          min={50}
                          max={180}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {showNotesColumn && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-amber-700">Notes</Label>
                    <span className="text-xs text-muted-foreground">{columnWidths.notes}px</span>
                  </div>
                  <Slider
                    value={[columnWidths.notes]}
                    onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, notes: value }))}
                    min={80}
                    max={300}
                    step={10}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Typography Controls */}
        <Collapsible open={typographyOpen} onOpenChange={setTypographyOpen} className="border-b pb-2 mb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                <span className="font-medium">Typography Settings</span>
                <span className="text-xs text-muted-foreground">
                  ({printFontSize}px • {fontFamilies.find(f => f.value === printFontFamily)?.label})
                </span>
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", typographyOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Font Size Control */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Print Font Size</Label>
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{printFontSize}px</span>
                </div>
                <Slider
                  value={[printFontSize]}
                  onValueChange={([value]) => setPrintFontSize(value)}
                  min={7}
                  max={14}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>7px (compact)</span>
                  <span>14px (large)</span>
                </div>
              </div>

              {/* Font Family Control */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Font Family</Label>
                <Select value={printFontFamily} onValueChange={setPrintFontFamily}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    {fontFamilies.map(font => (
                      <SelectItem 
                        key={font.value} 
                        value={font.value}
                        style={{ fontFamily: font.css }}
                      >
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Preview: <span style={{ fontFamily: getFontFamilyCSS() }}>The quick brown fox jumps</span>
                </p>
              </div>
            </div>
            
            {/* Print Orientation Control */}
            <div className="pt-3 border-t space-y-3">
              <Label className="text-sm font-medium">Page Orientation</Label>
              <div className="flex gap-2">
                <Button
                  variant={printOrientation === 'portrait' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPrintOrientation('portrait')}
                  className="flex-1 gap-2"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                  </svg>
                  Portrait
                </Button>
                <Button
                  variant={printOrientation === 'landscape' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPrintOrientation('landscape')}
                  className="flex-1 gap-2"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                  </svg>
                  Landscape
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Landscape mode provides more horizontal space for tables with many columns.
              </p>
            </div>
            
            {/* Page Layout Control */}
            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox 
                  id="onePatientPerPage" 
                  checked={onePatientPerPage}
                  onCheckedChange={(checked) => setOnePatientPerPage(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="onePatientPerPage" className="text-sm font-medium cursor-pointer">
                    One patient per page
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Each patient starts on a new page without content breaking across pages.
                  </p>
                </div>
              </div>
              
              {onePatientPerPage && (
                <div className="flex items-center gap-3 ml-6 pl-3 border-l-2 border-primary/20">
                  <Checkbox 
                    id="autoFitFontSize" 
                    checked={autoFitFontSize}
                    onCheckedChange={(checked) => setAutoFitFontSize(checked === true)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="autoFitFontSize" className="text-sm font-medium cursor-pointer">
                      Auto-fit font size
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically calculate optimal font size based on content density.
                      {autoFitFontSize && (
                        <span className="ml-1 font-medium text-primary">
                          Calculated: {getEffectiveFontSize()}px
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Tabs defaultValue="table" value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              Dense Table
            </TabsTrigger>
            <TabsTrigger value="cards" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Card View
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Detailed List
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0 mt-4 border rounded-lg h-[30vh] md:h-[40vh] lg:h-[45vh]">
          <div 
            className="p-4 bg-white text-foreground print-content-wrapper"
            style={{ fontFamily: getFontFamilyCSS(), fontSize: `${printFontSize}px` }}
          >
            {/* CSS to force override all inline styles from rich text content */}
            <style>{`
              .print-content-wrapper * {
                font-family: inherit !important;
                font-size: inherit !important;
              }
              .print-content-wrapper [style*="font-size"] {
                font-size: inherit !important;
              }
              .print-content-wrapper [style*="font-family"] {
                font-family: inherit !important;
              }
              .print-content-wrapper span, 
              .print-content-wrapper p, 
              .print-content-wrapper div:not(.font-bold):not([class*="text-"]) {
                font-size: inherit !important;
                font-family: inherit !important;
              }
            `}</style>
            <TabsContent value="table" className="m-0" forceMount style={{ display: activeTab === 'table' ? 'block' : 'none' }}>
              <div ref={tableRef}>
                <div className="header flex justify-between items-center mb-4 border-b-2 border-primary pb-3">
                  <div>
                    <h1 className="font-bold text-primary" style={{ fontSize: `${printFontSize + 6}px` }}>🏥 Patient Rounding Report</h1>
                    <div className="text-muted-foreground mt-1" style={{ fontSize: `${printFontSize - 1}px` }}>Comprehensive patient overview</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{dateStr}</div>
                    <div className="text-muted-foreground" style={{ fontSize: `${printFontSize - 1}px` }}>{timeStr} • {patients.length} patients</div>
                  </div>
                </div>
              
              <div className="text-muted-foreground mb-3 no-print bg-muted/30 p-2 rounded" style={{ fontSize: `${printFontSize - 1}px` }}>
                💡 Click any cell to expand/collapse • {isEditMode && "Double-click to edit •"} Drag column edges to resize
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ tableLayout: 'fixed', fontSize: 'inherit' }}>
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      {isColumnEnabled("patient") && (
                        <ResizableHeader column="patient" width={columnWidths.patient}>
                          Patient
                        </ResizableHeader>
                      )}
                      {/* Check for Summary + Events combination */}
                      {(() => {
                        const summaryEventsCombo = combinedColumns.includes('summaryEvents');
                        const allContentCombo = combinedColumns.includes('allContent');
                        
                        if (allContentCombo && (isColumnEnabled("clinicalSummary") || isColumnEnabled("intervalEvents") || isColumnEnabled("imaging") || isColumnEnabled("labs"))) {
                          const totalWidth = 
                            (isColumnEnabled("clinicalSummary") ? columnWidths.summary : 0) +
                            (isColumnEnabled("intervalEvents") ? columnWidths.events : 0) +
                            (isColumnEnabled("imaging") ? columnWidths.imaging : 0) +
                            (isColumnEnabled("labs") ? columnWidths.labs : 0);
                          return (
                            <th 
                              className="border border-border p-2 text-left font-bold bg-primary text-primary-foreground"
                              style={{ width: totalWidth }}
                            >
                              All Clinical Data
                            </th>
                          );
                        }
                        
                        const headers: JSX.Element[] = [];
                        
                        if (summaryEventsCombo && (isColumnEnabled("clinicalSummary") || isColumnEnabled("intervalEvents"))) {
                          headers.push(
                            <th 
                              key="summaryEvents"
                              className="border border-border p-2 text-left font-bold bg-primary text-primary-foreground"
                              style={{ width: columnWidths.summary + columnWidths.events }}
                            >
                              Summary + Events
                            </th>
                          );
                        } else {
                          if (isColumnEnabled("clinicalSummary")) {
                            headers.push(
                              <ResizableHeader key="summary" column="summary" width={columnWidths.summary}>
                                Clinical Summary
                              </ResizableHeader>
                            );
                          }
                          if (isColumnEnabled("intervalEvents")) {
                            headers.push(
                              <ResizableHeader key="events" column="events" width={columnWidths.events}>
                                Interval Events
                              </ResizableHeader>
                            );
                          }
                        }
                        
                        const imagingLabsCombo = combinedColumns.includes('imagingLabs');
                        if (imagingLabsCombo && (isColumnEnabled("imaging") || isColumnEnabled("labs"))) {
                          headers.push(
                            <th 
                              key="imagingLabs"
                              className="border border-border p-2 text-left font-bold bg-primary text-primary-foreground"
                              style={{ width: columnWidths.imaging + columnWidths.labs }}
                            >
                              Imaging + Labs
                            </th>
                          );
                        } else {
                          if (isColumnEnabled("imaging")) {
                            headers.push(
                              <ResizableHeader key="imaging" column="imaging" width={columnWidths.imaging}>
                                Imaging
                              </ResizableHeader>
                            );
                          }
                          if (isColumnEnabled("labs")) {
                            headers.push(
                              <ResizableHeader key="labs" column="labs" width={columnWidths.labs}>
                                Labs
                              </ResizableHeader>
                            );
                          }
                        }
                        
                        return headers;
                      })()}
                      {/* Check for Systems Review combination */}
                      {(() => {
                        const systemsComboActive = combinedColumns.includes('systemsReview') && enabledSystemKeys.length > 0;
                        if (systemsComboActive) {
                          const totalSystemWidth = enabledSystemKeys.reduce((sum, key) => 
                            sum + (columnWidths[`systems.${key}` as keyof ColumnWidthsType] || 90), 0
                          );
                          return (
                            <th 
                              className="border border-border p-2 text-left font-bold bg-primary text-primary-foreground"
                              style={{ width: totalSystemWidth }}
                            >
                              Systems Review
                            </th>
                          );
                        }
                        return enabledSystemKeys.map((key) => (
                          <ResizableHeader 
                            key={key} 
                            column={`systems.${key}`} 
                            width={columnWidths[`systems.${key}` as keyof ColumnWidthsType] || 90}
                          >
                            {systemLabels[key]}
                          </ResizableHeader>
                        ));
                      })()}
                      {showNotesColumn && (
                        <ResizableHeader column="notes" width={columnWidths.notes} className="bg-amber-500 text-white">
                          Notes
                        </ResizableHeader>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient, idx) => (
                      <tr key={patient.id} className={cn(
                        idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                        "border-b-2 border-primary/30"
                      )} style={{ borderBottom: '2px solid hsl(var(--primary) / 0.4)' }}>
                        {isColumnEnabled("patient") && (
                          <td className="border border-border p-2 align-top">
                            <div className="font-bold text-primary" style={{ fontSize: `${printFontSize + 1}px` }}>{patient.name || 'Unnamed'}</div>
                            <div className="text-muted-foreground" style={{ fontSize: `${printFontSize - 1}px` }}>Bed: {patient.bed || 'N/A'}</div>
                          </td>
                        )}
                        {/* Render cells based on column combinations */}
                        {(() => {
                          const summaryEventsCombo = combinedColumns.includes('summaryEvents');
                          const imagingLabsCombo = combinedColumns.includes('imagingLabs');
                          const allContentCombo = combinedColumns.includes('allContent');
                          
                          const cells: JSX.Element[] = [];
                          
                          if (allContentCombo && (isColumnEnabled("clinicalSummary") || isColumnEnabled("intervalEvents") || isColumnEnabled("imaging") || isColumnEnabled("labs"))) {
                            cells.push(
                              <td key="allContent" className="border border-border p-2 align-top">
                                {isColumnEnabled("clinicalSummary") && patient.clinicalSummary && (
                                  <div className="mb-2">
                                    <strong className="text-primary">Summary:</strong>{' '}
                                    <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.clinicalSummary) }} />
                                  </div>
                                )}
                                {isColumnEnabled("intervalEvents") && patient.intervalEvents && (
                                  <div className="mb-2">
                                    <strong className="text-primary">Events:</strong>{' '}
                                    <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.intervalEvents) }} />
                                  </div>
                                )}
                                {isColumnEnabled("imaging") && patient.imaging && (
                                  <div className="mb-2">
                                    <strong className="text-blue-600">Imaging:</strong>{' '}
                                    <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.imaging) }} />
                                  </div>
                                )}
                                {isColumnEnabled("labs") && patient.labs && (
                                  <div className="mb-2">
                                    <strong className="text-green-600">Labs:</strong>{' '}
                                    <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.labs) }} />
                                  </div>
                                )}
                              </td>
                            );
                          } else {
                            if (summaryEventsCombo && (isColumnEnabled("clinicalSummary") || isColumnEnabled("intervalEvents"))) {
                              cells.push(
                                <td key="summaryEvents" className="border border-border p-2 align-top">
                                  {isColumnEnabled("clinicalSummary") && patient.clinicalSummary && (
                                    <div className="mb-2">
                                      <strong className="text-primary">Summary:</strong>{' '}
                                      <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.clinicalSummary) }} />
                                    </div>
                                  )}
                                  {isColumnEnabled("intervalEvents") && patient.intervalEvents && (
                                    <div>
                                      <strong className="text-primary">Events:</strong>{' '}
                                      <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.intervalEvents) }} />
                                    </div>
                                  )}
                                </td>
                              );
                            } else {
                              if (isColumnEnabled("clinicalSummary")) {
                                cells.push(<ExpandableCell key="summary" patient={patient} field="clinicalSummary" className="border border-border" />);
                              }
                              if (isColumnEnabled("intervalEvents")) {
                                cells.push(<ExpandableCell key="events" patient={patient} field="intervalEvents" className="border border-border" />);
                              }
                            }
                            
                            if (imagingLabsCombo && (isColumnEnabled("imaging") || isColumnEnabled("labs"))) {
                              cells.push(
                                <td key="imagingLabs" className="border border-border p-2 align-top">
                                  {isColumnEnabled("imaging") && patient.imaging && (
                                    <div className="mb-2">
                                      <strong className="text-blue-600">Imaging:</strong>{' '}
                                      <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.imaging) }} />
                                    </div>
                                  )}
                                  {isColumnEnabled("labs") && patient.labs && (
                                    <div>
                                      <strong className="text-green-600">Labs:</strong>{' '}
                                      <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.labs) }} />
                                    </div>
                                  )}
                                </td>
                              );
                            } else {
                              if (isColumnEnabled("imaging")) {
                                cells.push(<ExpandableCell key="imaging" patient={patient} field="imaging" className="border border-border" />);
                              }
                              if (isColumnEnabled("labs")) {
                                cells.push(<ExpandableCell key="labs" patient={patient} field="labs" className="border border-border" />);
                              }
                            }
                          }
                          
                          return cells;
                        })()}
                        {/* Check for Systems Review combination in cells */}
                        {(() => {
                          const systemsComboActive = combinedColumns.includes('systemsReview') && enabledSystemKeys.length > 0;
                          if (systemsComboActive) {
                            // Multi-column layout for Systems Review - flows to adjacent columns, keeps each system intact
                            return (
                              <td className="border border-border p-2 align-top">
                                <div 
                                  className="systems-review-columns"
                                  style={{
                                    columns: `${systemsReviewColumnCount}`,
                                    columnGap: '1rem',
                                    columnFill: 'balance',
                                  }}
                                >
                                  {enabledSystemKeys.map(key => {
                                    const value = patient.systems[key as keyof typeof patient.systems];
                                    if (!value) return null;
                                    return (
                                      <div 
                                        key={key} 
                                        className="mb-2"
                                        style={{
                                          breakInside: 'avoid',
                                          pageBreakInside: 'avoid',
                                          display: 'inline-block',
                                          width: '100%',
                                        } as React.CSSProperties}
                                      >
                                        <strong className="text-primary">{systemLabels[key]}:</strong>{' '}
                                        <span dangerouslySetInnerHTML={{ __html: cleanInlineStyles(value) }} />
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          }
                          return enabledSystemKeys.map(key => (
                            <ExpandableCell 
                              key={key} 
                              patient={patient} 
                              field={`systems.${key}`} 
                              className="border border-border"
                            />
                          ));
                        })()}
                        {showNotesColumn && <NotesCell patient={patient} />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </TabsContent>

            <TabsContent value="cards" className="m-0" forceMount style={{ display: activeTab === 'cards' ? 'block' : 'none' }}>
              <div ref={cardsRef}>
                <div className="header flex justify-between items-center mb-4 border-b-2 border-primary pb-3">
                  <div>
                    <h1 className="font-bold text-primary" style={{ fontSize: `${printFontSize + 6}px` }}>🏥 Patient Rounding Report</h1>
                    <div className="text-muted-foreground mt-1" style={{ fontSize: `${printFontSize - 1}px` }}>Card-based patient summary</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{dateStr}</div>
                    <div className="text-muted-foreground" style={{ fontSize: `${printFontSize - 1}px` }}>{timeStr} • {patients.length} patients</div>
                  </div>
                </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {patients.map((patient, idx) => (
                  <div key={patient.id} className="border-3 border-primary rounded-lg overflow-hidden bg-card shadow-lg break-inside-avoid">
                    {/* Patient header - full width colored bar */}
                    <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="bg-white text-primary rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </span>
                        <span className="font-bold" style={{ fontSize: `${printFontSize + 3}px` }}>
                          {patient.name || 'Unnamed'}
                        </span>
                      </div>
                      {patient.bed && (
                        <span className="bg-white/20 px-3 py-1 rounded text-sm font-medium">
                          Bed: {patient.bed}
                        </span>
                      )}
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {isColumnEnabled("clinicalSummary") && patient.clinicalSummary && (
                        <div className="border-2 border-primary/30 rounded-lg overflow-hidden">
                          <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                            Clinical Summary
                          </div>
                          <div 
                            className="bg-muted/30 p-3"
                            dangerouslySetInnerHTML={{ __html: patient.clinicalSummary }}
                          />
                        </div>
                      )}
                      
                      {isColumnEnabled("intervalEvents") && patient.intervalEvents && (
                        <div className="border-2 border-primary/30 rounded-lg overflow-hidden">
                          <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                            Interval Events
                          </div>
                          <div 
                            className="bg-muted/30 p-3"
                            dangerouslySetInnerHTML={{ __html: patient.intervalEvents }}
                          />
                        </div>
                      )}
                      
                      {/* Imaging & Labs row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {isColumnEnabled("imaging") && patient.imaging && (
                          <div className="border-2 border-blue-400 rounded-lg overflow-hidden">
                            <div className="bg-blue-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                              Imaging
                            </div>
                            <div 
                              className="bg-blue-50 p-3"
                              dangerouslySetInnerHTML={{ __html: patient.imaging }}
                            />
                          </div>
                        )}
                        {isColumnEnabled("labs") && patient.labs && (
                          <div className="border-2 border-green-400 rounded-lg overflow-hidden">
                            <div className="bg-green-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                              Labs
                            </div>
                            <div 
                              className="bg-green-50 p-3"
                              dangerouslySetInnerHTML={{ __html: patient.labs }}
                            />
                          </div>
                        )}
                      </div>
                      
                      {enabledSystemKeys.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {enabledSystemKeys.map(key => {
                            const value = patient.systems[key as keyof typeof patient.systems];
                            if (!value) return null;
                            return (
                              <div key={key} className="border-2 border-primary rounded-lg overflow-hidden">
                                <div 
                                  className="bg-primary text-white font-bold uppercase px-2 py-1.5 text-center" 
                                  style={{ fontSize: `${printFontSize}px`, letterSpacing: '0.5px' }}
                                >
                                  {systemLabels[key]}
                                </div>
                                <div className="p-2 bg-muted/20" dangerouslySetInnerHTML={{ __html: value }} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {showNotesColumn && (
                        <div className="border-2 border-amber-400 rounded-lg overflow-hidden">
                          <div className="bg-amber-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                            Rounding Notes
                          </div>
                          <div className="min-h-[60px] w-full relative p-3 bg-amber-50">
                            {[...Array(4)].map((_, i) => (
                              <div 
                                key={i} 
                                className="border-b border-amber-300 h-[14px] w-full"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </TabsContent>

            <TabsContent value="list" className="m-0" forceMount style={{ display: activeTab === 'list' ? 'block' : 'none' }}>
              <div ref={listRef}>
                <div className="header flex justify-between items-center mb-4 border-b-2 border-primary pb-3">
                  <div>
                    <h1 className="font-bold text-primary" style={{ fontSize: `${printFontSize + 6}px` }}>🏥 Patient Rounding Report</h1>
                    <div className="text-muted-foreground mt-1" style={{ fontSize: `${printFontSize - 1}px` }}>Detailed patient documentation</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{dateStr}</div>
                    <div className="text-muted-foreground" style={{ fontSize: `${printFontSize - 1}px` }}>{timeStr} • {patients.length} patients</div>
                  </div>
                </div>
              
              <div className="space-y-6">
                {patients.map((patient, index) => (
                  <div key={patient.id} className="border-4 border-primary rounded-lg overflow-hidden mb-4 break-inside-avoid shadow-md">
                    {/* Patient header bar */}
                    <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="bg-white text-primary rounded-full w-10 h-10 flex items-center justify-center font-bold" style={{ fontSize: `${printFontSize + 2}px` }}>
                          {index + 1}
                        </span>
                        <span className="font-bold" style={{ fontSize: `${printFontSize + 4}px` }}>{patient.name || 'Unnamed'}</span>
                      </div>
                      {patient.bed && (
                        <span className="bg-white/20 px-4 py-1.5 rounded font-medium" style={{ fontSize: `${printFontSize}px` }}>
                          Bed: {patient.bed}
                        </span>
                      )}
                    </div>
                    
                    <div className="p-4 space-y-4 bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isColumnEnabled("clinicalSummary") && (
                          <div className="border-2 border-primary/40 rounded-lg overflow-hidden">
                            <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                              Clinical Summary
                            </div>
                            <div 
                              className="p-3 bg-muted/20"
                              dangerouslySetInnerHTML={{ __html: patient.clinicalSummary || '<span class="text-muted-foreground italic">None documented</span>' }}
                            />
                          </div>
                        )}
                        {isColumnEnabled("intervalEvents") && (
                          <div className="border-2 border-primary/40 rounded-lg overflow-hidden">
                            <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                              Interval Events
                            </div>
                            <div 
                              className="p-3 bg-muted/20"
                              dangerouslySetInnerHTML={{ __html: patient.intervalEvents || '<span class="text-muted-foreground italic">None documented</span>' }}
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Imaging & Labs row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isColumnEnabled("imaging") && (
                          <div className="border-2 border-blue-400 rounded-lg overflow-hidden">
                            <div className="bg-blue-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                              Imaging
                            </div>
                            <div 
                              className="p-3 bg-blue-50"
                              dangerouslySetInnerHTML={{ __html: patient.imaging || '<span class="text-muted-foreground italic">None documented</span>' }}
                            />
                          </div>
                        )}
                        {isColumnEnabled("labs") && (
                          <div className="border-2 border-green-400 rounded-lg overflow-hidden">
                            <div className="bg-green-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                              Labs
                            </div>
                            <div 
                              className="p-3 bg-green-50"
                              dangerouslySetInnerHTML={{ __html: patient.labs || '<span class="text-muted-foreground italic">None documented</span>' }}
                            />
                          </div>
                        )}
                      </div>
                      
                      {enabledSystemKeys.length > 0 && (
                        <div>
                          <div className="bg-primary text-white font-bold uppercase px-3 py-2 rounded-t-lg" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                            Systems Review
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 border-2 border-t-0 border-primary rounded-b-lg overflow-hidden">
                            {enabledSystemKeys.map((key, sysIdx) => {
                              const value = patient.systems[key as keyof typeof patient.systems];
                              return (
                                <div key={key} className={cn(
                                  "border-r border-b border-primary/30",
                                  sysIdx % 5 === 4 && "border-r-0"
                                )}>
                                  <div 
                                    className="bg-primary/90 text-white font-bold uppercase px-2 py-1.5 text-center" 
                                    style={{ fontSize: `${printFontSize}px`, letterSpacing: '0.3px' }}
                                  >
                                    {systemLabels[key]}
                                  </div>
                                  <div 
                                    className="p-2 bg-muted/10 min-h-[40px]"
                                    dangerouslySetInnerHTML={{ __html: value || '<span class="text-muted-foreground">-</span>' }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {showNotesColumn && (
                        <div className="border-2 border-amber-400 rounded-lg overflow-hidden">
                          <div className="bg-amber-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                            Rounding Notes
                          </div>
                          <div className="min-h-[60px] w-full relative p-3 bg-amber-50">
                            {[...Array(4)].map((_, i) => (
                              <div 
                                key={i} 
                                className="border-b border-amber-300 h-[14px] w-full"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </TabsContent>
          </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleDownloadPDFFromPrintView} className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
