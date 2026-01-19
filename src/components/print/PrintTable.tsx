import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import type { ColumnWidthsType } from './types';
import { systemLabels } from './constants';
import { cleanInlineStyles, formatTodosHtml } from './utils';
import { cn } from '@/lib/utils';

interface PrintTableProps {
  patients: Patient[];
  columns: { key: string; enabled: boolean }[];
  columnWidths: ColumnWidthsType;
  printFontSize: number;
  fontCSS: string;
  enabledSystemKeys: string[];
  showNotesColumn: boolean;
  showTodosColumn: boolean;
  getPatientTodos: (patientId: string) => PatientTodo[];
  isColumnEnabled: (key: string) => boolean;
}

export const PrintTable = ({
  patients,
  columnWidths,
  printFontSize,
  fontCSS,
  enabledSystemKeys,
  showNotesColumn,
  showTodosColumn,
  getPatientTodos,
  isColumnEnabled,
}: PrintTableProps) => {
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
            {showTodosColumn && (
              <th 
                className="border border-border p-3 text-left font-bold bg-violet-500 text-white uppercase"
                style={{ width: columnWidths.notes, fontSize: `${printFontSize + 1}px` }}
              >
                Todos
              </th>
            )}
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
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.clinicalSummary) }}
                  />
                </td>
              )}
              {isColumnEnabled("intervalEvents") && (
                <td className="border border-border p-3 align-top">
                  <div 
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: `${printFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.intervalEvents) }}
                  />
                </td>
              )}
              {isColumnEnabled("imaging") && (
                <td className="border border-border p-3 align-top">
                  <div 
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: `${printFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.imaging) }}
                  />
                </td>
              )}
              {isColumnEnabled("labs") && (
                <td className="border border-border p-3 align-top">
                  <div 
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: `${printFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.labs) }}
                  />
                </td>
              )}
              {enabledSystemKeys.map(key => (
                <td key={key} className="border border-border p-2 align-top">
                  <div 
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: `${printFontSize - 1}px` }}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.systems[key as keyof typeof patient.systems]) }}
                  />
                </td>
              ))}
              {showTodosColumn && (
                <td className="border border-border p-2 align-top bg-violet-50/50">
                  <div 
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: `${printFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: formatTodosHtml(getPatientTodos(patient.id)) }}
                  />
                </td>
              )}
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
};
