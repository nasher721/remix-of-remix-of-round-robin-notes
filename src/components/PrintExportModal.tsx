import { Patient } from "@/types/patient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileText, Grid3X3, List } from "lucide-react";
import { useRef } from "react";

interface PrintExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
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

export const PrintExportModal = ({ open, onOpenChange, patients }: PrintExportModalProps) => {
  const printRef = useRef<HTMLDivElement>(null);

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
            body { font-family: Arial, sans-serif; font-size: 9px; line-height: 1.3; color: #000; padding: 8px; }
            h1 { font-size: 14px; margin-bottom: 4px; }
            h2 { font-size: 11px; margin-bottom: 3px; border-bottom: 1px solid #333; padding-bottom: 2px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 4px; }
            .header-info { font-size: 8px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th, td { border: 1px solid #ccc; padding: 3px 4px; text-align: left; vertical-align: top; }
            th { background: #f0f0f0; font-weight: bold; font-size: 8px; text-transform: uppercase; }
            td { font-size: 8px; }
            .patient-name { font-weight: bold; white-space: nowrap; }
            .bed { color: #666; font-size: 7px; }
            .section-title { font-weight: bold; font-size: 7px; color: #444; margin-bottom: 2px; }
            .content { white-space: pre-wrap; word-break: break-word; }
            .systems-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; font-size: 7px; }
            .system-item { border: 1px solid #ddd; padding: 2px; background: #fafafa; }
            .system-label { font-weight: bold; font-size: 6px; color: #666; }
            .compact-row td { padding: 2px 3px; }
            .page-break { page-break-after: always; }
            .no-break { page-break-inside: avoid; }
            @media print {
              @page { size: landscape; margin: 0.25in; }
              body { padding: 0; }
            }
            .card-view { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .patient-card { border: 1px solid #ccc; padding: 6px; page-break-inside: avoid; }
            .patient-card h3 { font-size: 10px; border-bottom: 1px solid #999; padding-bottom: 2px; margin-bottom: 4px; }
            .list-view .patient-item { border-bottom: 1px solid #eee; padding: 4px 0; page-break-inside: avoid; }
            .list-view .patient-header { display: flex; gap: 8px; margin-bottom: 2px; }
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

  const truncate = (text: string, max: number = 100) => {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '...' : text;
  };

  const dateStr = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
  });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print / Export Patient Data
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="table" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              Dense Table
            </TabsTrigger>
            <TabsTrigger value="cards" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Cards View
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Compact List
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4 border rounded-lg p-4 bg-white" ref={printRef}>
            <TabsContent value="table" className="m-0">
              <div className="header">
                <h1>🏥 Patient Rounding Report</h1>
                <div className="header-info">{dateStr} • {timeStr} • {patients.length} patients</div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] text-xs">Patient</TableHead>
                    <TableHead className="w-[150px] text-xs">Summary</TableHead>
                    <TableHead className="w-[150px] text-xs">Events</TableHead>
                    <TableHead className="text-xs">Neuro</TableHead>
                    <TableHead className="text-xs">CV</TableHead>
                    <TableHead className="text-xs">Resp</TableHead>
                    <TableHead className="text-xs">Renal</TableHead>
                    <TableHead className="text-xs">GI</TableHead>
                    <TableHead className="text-xs">Endo</TableHead>
                    <TableHead className="text-xs">Heme</TableHead>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Skin</TableHead>
                    <TableHead className="text-xs">Dispo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.id} className="compact-row">
                      <TableCell className="text-xs font-medium">
                        <div className="patient-name">{patient.name || 'Unnamed'}</div>
                        <div className="bed">{patient.bed}</div>
                      </TableCell>
                      <TableCell className="text-xs">{truncate(patient.clinicalSummary, 80)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.intervalEvents, 80)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.neuro, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.cv, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.resp, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.renalGU, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.gi, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.endo, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.heme, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.infectious, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.skinLines, 50)}</TableCell>
                      <TableCell className="text-xs">{truncate(patient.systems.dispo, 50)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="cards" className="m-0">
              <div className="header">
                <h1>🏥 Patient Rounding Report</h1>
                <div className="header-info">{dateStr} • {timeStr} • {patients.length} patients</div>
              </div>
              
              <div className="card-view">
                {patients.map((patient) => (
                  <div key={patient.id} className="patient-card no-break">
                    <h3>{patient.name || 'Unnamed'} {patient.bed && `• ${patient.bed}`}</h3>
                    
                    {patient.clinicalSummary && (
                      <div className="mb-2">
                        <div className="section-title">Clinical Summary</div>
                        <div className="content text-xs">{patient.clinicalSummary}</div>
                      </div>
                    )}
                    
                    {patient.intervalEvents && (
                      <div className="mb-2">
                        <div className="section-title">Interval Events</div>
                        <div className="content text-xs">{patient.intervalEvents}</div>
                      </div>
                    )}
                    
                    <div className="systems-grid">
                      {Object.entries(patient.systems).map(([key, value]) => (
                        value && (
                          <div key={key} className="system-item">
                            <div className="system-label">{systemLabels[key]}</div>
                            <div className="content">{truncate(value, 60)}</div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="list" className="m-0 list-view">
              <div className="header">
                <h1>🏥 Patient Rounding Report</h1>
                <div className="header-info">{dateStr} • {timeStr} • {patients.length} patients</div>
              </div>
              
              {patients.map((patient, index) => (
                <div key={patient.id} className="patient-item no-break">
                  <div className="patient-header">
                    <span className="font-bold text-sm">{index + 1}. {patient.name || 'Unnamed'}</span>
                    {patient.bed && <span className="text-xs text-muted-foreground">Bed: {patient.bed}</span>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                    <div>
                      <span className="font-semibold">Summary: </span>
                      <span className={!patient.clinicalSummary ? 'empty' : ''}>
                        {patient.clinicalSummary || 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Events: </span>
                      <span className={!patient.intervalEvents ? 'empty' : ''}>
                        {patient.intervalEvents || 'None'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-1 text-xs">
                    {Object.entries(patient.systems).map(([key, value]) => (
                      value && (
                        <span key={key} className="bg-muted px-1 rounded">
                          <strong>{systemLabels[key]}:</strong> {truncate(value, 40)}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              ))}
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
