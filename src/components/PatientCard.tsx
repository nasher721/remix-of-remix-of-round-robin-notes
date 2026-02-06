import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, Copy, Trash2, ChevronDown, ChevronUp, Clock, ImageIcon, TestTube, Sparkles, Loader2, History, Settings2, X, Eraser, ClipboardList } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { ImagePasteEditor } from "./ImagePasteEditor";
import { PatientTodos } from "./PatientTodos";
import { FieldTimestamp } from "./FieldTimestamp";
import { FieldHistoryViewer } from "./FieldHistoryViewer";
import { SystemsConfigManager } from "./SystemsConfigManager";
import { MedicationList } from "./MedicationList";
import { LabFishbone } from "./labs";
import { PatientAcuityBadge } from "./PatientAcuityBadge";
import { QuickActionsPanel } from "./QuickActionsPanel";
import { SmartProtocolSuggestions, ProtocolBadge } from "./SmartProtocolSuggestions";
import { LabTrendBadge } from "./LabTrendingPanel";
import { AIGeneratorTools } from "./AIGeneratorTools";
import { AIClinicalAssistant } from "./AIClinicalAssistant";
import { PatientSystemsReview } from "./PatientSystemsReview";
import type { AutoText } from "@/types/autotext";
import { defaultAutotexts } from "@/data/autotexts";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import type { TodoSection } from "@/types/todo";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import { useIntervalEventsGenerator } from "@/hooks/useIntervalEventsGenerator";
import { useDailySummaryGenerator } from "@/hooks/useDailySummaryGenerator";
import { useSettings } from "@/contexts/SettingsContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";

interface PatientCardProps {
  patient: Patient;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  autotexts?: AutoText[];
}

