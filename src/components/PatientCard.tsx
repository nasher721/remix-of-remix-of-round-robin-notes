import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cardHover, collapseVariants } from '@/lib/animations';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, Copy, Trash2, ChevronDown, ChevronUp, Clock, ImageIcon, TestTube, Sparkles, Loader2, History, Settings2, X, Eraser, ClipboardList, MoreHorizontal } from "lucide-react";
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
import { AppleAIAssistant } from "./AppleAIAssistant";
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
import { useStreamingAI } from "@/hooks/useStreamingAI";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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

  const {
    streamWithAI: runAI,
    isStreaming: isStreamingAI,
    accumulatedResponse: aiOutput,
    error: aiError,
    cancel: cancelAI,
    reset: resetAI,
  } = useStreamingAI({ silent: true });
  const [aiPanelVisible, setAIPanelVisible] = React.useState(false);
  const [aiMode, setAIMode] = React.useState<'insights' | 'delta' | 'checklist' | 'handoff' | 'labs' | 'imaging' | null>(null);

  const stripHtml = React.useCallback((value: string | undefined) => value?.replace(/<[^>]*>/g, '') ?? '', []);

  const startAIMode = React.useCallback(
    async (mode: typeof aiMode) => {
      if (!mode) return;
      setAIPanelVisible(true);
      setAIMode(mode);
      resetAI();

      const prompts: Record<string, { prompt: string; text?: string }> = {
        insights: {
          prompt:
            'You are an ICU bedside assistant. From patient context (systems, labs, meds, interval events), generate 2-3 concise risk/attention items with one-liner reasoning and a suggested next action. <80 words.',
        },
        delta: {
          prompt:
            'Summarize what changed since last note. Focus on new interval events, system updates, labs, meds, and todos. 3 bullets max.',
        },
        checklist: {
          prompt:
            'Generate a concise rounding checklist (3-6 items) based on current problems, systems, labs, and meds. Each item should be actionable with who/when (e.g., RN now, MD pre-round).',
        },
        handoff: {
          prompt:
            'Create SBAR handoff text from patient context. One sentence each for Situation, Background, Assessment, Recommendation. Keep terse.',
        },
        labs: {
          prompt:
            'Explain these labs in 2 bullets: key interpretation + suggested next step. Be concise.',
          text: stripHtml(patient.labs),
        },
        imaging: {
          prompt:
            'Explain imaging findings in 2 bullets with possible implication and next step.',
          text: stripHtml(patient.imaging),
        },
      };

      const selected = prompts[mode];
      await runAI('clinical_summary', {
        patient,
        text: selected?.text || undefined,
        customPrompt: selected.prompt,
      });
    },
    [patient, resetAI, runAI, stripHtml]
  );

  const insertAIOutput = React.useCallback(() => {
    if (!aiOutput?.trim()) return;
    const targetField = 'clinicalSummary';
    const currentValue = (patient[targetField as keyof Patient] as string) || '';
    const newValue = currentValue ? `${currentValue}\n\n---\n${aiOutput}` : aiOutput;
    onUpdate(patient.id, targetField, newValue);
    toast({ title: 'Inserted AI output', description: 'Added to clinical summary' });
  }, [aiOutput, onUpdate, patient, toast]);

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

  return (
    <motion.article
      className="print-avoid-break bg-card rounded-2xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative group ring-1 ring-black/5 dark:ring-white/5"
      aria-label={`Patient: ${patient.name || 'Unnamed'}`}
      variants={shouldReduceMotion ? undefined : cardHover}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
    >
      {/* Header */}
      <div className="flex justify-between items-center gap-4 px-5 py-3.5 bg-gradient-to-r from-secondary/20 to-secondary/10 border-b border-border/40 transition-colors group-hover:from-secondary/30 group-hover:to-secondary/15">
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 shadow-sm">
            <span className="text-base font-semibold text-primary">
              {patient.name ? patient.name.charAt(0).toUpperCase() : '#'}
            </span>
          </div>
          <div className="flex gap-2.5 flex-1 flex-wrap items-center">
            <Input
              placeholder="Patient Name"
              value={patient.name}
              onChange={(e) => onUpdate(patient.id, 'name', e.target.value)}
              aria-label="Patient name"
              className="max-w-[220px] font-medium bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-base text-foreground transition-all duration-200 shadow-none hover:shadow-sm focus:shadow-sm"
            />
            <Input
              placeholder="Bed/Room"
              value={patient.bed}
              onChange={(e) => onUpdate(patient.id, 'bed', e.target.value)}
              aria-label="Bed or room number"
              className="max-w-[110px] bg-transparent border-transparent hover:bg-secondary/40 hover:border-border/50 focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-3 h-9 text-sm text-muted-foreground font-medium transition-all duration-200 shadow-none hover:shadow-sm focus:shadow-sm"
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
          <AppleAIAssistant patient={patient} onUpdatePatient={onUpdate} compact />
          {/* AI Modes Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isStreamingAI}
                className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                aria-label="AI modes"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                AI
                <ChevronDown className="h-3 w-3 ml-0.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">AI Modes</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => startAIMode('insights')}
                disabled={isStreamingAI}
                className="cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                Insights
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => startAIMode('delta')}
                disabled={isStreamingAI}
                className="cursor-pointer"
              >
                <Clock className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                Delta
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => startAIMode('checklist')}
                disabled={isStreamingAI}
                className="cursor-pointer"
              >
                <ClipboardList className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                Checklist
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => startAIMode('handoff')}
                disabled={isStreamingAI}
                className="cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                SBAR
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="w-px h-4 bg-border/40 mx-1" />
          
          {/* Collapse Button - Primary Action */}
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
          
          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Actions</DropdownMenuLabel>
              <DropdownMenuItem className="cursor-pointer">
                <FieldHistoryViewer
                  patientId={patient.id}
                  patientName={patient.name}
                  trigger={
                    <div className="flex items-center w-full">
                      <History className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                      <span>View History</span>
                    </div>
                  }
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDuplicate(patient.id)}
                className="cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onRemove(patient.id)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(aiPanelVisible || isStreamingAI || aiOutput || aiError) && (
        <div className="mx-5 mt-3 mb-1 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 no-print">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className={`h-4 w-4 ${isStreamingAI ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isStreamingAI ? 'Generating…' : aiMode ? `AI ${aiMode}` : 'AI Output'}</span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancelAI}
                disabled={!isStreamingAI}
              >
                Stop
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetAI();
                  setAIPanelVisible(false);
                  setAIMode(null);
                }}
                disabled={isStreamingAI}
              >
                Reset
              </Button>
            </div>
          </div>

          {aiError && (
            <p className="text-sm text-destructive">{aiError}</p>
          )}

          <div className="rounded-lg border bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words min-h-[52px]">
            {aiOutput?.trim() || (isStreamingAI ? 'Streaming response…' : 'No output yet.')}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="text-xs text-muted-foreground">AI generated text.</div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!aiOutput?.trim()) return;
                  navigator.clipboard.writeText(aiOutput).catch(() => {
                    toast({
                      title: 'Copy failed',
                      description: 'Could not copy to clipboard',
                      variant: 'destructive',
                    });
                  });
                }}
                disabled={!aiOutput?.trim()}
              >
                Copy
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={insertAIOutput}
                disabled={!aiOutput?.trim()}
              >
                Insert into summary
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Proactive Risk Nudges */}
      {(() => {
        const labsText = stripHtml(patient.labs || '').toLowerCase();
        const nudges: { label: string; description: string }[] = [];

        if (labsText.includes('cr:') || labsText.includes('creatinine')) {
          const crMatch = labsText.match(/cr[:\s]+([\d.]+)/) || labsText.match(/creatinine[:\s]+([\d.]+)/);
          if (crMatch && parseFloat(crMatch[1]) > 1.5) {
            nudges.push({ label: 'AKI risk', description: 'Elevated Cr detected. Consider renal dosing and nephrology consult.' });
          }
        }

        if (labsText.includes('wbc') && labsText.includes('lactate')) {
          const wbcMatch = labsText.match(/wbc[:\s]+([\d.]+)/);
          const lactateMatch = labsText.match(/lactate[:\s]+([\d.]+)/);
          if (wbcMatch && lactateMatch && (parseFloat(wbcMatch[1]) > 12 || parseFloat(lactateMatch[1]) > 2)) {
            nudges.push({ label: 'Sepsis risk', description: 'Consider sepsis workup if clinically indicated.' });
          }
        }

        if (labsText.includes('bun') && labsText.includes('cr')) {
          const bunMatch = labsText.match(/bun[:\s]+([\d.]+)/);
          const crMatch2 = labsText.match(/cr[:\s]+([\d.]+)/);
          if (bunMatch && crMatch2) {
            const ratio = parseFloat(bunMatch[1]) / parseFloat(crMatch2[1]);
            if (ratio > 20) {
              nudges.push({ label: 'Pre-renal AKI', description: 'BUN/Cr ratio >20 suggests pre-renal etiology. Consider volume status.' });
            }
          }
        }

        if (nudges.length === 0) return null;

        return (
          <div className="mx-5 mt-2 mb-1 space-y-2 no-print">
            {nudges.map((nudge, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-2"
              >
                <div className="flex-1">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">{nudge.label}</div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-300">{nudge.description}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addTodo(`${nudge.label}: ${nudge.description}`)}
                  className="h-6 px-2 text-[10px] text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                >
                  Add todo
                </Button>
              </div>
            ))}
          </div>
        );
      })()}
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
                      <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                        <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-card-foreground/70">Clinical Summary</h3>
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
                    <div className="bg-background/50 rounded-xl p-3 border border-border/40 shadow-inner transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
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
                      <div className="h-5 w-5 rounded flex items-center justify-center bg-violet-500/10 border border-violet-500/15">
                        <Calendar className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" aria-hidden="true" />
                      </div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-card-foreground/70">Interval Events</h3>
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
                    <div className="bg-background/50 rounded-xl p-3 border border-border/40 shadow-inner transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
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
                          <div className="h-5 w-5 rounded flex items-center justify-center bg-sky-500/10 border border-sky-500/15">
                            <ImageIcon className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" aria-hidden="true" />
                          </div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-card-foreground/70">Imaging</h3>
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
                            onClick={() => startAIMode('imaging')}
                            disabled={isStreamingAI}
                            className="h-6 px-1.5 text-[10px] text-muted-foreground/50 hover:text-primary"
                            type="button"
                          >
                            Explain
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
                        <div className="bg-background/50 rounded-xl border border-border/40 shadow-inner transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
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
                          <div className="h-5 w-5 rounded flex items-center justify-center bg-amber-500/10 border border-amber-500/15">
                            <TestTube className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                          </div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-card-foreground/70">Labs</h3>
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
                            onClick={() => startAIMode('labs')}
                            disabled={isStreamingAI}
                            className="h-6 px-1.5 text-[10px] text-muted-foreground/50 hover:text-primary"
                            type="button"
                          >
                            Explain
                          </Button>
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
                        <div className="bg-background/50 rounded-xl p-3 border border-border/40 shadow-inner transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
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
                <div className="bg-background/50 rounded-xl p-4 border border-border/40 shadow-inner transition-all duration-200 hover:border-border/60">
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
