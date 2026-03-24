import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { animate, stagger } from 'animejs';
import { cardHover, collapseVariants } from '@/lib/animations';
import { durations, ease, staggers } from '@/lib/anime-presets';
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
import { LengthOfStayBadge } from "./LengthOfStayBadge";
import { QuickActionsPanel } from "./QuickActionsPanel";
import { SmartProtocolSuggestions, ProtocolBadge } from "./SmartProtocolSuggestions";
import { LabTrendBadge } from "./LabTrendingPanel";
import { AppleAIAssistant } from "./AppleAIAssistant";
import { PatientSystemsReview } from "./PatientSystemsReview";
import type { AutoText } from "@/types/autotext";
import { defaultAutotexts } from "@/data/autotexts";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import type { PatientTodo, TodoSection } from "@/types/todo";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { usePatientTodos, type PatientTodosApi } from "@/hooks/usePatientTodos";
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
  /** When provided (e.g. from dashboard todosMap), used as initial todos and avoids a duplicate fetch. */
  initialTodos?: PatientTodo[];
  /** When set (e.g. desktop list + tasks rail), uses this API instead of internal usePatientTodos so rail and card stay in sync. */
  sharedPatientTodos?: PatientTodosApi;
  /** Hide the top patient-wide tasks block (parent shows it in a rail). */
  hidePatientWideTodos?: boolean;
}