const PatientCardComponent = ({
  patient,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleCollapse,
  autotexts = defaultAutotexts,
}: PatientCardProps) => {
  const { globalFontSize, todosAlwaysVisible, showLabFishbones, sectionVisibility } = useSettings();
  const changeTracking = useChangeTracking();

  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);
  const [showSystemsConfig, setShowSystemsConfig] = React.useState(false);
  const { todos, generating, addTodo, toggleTodo, deleteTodo, generateTodos } = usePatientTodos(patient.id);
  const { generateIntervalEvents, isGenerating: isGeneratingEvents, cancelGeneration } = useIntervalEventsGenerator();
  const { generateDailySummary, isGenerating: isGeneratingSummary, cancelGeneration: cancelSummary } = useDailySummaryGenerator();
  const { enabledSystems, systemLabels, systemIcons } = useSystemsConfig();
  const imagingImageCount = React.useMemo(() => {
    if (!patient.imaging) return 0;
    return (patient.imaging.match(/<img[^>]+src=["'][^"']+["'][^>]*>/gi) || []).length;
  }, [patient.imaging]);

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

  const handleGenerateDailySummary = async () => {
    await generateDailySummary(patient, (newValue) => {
      onUpdate(patient.id, 'intervalEvents', newValue);
    });
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

  const clearAllSystems = () => {
    if (confirm('Clear ALL systems review data? This cannot be undone.')) {
      // Clear each enabled system
      enabledSystems.forEach((system) => {
        onUpdate(patient.id, `systems.${system.key}`, '');
      });
    }
  };



  return (
    <div className="print-avoid-break bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden card-hover">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 px-5 py-4 bg-gradient-to-r from-secondary/30 to-transparent border-b border-border/30">
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/10">
            <span className="text-base font-semibold text-primary">
              {patient.name ? patient.name.charAt(0).toUpperCase() : '#'}
            </span>
          </div>
          <div className="flex gap-2.5 flex-1 flex-wrap items-center">
            <Input
              placeholder="Patient Name"
              value={patient.name}
              onChange={(e) => onUpdate(patient.id, 'name', e.target.value)}
              className="max-w-[200px] font-medium bg-background/80 border border-border/40 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-lg px-3 h-8 text-sm transition-all duration-150"
            />
            <Input
              placeholder="Bed/Room"
              value={patient.bed}
              onChange={(e) => onUpdate(patient.id, 'bed', e.target.value)}
              className="max-w-[100px] bg-background/80 border border-border/40 hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-lg px-3 h-8 text-sm text-muted-foreground transition-all duration-150"
            />
            {/* Patient Status Badges */}
            <div className="flex items-center gap-1.5 no-print">
              <PatientAcuityBadge patient={patient} size="sm" />
              <LabTrendBadge labText={patient.labs} />
              <ProtocolBadge patient={patient} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 no-print">
          {/* Quick Actions & Protocol Tools */}
          <QuickActionsPanel patient={patient} onUpdatePatient={onUpdate} />
          <SmartProtocolSuggestions patient={patient} />
          <AIGeneratorTools patient={patient} onUpdatePatient={onUpdate} compact />
          <AIClinicalAssistant patient={patient} onUpdatePatient={onUpdate} compact />
          <div className="w-px h-4 bg-border/40 mx-1" />
          <FieldHistoryViewer
            patientId={patient.id}
            patientName={patient.name}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground/70 hover:text-foreground hover:bg-secondary/60"
                title="View change history"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleCollapse(patient.id)}
            className="h-8 w-8 text-muted-foreground/70 hover:text-foreground hover:bg-secondary/60"
            title={patient.collapsed ? "Expand" : "Collapse"}
          >
            {patient.collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(patient.id)}
            className="h-8 w-8 text-muted-foreground/70 hover:text-foreground hover:bg-secondary/60"
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(patient.id)}
            className="h-8 w-8 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/5"
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!patient.collapsed && (
        <div className="p-5 space-y-4">
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
          {sectionVisibility.clinicalSummary && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/8">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinical Summary</h3>
                  {patient.clinicalSummary && (
                    <span className="text-[10px] text-muted-foreground/60 bg-secondary/60 px-1.5 py-0.5 rounded">
                      {patient.clinicalSummary.length}
                    </span>
                  )}
                </div>
                <div className="flex gap-0.5 no-print">
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
                    className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground"
                    title="Add timestamp"
                  >
                    <Clock className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearSection('clinicalSummary')}
                    className="h-6 px-1.5 text-[10px] text-muted-foreground/50 hover:text-destructive"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="bg-secondary/20 rounded-lg p-3 border border-border/30 transition-colors focus-within:border-primary/20 focus-within:bg-secondary/30">
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
          )}

          {/* Interval Events */}
          {sectionVisibility.intervalEvents && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/8">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interval Events</h3>
                  {patient.intervalEvents && (
                    <span className="text-[10px] text-muted-foreground/60 bg-secondary/60 px-1.5 py-0.5 rounded">
                      {patient.intervalEvents.length}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 no-print">
                  {isGeneratingEvents || isGeneratingSummary ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={isGeneratingEvents ? cancelGeneration : cancelSummary}
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Cancel generation"
                    >
                      <X className="h-3 w-3" />
                      <span className="ml-1 text-xs">Cancel</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateIntervalEvents}
                        className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                        title="Generate from Systems (AI)"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span className="ml-1 text-xs">Generate</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateDailySummary}
                        className="h-7 px-2 text-amber-600 hover:text-amber-600 hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
                        title="Summarize today's changes & todos (AI)"
                      >
                        <ClipboardList className="h-3 w-3" />
                        <span className="ml-1 text-xs">Summary</span>
                      </Button>
                    </>
                  )}
                  {(isGeneratingEvents || isGeneratingSummary) && (
                    <div className="flex items-center h-7 px-2">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    </div>
                  )}
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
                    className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground"
                    title="Add timestamp"
                  >
                    <Clock className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearSection('intervalEvents')}
                    className="h-6 px-1.5 text-[10px] text-muted-foreground/50 hover:text-destructive"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="bg-secondary/20 rounded-lg p-3 border border-border/30 transition-colors focus-within:border-primary/20 focus-within:bg-secondary/30">
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
          )}

          {/* Imaging & Labs Row */}
          {(sectionVisibility.imaging || sectionVisibility.labs) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Imaging */}
              {sectionVisibility.imaging && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded flex items-center justify-center bg-blue-500/8">
                        <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imaging</h3>
                      {patient.imaging && (
                        <span className="text-[10px] text-blue-600/60 bg-blue-50 px-1.5 py-0.5 rounded">
                          {patient.imaging.replace(/<[^>]*>/g, '').length}
                        </span>
                      )}
                      {imagingImageCount > 0 && (
                        <span className="text-[10px] text-blue-600/70 bg-blue-50 px-1.5 py-0.5 rounded">
                          {imagingImageCount} img
                        </span>
                      )}
                    </div>
                    <div className="flex gap-0.5 no-print">
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
                        className="h-6 px-1.5 text-[10px] text-muted-foreground/50 hover:text-destructive"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="bg-blue-50/20 rounded-lg border border-blue-200/30 transition-colors focus-within:border-blue-300/40">
                      <ImagePasteEditor
                        value={patient.imaging}
                        onChange={(value) => onUpdate(patient.id, 'imaging', value)}
                        placeholder="X-rays, CT, MRI, Echo... (paste images here)"
                        minHeight="60px"
                        autotexts={autotexts}
                        fontSize={globalFontSize}
                        changeTracking={changeTracking}
                        patient={patient}
                        section="imaging"
                      />
                    </div>
                    <FieldTimestamp timestamp={patient.fieldTimestamps?.imaging} className="pl-1" />
                  </div>
                </div>
              )}

              {/* Labs */}
              {sectionVisibility.labs && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/8">
                        <TestTube className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labs</h3>
                      {patient.labs && (
                        <span className="text-[10px] text-muted-foreground/60 bg-secondary/60 px-1.5 py-0.5 rounded">
                          {patient.labs.length}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-0.5 no-print">
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
                        className="h-6 px-1.5 text-[10px] text-muted-foreground/50 hover:text-destructive"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Lab Fishbone Display (when enabled and labs have data) */}
                  {showLabFishbones && patient.labs && (
                    <LabFishbone labs={patient.labs} className="mb-2" />
                  )}

                  <div className="space-y-1">
                    <div className="bg-secondary/20 rounded-lg p-3 border border-border/30 transition-colors focus-within:border-primary/20 focus-within:bg-secondary/30">
                      <RichTextEditor
                        value={patient.labs}
                        onChange={(value) => onUpdate(patient.id, 'labs', value)}
                        placeholder="CBC, BMP, LFTs, coags... (e.g., Na: 140, K: 4.0, Cr: 1.0)"
                        minHeight="60px"
                        autotexts={autotexts}
                        fontSize={globalFontSize}
                        changeTracking={changeTracking}
                      />
                    </div>
                    <FieldTimestamp timestamp={patient.fieldTimestamps?.labs} className="pl-1" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Medications */}
          {sectionVisibility.medications && (
            <div className="bg-secondary/15 rounded-lg p-4 border border-border/30">
              <MedicationList
                medications={patient.medications ?? { infusions: [], scheduled: [], prn: [] }}
                onMedicationsChange={(meds) => onUpdate(patient.id, 'medications', meds)}
              />
              <FieldTimestamp timestamp={patient.fieldTimestamps?.medications} className="pl-1 mt-2" />
            </div>
          )}

          {/* Systems Review */}
          {sectionVisibility.systemsReview && (
            <PatientSystemsReview
              patient={patient}
              todos={todos}
              generating={generating}
              autotexts={autotexts}
              globalFontSize={globalFontSize}
              changeTracking={changeTracking}
              onUpdate={onUpdate}
              addTodo={addTodo}
              toggleTodo={toggleTodo}
              deleteTodo={deleteTodo}
              generateTodos={(section) => generateTodos(patient, section as TodoSection)}
              onClearAll={clearAllSystems}
              onOpenConfig={() => setShowSystemsConfig(true)}
            />
          )}
        </div>
      )}

      <SystemsConfigManager
        open={showSystemsConfig}
        onOpenChange={setShowSystemsConfig}
      />
    </div>
  );
};

// Memoize to prevent unnecessary re-renders when other patients change
export const PatientCard = React.memo(PatientCardComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.patient.id === nextProps.patient.id &&
    prevProps.patient.name === nextProps.patient.name &&
    prevProps.patient.bed === nextProps.patient.bed &&
    prevProps.patient.clinicalSummary === nextProps.patient.clinicalSummary &&
    prevProps.patient.intervalEvents === nextProps.patient.intervalEvents &&
    prevProps.patient.imaging === nextProps.patient.imaging &&
    prevProps.patient.labs === nextProps.patient.labs &&
    prevProps.patient.collapsed === nextProps.patient.collapsed &&
    prevProps.patient.lastModified === nextProps.patient.lastModified &&
    prevProps.autotexts === nextProps.autotexts &&
    prevProps.onUpdate === nextProps.onUpdate &&
    prevProps.onRemove === nextProps.onRemove &&
    prevProps.onDuplicate === nextProps.onDuplicate &&
    prevProps.onToggleCollapse === nextProps.onToggleCollapse
  );
});
