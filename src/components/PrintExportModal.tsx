import type { Patient, PatientSystems } from "@/types/patient";
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
  Square
} from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Checkbox } from "@/components/ui/checkbox";
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
}

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
  const defaultColumnWidths = {
    patient: 100,
    summary: 150,
    events: 150,
    imaging: 120,
    labs: 120,
    systems: 90,
    notes: 140
  };
  const [columnWidths, setColumnWidths] = useState(defaultColumnWidths);
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
  const [patientNotes, setPatientNotes] = useState<Record<string, string>>({});
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
  const { toast } = useToast();

  // Save one patient per page preference
  useEffect(() => {
    localStorage.setItem('printOnePatientPerPage', onePatientPerPage.toString());
  }, [onePatientPerPage]);

  // Save auto-fit preference
  useEffect(() => {
    localStorage.setItem('printAutoFitFontSize', autoFitFontSize.toString());
  }, [autoFitFontSize]);

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

  // Drag-to-resize handlers
  const handleResizeStart = useCallback((column: string, startWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing({ column, startX: e.clientX, startWidth });
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(50, Math.min(400, resizing.startWidth + diff));
    setColumnWidths(prev => ({ ...prev, [resizing.column]: newWidth }));
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

  const isColumnEnabled = (key: string): boolean => {
    return columns.find(c => c.key === key)?.enabled ?? false;
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
    const fontCSS = getFontFamilyCSS();
    const baseFontSize = printFontSize;
    const headerFontSize = Math.max(baseFontSize + 6, 14);
    const patientNameSize = Math.max(baseFontSize + 1, 9);
    
    let contentHTML = '';
    
    if (activeTab === 'table') {
      // Table view HTML
      let tableHeaders = '';
      if (isColumnEnabled("patient")) {
        tableHeaders += `<th style="width: ${columnWidths.patient}px;">Patient</th>`;
      }
      if (isColumnEnabled("clinicalSummary")) {
        tableHeaders += `<th style="width: ${columnWidths.summary}px;">Clinical Summary</th>`;
      }
      if (isColumnEnabled("intervalEvents")) {
        tableHeaders += `<th style="width: ${columnWidths.events}px;">Interval Events</th>`;
      }
      if (isColumnEnabled("imaging")) {
        tableHeaders += `<th style="width: ${columnWidths.imaging}px;">Imaging</th>`;
      }
      if (isColumnEnabled("labs")) {
        tableHeaders += `<th style="width: ${columnWidths.labs}px;">Labs</th>`;
      }
      enabledSystemKeys.forEach(key => {
        tableHeaders += `<th style="width: ${columnWidths.systems}px;">${systemLabels[key]}</th>`;
      });
      if (showTodosColumn) {
        tableHeaders += `<th class="todos-header" style="width: ${columnWidths.notes}px;">Todos</th>`;
      }
      if (showNotesColumn) {
        tableHeaders += `<th class="notes-header" style="width: ${columnWidths.notes}px;">Notes</th>`;
      }
      
      let tableRows = '';
      patients.forEach((patient, idx) => {
        // For one-per-page in table view, wrap each row in a separate table
        if (onePatientPerPage) {
          let singleRow = `<tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">`;
          
          if (isColumnEnabled("patient")) {
            singleRow += `<td class="patient-cell">
              <div class="patient-name">${patient.name || 'Unnamed'}</div>
              <div class="bed">Bed: ${patient.bed || 'N/A'}</div>
            </td>`;
          }
          if (isColumnEnabled("clinicalSummary")) {
            singleRow += `<td class="content-cell">${cleanInlineStyles(patient.clinicalSummary) || ''}</td>`;
          }
          if (isColumnEnabled("intervalEvents")) {
            singleRow += `<td class="content-cell">${cleanInlineStyles(patient.intervalEvents) || ''}</td>`;
          }
          if (isColumnEnabled("imaging")) {
            singleRow += `<td class="content-cell">${cleanInlineStyles(patient.imaging) || ''}</td>`;
          }
          if (isColumnEnabled("labs")) {
            singleRow += `<td class="content-cell">${cleanInlineStyles(patient.labs) || ''}</td>`;
          }
          enabledSystemKeys.forEach(key => {
            singleRow += `<td class="content-cell system-cell">${cleanInlineStyles(patient.systems[key as keyof typeof patient.systems]) || ''}</td>`;
          });
          if (showTodosColumn) {
            const todos = getPatientTodos(patient.id);
            singleRow += `<td class="content-cell todos-cell">${formatTodosHtml(todos)}</td>`;
          }
          if (showNotesColumn) {
            singleRow += `<td class="notes-cell">
              <div class="notes-lines">
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
              </div>
            </td>`;
          }
          singleRow += '</tr>';
          
          tableRows += `
            <div class="patient-page-wrapper">
              <table class="data-table single-patient-table">
                <thead><tr>${tableHeaders}</tr></thead>
                <tbody>${singleRow}</tbody>
              </table>
            </div>
          `;
        } else {
          let row = `<tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">`;
          
          if (isColumnEnabled("patient")) {
            row += `<td class="patient-cell">
              <div class="patient-name">${patient.name || 'Unnamed'}</div>
              <div class="bed">Bed: ${patient.bed || 'N/A'}</div>
            </td>`;
          }
          if (isColumnEnabled("clinicalSummary")) {
            row += `<td class="content-cell">${cleanInlineStyles(patient.clinicalSummary) || ''}</td>`;
          }
          if (isColumnEnabled("intervalEvents")) {
            row += `<td class="content-cell">${cleanInlineStyles(patient.intervalEvents) || ''}</td>`;
          }
          if (isColumnEnabled("imaging")) {
            row += `<td class="content-cell">${cleanInlineStyles(patient.imaging) || ''}</td>`;
          }
          if (isColumnEnabled("labs")) {
            row += `<td class="content-cell">${cleanInlineStyles(patient.labs) || ''}</td>`;
          }
          enabledSystemKeys.forEach(key => {
            row += `<td class="content-cell system-cell">${cleanInlineStyles(patient.systems[key as keyof typeof patient.systems]) || ''}</td>`;
          });
          if (showTodosColumn) {
            const todos = getPatientTodos(patient.id);
            row += `<td class="content-cell todos-cell">${formatTodosHtml(todos)}</td>`;
          }
          if (showNotesColumn) {
            row += `<td class="notes-cell">
              <div class="notes-lines">
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
              </div>
            </td>`;
          }
          
          row += '</tr>';
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
      // Card view HTML
      let cardsHTML = '<div class="cards-grid">';
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
        
        cardsHTML += `
          <div class="patient-card${onePatientPerPage ? ' patient-page-wrapper' : ''}">
            <div class="card-header">
              <span class="patient-number">${idx + 1}</span>
              <span class="patient-name">${patient.name || 'Unnamed'}</span>
              ${patient.bed ? `<span class="patient-bed">Bed: ${patient.bed}</span>` : ''}
            </div>
            <div class="card-body">${cardContent}</div>
          </div>
        `;
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
              page-break-after: always;
              page-break-inside: avoid;
              break-after: page;
              break-inside: avoid;
            }
            .patient-page-wrapper:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .single-patient-table {
              height: auto;
              max-height: 100vh;
            }
            ${onePatientPerPage ? `
            .cards-grid {
              display: block;
            }
            .cards-grid .patient-card {
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
              }
              .patient-page-wrapper:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
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
                    style={{ width: columnWidths.systems, fontSize: `${printFontSize}px` }}
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
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
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
              
              {enabledSystemKeys.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Systems (each)</Label>
                    <span className="text-xs text-muted-foreground">{columnWidths.systems}px</span>
                  </div>
                  <Slider
                    value={[columnWidths.systems]}
                    onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, systems: value }))}
                    min={50}
                    max={180}
                    step={5}
                    className="w-full"
                  />
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

        <Tabs defaultValue="table" value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
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

          <div 
            className="flex-1 overflow-auto mt-4 border rounded-lg p-4 bg-white text-foreground print-content-wrapper"
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
                      {isColumnEnabled("clinicalSummary") && (
                        <ResizableHeader column="summary" width={columnWidths.summary}>
                          Clinical Summary
                        </ResizableHeader>
                      )}
                      {isColumnEnabled("intervalEvents") && (
                        <ResizableHeader column="events" width={columnWidths.events}>
                          Interval Events
                        </ResizableHeader>
                      )}
                      {isColumnEnabled("imaging") && (
                        <ResizableHeader column="imaging" width={columnWidths.imaging}>
                          Imaging
                        </ResizableHeader>
                      )}
                      {isColumnEnabled("labs") && (
                        <ResizableHeader column="labs" width={columnWidths.labs}>
                          Labs
                        </ResizableHeader>
                      )}
                      {enabledSystemKeys.map((key, idx) => (
                        <ResizableHeader 
                          key={key} 
                          column="systems" 
                          width={columnWidths.systems}
                        >
                          {systemLabels[key]}
                        </ResizableHeader>
                      ))}
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
                        {isColumnEnabled("clinicalSummary") && (
                          <ExpandableCell patient={patient} field="clinicalSummary" className="border border-border" />
                        )}
                        {isColumnEnabled("intervalEvents") && (
                          <ExpandableCell patient={patient} field="intervalEvents" className="border border-border" />
                        )}
                        {isColumnEnabled("imaging") && (
                          <ExpandableCell patient={patient} field="imaging" className="border border-border" />
                        )}
                        {isColumnEnabled("labs") && (
                          <ExpandableCell patient={patient} field="labs" className="border border-border" />
                        )}
                        {enabledSystemKeys.map(key => (
                          <ExpandableCell 
                            key={key} 
                            patient={patient} 
                            field={`systems.${key}`} 
                            className="border border-border"
                          />
                        ))}
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

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90">
              <Printer className="h-4 w-4 mr-2" />
              Print Selected Format
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
