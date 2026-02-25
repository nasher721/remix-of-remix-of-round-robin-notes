import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import type { PdfColumnLayout, PdfExportSettings } from '@/lib/print/types';
import type { ColumnConfig, ColumnWidthsType, PatientTodosMap } from './types';
import { systemLabels, systemKeys, columnCombinations } from './constants';
import { stripHtml, formatTodosForDisplay, formatMedicationsText } from './utils';
import { htmlToRTF, escapeRTF as escapeRTFNew, initRTFColorTable, getRTFColorTable, parseColor } from '@/lib/print/htmlFormatter';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2pdf from 'html2pdf.js';

type RgbColor = { r: number; g: number; b: number };

interface PdfRenderableColumn {
  id: string;
  label: string;
  type: 'single' | 'combined';
  sourceKeys: string[];
}

interface PdfCellData {
  text: string;
  color: RgbColor | null;
}

interface PdfMarginConfig {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface PdfTypographyConfig {
  titleFontSize: number;
  metaFontSize: number;
  bodyFontSize: number;
  lineHeight: number;
  cellPadding: number;
}

interface PdfLayoutMetrics {
  margins: PdfMarginConfig;
  contentTop: number;
  contentBottom: number;
  pageWidth: number;
  pageHeight: number;
}

const PDF_MARGIN_MM_BY_SETTING = {
  narrow: 10,
  normal: 15,
  wide: 20,
} as const;

const PDF_DEFAULT_TITLE = 'Patient Rounding Report';
const PDF_ACCENT_COLOR: [number, number, number] = [30, 64, 175];
const PDF_BORDER_COLOR: [number, number, number] = [203, 213, 225];
const PDF_ALTERNATE_ROW_COLOR: [number, number, number] = [248, 250, 252];

const isNearBlack = (color: RgbColor): boolean => color.r < 40 && color.g < 40 && color.b < 40;

const normalizePdfText = (text: string): string =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const getPdfFileName = () => `patient-rounding-${new Date().toISOString().split('T')[0]}.pdf`;

const clampNumber = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const tintColor = (color: RgbColor, tintFactor: number = 0.9): RgbColor => ({
  r: Math.round(color.r + (255 - color.r) * tintFactor),
  g: Math.round(color.g + (255 - color.g) * tintFactor),
  b: Math.round(color.b + (255 - color.b) * tintFactor),
});

const extractDominantColor = (html: string): RgbColor | null => {
  if (!html) return null;
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const elementsWithColor = temp.querySelectorAll('[style*="color"], [style*="background-color"]');
  let fallbackColor: RgbColor | null = null;

  for (const el of elementsWithColor) {
    const style = el.getAttribute('style') || '';

    const backgroundColorMatch = style.match(/(?:^|;)\s*background-color\s*:\s*([^;]+)/i);
    if (backgroundColorMatch) {
      const parsedBackgroundColor = parseColor(backgroundColorMatch[1].trim());
      if (parsedBackgroundColor) {
        return parsedBackgroundColor;
      }
    }

    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    if (colorMatch) {
      const color = parseColor(colorMatch[1].trim());
      if (color && !isNearBlack(color)) {
        return color;
      }
      if (color && !fallbackColor) {
        fallbackColor = color;
      }
    }
  }

  return fallbackColor;
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
        case 'div':
        case 'section':
        case 'article':
          return children + '\n';
        case 'li': return '• ' + children + '\n';
        case 'ul':
        case 'ol': return children;
        default: return children;
      }
    }
    return '';
  };

  return normalizePdfText(Array.from(temp.childNodes).map(processNode).join(''));
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
  showPageNumbers?: boolean;
  showTimestamp?: boolean;
  physicianName?: string;
  pdf?: PdfExportSettings;
}

const getEnabledSystemKeys = (isColumnEnabled: (key: string) => boolean) =>
  systemKeys.filter(key => isColumnEnabled(`systems.${key}`));

