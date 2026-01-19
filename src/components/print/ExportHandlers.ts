import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import type { ColumnConfig, ColumnWidthsType, PatientTodosMap } from './types';
import { systemLabels, systemKeys, columnCombinations } from './constants';
import { stripHtml, formatTodosForDisplay, escapeRTF, cleanInlineStyles, isColumnCombined, getCombinedContent } from './utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportContext {
  patients: Patient[];
  patientTodos: PatientTodosMap;
  columns: ColumnConfig[];
  combinedColumns: string[];
  columnWidths: ColumnWidthsType;
  printFontSize: number;
  printOrientation: 'portrait' | 'landscape';
  onePatientPerPage: boolean;
  isColumnEnabled: (key: string) => boolean;
  getPatientTodos: (patientId: string) => PatientTodo[];
  showNotesColumn: boolean;
  showTodosColumn: boolean;
  patientNotes: Record<string, string>;
  isFiltered?: boolean;
  totalPatientCount?: number;
}

const getEnabledSystemKeys = (isColumnEnabled: (key: string) => boolean) => 
  systemKeys.filter(key => isColumnEnabled(`systems.${key}`));

export const handleExportExcel = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  
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
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Patient Rounding");
  
  const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
  
  return fileName;
};

export const handleExportPDF = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);
  
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Rounding Report", 14, 15);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  doc.text(`Total Patients: ${patients.length}`, 14, 27);

  const headers: string[] = [];
  if (isColumnEnabled("patient")) headers.push("Patient", "Bed");
  if (isColumnEnabled("clinicalSummary")) headers.push("Summary");
  if (isColumnEnabled("intervalEvents")) headers.push("Events");
  if (isColumnEnabled("imaging")) headers.push("Imaging");
  if (isColumnEnabled("labs")) headers.push("Labs");
  enabledSystemKeys.forEach(key => {
    headers.push(systemLabels[key]);
  });
  if (showTodosColumn) headers.push("Todos");
  if (isColumnEnabled("notes")) headers.push("Notes");

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
    enabledSystemKeys.forEach(key => {
      row.push(stripHtml(patient.systems[key as keyof typeof patient.systems]));
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
    margin: { top: 32, left: 10, right: 10 },
    tableWidth: 'auto',
    showHead: 'everyPage',
    rowPageBreak: 'auto',
  });

  const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  
  return fileName;
};

export const handleExportTXT = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);
  
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

    if (enabledSystemKeys.length > 0) {
      content += `SYSTEMS REVIEW:\n`;
      enabledSystemKeys.forEach(key => {
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

  return fileName;
};

export const handleExportRTF = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);
  
  let rtf = `{\\rtf1\\ansi\\deff0\n`;
  rtf += `{\\fonttbl{\\f0\\fswiss Arial;}{\\f1\\fmodern Courier New;}}\n`;
  rtf += `{\\colortbl;\\red0\\green0\\blue0;\\red59\\green130\\blue246;\\red100\\green100\\blue100;}\n\n`;

  rtf += `\\f0\\fs32\\b PATIENT ROUNDING REPORT\\b0\\par\n`;
  rtf += `\\fs20\\cf3 Generated: ${new Date().toLocaleString()}\\par\n`;
  rtf += `Total Patients: ${patients.length}\\cf1\\par\n`;
  rtf += `\\line\n`;

  patients.forEach((patient, index) => {
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

    if (enabledSystemKeys.length > 0) {
      rtf += `\\fs22\\b Systems Review:\\b0\\par\n`;
      enabledSystemKeys.forEach(key => {
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

  return fileName;
};

export const handleExportDOC = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);
  
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

    if (enabledSystemKeys.length > 0) {
      html += `
    <div class="section">
      <div class="section-title">Systems Review</div>
      <table>
        <tr>`;
      enabledSystemKeys.forEach(key => {
        html += `<th>${systemLabels[key]}</th>`;
      });
      html += `</tr><tr>`;
      enabledSystemKeys.forEach(key => {
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

  return fileName;
};

export const handleExportJSON = (ctx: ExportContext) => {
  const { 
    patients, 
    columns, 
    combinedColumns, 
    isColumnEnabled, 
    showTodosColumn, 
    getPatientTodos,
    isFiltered,
    totalPatientCount
  } = ctx;
  
  const exportData = {
    exportedAt: new Date().toISOString(),
    patientCount: patients.length,
    columns: columns.filter(c => c.enabled).map(c => c.key),
    combinedColumns: combinedColumns,
    isFiltered: isFiltered,
    totalPatients: totalPatientCount || patients.length,
    data: patients.map(patient => {
      const row: Record<string, unknown> = {};
      
      if (isColumnEnabled("patient")) {
        row.patientName = patient.name || "Unnamed";
        row.bed = patient.bed;
      }
      if (isColumnEnabled("clinicalSummary")) {
        row.clinicalSummary = stripHtml(patient.clinicalSummary);
      }
      if (isColumnEnabled("intervalEvents")) {
        row.intervalEvents = stripHtml(patient.intervalEvents);
      }
      if (isColumnEnabled("imaging")) {
        row.imaging = stripHtml(patient.imaging);
      }
      if (isColumnEnabled("labs")) {
        row.labs = stripHtml(patient.labs);
      }
      
      const systems: Record<string, string> = {};
      systemKeys.forEach(key => {
        if (isColumnEnabled(`systems.${key}`)) {
          systems[key] = stripHtml(patient.systems[key as keyof typeof patient.systems]);
        }
      });
      if (Object.keys(systems).length > 0) {
        row.systems = systems;
      }
      
      if (showTodosColumn) {
        row.todos = getPatientTodos(patient.id).map(t => ({
          content: t.content,
          completed: t.completed
        }));
      }
      
      return row;
    })
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.json`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
};
