import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, Copy, Trash2, ChevronDown, ChevronUp, Clock, ImageIcon, TestTube, Sparkles, Loader2, History } from "lucide-react";
import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor";
import { ImagePasteEditor } from "./ImagePasteEditor";
import { PatientTodos } from "./PatientTodos";
import { FieldTimestamp } from "./FieldTimestamp";
import { FieldHistoryViewer } from "./FieldHistoryViewer";
import { AutoText } from "@/types/autotext";
import { defaultAutotexts } from "@/data/autotexts";
import type { Patient, PatientSystems } from "@/types/patient";
import { SYSTEM_LABELS, SYSTEM_ICONS } from "@/constants/systems";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import { useIntervalEventsGenerator } from "@/hooks/useIntervalEventsGenerator";
interface PatientCardProps {
  patient: Patient;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  autotexts?: AutoText[];
  globalFontSize?: number;
  changeTracking?: {
    enabled: boolean;
    wrapWithMarkup: (text: string) => string;
  } | null;
  todosAlwaysVisible?: boolean;
}

export const PatientCard = ({ 
  patient, 
  onUpdate, 
  onRemove, 
  onDuplicate, 
  onToggleCollapse,
  autotexts = defaultAutotexts,
  globalFontSize = 14,
  changeTracking = null,
  todosAlwaysVisible = false
}: PatientCardProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { todos, generating, addTodo, toggleTodo, deleteTodo, generateTodos } = usePatientTodos(patient.id);
  const { generateIntervalEvents, isGenerating: isGeneratingEvents } = useIntervalEventsGenerator();

  const handleGenerateIntervalEvents = async () => {
    const result = await generateIntervalEvents(
      patient.systems,
      patient.intervalEvents,
      patient.name
    );
    if (result) {
      // Append to existing interval events with a newline separator
      const newValue = patient.intervalEvents 
        ? `${patient.intervalEvents}\n\n${result}`
        : result;
      onUpdate(patient.id, 'intervalEvents', newValue);
    }
  };

  const addTimestamp = (field: string) => {
    const timestamp = new Date().toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
    const currentValue = field.includes('.') 
      ? patient.systems[field.split('.')[1] as keyof PatientSystems]
      : patient[field as keyof Patient];
    const newValue = `[${timestamp}] ${currentValue || ''}`;
    onUpdate(patient.id, field, newValue);
  };

  const clearSection = (field: string) => {
    if (confirm('Clear this section?')) {
      onUpdate(patient.id, field, '');
    }
  };

  const hasSystemContent = (key: string) => {
    return Boolean(patient.systems[key as keyof PatientSystems]);
  };

  return (
    <div className="print-avoid-break bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 p-5 border-b border-border">
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">👤</span>
            </div>
            <div className="flex gap-3 flex-1 flex-wrap">
              <Input
                placeholder="Patient Name"
                value={patient.name}
                onChange={(e) => onUpdate(patient.id, 'name', e.target.value)}
                className="max-w-[220px] font-medium bg-card border border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-[0_0_12px_hsl(var(--primary)/0.15)] rounded-lg px-3 h-9 text-base transition-shadow duration-200"
              />
              <Input
                placeholder="Bed/Room"
                value={patient.bed}
                onChange={(e) => onUpdate(patient.id, 'bed', e.target.value)}
                className="max-w-[120px] bg-card border border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-[0_0_12px_hsl(var(--primary)/0.15)] rounded-lg px-3 h-9 text-muted-foreground transition-shadow duration-200"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 no-print">
          <FieldHistoryViewer
            patientId={patient.id}
            patientName={patient.name}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                title="View change history"
              >
                <History className="h-4 w-4" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleCollapse(patient.id)}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title={patient.collapsed ? "Expand" : "Collapse"}
          >
            {patient.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(patient.id)}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(patient.id)}
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!patient.collapsed && (
        <div className="p-5 space-y-5">
          {/* Patient-Wide Todos */}
          <div className={todosAlwaysVisible ? "" : "flex items-center gap-2 pb-2 border-b border-border"}>
            {!todosAlwaysVisible && (
              <span className="text-sm font-medium text-muted-foreground">Patient Tasks:</span>
            )}
            <PatientTodos
              todos={todos}
              section={null}
              patient={patient}
              generating={generating}
              onAddTodo={addTodo}
              onToggleTodo={toggleTodo}
              onDeleteTodo={deleteTodo}
              onGenerateTodos={generateTodos}
              alwaysVisible={todosAlwaysVisible}
            />
          </div>

          {/* Clinical Summary */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">Clinical Summary</h3>
                {patient.clinicalSummary && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {patient.clinicalSummary.length} chars
                  </span>
                )}
              </div>
              <div className="flex gap-1 no-print">
                <PatientTodos
                  todos={todos}
                  section="clinical_summary"
                  patient={patient}
                  generating={generating}
                  onAddTodo={addTodo}
                  onToggleTodo={toggleTodo}
                  onDeleteTodo={deleteTodo}
                  onGenerateTodos={generateTodos}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addTimestamp('clinicalSummary')}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  title="Add timestamp"
                >
                  <Clock className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearSection('clinicalSummary')}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.clinicalSummary}
                  onChange={(value) => onUpdate(patient.id, 'clinicalSummary', value)}
                  placeholder="Enter clinical summary..."
                  minHeight="80px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.clinicalSummary} className="pl-1" />
            </div>
          </div>

          {/* Interval Events */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">Interval Events</h3>
                {patient.intervalEvents && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {patient.intervalEvents.length} chars
                  </span>
                )}
              </div>
              <div className="flex gap-1 no-print">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateIntervalEvents}
                  disabled={isGeneratingEvents}
                  className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                  title="Generate from Systems (AI)"
                >
                  {isGeneratingEvents ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  <span className="ml-1 text-xs">Generate</span>
                </Button>
                <PatientTodos
                  todos={todos}
                  section="interval_events"
                  patient={patient}
                  generating={generating}
                  onAddTodo={addTodo}
                  onToggleTodo={toggleTodo}
                  onDeleteTodo={deleteTodo}
                  onGenerateTodos={generateTodos}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addTimestamp('intervalEvents')}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  title="Add timestamp"
                >
                  <Clock className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearSection('intervalEvents')}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.intervalEvents}
                  onChange={(value) => onUpdate(patient.id, 'intervalEvents', value)}
                  placeholder="Enter interval events..."
                  minHeight="80px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.intervalEvents} className="pl-1" />
            </div>
          </div>

          {/* Imaging & Labs Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Imaging */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-medium">Imaging</h3>
                  {patient.imaging && (
                    <span className="text-xs text-muted-foreground bg-blue-100 px-2 py-0.5 rounded-full">
                      {patient.imaging.includes('<img') ? '📷' : ''} {patient.imaging.replace(/<[^>]*>/g, '').length} chars
                    </span>
                  )}
                </div>
                <div className="flex gap-1 no-print">
                  <PatientTodos
                    todos={todos}
                    section="imaging"
                    patient={patient}
                    generating={generating}
                    onAddTodo={addTodo}
                    onToggleTodo={toggleTodo}
                    onDeleteTodo={deleteTodo}
                    onGenerateTodos={generateTodos}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearSection('imaging')}
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="bg-blue-50/30 rounded-lg border border-blue-200/50">
                  <ImagePasteEditor
                    value={patient.imaging}
                    onChange={(value) => onUpdate(patient.id, 'imaging', value)}
                    placeholder="X-rays, CT, MRI, Echo... (paste images here)"
                    minHeight="60px"
                    autotexts={autotexts}
                    fontSize={globalFontSize}
                    changeTracking={changeTracking}
                  />
                </div>
                <FieldTimestamp timestamp={patient.fieldTimestamps?.imaging} className="pl-1" />
              </div>
            </div>

            {/* Labs */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TestTube className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium">Labs</h3>
                  {patient.labs && (
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {patient.labs.length} chars
                    </span>
                  )}
                </div>
                <div className="flex gap-1 no-print">
                  <PatientTodos
                    todos={todos}
                    section="labs"
                    patient={patient}
                    generating={generating}
                    onAddTodo={addTodo}
                    onToggleTodo={toggleTodo}
                    onDeleteTodo={deleteTodo}
                    onGenerateTodos={generateTodos}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearSection('labs')}
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                  <RichTextEditor
                    value={patient.labs}
                    onChange={(value) => onUpdate(patient.id, 'labs', value)}
                    placeholder="CBC, BMP, LFTs, coags..."
                    minHeight="60px"
                    autotexts={autotexts}
                    fontSize={globalFontSize}
                    changeTracking={changeTracking}
                  />
                </div>
                <FieldTimestamp timestamp={patient.fieldTimestamps?.labs} className="pl-1" />
              </div>
            </div>
          </div>

          {/* Systems Review */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-primary text-sm">⚕️</span>
              <h3 className="text-sm font-medium">Systems Review</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Object.entries(SYSTEM_LABELS).map(([key, label]) => (
                <div 
                  key={key} 
                  className={`rounded-lg p-3 border transition-all duration-200 ${
                    hasSystemContent(key) 
                      ? 'bg-card border-primary/20 shadow-sm' 
                      : 'bg-secondary/30 border-border/50 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <span>{SYSTEM_ICONS[key]}</span>
                      {label}
                    </label>
                    <div className="flex items-center gap-1">
                      <PatientTodos
                        todos={todos}
                        section={key}
                        patient={patient}
                        generating={generating}
                        onAddTodo={addTodo}
                        onToggleTodo={toggleTodo}
                        onDeleteTodo={deleteTodo}
                        onGenerateTodos={generateTodos}
                      />
                      {hasSystemContent(key) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <RichTextEditor
                      value={patient.systems[key as keyof PatientSystems]}
                      onChange={(value) => onUpdate(patient.id, `systems.${key}`, value)}
                      placeholder={`${label}...`}
                      minHeight="50px"
                      autotexts={autotexts}
                      fontSize={globalFontSize}
                      changeTracking={changeTracking}
                    />
                    <FieldTimestamp 
                      timestamp={patient.fieldTimestamps?.[`systems.${key}` as keyof typeof patient.fieldTimestamps]} 
                      className="pl-1" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