const PatientCardComponent = ({
  patient,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleCollapse,
  autotexts = defaultAutotexts,
  initialTodos,
  sharedPatientTodos,
  hidePatientWideTodos = false,
}: PatientCardProps) => {
  const { globalFontSize, todosAlwaysVisible, showLabFishbones, sectionVisibility } = useSettings();
  const changeTracking = useChangeTracking();

  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);
  const [showSystemsConfig, setShowSystemsConfig] = React.useState(false);
  const internalTodos = usePatientTodos(sharedPatientTodos ? null : patient.id, {
    initialTodos: sharedPatientTodos ? undefined : initialTodos,
  });
  const { todos, generating, addTodo, toggleTodo, deleteTodo, generateTodos } = sharedPatientTodos ?? internalTodos;
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
    }, todos.length ? todos : undefined);
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



  const shouldReduceMotion = useReducedMotion();
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const prevCollapsed = React.useRef(patient.collapsed);

  React.useEffect(() => {
    const wasCollapsed = prevCollapsed.current;
    prevCollapsed.current = patient.collapsed;

    if (wasCollapsed && !patient.collapsed && !shouldReduceMotion) {
      const timer = setTimeout(() => {
        const el = bodyRef.current;
        if (!el) return;
        const sections = el.querySelectorAll<HTMLElement>(':scope > *');
        if (!sections.length) return;

        sections.forEach(s => { s.style.opacity = '0'; s.style.transform = 'translateY(12px)'; });

        animate(sections, {
          opacity: [0, 1],
          translateY: [12, 0],
          delay: stagger(staggers.tight),
          duration: durations.normal,
          ease: ease.out,
        });
      }, 180);

      return () => clearTimeout(timer);
    }
  }, [patient.collapsed, shouldReduceMotion]);

  return (
    <motion.article
      className="print-avoid-break bg-card rounded-lg border border-border/40 shadow-card hover:shadow-md transition-all duration-300 overflow-hidden relative group"
      aria-label={`Patient: ${patient.name || 'Unnamed'}`}
      variants={shouldReduceMotion ? undefined : cardHover}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
    >
      {/* Header */}
      <div className="flex justify-between items-center gap-4 px-4 py-3 bg-secondary/30 border-b border-border/30 transition-colors group-hover:bg-secondary/40">
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
            <span className="text-base font-semibold text-primary">
              {patient.name ? patient.name.charAt(0).toUpperCase() : '#'}
            </span>
          </div>
          <div className="flex gap-2.5 flex-1 flex-wrap items-center">
            <Input
              placeholder="Patient name"
              value={patient.name}
              onChange={(e) => onUpdate(patient.id, 'name', e.target.value)}
              aria-label="Patient name"
              title="Legal name or label used on rounds"
              className="max-w-[220px] font-semibold bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-base text-foreground transition-all duration-200 shadow-none hover:shadow-sm focus:shadow-sm tracking-tight"
            />
            <Input
              placeholder="MRN"
              value={patient.mrn ?? ""}
              onChange={(e) => onUpdate(patient.id, 'mrn', e.target.value)}
              aria-label="Medical record number"
              title="Hospital MRN or account number"
              className="max-w-[110px] bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-xs text-muted-foreground/70 font-normal transition-all duration-200 shadow-none hover:shadow-sm focus:shadow-sm"
            />
            <Input
              placeholder="Bed / room"
              value={patient.bed}
              onChange={(e) => onUpdate(patient.id, 'bed', e.target.value)}
              aria-label="Bed or room number"
              title="Unit and room or bay"
              className="max-w-[120px] bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-xs text-muted-foreground/70 font-normal transition-all duration-200 shadow-none hover:shadow-sm focus:shadow-sm"
            />
            {/* Patient Status Badges */}
            <div className="flex items-center gap-1.5 no-print">
              <PatientAcuityBadge patient={patient} size="sm" />
              <LengthOfStayBadge createdAt={patient.createdAt} />
              <LabTrendBadge labText={patient.labs} />
              <ProtocolBadge patient={patient} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 no-print">
          {/* Quick Actions & Protocol Tools */}
          <QuickActionsPanel patient={patient} onUpdatePatient={onUpdate} />
          <SmartProtocolSuggestions patient={patient} />
          <AppleAIAssistant patient={patient} onUpdatePatient={onUpdate} compact />
          <div className="w-px h-4 bg-border/40 mx-1" />
          <FieldHistoryViewer
            patientId={patient.id}
            patientName={patient.name}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
                aria-label="View change history"
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleCollapse(patient.id)}
            className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
            aria-label={patient.collapsed ? "Expand patient card" : "Collapse patient card"}
            aria-expanded={!patient.collapsed}
            aria-controls={`patient-body-${patient.id}`}
          >
            {patient.collapsed ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
          <div
            className="flex items-center gap-0.5 pl-2 ml-1 border-l border-border/50"
            role="group"
            aria-label="Duplicate or remove patient"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDuplicate(patient.id)}
              className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
              aria-label="Duplicate patient"
              title="Duplicate this patient card"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(patient.id)}
              className="h-8 w-8 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              aria-label="Remove patient from list"
              title="Remove patient from this session"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!patient.collapsed && (
          <motion.div
            key="card-body"
            id={`patient-body-${patient.id}`}
            variants={shouldReduceMotion ? undefined : collapseVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="overflow-hidden"
          >
            <div ref={bodyRef} className="p-4 space-y-4">
              {/* Patient-Wide Todos (hidden when desktop parent renders them in the tasks rail) */}
              {!hidePatientWideTodos && (
                <div
                  className={todosAlwaysVisible ? "" : "flex flex-wrap items-center gap-2 pb-2 border-b border-border"}
                  role="region"
                  aria-labelledby={`patient-tasks-heading-${patient.id}`}
                >
                  {!todosAlwaysVisible && (
                    <span id={`patient-tasks-heading-${patient.id}`} className="text-sm font-medium text-muted-foreground">
                      Patient tasks
                    </span>
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
              )}

              {/* Clinical Summary */}
              {sectionVisibility.clinicalSummary && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                        <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinical Summary</h3>
                      {patient.clinicalSummary && (
                        <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
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
                        aria-label="Add timestamp to clinical summary"
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
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
                    <div className="bg-background/50 rounded-lg p-3 border border-border/40 transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
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
                      <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                        <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interval Events</h3>
                      {patient.intervalEvents && (
                        <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
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
                          aria-label="Cancel generation"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                          <span className="ml-1 text-xs">Cancel</span>
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateIntervalEvents}
                            className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                            aria-label="Generate interval events from systems using AI"
                          >
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            <span className="ml-1 text-xs">Generate</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateDailySummary}
                            className="h-7 px-2 text-warning hover:text-warning hover:bg-warning/10"
                            aria-label="Summarize today's changes and todos using AI"
                          >
                            <ClipboardList className="h-3 w-3" aria-hidden="true" />
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
                        aria-label="Add timestamp to interval events"
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
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
                    <div className="bg-background/50 rounded-lg p-3 border border-border/40 transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
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
                          <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                            <ImageIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          </div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imaging</h3>
                          {patient.imaging && (
                            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              {patient.imaging.replace(/<[^>]*>/g, '').length}
                            </span>
                          )}
                          {imagingImageCount > 0 && (
                            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
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
                            onClick={() => addTimestamp('imaging')}
                            className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground"
                            aria-label="Add timestamp to imaging"
                          >
                            <Clock className="h-3 w-3" aria-hidden="true" />
                          </Button>
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
                        <div className="bg-background/50 rounded-lg border border-border/40 transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
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
                          <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                            <TestTube className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          </div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labs</h3>
                          {patient.labs && (
                            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
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
                        <div className="bg-background/50 rounded-lg p-3 border border-border/40 transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
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
                <div className="bg-background/50 rounded-lg p-4 border border-border/40 transition-all duration-200 hover:border-border/60">
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
          </motion.div>
        )}
      </AnimatePresence>

      <SystemsConfigManager
        open={showSystemsConfig}
        onOpenChange={setShowSystemsConfig}
      />
    </motion.article>
  );
};

// Memoize to prevent unnecessary re-renders when other patients change
// React Query provides stable patient references when data hasn't changed,
// so reference comparison is sufficient for the patient object
export const PatientCard = React.memo(PatientCardComponent, (prevProps, nextProps) => {
  if (prevProps.hidePatientWideTodos !== nextProps.hidePatientWideTodos) return false;
  const sharedEqual =
    prevProps.sharedPatientTodos === nextProps.sharedPatientTodos ||
    (!!prevProps.sharedPatientTodos &&
      !!nextProps.sharedPatientTodos &&
      prevProps.sharedPatientTodos.todos === nextProps.sharedPatientTodos.todos &&
      prevProps.sharedPatientTodos.generating === nextProps.sharedPatientTodos.generating);
  if (!sharedEqual) return false;

  // Fast path: if patient reference is identical, only check callbacks
  if (prevProps.patient === nextProps.patient) {
    return (
      prevProps.autotexts === nextProps.autotexts &&
      prevProps.onUpdate === nextProps.onUpdate &&
      prevProps.onRemove === nextProps.onRemove &&
      prevProps.onDuplicate === nextProps.onDuplicate &&
      prevProps.onToggleCollapse === nextProps.onToggleCollapse
    );
  }

  // Different patient objects - check if it's actually a different patient
  // or just an update to the same patient
  if (prevProps.patient.id !== nextProps.patient.id) {
    return false; // Different patient, must re-render
  }

  // Same patient ID but different object - check if meaningful fields changed
  // Use lastModified as a quick change indicator
  return (
    prevProps.patient.lastModified === nextProps.patient.lastModified &&
    prevProps.patient.collapsed === nextProps.patient.collapsed &&
    prevProps.autotexts === nextProps.autotexts &&
    prevProps.onUpdate === nextProps.onUpdate &&
    prevProps.onRemove === nextProps.onRemove &&
    prevProps.onDuplicate === nextProps.onDuplicate &&
    prevProps.onToggleCollapse === nextProps.onToggleCollapse
  );
});