const resolvePdfFontFamily = (fontFamily: string): 'helvetica' | 'times' | 'courier' => {
  if (fontFamily === 'times' || fontFamily === 'georgia') return 'times';
  if (fontFamily === 'courier') return 'courier';
  return 'helvetica';
};

const getPdfTypography = (ctx: ExportContext): PdfTypographyConfig => {
  const bodyFontSize = clampNumber(ctx.printFontSize, 7, 12);
  return {
    titleFontSize: clampNumber(bodyFontSize + 4, 12, 18),
    metaFontSize: clampNumber(bodyFontSize - 1, 8, 11),
    bodyFontSize,
    lineHeight: clampNumber(bodyFontSize * 0.43, 3.2, 5.2),
    cellPadding: bodyFontSize <= 8 ? 1.6 : 2.2,
  };
};

const getPdfMargins = (setting: ExportContext['margins']): PdfMarginConfig => {
  const marginValue = PDF_MARGIN_MM_BY_SETTING[setting] ?? PDF_MARGIN_MM_BY_SETTING.normal;
  return {
    top: marginValue,
    right: marginValue,
    bottom: marginValue,
    left: marginValue,
  };
};

const getPdfLayoutMetrics = (doc: jsPDF, ctx: ExportContext): PdfLayoutMetrics => {
  const margins = getPdfMargins(ctx.margins);
  return {
    margins,
    contentTop: margins.top + 14,
    contentBottom: margins.bottom + 8,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
  };
};

const isFieldEnabled = (ctx: ExportContext, fieldKey: string): boolean => {
  if (fieldKey === 'todos') return ctx.showTodosColumn;
  if (fieldKey === 'notes') return ctx.showNotesColumn || ctx.isColumnEnabled('notes');
  return ctx.isColumnEnabled(fieldKey);
};

const FALLBACK_COLUMN_LABELS: Record<string, string> = {
  patient: 'Patient',
  clinicalSummary: 'Clinical Summary',
  intervalEvents: 'Interval Events',
  imaging: 'Imaging',
  labs: 'Labs',
  medications: 'Medications',
  todos: 'Todos',
  notes: 'Notes',
};

const resolveColumnLabel = (ctx: ExportContext, key: string): string => {
  if (key.startsWith('systems.')) {
    const systemKey = key.replace('systems.', '') as keyof typeof systemLabels;
    return systemLabels[systemKey] || key;
  }

  const configuredLabel = ctx.columns.find(column => column.key === key)?.label;
  return configuredLabel || FALLBACK_COLUMN_LABELS[key] || key;
};

const resolveColumnWeight = (ctx: ExportContext, column: PdfRenderableColumn): number => {
  const getWeightFromFieldKey = (fieldKey: string): number => {
    if (fieldKey === 'clinicalSummary') return ctx.columnWidths.summary || 150;
    if (fieldKey === 'intervalEvents') return ctx.columnWidths.events || 150;
    if (fieldKey === 'patient') return ctx.columnWidths.patient || 100;
    if (fieldKey === 'notes') return ctx.columnWidths.notes || 140;
    if (fieldKey === 'todos') return ctx.columnWidths.todos || 140;
    if (fieldKey === 'imaging') return ctx.columnWidths.imaging || 120;
    if (fieldKey === 'labs') return ctx.columnWidths.labs || 120;
    if (fieldKey === 'medications') return ctx.columnWidths.medications || 150;
    if (fieldKey.startsWith('systems.')) {
      return ctx.columnWidths[fieldKey] || ctx.columnWidths['systems.neuro'] || 90;
    }
    return ctx.columnWidths[fieldKey] || 120;
  };

  if (column.type === 'combined') {
    const combinedWeight = column.sourceKeys.reduce((sum, sourceKey) => sum + getWeightFromFieldKey(sourceKey), 0);
    return combinedWeight || 200;
  }

  return getWeightFromFieldKey(column.sourceKeys[0]);
};

