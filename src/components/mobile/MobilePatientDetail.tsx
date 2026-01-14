import { useState } from "react";
import { Patient, PatientSystems } from "@/types/patient";
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
  Clock,
  Copy,
  Trash2,
  Printer
} from "lucide-react";
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
import { SYSTEM_LABELS, SYSTEM_ICONS } from "@/constants/systems";
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
}: MobilePatientDetailProps) => {
  const [openSections, setOpenSections] = useState<string[]>(["summary", "events"]);
  const { todos, generating, addTodo, toggleTodo, deleteTodo, generateTodos } = usePatientTodos(patient.id);

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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border safe-area-top">
        <div className="flex items-center justify-between h-14 px-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onPrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print / Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Patient
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
              className="text-lg font-semibold bg-transparent border-0 border-b-2 border-transparent focus:border-primary rounded-none px-0 h-auto py-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Room:</span>
            <Input
              placeholder="Bed/Room"
              value={patient.bed}
              onChange={(e) => onUpdate(patient.id, "bed", e.target.value)}
              className="w-24 h-8 text-sm bg-secondary/50 border-0"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last updated {new Date(patient.lastModified).toLocaleTimeString()}</span>
          </div>
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
        <AccordionItem value="summary" className="border-b">
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
          </AccordionContent>
        </AccordionItem>

        {/* Interval Events */}
        <AccordionItem value="events" className="border-b">
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
                onClick={() => addTimestamp("intervalEvents")}
                className="h-7 text-xs"
              >
                <Clock className="h-3 w-3 mr-1" />
                Add Time
              </Button>
            </div>
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
          </AccordionContent>
        </AccordionItem>

        {/* Imaging */}
        <AccordionItem value="imaging" className="border-b">
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
          </AccordionContent>
        </AccordionItem>

        {/* Labs */}
        <AccordionItem value="labs" className="border-b">
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
          </AccordionContent>
        </AccordionItem>

        {/* Systems Review */}
        <AccordionItem value="systems" className="border-b">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-2">
              <span className="text-primary text-sm">⚕️</span>
              <span className="font-medium">Systems Review</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3">
              {Object.entries(SYSTEM_LABELS).map(([key, label]) => (
                <div key={key} className="rounded-lg p-3 border border-border/50 bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <span>{SYSTEM_ICONS[key]}</span>
                      {label}
                    </label>
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
                  </div>
                  <RichTextEditor
                    value={patient.systems[key as keyof PatientSystems]}
                    onChange={(value) => onUpdate(patient.id, `systems.${key}`, value)}
                    placeholder={`${label}...`}
                    minHeight="60px"
                    autotexts={autotexts}
                    fontSize={globalFontSize}
                    changeTracking={changeTracking}
                  />
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
