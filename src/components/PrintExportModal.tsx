import type { Patient, PatientSystems } from "@/types/patient";
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
  X
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

interface PrintExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
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

export const PrintExportModal = ({ open, onOpenChange, patients, onUpdatePatient }: PrintExportModalProps) => {
  const printRef = useRef<HTMLDivElement>(null);
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
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [patientNotes, setPatientNotes] = useState<Record<string, string>>({});
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [resizing, setResizing] = useState<{ column: string; startX: number; startWidth: number } | null>(null);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const { toast } = useToast();

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

  const toggleColumn = (key: string) => {
    setColumns(prev => prev.map(col => 
      col.key === key ? { ...col, enabled: !col.enabled } : col
    ));
  };

  const selectAllColumns = () => {
    setColumns(prev => prev.map(col => ({ ...col, enabled: true })));
  };

  const deselectAllColumns = () => {
    setColumns(prev => prev.map(col => 
      col.key === "patient" ? col : { ...col, enabled: false }
    ));
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

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Patient Rounding Report - ${new Date().toLocaleDateString()}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              font-size: 9px; 
              line-height: 1.3; 
              color: #1a1a1a; 
              padding: 8px;
              background: #fff;
            }
            h1 { font-size: 14px; margin-bottom: 4px; color: #1e40af; }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              margin-bottom: 8px; 
              border-bottom: 3px solid #1e40af; 
              padding-bottom: 6px; 
            }
            .header-info { font-size: 8px; color: #4b5563; }
            .report-meta { 
              background: #f1f5f9; 
              padding: 6px 10px; 
              border-radius: 4px; 
              margin-bottom: 10px;
              display: flex;
              gap: 20px;
              font-size: 8px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 8px; 
              table-layout: fixed; 
            }
            th, td { 
              border: 1px solid #d1d5db; 
              padding: 4px 5px; 
              text-align: left; 
              vertical-align: top; 
              word-wrap: break-word; 
              overflow-wrap: break-word;
              white-space: pre-wrap !important;
              max-width: none !important;
            }
            th { 
              background: linear-gradient(180deg, #1e40af 0%, #1e3a8a 100%); 
              color: #fff;
              font-weight: 600; 
              font-size: 8px; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            td { font-size: 8px; background: #fff; }
            tr:nth-child(even) td { background: #f8fafc; }
            tr:hover td { background: #e0f2fe; }
            .patient-name { font-weight: 700; color: #1e40af; font-size: 9px; }
            .bed { color: #6b7280; font-size: 7px; display: block; margin-top: 2px; }
            .content { white-space: pre-wrap !important; word-break: break-word; }
            .line-clamp-3 { 
              -webkit-line-clamp: unset !important; 
              display: block !important; 
              overflow: visible !important;
              max-height: none !important;
            }
            .system-label { font-weight: 600; color: #374151; display: block; font-size: 7px; margin-bottom: 1px; }
            .no-break { page-break-inside: avoid; }
            .notes-cell { background: #fffbeb !important; }
            @media print {
              @page { size: landscape; margin: 0.3in; }
              body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
              th { background: #1e40af !important; color: #fff !important; }
              tr:nth-child(even) td { background: #f8fafc !important; }
              .notes-cell { background: #fffbeb !important; }
              td, th { 
                white-space: pre-wrap !important; 
                overflow: visible !important;
                max-height: none !important;
              }
              .line-clamp-3 { 
                -webkit-line-clamp: unset !important; 
                display: block !important; 
                overflow: visible !important;
              }
            }
            .card-view { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .patient-card { 
              border: 2px solid #1e40af; 
              border-radius: 6px;
              padding: 8px; 
              page-break-inside: avoid; 
              background: #fff;
            }
            .patient-card h3 { 
              font-size: 11px; 
              border-bottom: 2px solid #1e40af; 
              padding-bottom: 4px; 
              margin-bottom: 6px; 
              color: #1e40af;
            }
            .section { margin-bottom: 6px; }
            .section-title { 
              font-weight: 700; 
              font-size: 8px; 
              color: #1e40af; 
              margin-bottom: 2px;
              text-transform: uppercase;
            }
            .section-content { 
              font-size: 8px; 
              background: #f8fafc; 
              padding: 4px 6px; 
              border-radius: 3px;
              border-left: 3px solid #1e40af;
            }
            .systems-grid { 
              display: grid; 
              grid-template-columns: repeat(5, 1fr); 
              gap: 4px; 
              font-size: 7px; 
            }
            .system-item { 
              border: 1px solid #e5e7eb; 
              padding: 4px; 
              background: #f8fafc; 
              border-radius: 3px;
            }
            .system-item .label { 
              font-weight: 700; 
              font-size: 6px; 
              color: #1e40af; 
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .list-view .patient-item { 
              border-bottom: 2px solid #e5e7eb; 
              padding: 8px 0; 
              page-break-inside: avoid; 
            }
            .empty { color: #9ca3af; font-style: italic; }
            .footer {
              margin-top: 10px;
              padding-top: 6px;
              border-top: 1px solid #d1d5db;
              font-size: 7px;
              color: #6b7280;
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <div class="footer">
            Generated by Patient Rounding Assistant • ${new Date().toLocaleString()} • Page 1
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
            "text-xs whitespace-pre-wrap break-words",
            !expanded && "line-clamp-3"
          )}
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

  // Full-page preview modal
  if (isFullPreview) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-auto print:overflow-visible">
        {/* Full preview header */}
        <div className="sticky top-0 z-10 bg-white border-b shadow-sm p-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Fullscreen className="h-5 w-5 text-primary" />
              Full Page Preview
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
        <div className="p-8 max-w-[1200px] mx-auto" ref={printRef}>
          <div className="header flex justify-between items-center mb-6 border-b-2 border-primary pb-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">🏥 Patient Rounding Report</h1>
              <div className="text-sm text-muted-foreground mt-1">Full page print preview</div>
            </div>
            <div className="text-right">
              <div className="font-medium text-lg">{dateStr}</div>
              <div className="text-sm text-muted-foreground">{timeStr} • {patients.length} patients</div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  {isColumnEnabled("patient") && (
                    <th className="border border-border p-3 text-left font-bold" style={{ width: columnWidths.patient }}>
                      Patient
                    </th>
                  )}
                  {isColumnEnabled("clinicalSummary") && (
                    <th className="border border-border p-3 text-left font-bold" style={{ width: columnWidths.summary }}>
                      Clinical Summary
                    </th>
                  )}
                  {isColumnEnabled("intervalEvents") && (
                    <th className="border border-border p-3 text-left font-bold" style={{ width: columnWidths.events }}>
                      Interval Events
                    </th>
                  )}
                  {isColumnEnabled("imaging") && (
                    <th className="border border-border p-3 text-left font-bold" style={{ width: columnWidths.imaging }}>
                      Imaging
                    </th>
                  )}
                  {isColumnEnabled("labs") && (
                    <th className="border border-border p-3 text-left font-bold" style={{ width: columnWidths.labs }}>
                      Labs
                    </th>
                  )}
                  {enabledSystemKeys.map(key => (
                    <th 
                      key={key} 
                      className="border border-border p-3 text-left font-bold text-xs"
                      style={{ width: columnWidths.systems }}
                    >
                      {systemLabels[key]}
                    </th>
                  ))}
                  {showNotesColumn && (
                    <th 
                      className="border border-border p-3 text-left font-bold bg-amber-500 text-white"
                      style={{ width: columnWidths.notes }}
                    >
                      Notes
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {patients.map((patient, idx) => (
                  <tr key={patient.id} className={cn("border-b", idx % 2 === 0 ? "bg-white" : "bg-muted/20")}>
                    {isColumnEnabled("patient") && (
                      <td className="border border-border p-3 align-top">
                        <div className="font-bold text-primary">{patient.name || 'Unnamed'}</div>
                        <div className="text-xs text-muted-foreground">Bed: {patient.bed || 'N/A'}</div>
                      </td>
                    )}
                    {isColumnEnabled("clinicalSummary") && (
                      <td className="border border-border p-3 align-top">
                        <div 
                          className="text-sm whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: patient.clinicalSummary }}
                        />
                      </td>
                    )}
                    {isColumnEnabled("intervalEvents") && (
                      <td className="border border-border p-3 align-top">
                        <div 
                          className="text-sm whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: patient.intervalEvents }}
                        />
                      </td>
                    )}
                    {isColumnEnabled("imaging") && (
                      <td className="border border-border p-3 align-top">
                        <div 
                          className="text-sm whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: patient.imaging }}
                        />
                      </td>
                    )}
                    {isColumnEnabled("labs") && (
                      <td className="border border-border p-3 align-top">
                        <div 
                          className="text-sm whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: patient.labs }}
                        />
                      </td>
                    )}
                    {enabledSystemKeys.map(key => (
                      <td key={key} className="border border-border p-2 align-top">
                        <div 
                          className="text-xs whitespace-pre-wrap break-words"
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
        <div className="flex gap-2 items-center border-b pb-3 mb-2">
          <span className="text-sm font-medium">Export:</span>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel (.xlsx)
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <Download className="h-4 w-4 text-red-600" />
            PDF
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

        <Tabs defaultValue="table" className="flex-1 overflow-hidden flex flex-col">
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

          <div className="flex-1 overflow-auto mt-4 border rounded-lg p-4 bg-white text-foreground" ref={printRef}>
            <TabsContent value="table" className="m-0">
              <div className="header flex justify-between items-center mb-4 border-b-2 border-primary pb-3">
                <div>
                  <h1 className="text-xl font-bold text-primary">🏥 Patient Rounding Report</h1>
                  <div className="text-xs text-muted-foreground mt-1">Comprehensive patient overview</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{dateStr}</div>
                  <div className="text-xs text-muted-foreground">{timeStr} • {patients.length} patients</div>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground mb-3 no-print bg-muted/30 p-2 rounded">
                💡 Click any cell to expand/collapse • {isEditMode && "Double-click to edit •"} Drag column edges to resize
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
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
                          className="text-[10px]"
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
                      <tr key={patient.id} className={cn("border-b", idx % 2 === 0 ? "bg-white" : "bg-muted/20")}>
                        {isColumnEnabled("patient") && (
                          <td className="border border-border p-2 align-top">
                            <div className="font-bold text-sm text-primary">{patient.name || 'Unnamed'}</div>
                            <div className="text-[10px] text-muted-foreground">Bed: {patient.bed || 'N/A'}</div>
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
            </TabsContent>

            <TabsContent value="cards" className="m-0">
              <div className="header flex justify-between items-center mb-4 border-b-2 border-primary pb-3">
                <div>
                  <h1 className="text-xl font-bold text-primary">🏥 Patient Rounding Report</h1>
                  <div className="text-xs text-muted-foreground mt-1">Card-based patient summary</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{dateStr}</div>
                  <div className="text-xs text-muted-foreground">{timeStr} • {patients.length} patients</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {patients.map((patient) => (
                  <div key={patient.id} className="border-2 border-primary rounded-lg p-4 bg-card shadow-sm break-inside-avoid">
                    <h3 className="font-bold text-base border-b-2 border-primary pb-2 mb-4 text-primary">
                      {patient.name || 'Unnamed'} {patient.bed && `• Bed ${patient.bed}`}
                    </h3>
                    
                    {isColumnEnabled("clinicalSummary") && patient.clinicalSummary && (
                      <div className="mb-4">
                        <div className="text-xs font-bold text-primary uppercase mb-1">Clinical Summary</div>
                        <div 
                          className="text-sm bg-muted/30 p-3 rounded border-l-4 border-primary"
                          dangerouslySetInnerHTML={{ __html: patient.clinicalSummary }}
                        />
                      </div>
                    )}
                    
                    {isColumnEnabled("intervalEvents") && patient.intervalEvents && (
                      <div className="mb-4">
                        <div className="text-xs font-bold text-primary uppercase mb-1">Interval Events</div>
                        <div 
                          className="text-sm bg-muted/30 p-3 rounded border-l-4 border-primary"
                          dangerouslySetInnerHTML={{ __html: patient.intervalEvents }}
                        />
                      </div>
                    )}
                    
                    {/* Imaging & Labs row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {isColumnEnabled("imaging") && patient.imaging && (
                        <div>
                          <div className="text-xs font-bold text-primary uppercase mb-1">Imaging</div>
                          <div 
                            className="text-sm bg-blue-50/50 p-3 rounded border-l-4 border-blue-400"
                            dangerouslySetInnerHTML={{ __html: patient.imaging }}
                          />
                        </div>
                      )}
                      {isColumnEnabled("labs") && patient.labs && (
                        <div>
                          <div className="text-xs font-bold text-primary uppercase mb-1">Labs</div>
                          <div 
                            className="text-sm bg-green-50/50 p-3 rounded border-l-4 border-green-400"
                            dangerouslySetInnerHTML={{ __html: patient.labs }}
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {enabledSystemKeys.map(key => {
                        const value = patient.systems[key as keyof typeof patient.systems];
                        if (!value) return null;
                        return (
                          <div key={key} className="text-xs border rounded p-2 bg-muted/20">
                            <div className="font-bold text-[10px] text-primary uppercase mb-1">{systemLabels[key]}</div>
                            <div dangerouslySetInnerHTML={{ __html: value }} />
                          </div>
                        );
                      })}
                    </div>
                    
                    {showNotesColumn && (
                      <div className="mt-4 p-3 bg-amber-50/50 rounded border border-amber-200">
                        <div className="text-xs font-bold text-amber-700 uppercase mb-1">Rounding Notes</div>
                        <div className="min-h-[60px] w-full relative">
                          {[...Array(4)].map((_, i) => (
                            <div 
                              key={i} 
                              className="border-b border-amber-200/60 h-[14px] w-full"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="list" className="m-0">
              <div className="header flex justify-between items-center mb-4 border-b-2 border-primary pb-3">
                <div>
                  <h1 className="text-xl font-bold text-primary">🏥 Patient Rounding Report</h1>
                  <div className="text-xs text-muted-foreground mt-1">Detailed patient documentation</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{dateStr}</div>
                  <div className="text-xs text-muted-foreground">{timeStr} • {patients.length} patients</div>
                </div>
              </div>
              
              <div className="space-y-6">
                {patients.map((patient, index) => (
                  <div key={patient.id} className="border-b-2 border-muted pb-4 break-inside-avoid">
                    <div className="flex items-baseline gap-3 mb-3 bg-primary/10 p-2 rounded">
                      <span className="font-bold text-lg text-primary">{index + 1}.</span>
                      <span className="font-bold text-lg">{patient.name || 'Unnamed'}</span>
                      {patient.bed && <span className="text-sm text-muted-foreground">Bed: {patient.bed}</span>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {isColumnEnabled("clinicalSummary") && (
                        <div>
                          <span className="font-bold text-sm text-primary uppercase">Clinical Summary</span>
                          <div 
                            className="mt-1 bg-muted/30 p-3 rounded text-sm border-l-4 border-primary"
                            dangerouslySetInnerHTML={{ __html: patient.clinicalSummary || '<span class="text-muted-foreground italic">None documented</span>' }}
                          />
                        </div>
                      )}
                      {isColumnEnabled("intervalEvents") && (
                        <div>
                          <span className="font-bold text-sm text-primary uppercase">Interval Events</span>
                          <div 
                            className="mt-1 bg-muted/30 p-3 rounded text-sm border-l-4 border-primary"
                            dangerouslySetInnerHTML={{ __html: patient.intervalEvents || '<span class="text-muted-foreground italic">None documented</span>' }}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Imaging & Labs row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {isColumnEnabled("imaging") && (
                        <div>
                          <span className="font-bold text-sm text-blue-600 uppercase">Imaging</span>
                          <div 
                            className="mt-1 bg-blue-50/50 p-3 rounded text-sm border-l-4 border-blue-400"
                            dangerouslySetInnerHTML={{ __html: patient.imaging || '<span class="text-muted-foreground italic">None documented</span>' }}
                          />
                        </div>
                      )}
                      {isColumnEnabled("labs") && (
                        <div>
                          <span className="font-bold text-sm text-green-600 uppercase">Labs</span>
                          <div 
                            className="mt-1 bg-green-50/50 p-3 rounded text-sm border-l-4 border-green-400"
                            dangerouslySetInnerHTML={{ __html: patient.labs || '<span class="text-muted-foreground italic">None documented</span>' }}
                          />
                        </div>
                      )}
                    </div>
                    
                    {enabledSystemKeys.length > 0 && (
                      <div>
                        <span className="font-bold text-sm text-primary uppercase">Systems Review</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                          {enabledSystemKeys.map(key => {
                            const value = patient.systems[key as keyof typeof patient.systems];
                            return (
                              <div key={key} className="bg-muted/20 p-2 rounded border">
                                <span className="font-bold text-xs text-primary uppercase">{systemLabels[key]}</span>
                                <div 
                                  className="text-sm mt-1"
                                  dangerouslySetInnerHTML={{ __html: value || '<span class="text-muted-foreground">-</span>' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {showNotesColumn && (
                      <div className="mt-4">
                        <span className="font-bold text-sm text-amber-700 uppercase">Rounding Notes</span>
                        <div className="mt-1 w-full min-h-[60px] p-3 bg-amber-50/50 border border-amber-200 rounded relative">
                          {[...Array(4)].map((_, i) => (
                            <div 
                              key={i} 
                              className="border-b border-amber-200/60 h-[14px] w-full"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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