const buildRenderableColumns = (ctx: ExportContext): PdfRenderableColumn[] => {
  const renderColumns: PdfRenderableColumn[] = [];
  const processedKeys = new Set<string>();

  (ctx.combinedColumns || []).forEach(comboKey => {
    const combination = columnCombinations.find(combo => combo.key === comboKey);
    if (!combination) return;

    const activeSourceKeys = combination.columns.filter(columnKey => isFieldEnabled(ctx, columnKey));
    if (activeSourceKeys.length === 0) return;

    renderColumns.push({
      id: combination.key,
      label: combination.label,
      type: 'combined',
      sourceKeys: activeSourceKeys,
    });

    activeSourceKeys.forEach(columnKey => processedKeys.add(columnKey));
  });

  ctx.columns.forEach(column => {
    if (processedKeys.has(column.key)) return;
    if (!isFieldEnabled(ctx, column.key)) return;

    renderColumns.push({
      id: column.key,
      label: resolveColumnLabel(ctx, column.key),
      type: 'single',
      sourceKeys: [column.key],
    });
  });

  if (renderColumns.length === 0) {
    return [
      {
        id: 'patient',
        label: 'Patient',
        type: 'single',
        sourceKeys: ['patient'],
      },
    ];
  }

  return renderColumns.sort((a, b) => {
    if (a.id === 'patient') return -1;
    if (b.id === 'patient') return 1;
    return 0;
  });
};

const getPatientFieldCellData = (ctx: ExportContext, patient: Patient, fieldKey: string): PdfCellData => {
  if (fieldKey === 'patient') {
    return {
      text: normalizePdfText(`${patient.name || 'Unnamed'}\nBed: ${patient.bed || '-'}`),
      color: null,
    };
  }

  if (fieldKey === 'clinicalSummary') {
    return {
      text: htmlToStructuredText(patient.clinicalSummary),
      color: extractDominantColor(patient.clinicalSummary),
    };
  }

  if (fieldKey === 'intervalEvents') {
    return {
      text: htmlToStructuredText(patient.intervalEvents),
      color: extractDominantColor(patient.intervalEvents),
    };
  }

  if (fieldKey === 'imaging') {
    return {
      text: htmlToStructuredText(patient.imaging),
      color: extractDominantColor(patient.imaging),
    };
  }

  if (fieldKey === 'labs') {
    return {
      text: htmlToStructuredText(patient.labs),
      color: extractDominantColor(patient.labs),
    };
  }

  if (fieldKey === 'medications') {
    return {
      text: normalizePdfText(formatMedicationsText(patient.medications)),
      color: null,
    };
  }

  if (fieldKey.startsWith('systems.')) {
    const systemKey = fieldKey.replace('systems.', '') as keyof typeof patient.systems;
    const value = patient.systems[systemKey];
    return {
      text: htmlToStructuredText(value),
      color: extractDominantColor(value),
    };
  }

  if (fieldKey === 'todos') {
    return {
      text: normalizePdfText(formatTodosForDisplay(ctx.getPatientTodos(patient.id))),
      color: null,
    };
  }

  if (fieldKey === 'notes') {
    return {
      text: normalizePdfText(ctx.patientNotes[patient.id] || ''),
      color: null,
    };
  }

  const fallbackValue = patient[fieldKey as keyof Patient];
  if (typeof fallbackValue === 'string') {
    return {
      text: htmlToStructuredText(fallbackValue),
      color: extractDominantColor(fallbackValue),
    };
  }

  return {
    text: '',
    color: null,
  };
};

const getColumnCellData = (ctx: ExportContext, patient: Patient, column: PdfRenderableColumn): PdfCellData => {
  if (column.type === 'single') {
    return getPatientFieldCellData(ctx, patient, column.sourceKeys[0]);
  }

  const sectionBlocks: string[] = [];
  let combinedColor: RgbColor | null = null;

  column.sourceKeys.forEach(sourceKey => {
    const sectionData = getPatientFieldCellData(ctx, patient, sourceKey);
    if (!sectionData.text) return;

    sectionBlocks.push(`${resolveColumnLabel(ctx, sourceKey)}:\n${sectionData.text}`);
    if (!combinedColor && sectionData.color) {
      combinedColor = sectionData.color;
    }
  });

  return {
    text: normalizePdfText(sectionBlocks.join('\n\n')),
    color: combinedColor,
  };
};

