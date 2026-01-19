import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import { systemLabels } from './constants';
import { cleanInlineStyles } from './utils';
import { cn } from '@/lib/utils';
import { CheckSquare, Square } from 'lucide-react';

interface PrintListProps {
  patients: Patient[];
  printFontSize: number;
  fontCSS: string;
  enabledSystemKeys: string[];
  showNotesColumn: boolean;
  showTodosColumn: boolean;
  getPatientTodos: (patientId: string) => PatientTodo[];
  isColumnEnabled: (key: string) => boolean;
}

export const PrintList = ({
  patients,
  printFontSize,
  fontCSS,
  enabledSystemKeys,
  showNotesColumn,
  showTodosColumn,
  getPatientTodos,
  isColumnEnabled,
}: PrintListProps) => {
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
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.clinicalSummary) || '<span class="text-muted-foreground italic">None documented</span>' }}
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
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.intervalEvents) || '<span class="text-muted-foreground italic">None documented</span>' }}
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
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.imaging) || '<span class="text-muted-foreground italic">None documented</span>' }}
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
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.labs) || '<span class="text-muted-foreground italic">None documented</span>' }}
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
                          dangerouslySetInnerHTML={{ __html: cleanInlineStyles(value) || '<span class="text-muted-foreground">-</span>' }}
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
