import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import { systemLabels } from './constants';
import { cleanInlineStyles } from './utils';
import { cn } from '@/lib/utils';
import { CheckSquare, Square } from 'lucide-react';

interface PrintCardsProps {
  patients: Patient[];
  printFontSize: number;
  fontCSS: string;
  enabledSystemKeys: string[];
  showNotesColumn: boolean;
  showTodosColumn: boolean;
  getPatientTodos: (patientId: string) => PatientTodo[];
  isColumnEnabled: (key: string) => boolean;
}

export const PrintCards = ({
  patients,
  printFontSize,
  fontCSS,
  enabledSystemKeys,
  showNotesColumn,
  showTodosColumn,
  getPatientTodos,
  isColumnEnabled,
}: PrintCardsProps) => {
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
                  className="bg-muted/30 p-3 whitespace-pre-wrap"
                  style={{ fontSize: `${printFontSize}px` }}
                  dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.clinicalSummary) }}
                />
              </div>
            )}

            {isColumnEnabled("intervalEvents") && patient.intervalEvents && (
              <div className="border-2 border-primary/30 rounded-lg overflow-hidden">
                <div className="bg-primary text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                  Interval Events
                </div>
                <div
                  className="bg-muted/30 p-3 whitespace-pre-wrap"
                  style={{ fontSize: `${printFontSize}px` }}
                  dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.intervalEvents) }}
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
                    className="bg-blue-50 p-3 whitespace-pre-wrap"
                    style={{ fontSize: `${printFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.imaging) }}
                  />
                </div>
              )}
              {isColumnEnabled("labs") && patient.labs && (
                <div className="border-2 border-green-400 rounded-lg overflow-hidden">
                  <div className="bg-green-500 text-white font-bold uppercase px-3 py-2" style={{ fontSize: `${printFontSize + 1}px`, letterSpacing: '0.5px' }}>
                    Labs
                  </div>
                  <div
                    className="bg-green-50 p-3 whitespace-pre-wrap"
                    style={{ fontSize: `${printFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.labs) }}
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
                      <div className="p-2 bg-muted/20 whitespace-pre-wrap" style={{ fontSize: `${printFontSize - 1}px` }} dangerouslySetInnerHTML={{ __html: cleanInlineStyles(value) }} />
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
};
