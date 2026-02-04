import { useState } from "react";
import { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import { MedicationList } from "@/components/MedicationList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  MoreHorizontal,
  FileText,
  Calendar,
  ImageIcon,
  TestTube,
  Pill,
  Clock,
  Copy,
  Trash2,
  Printer,
  Sparkles,
  Loader2,
  History,
  Eraser,
  Activity
} from "lucide-react";
import { useIntervalEventsGenerator } from "@/hooks/useIntervalEventsGenerator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ImagePasteEditor } from "@/components/ImagePasteEditor";
import { PatientTodos } from "@/components/PatientTodos";
import { FieldTimestamp } from "@/components/FieldTimestamp";
import { FieldHistoryViewer } from "@/components/FieldHistoryViewer";
import { AIClinicalAssistant } from "@/components/AIClinicalAssistant";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import { AutoText } from "@/types/autotext";
import { usePatientTodos } from "@/hooks/usePatientTodos";

interface MobilePatientDetailProps {
  patient: Patient;
  onBack: () => void;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPrint: () => void;
  autotexts?: AutoText[];
  globalFontSize?: number;
  changeTracking?: {
    enabled: boolean;
    wrapWithMarkup: (text: string) => string;
  } | null;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export const MobilePatientDetail = ({
  patient,
  onBack,
  onUpdate,
  onRemove,
  onDuplicate,
  onPrint,
  autotexts = [],
  globalFontSize = 16,
  changeTracking = null,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}: MobilePatientDetailProps) => {
  const [openSections, setOpenSections] = useState<string[]>(["summary", "events"]);
  const { todos, generating, addTodo, toggleTodo, deleteTodo, generateTodos } = usePatientTodos(patient.id);
  const { generateIntervalEvents, isGenerating: isGeneratingEvents } = useIntervalEventsGenerator();
  const { enabledSystems } = useSystemsConfig();

  const sectionChips = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "events", label: "Events", icon: Calendar },
    { id: "imaging", label: "Imaging", icon: ImageIcon },
    { id: "labs", label: "Labs", icon: TestTube },
    { id: "medications", label: "Meds", icon: Pill },
    { id: "systems", label: "Systems", icon: Activity },
  ];

  const handleJumpToSection = (sectionId: string) => {
    setOpenSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
    requestAnimationFrame(() => {
      const target = document.getElementById(`section-${sectionId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleGenerateIntervalEvents = async () => {
    const result = await generateIntervalEvents(
      patient.systems,
      patient.intervalEvents,
      patient.name
    );
    if (result) {
      const newValue = patient.intervalEvents
        ? `${patient.intervalEvents}<br/><br/>${result}`
        : result;
      onUpdate(patient.id, "intervalEvents", newValue);
    }
  };

  const addTimestamp = (field: string) => {
    const timestamp = new Date().toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const currentValue = field.includes(".")
      ? patient.systems[field.split(".")[1] as keyof PatientSystems]
      : patient[field as keyof Patient];
    const newValue = `[${timestamp}] ${currentValue || ""}`;
    onUpdate(patient.id, field, newValue);
  };

  const handleRemove = () => {
    if (confirm("Remove this patient from rounds?")) {
      onRemove(patient.id);
      onBack();
    }
  };

  const handleDuplicate = () => {
    onDuplicate(patient.id);
    onBack();
  };

  const clearAllSystems = () => {
    if (confirm('Clear ALL systems review data? This cannot be undone.')) {
      enabledSystems.forEach((system) => {
        onUpdate(patient.id, `systems.${system.key}`, '');
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 safe-area-top shadow-sm">
        <div className="flex items-center justify-between h-14 px-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </Button>

            {/* Quick Navigation */}
            <div className="flex items-center bg-secondary/50 rounded-full border border-border/50 ml-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="h-8 w-8 rounded-l-full hover:bg-secondary"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border/50"></div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                disabled={!hasNext}
                className="h-8 w-8 rounded-r-full hover:bg-secondary"
              >
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <FieldHistoryViewer
                patientId={patient.id}
                patientName={patient.name}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <History className="h-4 w-4 mr-2" />
                    View History
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuItem onClick={onPrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print / Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* AI Clinical Assistant - integrated inline */}
              <div className="px-2 py-1">
                <AIClinicalAssistant
                  patient={patient}
                  onUpdatePatient={onUpdate}
                  compact
                />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Patient
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearAllSystems} className="text-orange-600">
                <Eraser className="h-4 w-4 mr-2" />
                Clear Systems Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRemove} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Patient
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Patient Info */}
      <div className="px-4 py-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl">👤</span>
          </div>
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Patient Name"
              value={patient.name}
              onChange={(e) => onUpdate(patient.id, "name", e.target.value)}
              className="text-lg font-semibold bg-card border border-border focus:border-primary rounded-lg px-3 h-10 touch-manipulation"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="done"
              onTouchStart={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border/60 rounded-full px-3 py-1">
            <span className="text-[11px] text-muted-foreground">Room</span>
            <Input
              placeholder="Bed/Room"
              value={patient.bed}
              onChange={(e) => onUpdate(patient.id, "bed", e.target.value)}
              className="w-24 h-7 text-sm bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-card border border-border/60 rounded-full px-3 py-1">
            <Clock className="h-3 w-3" />
            <span>Updated {new Date(patient.lastModified).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border bg-background/95">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {sectionChips.map((chip) => {
            const Icon = chip.icon;
            return (
              <Button
                key={chip.id}
                variant={openSections.includes(chip.id) ? "default" : "outline"}
                size="sm"
                className="h-8 rounded-full px-3 text-xs shrink-0"
                onClick={() => handleJumpToSection(chip.id)}
              >
                <Icon className="h-3.5 w-3.5 mr-1" />
                {chip.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Patient-Wide Todos */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">Patient Tasks:</span>
        <PatientTodos
          todos={todos}
          section={null}
          patient={patient}
          generating={generating}
          onAddTodo={addTodo}
          onToggleTodo={toggleTodo}
          onDeleteTodo={deleteTodo}
          onGenerateTodos={generateTodos}
        />
      </div>

      {/* Content Sections */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="px-4"
      >
        {/* Clinical Summary */}
        <AccordionItem value="summary" className="border-b" id="section-summary">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">Clinical Summary</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end gap-1 mb-2">
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
                onClick={() => addTimestamp("clinicalSummary")}
                className="h-7 text-xs"
              >
                <Clock className="h-3 w-3 mr-1" />
                Add Time
              </Button>
            </div>
            <div className="space-y-1">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.clinicalSummary}
                  onChange={(value) => onUpdate(patient.id, "clinicalSummary", value)}
                  placeholder="Enter clinical summary..."
                  minHeight="100px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.clinicalSummary} className="pl-1" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Interval Events */}
        <AccordionItem value="events" className="border-b" id="section-events">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">Interval Events</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end gap-1 mb-2">
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
                onClick={handleGenerateIntervalEvents}
                disabled={isGeneratingEvents}
                className="h-7 text-xs gap-1"
                title="Generate interval events from systems data"
              >
                {isGeneratingEvents ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addTimestamp("intervalEvents")}
                className="h-7 text-xs"
              >
                <Clock className="h-3 w-3 mr-1" />
                Add Time
              </Button>
            </div>
            <div className="space-y-1">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.intervalEvents}
                  onChange={(value) => onUpdate(patient.id, "intervalEvents", value)}
                  placeholder="Enter interval events..."
                  minHeight="100px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.intervalEvents} className="pl-1" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Imaging */}
        <AccordionItem value="imaging" className="border-b" id="section-imaging">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Imaging</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end mb-2">
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
            </div>
            <div className="space-y-1">
              <div className="bg-blue-50/30 rounded-lg border border-blue-200/50">
                <ImagePasteEditor
                  value={patient.imaging}
                  onChange={(value) => onUpdate(patient.id, "imaging", value)}
                  placeholder="X-rays, CT, MRI, Echo... (paste images here)"
                  minHeight="80px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.imaging} className="pl-1" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Labs */}
        <AccordionItem value="labs" className="border-b" id="section-labs">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <TestTube className="h-4 w-4 text-primary" />
              <span className="font-medium">Labs</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end mb-2">
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
            </div>
            <div className="space-y-1">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.labs}
                  onChange={(value) => onUpdate(patient.id, "labs", value)}
                  placeholder="CBC, BMP, LFTs, coags..."
                  minHeight="80px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                  changeTracking={changeTracking}
                />
              </div>
              <FieldTimestamp timestamp={patient.fieldTimestamps?.labs} className="pl-1" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Medications */}
        <AccordionItem value="medications" className="border-b" id="section-medications">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-success" />
              <span className="font-medium">Medications</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <MedicationList
              medications={patient.medications || { infusions: [], scheduled: [], prn: [] }}
              onMedicationsChange={(medications: PatientMedications) =>
                onUpdate(patient.id, "medications", medications)
              }
            />
          </AccordionContent>
        </AccordionItem>

        {/* Systems Review */}
        <AccordionItem value="systems" className="border-b" id="section-systems">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <span className="text-primary text-sm">⚕️</span>
              <span className="font-medium">Systems Review</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex justify-end mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllSystems}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                <Eraser className="h-3 w-3 mr-1" />
                Clear All Systems
              </Button>
            </div>
            <div className="space-y-3">
              {enabledSystems.map((system) => (
                <div key={system.key} className="rounded-lg p-3 border border-border/50 bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <span>{system.icon}</span>
                      {system.label}
                    </label>
                    <PatientTodos
                      todos={todos}
                      section={system.key}
                      patient={patient}
                      generating={generating}
                      onAddTodo={addTodo}
                      onToggleTodo={toggleTodo}
                      onDeleteTodo={deleteTodo}
                      onGenerateTodos={generateTodos}
                    />
                  </div>
                  <div className="space-y-1">
                    <RichTextEditor
                      value={patient.systems[system.key as keyof PatientSystems] || ''}
                      onChange={(value) => onUpdate(patient.id, `systems.${system.key}`, value)}
                      placeholder={`${system.label}...`}
                      minHeight="60px"
                      autotexts={autotexts}
                      fontSize={globalFontSize}
                      changeTracking={changeTracking}
                    />
                    <FieldTimestamp
                      timestamp={patient.fieldTimestamps?.[`systems.${system.key}` as keyof typeof patient.fieldTimestamps]}
                      className="pl-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
