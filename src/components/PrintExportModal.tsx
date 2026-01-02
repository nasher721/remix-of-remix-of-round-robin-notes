import { Patient } from "@/types/patient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, FileText, Grid3X3, List, Maximize2, Minimize2, Edit3 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
            body { font-family: Arial, sans-serif; font-size: 8px; line-height: 1.2; color: #000; padding: 4px; }
            h1 { font-size: 12px; margin-bottom: 4px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 2px solid #000; padding-bottom: 4px; }
            .header-info { font-size: 7px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
            th, td { border: 1px solid #999; padding: 2px 3px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
            th { background: #e0e0e0; font-weight: bold; font-size: 7px; text-transform: uppercase; }
            td { font-size: 7px; }
            .patient-name { font-weight: bold; }
            .bed { color: #666; font-size: 6px; }
            .content { white-space: pre-wrap; word-break: break-word; }
            .no-break { page-break-inside: avoid; }
            @media print {
              @page { size: landscape; margin: 0.2in; }
              body { padding: 0; }
              .no-print { display: none !important; }
            }
            .card-view { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
            .patient-card { border: 1px solid #999; padding: 4px; page-break-inside: avoid; }
            .patient-card h3 { font-size: 9px; border-bottom: 1px solid #999; padding-bottom: 2px; margin-bottom: 3px; }
            .section-title { font-weight: bold; font-size: 6px; color: #444; margin-bottom: 1px; }
            .systems-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; font-size: 6px; }
            .system-item { border: 1px solid #ccc; padding: 2px; background: #f5f5f5; }
            .system-label { font-weight: bold; font-size: 5px; color: #666; }
            .list-view .patient-item { border-bottom: 1px solid #ccc; padding: 3px 0; page-break-inside: avoid; }
            .empty { color: #999; font-style: italic; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
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
        <div className={cn(
          "text-xs whitespace-pre-wrap break-words",
          !expanded && "line-clamp-3"
        )}>
          {value || <span className="text-muted-foreground italic">-</span>}
        </div>
        {value && value.length > 50 && (
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
          </DialogTitle>
        </DialogHeader>

        {/* Column Width Controls */}
        <div className="flex gap-4 items-center text-xs border-b pb-2 mb-2 no-print">
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
              Interactive Table
            </TabsTrigger>
            <TabsTrigger value="cards" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Full Cards
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Detailed List
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4 border rounded-lg p-4 bg-white text-foreground" ref={printRef}>
            <TabsContent value="table" className="m-0">
              <div className="header flex justify-between items-center mb-3 border-b-2 border-black pb-2">
                <h1 className="text-lg font-bold">🏥 Patient Rounding Report</h1>
                <div className="header-info text-xs text-muted-foreground">{dateStr} • {timeStr} • {patients.length} patients</div>
              </div>
              
              <div className="text-xs text-muted-foreground mb-2 no-print">
                💡 Click any cell to expand/collapse • {isEditMode && "Double-click to edit •"} Adjust column widths above
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border p-1 text-left font-bold" style={{ width: columnWidths.patient }}>Patient</th>
                      <th className="border border-border p-1 text-left font-bold" style={{ width: columnWidths.summary }}>Summary</th>
                      <th className="border border-border p-1 text-left font-bold" style={{ width: columnWidths.events }}>Events</th>
                      {systemKeys.map(key => (
                        <th key={key} className="border border-border p-1 text-left font-bold text-[10px]" style={{ width: columnWidths.systems }}>
                          {systemLabels[key]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient) => (
                      <tr key={patient.id} className="border-b hover:bg-muted/30">
                        <td className="border border-border p-1 align-top">
                          <div className="font-bold text-xs">{patient.name || 'Unnamed'}</div>
                          <div className="text-[10px] text-muted-foreground">{patient.bed}</div>
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
              <div className="header flex justify-between items-center mb-3 border-b-2 border-black pb-2">
                <h1 className="text-lg font-bold">🏥 Patient Rounding Report</h1>
                <div className="header-info text-xs text-muted-foreground">{dateStr} • {timeStr} • {patients.length} patients</div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {patients.map((patient) => (
                  <div key={patient.id} className="patient-card border rounded-lg p-3 bg-card shadow-sm break-inside-avoid">
                    <h3 className="font-bold text-sm border-b pb-2 mb-3">
                      {patient.name || 'Unnamed'} {patient.bed && `• Bed ${patient.bed}`}
                    </h3>
                    
                    {patient.clinicalSummary && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Clinical Summary</div>
                        <div className="text-xs whitespace-pre-wrap bg-muted/30 p-2 rounded">{patient.clinicalSummary}</div>
                      </div>
                    )}
                    
                    {patient.intervalEvents && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Interval Events</div>
                        <div className="text-xs whitespace-pre-wrap bg-muted/30 p-2 rounded">{patient.intervalEvents}</div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {systemKeys.map(key => {
                        const value = patient.systems[key as keyof typeof patient.systems];
                        if (!value) return null;
                        return (
                          <div key={key} className="text-xs border rounded p-1.5 bg-muted/20">
                            <div className="font-semibold text-[10px] text-muted-foreground">{systemLabels[key]}</div>
                            <div className="whitespace-pre-wrap">{value}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="list" className="m-0">
              <div className="header flex justify-between items-center mb-3 border-b-2 border-black pb-2">
                <h1 className="text-lg font-bold">🏥 Patient Rounding Report</h1>
                <div className="header-info text-xs text-muted-foreground">{dateStr} • {timeStr} • {patients.length} patients</div>
              </div>
              
              <div className="space-y-4">
                {patients.map((patient, index) => (
                  <div key={patient.id} className="border-b pb-3 break-inside-avoid">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-bold">{index + 1}. {patient.name || 'Unnamed'}</span>
                      {patient.bed && <span className="text-xs text-muted-foreground">Bed: {patient.bed}</span>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-2">
                      <div>
                        <span className="font-semibold">Clinical Summary:</span>
                        <div className="whitespace-pre-wrap mt-1 bg-muted/30 p-2 rounded">
                          {patient.clinicalSummary || <span className="text-muted-foreground italic">None</span>}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold">Interval Events:</span>
                        <div className="whitespace-pre-wrap mt-1 bg-muted/30 p-2 rounded">
                          {patient.intervalEvents || <span className="text-muted-foreground italic">None</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs">
                      <span className="font-semibold">Systems:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 mt-1">
                        {systemKeys.map(key => {
                          const value = patient.systems[key as keyof typeof patient.systems];
                          return (
                            <div key={key} className="bg-muted/20 p-1.5 rounded border">
                              <span className="font-medium">{systemLabels[key]}:</span>
                              <div className="whitespace-pre-wrap">{value || <span className="text-muted-foreground">-</span>}</div>
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
            <Button onClick={handlePrint} className="bg-success hover:bg-success/90 text-success-foreground">
              <Printer className="h-4 w-4 mr-2" />
              Print Selected Format
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