const resolvePdfLayoutColumns = (ctx: ExportContext, renderColumnCount: number): { columns: PdfColumnLayout; explicit: boolean } => {
  const explicitColumns = ctx.pdf?.layoutColumns;
  if (explicitColumns === 1 || explicitColumns === 2 || explicitColumns === 3) {
    return {
      columns: explicitColumns,
      explicit: true,
    };
  }

  if (ctx.printOrientation === 'landscape') {
    if (ctx.printFontSize <= 7) {
      return {
        columns: 3,
        explicit: false,
      };
    }

    if (renderColumnCount <= 6 || ctx.printFontSize <= 9) {
      return {
        columns: 2,
        explicit: false,
      };
    }
  }

  return {
    columns: 1,
    explicit: false,
  };
};

const applyPdfHeaderAndFooter = (
  doc: jsPDF,
  ctx: ExportContext,
  metrics: PdfLayoutMetrics,
  typography: PdfTypographyConfig,
  generatedAt: string,
  pdfFontFamily: 'helvetica' | 'times' | 'courier'
) => {
  const totalPages = doc.getNumberOfPages();
  const title = normalizePdfText(ctx.pdf?.title || PDF_DEFAULT_TITLE) || PDF_DEFAULT_TITLE;
  const showTimestamp = ctx.showTimestamp !== false;
  const showPageNumbers = ctx.showPageNumbers !== false;

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);

    doc.setFont(pdfFontFamily, 'bold');
    doc.setFontSize(typography.titleFontSize);
    doc.setTextColor(...PDF_ACCENT_COLOR);
    doc.text(title, metrics.margins.left, metrics.margins.top - 1);

    doc.setFont(pdfFontFamily, 'normal');
    doc.setFontSize(typography.metaFontSize);
    doc.setTextColor(71, 85, 105);

    if (ctx.physicianName) {
      doc.text(ctx.physicianName, metrics.margins.left, metrics.margins.top + 4);
    }

    const totalPatientsLabel = `Total Patients: ${ctx.patients.length}`;
    doc.text(totalPatientsLabel, metrics.pageWidth - metrics.margins.right, metrics.margins.top + 4, { align: 'right' });

    doc.setDrawColor(...PDF_BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.line(metrics.margins.left, metrics.margins.top + 6, metrics.pageWidth - metrics.margins.right, metrics.margins.top + 6);

    const footerY = metrics.pageHeight - metrics.margins.bottom + 3;
    doc.line(
      metrics.margins.left,
      metrics.pageHeight - metrics.margins.bottom - 4,
      metrics.pageWidth - metrics.margins.right,
      metrics.pageHeight - metrics.margins.bottom - 4
    );

    if (showTimestamp) {
      doc.text(`Generated: ${generatedAt}`, metrics.margins.left, footerY);
    }

    if (showPageNumbers) {
      doc.text(`Page ${page} of ${totalPages}`, metrics.pageWidth - metrics.margins.right, footerY, { align: 'right' });
    }
  }
};

