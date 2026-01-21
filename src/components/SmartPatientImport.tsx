import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Loader2, Clipboard, FileText, Check, Edit2, Pill } from "lucide-react";
import type { PatientSystems, PatientMedications } from "@/types/patient";

interface ParsedPatientData {
  name: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
}

interface SmartPatientImportProps {
  onImportPatient: (patient: {
    name: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    imaging: string;
    labs: string;
    systems: PatientSystems;
    medications?: PatientMedications;
  }) => Promise<void>;
  trigger?: React.ReactNode;
}

export const SmartPatientImport = ({ onImportPatient, trigger }: SmartPatientImportProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "review">("input");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedPatientData | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setContent(text);
        toast({ title: "Text pasted from clipboard" });
      }
    } catch {
      toast({
        title: "Could not access clipboard",
        description: "Please paste manually using Ctrl+V",
        variant: "destructive",
      });
    }
  };

  const handleParse = async () => {
    if (!content.trim()) {
      toast({
        title: "No content to parse",
        description: "Please enter or paste clinical notes",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-single-patient", {
        body: { content: content.trim() },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.patient) {
        setParsedData(data.patient);
        setStep("review");
        toast({ title: "Notes parsed successfully", description: "Review and edit the organized data" });
      } else {
        throw new Error("No patient data returned");
      }
    } catch (error) {
      console.error("Parse error:", error);
      toast({
        title: "Failed to parse notes",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setIsLoading(true);
    try {
      await onImportPatient(parsedData);
      toast({ title: "Patient imported successfully" });
      handleClose();
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Failed to import patient",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("input");
    setContent("");
    setParsedData(null);
    setEditingField(null);
  };

  const updateField = (field: string, value: string) => {
    if (!parsedData) return;

    if (field.startsWith("systems.")) {
      const systemKey = field.replace("systems.", "") as keyof PatientSystems;
      setParsedData({
        ...parsedData,
        systems: { ...parsedData.systems, [systemKey]: value },
      });
    } else {
      setParsedData({ ...parsedData, [field]: value });
    }
    setEditingField(null);
  };

  const renderEditableField = (label: string, field: string, value: string, multiline = false) => {
    const isEditing = editingField === field;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setEditingField(isEditing ? null : field)}
          >
            {isEditing ? <Check className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
          </Button>
        </div>
        {isEditing ? (
          multiline ? (
            <Textarea
              value={value}
              onChange={(e) => updateField(field, e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
          ) : (
            <Input
              value={value}
              onChange={(e) => updateField(field, e.target.value)}
              className="text-sm"
              autoFocus
            />
          )
        ) : (
          <div
            className="text-sm p-2 bg-muted/50 rounded-md min-h-[32px] whitespace-pre-wrap cursor-pointer hover:bg-muted"
            onClick={() => setEditingField(field)}
          >
            {value || <span className="text-muted-foreground italic">Empty</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Wand2 className="h-4 w-4" />
            Smart Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            {step === "input" ? "Smart Patient Import" : "Review & Edit"}
          </DialogTitle>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4 flex-1">
            <p className="text-sm text-muted-foreground">
              Paste clinical notes and AI will organize them into the correct patient fields.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePaste} className="gap-1">
                <Clipboard className="h-4 w-4" />
                Paste from Clipboard
              </Button>
            </div>

            <Textarea
              placeholder="Paste or type clinical notes here...&#10;&#10;Examples:&#10;- H&P notes&#10;- Progress notes&#10;- Signout/handoff text&#10;- Any clinical documentation"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[250px] font-mono text-sm"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleParse} disabled={isLoading || !content.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Parse Notes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : parsedData ? (
          <div className="flex-1 flex flex-col min-h-0">
            <p className="text-sm text-muted-foreground mb-3">
              Review the extracted data. Click any field to edit.
            </p>

            <ScrollArea className="flex-1 pr-4">
              <Tabs defaultValue="main" className="w-full">
                <TabsList className="mb-3">
                  <TabsTrigger value="main">Main Info</TabsTrigger>
                  <TabsTrigger value="medications">Medications</TabsTrigger>
                  <TabsTrigger value="systems">Systems Review</TabsTrigger>
                </TabsList>

                <TabsContent value="main" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    {renderEditableField("Patient Name", "name", parsedData.name)}
                    {renderEditableField("Bed/Room", "bed", parsedData.bed)}
                  </div>
                  {renderEditableField("Clinical Summary", "clinicalSummary", parsedData.clinicalSummary, true)}
                  {renderEditableField("Interval Events", "intervalEvents", parsedData.intervalEvents, true)}
                  {renderEditableField("Imaging", "imaging", parsedData.imaging, true)}
                  {renderEditableField("Labs", "labs", parsedData.labs, true)}
                </TabsContent>

                <TabsContent value="medications" className="space-y-4 mt-0">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Pill className="h-4 w-4 text-red-500" />
                        Infusions ({parsedData.medications?.infusions?.length || 0})
                      </Label>
                      <div className="text-sm p-2 bg-muted/50 rounded-md min-h-[40px]">
                        {parsedData.medications?.infusions?.length ? (
                          <ul className="space-y-1">
                            {parsedData.medications.infusions.map((med, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-red-500">•</span> {med}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground italic">No infusions</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Pill className="h-4 w-4 text-blue-500" />
                        Scheduled ({parsedData.medications?.scheduled?.length || 0})
                      </Label>
                      <div className="text-sm p-2 bg-muted/50 rounded-md min-h-[40px]">
                        {parsedData.medications?.scheduled?.length ? (
                          <ul className="space-y-1">
                            {parsedData.medications.scheduled.map((med, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-blue-500">•</span> {med}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground italic">No scheduled medications</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Pill className="h-4 w-4 text-amber-500" />
                        PRN ({parsedData.medications?.prn?.length || 0})
                      </Label>
                      <div className="text-sm p-2 bg-muted/50 rounded-md min-h-[40px]">
                        {parsedData.medications?.prn?.length ? (
                          <ul className="space-y-1">
                            {parsedData.medications.prn.map((med, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-amber-500">•</span> {med}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground italic">No PRN medications</span>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="systems" className="space-y-3 mt-0">
                  {renderEditableField("Neuro", "systems.neuro", parsedData.systems.neuro, true)}
                  {renderEditableField("Cardiovascular", "systems.cv", parsedData.systems.cv, true)}
                  {renderEditableField("Respiratory", "systems.resp", parsedData.systems.resp, true)}
                  {renderEditableField("Renal/GU", "systems.renalGU", parsedData.systems.renalGU, true)}
                  {renderEditableField("GI", "systems.gi", parsedData.systems.gi, true)}
                  {renderEditableField("Endocrine", "systems.endo", parsedData.systems.endo, true)}
                  {renderEditableField("Heme", "systems.heme", parsedData.systems.heme, true)}
                  {renderEditableField("Infectious", "systems.infectious", parsedData.systems.infectious, true)}
                  {renderEditableField("Skin/Lines", "systems.skinLines", parsedData.systems.skinLines, true)}
                  {renderEditableField("Disposition", "systems.dispo", parsedData.systems.dispo, true)}
                </TabsContent>
              </Tabs>
            </ScrollArea>

            <div className="flex justify-between pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setStep("input")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Import Patient
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
