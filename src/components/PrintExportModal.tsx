import { Patient } from "@/types/patient";
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
  Download
} from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PrintExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  onUpdatePatient?: (id: number, field: string, value: string) => void;
}

const systemLabels: Record<string, string> = {
  neuro: "Neuro",
  cv: "CV",
  resp: "Resp",
  renalGU: "Renal/GU",
  gi: "GI",
  endo: "Endo",
  heme: "Heme",
  infectious: "ID",
  skinLines: "Skin/Lines",
  dispo: "Dispo"
};

const systemKeys = Object.keys(systemLabels);

interface ExpandedCell {
  patientId: number;
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
  const [columnWidths, setColumnWidths] = useState({
    patient: 100,
    summary: 150,
    events: 150,
    systems: 80
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const { toast } = useToast();

  const handleCellClick = (patientId: number, field: string) => {
    if (expandedCell?.patientId === patientId && expandedCell?.field === field) {
      setExpandedCell(null);
    } else {
      setExpandedCell({ patientId, field });
    }
  };

  const handleDoubleClick = (patientId: number, field: string, currentValue: string) => {
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

  const isExpanded = (patientId: number, field: string) => 
    expandedCell?.patientId === patientId && expandedCell?.field === field;

  const isEditing = (patientId: number, field: string) =>
    editingCell?.patientId === patientId && editingCell?.field === field;

  const getCellValue = (patient: Patient, field: string): string => {
    if (field === "clinicalSummary") return patient.clinicalSummary;
    if (field === "intervalEvents") return patient.intervalEvents;
    if (field.startsWith("systems.")) {
      const systemKey = field.replace("systems.", "") as keyof typeof patient.systems;
      return patient.systems[systemKey];
    }
    return "";
  };

  // Export to Excel
  const handleExportExcel = () => {
    const data = patients.map(patient => ({
      "Patient Name": patient.name || "Unnamed",
      "Bed/Room": patient.bed,
      "Clinical Summary": stripHtml(patient.clinicalSummary),
      "Interval Events": stripHtml(patient.intervalEvents),
      ...Object.fromEntries(
        systemKeys.map(key => [
          systemLabels[key],
          stripHtml(patient.systems[key as keyof typeof patient.systems])
        ])
      ),
      "Created": new Date(patient.createdAt).toLocaleString(),
      "Last Modified": new Date(patient.lastModified).toLocaleString()
    }));

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

  // Export to PDF
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

    // Table data
    const tableData = patients.map(patient => [
      patient.name || "Unnamed",
      patient.bed || "-",
      stripHtml(patient.clinicalSummary).substring(0, 100) + (patient.clinicalSummary.length > 100 ? "..." : ""),
      stripHtml(patient.intervalEvents).substring(0, 100) + (patient.intervalEvents.length > 100 ? "..." : ""),
      ...systemKeys.map(key => {
        const val = stripHtml(patient.systems[key as keyof typeof patient.systems]);
        return val.substring(0, 40) + (val.length > 40 ? "..." : "");
      })
    ]);

    autoTable(doc, {
      head: [["Patient", "Bed", "Summary", "Events", ...systemKeys.map(k => systemLabels[k])]],
      body: tableData,
      startY: 32,
      styles: {
        fontSize: 6,
        cellPadding: 1.5,
        overflow: 'linebreak',
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 6
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 12 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: { top: 32, left: 10, right: 10 }
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
      if (patient.clinicalSummary) {
        doc.setFont("helvetica", "bold");
        doc.text("Clinical Summary:", 14, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        const summaryLines = doc.splitTextToSize(stripHtml(patient.clinicalSummary), 270);
        doc.text(summaryLines, 14, yPos);
        yPos += summaryLines.length * 4 + 5;
      }
      
      // Interval Events
      if (patient.intervalEvents) {
        doc.setFont("helvetica", "bold");
        doc.text("Interval Events:", 14, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        const eventsLines = doc.splitTextToSize(stripHtml(patient.intervalEvents), 270);
        doc.text(eventsLines, 14, yPos);
        yPos += eventsLines.length * 4 + 5;
      }
      
      // Systems
      doc.setFont("helvetica", "bold");
      doc.text("Systems Review:", 14, yPos);
      yPos += 5;
      
      systemKeys.forEach(key => {
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
            .content { white-space: pre-wrap; word-break: break-word; }
            .system-label { font-weight: 600; color: #374151; display: block; font-size: 7px; margin-bottom: 1px; }
            .no-break { page-break-inside: avoid; }
            @media print {
              @page { size: landscape; margin: 0.3in; }
              body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
              th { background: #1e40af !important; color: #fff !important; }
              tr:nth-child(even) td { background: #f8fafc !important; }
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

        {/* Column Width Controls */}
        <div className="flex gap-4 items-center text-xs border-b pb-2 mb-2 no-print flex-wrap">
          <span className="font-medium">Column Widths:</span>
          <label className="flex items-center gap-1">
            Patient:
            <input
              type="range"
              min="60"
              max="150"
              value={columnWidths.patient}
              onChange={(e) => setColumnWidths(prev => ({ ...prev, patient: Number(e.target.value) }))}
              className="w-16"
            />
          </label>
          <label className="flex items-center gap-1">
            Summary:
            <input
              type="range"
              min="80"
              max="300"
              value={columnWidths.summary}
              onChange={(e) => setColumnWidths(prev => ({ ...prev, summary: Number(e.target.value) }))}
              className="w-16"
            />
          </label>
          <label className="flex items-center gap-1">
            Events:
            <input
              type="range"
              min="80"
              max="300"
              value={columnWidths.events}
              onChange={(e) => setColumnWidths(prev => ({ ...prev, events: Number(e.target.value) }))}
              className="w-16"
            />
          </label>
          <label className="flex items-center gap-1">
            Systems:
            <input
              type="range"
              min="50"
              max="150"
              value={columnWidths.systems}
              onChange={(e) => setColumnWidths(prev => ({ ...prev, systems: Number(e.target.value) }))}
              className="w-16"
            />
          </label>
        </div>

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
                💡 Click any cell to expand/collapse • {isEditMode && "Double-click to edit •"} Use sliders to adjust column widths
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="border border-border p-2 text-left font-bold" style={{ width: columnWidths.patient }}>Patient</th>
                      <th className="border border-border p-2 text-left font-bold" style={{ width: columnWidths.summary }}>Clinical Summary</th>
                      <th className="border border-border p-2 text-left font-bold" style={{ width: columnWidths.events }}>Interval Events</th>
                      {systemKeys.map(key => (
                        <th key={key} className="border border-border p-2 text-left font-bold text-[10px]" style={{ width: columnWidths.systems }}>
                          {systemLabels[key]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient, idx) => (
                      <tr key={patient.id} className={cn("border-b", idx % 2 === 0 ? "bg-white" : "bg-muted/20")}>
                        <td className="border border-border p-2 align-top">
                          <div className="font-bold text-sm text-primary">{patient.name || 'Unnamed'}</div>
                          <div className="text-[10px] text-muted-foreground">Bed: {patient.bed || 'N/A'}</div>
                        </td>
                        <ExpandableCell patient={patient} field="clinicalSummary" className="border border-border" />
                        <ExpandableCell patient={patient} field="intervalEvents" className="border border-border" />
                        {systemKeys.map(key => (
                          <ExpandableCell 
                            key={key} 
                            patient={patient} 
                            field={`systems.${key}`} 
                            className="border border-border"
                          />
                        ))}
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
                    
                    {patient.clinicalSummary && (
                      <div className="mb-4">
                        <div className="text-xs font-bold text-primary uppercase mb-1">Clinical Summary</div>
                        <div 
                          className="text-sm bg-muted/30 p-3 rounded border-l-4 border-primary"
                          dangerouslySetInnerHTML={{ __html: patient.clinicalSummary }}
                        />
                      </div>
                    )}
                    
                    {patient.intervalEvents && (
                      <div className="mb-4">
                        <div className="text-xs font-bold text-primary uppercase mb-1">Interval Events</div>
                        <div 
                          className="text-sm bg-muted/30 p-3 rounded border-l-4 border-primary"
                          dangerouslySetInnerHTML={{ __html: patient.intervalEvents }}
                        />
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {systemKeys.map(key => {
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
                      <div>
                        <span className="font-bold text-sm text-primary uppercase">Clinical Summary</span>
                        <div 
                          className="mt-1 bg-muted/30 p-3 rounded text-sm border-l-4 border-primary"
                          dangerouslySetInnerHTML={{ __html: patient.clinicalSummary || '<span class="text-muted-foreground italic">None documented</span>' }}
                        />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-primary uppercase">Interval Events</span>
                        <div 
                          className="mt-1 bg-muted/30 p-3 rounded text-sm border-l-4 border-primary"
                          dangerouslySetInnerHTML={{ __html: patient.intervalEvents || '<span class="text-muted-foreground italic">None documented</span>' }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-bold text-sm text-primary uppercase">Systems Review</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                        {systemKeys.map(key => {
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