const renderPdfTableLayout = (
  doc: jsPDF,
  ctx: ExportContext,
  renderColumns: PdfRenderableColumn[],
  metrics: PdfLayoutMetrics,
  typography: PdfTypographyConfig,
  pdfFontFamily: 'helvetica' | 'times' | 'courier'
) => {
  const preserveHighlightColors = ctx.pdf?.preserveHighlightColors !== false;

  const tableRowsWithColors: PdfCellData[][] = ctx.patients.map(patient =>
    renderColumns.map(column => {
      const cellData = getColumnCellData(ctx, patient, column);
      return {
        text: cellData.text || '—',
        color: cellData.color,
      };
    })
  );

  const tableData = tableRowsWithColors.map(row => row.map(cell => cell.text));
  const totalWeight = renderColumns.reduce((sum, column) => sum + resolveColumnWeight(ctx, column), 0) || 1;
  const usableWidth = metrics.pageWidth - metrics.margins.left - metrics.margins.right;

  const columnStyles = renderColumns.reduce((styles, column, index) => {
    const normalizedWidth = (resolveColumnWeight(ctx, column) / totalWeight) * usableWidth;
    styles[index] = {
      cellWidth: Math.max(24, normalizedWidth),
    };
    return styles;
  }, {} as Record<number, { cellWidth: number }>);

  autoTable(doc, {
    head: [renderColumns.map(column => column.label)],
    body: tableData,
    startY: metrics.contentTop,
    margin: {
      top: metrics.contentTop,
      left: metrics.margins.left,
      right: metrics.margins.right,
      bottom: metrics.contentBottom,
    },
    showHead: 'everyPage',
    rowPageBreak: 'auto',
    tableWidth: 'auto',
    styles: {
      font: pdfFontFamily,
      fontSize: typography.bodyFontSize,
      cellPadding: typography.cellPadding,
      overflow: 'linebreak',
      lineWidth: 0.1,
      lineColor: PDF_BORDER_COLOR,
      textColor: [15, 23, 42],
      valign: 'top',
      minCellHeight: typography.lineHeight + 2,
    },
    headStyles: {
      fillColor: PDF_ACCENT_COLOR,
      textColor: 255,
      fontStyle: 'bold',
      font: pdfFontFamily,
      fontSize: clampNumber(typography.bodyFontSize + 0.5, 8, 12),
      cellPadding: typography.cellPadding + 0.2,
    },
    alternateRowStyles: {
      fillColor: PDF_ALTERNATE_ROW_COLOR,
    },
    columnStyles,
    didParseCell: data => {
      if (data.section !== 'body') return;

      const rowIndex = data.row.index;
      const columnIndex = data.column.index;
      const cellData = tableRowsWithColors[rowIndex]?.[columnIndex];
      if (!cellData?.color || !preserveHighlightColors) return;

      data.cell.styles.textColor = [cellData.color.r, cellData.color.g, cellData.color.b];
      const tintedColor = tintColor(cellData.color, 0.92);
      data.cell.styles.fillColor = [tintedColor.r, tintedColor.g, tintedColor.b];
    },
  });
};

