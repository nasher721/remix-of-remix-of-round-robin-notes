import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import type { ColumnConfig, ColumnWidthsType, PatientTodosMap } from './types';
import { systemLabels, systemKeys, columnCombinations } from './constants';
import { stripHtml, formatTodosForDisplay } from './utils';
import { htmlToRTF, escapeRTF as escapeRTFNew, initRTFColorTable, getRTFColorTable, parseColor } from '@/lib/print/htmlFormatter';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2pdf from 'html2pdf.js';

// Extract dominant color from HTML string for PDF export
const extractDominantColor = (html: string): { r: number; g: number; b: number } | null => {
  if (!html) return null;
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Find first element with a color style
  const elementsWithColor = temp.querySelectorAll('[style*="color"]');
  for (const el of elementsWithColor) {
    const style = el.getAttribute('style') || '';
    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    if (colorMatch) {
      const color = parseColor(colorMatch[1].trim());
      if (color) return color;
    }
  }
  return null;
};

// Convert HTML to text while preserving structure indicators
const htmlToStructuredText = (html: string): string => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const children = Array.from(el.childNodes).map(processNode).join('');

      switch (tag) {
        case 'br': return '\n';
        case 'p': return children + '\n';
        case 'li': return '• ' + children + '\n';
        case 'ul':
        case 'ol': return children;
        default: return children;
      }
    }
    return '';
  };

  return Array.from(temp.childNodes).map(processNode).join('').trim();
};