const renderPdfMultiColumnLayout = (
  doc: jsPDF,
  ctx: ExportContext,
  renderColumns: PdfRenderableColumn[],
  layoutColumns: PdfColumnLayout,
  metrics: PdfLayoutMetrics,
  typography: PdfTypographyConfig,
  pdfFontFamily: 'helvetica' | 'times' | 'courier'
) => {
  const preserveHighlightColors = ctx.pdf?.preserveHighlightColors !== false;

  const patientCards: PdfCellData[] = ctx.patients.map(patient => {
    const cardSections: string[] = [];
    let cardColor: RgbColor | null = null;

    const patientHeader = getPatientFieldCellData(ctx, patient, 'patient');
    if (patientHeader.text) {
      cardSections.push(patientHeader.text);
    }

    renderColumns
      .filter(column => column.id !== 'patient')
      .forEach(column => {
        const columnData = getColumnCellData(ctx, patient, column);
        if (!columnData.text) return;

        cardSections.push(`${column.label.toUpperCase()}:\n${columnData.text}`);
        if (!cardColor && columnData.color) {
          cardColor = columnData.color;
        }
      });

    return {
      text: normalizePdfText(cardSections.join('\n\n')),
      color: cardColor,
    };
  });

  const rowsWithColors: PdfCellData[][] = [];
  for (let index = 0; index < patientCards.length; index += layoutColumns) {
    const row: PdfCellData[] = [];
    for (let columnIndex = 0; columnIndex < layoutColumns; columnIndex += 1) {
      row.push(patientCards[index + columnIndex] || { text: '', color: null });
    }
    rowsWithColors.push(row);
  }

  const bodyRows = rowsWithColors.map(row => row.map(cell => cell.text || ' '));
  const usableWidth = metrics.pageWidth - metrics.margins.left - metrics.margins.right;
  const cardColumnWidth = usableWidth / layoutColumns;

  const columnStyles = Array.from({ length: layoutColumns }).reduce<Record<number, { cellWidth: number }>>(
    (styles, _, index) => {
      styles[index] = {
        cellWidth: cardColumnWidth,
      };
      return styles;
    },
    {}
  );

  autoTable(doc, {
    body: bodyRows,
    startY: metrics.contentTop,
    margin: {
      top: metrics.contentTop,
      left: metrics.margins.left,
      right: metrics.margins.right,
      bottom: metrics.contentBottom,
    },
    rowPageBreak: 'avoid',
    tableWidth: 'auto',
    styles: {
      font: pdfFontFamily,
      fontSize: clampNumber(typography.bodyFontSize - (layoutColumns === 3 ? 1 : 0), 6.5, 11),
      cellPadding: layoutColumns === 3 ? 1.4 : 2,
      overflow: 'linebreak',
      lineWidth: 0.12,
      lineColor: PDF_BORDER_COLOR,
      textColor: [15, 23, 42],
      valign: 'top',
      minCellHeight: layoutColumns === 3 ? 34 : 42,
    },
    alternateRowStyles: {
      fillColor: PDF_ALTERNATE_ROW_COLOR,
    },
    columnStyles,
    didParseCell: data => {
      if (data.section !== 'body') return;

      const rowIndex = data.row.index;
      const columnIndex = data.column.index;
      const cellData = rowsWithColors[rowIndex]?.[columnIndex];
      if (!cellData?.color || !preserveHighlightColors) return;

      data.cell.styles.textColor = [cellData.color.r, cellData.color.g, cellData.color.b];
      const cardTint = tintColor(cellData.color, 0.94);
      data.cell.styles.fillColor = [cardTint.r, cardTint.g, cardTint.b];
    },
  });
};

const exportWithHtml2PdfFallback = async (ctx: ExportContext, element: HTMLElement, fileName: string) => {
  await html2pdf()
    .set({
      filename: fileName,
      margin: 0,
      image: {
        type: 'jpeg',
        quality: 0.98,
      },
      html2canvas: {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: ctx.printOrientation,
      },
    })
    .from(element)
    .save();
};

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
    if (isColumnEnabled("medications")) {
      row["Medications"] = formatMedicationsText(patient.medications);
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
  const fileName = getPdfFileName();
  const generatedAt = new Date().toLocaleString();

  try {
    const doc = new jsPDF({
      orientation: ctx.printOrientation,
      unit: 'mm',
      format: 'a4',
    });

    const pdfFontFamily = resolvePdfFontFamily(ctx.printFontFamily);
    const typography = getPdfTypography(ctx);
    const metrics = getPdfLayoutMetrics(doc, ctx);
    const renderColumns = buildRenderableColumns(ctx);
    const { columns: layoutColumns, explicit } = resolvePdfLayoutColumns(ctx, renderColumns.length);

    const shouldUseMultiColumnLayout =
      !ctx.onePatientPerPage && layoutColumns > 1 && (explicit || renderColumns.length <= 8);

    doc.setFont(pdfFontFamily, 'normal');

    if (shouldUseMultiColumnLayout) {
      renderPdfMultiColumnLayout(doc, ctx, renderColumns, layoutColumns, metrics, typography, pdfFontFamily);
    } else {
      renderPdfTableLayout(doc, ctx, renderColumns, metrics, typography, pdfFontFamily);
    }

    applyPdfHeaderAndFooter(doc, ctx, metrics, typography, generatedAt, pdfFontFamily);
    doc.save(fileName);

    return fileName;
  } catch (error) {
    console.error('jsPDF export failed, attempting html2pdf fallback:', error);
    if (!element) {
      throw error;
    }

    await exportWithHtml2PdfFallback(ctx, element, fileName);
    return fileName;
  }
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
    if (isColumnEnabled("medications")) {
      const medsText = formatMedicationsText(patient.medications);
      if (medsText) content += `MEDICATIONS:\n${medsText}\n\n`;
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
    if (isColumnEnabled("medications")) {
      const medsText = formatMedicationsText(patient.medications);
      if (medsText) {
        content += `\\fs22\\b Medications:\\b0\\par\n`;
        content += `\\fs20 ${escapeRTFNew(medsText)}\\par\\par\n`;
      }
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
    if (isColumnEnabled("medications")) {
      const medsText = formatMedicationsText(patient.medications);
      if (medsText) {
        html += `
    <div class="section">
      <div class="section-title">Medications</div>
      <div class="section-content">${medsText.replace(/\n/g, '<br>')}</div>
    </div>`;
      }
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

export const handleExportMarkdown = (ctx: ExportContext) => {
  const { patients, isColumnEnabled, showTodosColumn, getPatientTodos, patientNotes } = ctx;
  const enabledSystemKeys = getEnabledSystemKeys(isColumnEnabled);

  let content = `# Patient Rounding Report\n`;
  content += `**Generated:** ${new Date().toLocaleString()}\n`;
  content += `**Total Patients:** ${patients.length}\n\n`;

  patients.forEach((patient, index) => {
    content += `## Patient ${index + 1}: ${patient.name || 'Unnamed'}\n`;
    content += `**Bed/Room:** ${patient.bed || 'N/A'}\n\n`;

    if (isColumnEnabled("clinicalSummary") && patient.clinicalSummary) {
      content += `### Clinical Summary\n${stripHtml(patient.clinicalSummary)}\n\n`;
    }
    if (isColumnEnabled("intervalEvents") && patient.intervalEvents) {
      content += `### Interval Events\n${stripHtml(patient.intervalEvents)}\n\n`;
    }
    if (isColumnEnabled("imaging") && patient.imaging) {
      content += `### Imaging\n${stripHtml(patient.imaging)}\n\n`;
    }
    if (isColumnEnabled("labs") && patient.labs) {
      content += `### Labs\n${stripHtml(patient.labs)}\n\n`;
    }
    if (isColumnEnabled("medications")) {
      const medsText = formatMedicationsText(patient.medications);
      if (medsText) {
        content += `### Medications\n${medsText}\n\n`;
      }
    }

    if (enabledSystemKeys.length > 0) {
      content += `### Systems Review\n`;
      enabledSystemKeys.forEach(key => {
        const value = patient.systems[key as keyof typeof patient.systems];
        if (value) {
          content += `#### ${systemLabels[key]}\n${stripHtml(value)}\n\n`;
        }
      });
    }

    if (showTodosColumn) {
      const todos = getPatientTodos(patient.id);
      if (todos.length > 0) {
        content += `### Todos\n`;
        todos.forEach(todo => {
          content += `- [${todo.completed ? 'x' : ' '}] ${todo.content}\n`;
        });
        content += `\n`;
      }
    }

    if (isColumnEnabled("notes") && patientNotes[patient.id]) {
      content += `### Notes\n${patientNotes[patient.id]}\n\n`;
    }

    content += `---\n\n`;
  });

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `patient-rounding-${new Date().toISOString().split('T')[0]}.md`;
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
      if (isColumnEnabled("medications")) {
        row.medications = {
          infusions: patient.medications?.infusions || [],
          scheduled: patient.medications?.scheduled || [],
          prn: patient.medications?.prn || [],
          rawText: patient.medications?.rawText || ''
        };
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