interface ExportContext {
  patients: Patient[];
  patientTodos: PatientTodosMap;
  columns: ColumnConfig[];
  combinedColumns: string[];
  columnWidths: ColumnWidthsType;
  printFontSize: number;
  printFontFamily: string;
  printOrientation: 'portrait' | 'landscape';
  onePatientPerPage: boolean;
  margins: 'narrow' | 'normal' | 'wide';
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

export const handleExportPDF = async (ctx: ExportContext, element?: HTMLElement | null) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);

  if (element) {
    const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.pdf`;
    await html2pdf()
      .set({
        filename: fileName,
        margin: 0,
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: ctx.printOrientation,
        },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.print-avoid-break'] },
      })
      .from(element)
      .save();
    return fileName;
  }

  const doc = new jsPDF({
    orientation: ctx.printOrientation,
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

  // Build table data with color information for each cell
  type CellData = { text: string; color: { r: number; g: number; b: number } | null };
  const tableDataWithColors: CellData[][] = patients.map(patient => {
    const row: CellData[] = [];

    if (isColumnEnabled("patient")) {
      row.push({ text: patient.name || "Unnamed", color: null });
      row.push({ text: patient.bed || "-", color: null });
    }
    if (isColumnEnabled("clinicalSummary")) {
      row.push({
        text: htmlToStructuredText(patient.clinicalSummary),
        color: extractDominantColor(patient.clinicalSummary)
      });
    }
    if (isColumnEnabled("intervalEvents")) {
      row.push({
        text: htmlToStructuredText(patient.intervalEvents),
        color: extractDominantColor(patient.intervalEvents)
      });
    }
    if (isColumnEnabled("imaging")) {
      row.push({
        text: htmlToStructuredText(patient.imaging),
        color: extractDominantColor(patient.imaging)
      });
    }
    if (isColumnEnabled("labs")) {
      row.push({
        text: htmlToStructuredText(patient.labs),
        color: extractDominantColor(patient.labs)
      });
    }
    enabledSystemKeys.forEach(key => {
      const value = patient.systems[key as keyof typeof patient.systems];
      row.push({
        text: htmlToStructuredText(value),
        color: extractDominantColor(value)
      });
    });
    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      row.push({ text: formatTodosForDisplay(todos), color: null });
    }
    if (isColumnEnabled("notes")) {
      row.push({ text: patientNotes[patient.id] || "", color: null });
    }

    return row;
  });

  // Extract just the text for the table body
  const tableData = tableDataWithColors.map(row => row.map(cell => cell.text));

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
    // Apply colors to cells that have them
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index !== undefined && data.column.index !== undefined) {
        const cellData = tableDataWithColors[data.row.index]?.[data.column.index];
        if (cellData?.color) {
          data.cell.styles.textColor = [cellData.color.r, cellData.color.g, cellData.color.b];
        }
      }
    }
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

  // Initialize RTF color table for this export
  initRTFColorTable();

  // Build RTF content first to collect all colors
  const patientContent: string[] = [];
  
  patients.forEach((patient, index) => {
    let content = '';
    content += `\\pard\\sb200\\sa100\\brdrb\\brdrs\\brdrw10\\brsp20\n`;
    content += `\\fs28\\b\\cf2 Patient ${index + 1}: ${escapeRTFNew(patient.name || 'Unnamed')}\\cf1\\b0\\par\n`;
    content += `\\fs20 Bed/Room: ${escapeRTFNew(patient.bed || 'N/A')}\\par\n`;
    content += `\\pard\\sa100\n`;

    if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
      content += `\\fs22\\b Clinical Summary:\\b0\\par\n`;
      content += `\\fs20 ${htmlToRTF(patient.clinicalSummary)}\\par\\par\n`;
    }
    if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
      content += `\\fs22\\b Interval Events:\\b0\\par\n`;
      content += `\\fs20 ${htmlToRTF(patient.intervalEvents)}\\par\\par\n`;
    }
    if (isColumnEnabled("imaging") && patient.imaging) {
      content += `\\fs22\\b Imaging:\\b0\\par\n`;
      content += `\\fs20 ${htmlToRTF(patient.imaging)}\\par\\par\n`;
    }
    if (isColumnEnabled("labs") && patient.labs) {
      content += `\\fs22\\b Labs:\\b0\\par\n`;
      content += `\\fs20 ${htmlToRTF(patient.labs)}\\par\\par\n`;
    }

    if (enabledSystemKeys.length > 0) {
      content += `\\fs22\\b Systems Review:\\b0\\par\n`;
      enabledSystemKeys.forEach(key => {
        const value = patient.systems[key as keyof typeof patient.systems];
        if (value) {
          content += `\\fs20\\b ${escapeRTFNew(systemLabels[key])}:\\b0  ${htmlToRTF(value)}\\par\n`;
        }
      });
      content += `\\par\n`;
    }

    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      if (todos.length > 0) {
        content += `\\fs22\\b Todos:\\b0\\par\n`;
        todos.forEach(todo => {
          content += `\\fs20 ${todo.completed ? '[X]' : '[ ]'} ${escapeRTFNew(todo.content)}\\par\n`;
        });
        content += `\\par\n`;
      }
    }

    if (isColumnEnabled("notes") && patientNotes[patient.id]) {
      content += `\\fs22\\b Notes:\\b0\\par\n`;
      content += `\\fs20 ${escapeRTFNew(patientNotes[patient.id])}\\par\\par\n`;
    }

    content += `\\par\n`;
    patientContent.push(content);
  });

  // Now build complete RTF with the dynamically generated color table
  let rtf = `{\\rtf1\\ansi\\deff0\n`;
  rtf += `{\\fonttbl{\\f0\\fswiss Arial;}{\\f1\\fmodern Courier New;}}\n`;
  rtf += `${getRTFColorTable()}\n\n`;

  rtf += `\\f0\\fs32\\b PATIENT ROUNDING REPORT\\b0\\par\n`;
  rtf += `\\fs20\\cf3 Generated: ${new Date().toLocaleString()}\\par\n`;
  rtf += `Total Patients: ${patients.length}\\cf1\\par\n`;
  rtf += `\\line\n`;

  // Add all patient content
  rtf += patientContent.join('');

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
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page { margin: 1in; }
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; word-break: break-word; overflow-wrap: anywhere; }
    * { box-sizing: border-box; }
    h1 { color: #3b82f6; font-size: 18pt; margin-bottom: 5pt; }
    h2 { color: #3b82f6; font-size: 14pt; border-bottom: 2px solid #3b82f6; padding-bottom: 5pt; margin-top: 20pt; }
    h3 { font-size: 12pt; color: #333; margin-top: 10pt; margin-bottom: 5pt; }
    .meta { color: #666; font-size: 10pt; margin-bottom: 15pt; }
    .patient-card { border: 1px solid #ccc; margin: 15pt 0; padding: 10pt; page-break-inside: avoid; }
    .patient-header { background: #3b82f6; color: white; padding: 8pt; margin: -10pt -10pt 10pt -10pt; }
    .section { margin: 10pt 0; }
    .section-title { font-weight: bold; color: #333; }
    .section-content { margin-top: 3pt; }
    .todo-item { margin: 3pt 0; }
    .completed { text-decoration: line-through; color: #888; }
    table { width: 100%; border-collapse: collapse; margin: 10pt 0; table-layout: fixed; }
    th, td { border: 1px solid #ddd; padding: 5pt; text-align: left; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
    th { background: #f5f5f5; font-weight: bold; }
    img { max-width: 100%; height: auto; }
    /* Preserve inline colors - Word respects inline styles */
    span[style], div[style], p[style] { mso-style-textfill-type: solid; }
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
      <div class="section-content">${patient.clinicalSummary}</div>
    </div>`;
    }
    if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
      html += `
    <div class="section">
      <div class="section-title">Interval Events</div>
      <div class="section-content">${patient.intervalEvents}</div>
    </div>`;
    }
    if (isColumnEnabled("imaging") && patient.imaging) {
      html += `
    <div class="section">
      <div class="section-title">Imaging</div>
      <div class="section-content">${patient.imaging}</div>
    </div>`;
    }
    if (isColumnEnabled("labs") && patient.labs) {
      html += `
    <div class="section">
      <div class="section-title">Labs</div>
      <div class="section-content">${patient.labs}</div>
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
        // Preserve inline styles with colors in table cells
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
      <div class="section-content">${patientNotes[patient.id]}</div>
    </div>`;
    }

    html += `
  </div>`;
  });

  html += `
</body>
</html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
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
