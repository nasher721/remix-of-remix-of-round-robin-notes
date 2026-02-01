import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileUp, Loader2, FileText, Users, AlertCircle, Settings2, Info } from "lucide-react";
import { extractPdfText, extractPdfAsImages } from "@/lib/import-utils";
import { useImportSettings } from "@/hooks/useImportSettings";
import { stripHtml } from "@/lib/print/htmlFormatter";

interface PatientSystems {
  neuro: string;
  cv: string;
  resp: string;
  renalGU: string;
  gi: string;
  endo: string;
  heme: string;
  infectious: string;
  skinLines: string;
  dispo: string;
}

interface PatientMedications {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText?: string;
}

interface ParsedPatient {
  bed: string;
  name: string;
  mrn: string;
  age: string;
  sex: string;
  handoffSummary: string;
  intervalEvents: string;
  systems: PatientSystems;
  medications?: PatientMedications;
}

interface EpicHandoffImportProps {
  existingBeds: string[];
  onImportPatients: (patients: Array<{
    name: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    systems: PatientSystems;
    medications?: PatientMedications;
  }>) => Promise<void>;
}

export const EpicHandoffImport = ({ existingBeds, onImportPatients }: EpicHandoffImportProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [parsedPatients, setParsedPatients] = useState<ParsedPatient[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"upload" | "select">("upload");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { settings, updateSettings } = useImportSettings();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt') && !file.type.includes('text')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or text file from Epic.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage("Reading file...");
    setParsedPatients([]);
    setSelectedPatients(new Set());

    try {
      let content: string = "";
      let useOcr = false;

      if (file.name.endsWith('.pdf')) {
        if (settings.forceOcr) {
          useOcr = true;
          setStatusMessage("Preparing document for OCR...");
        } else {
          try {
            setStatusMessage("Extracting text from PDF...");
            content = await extractPdfText(file);
            console.log("Extracted PDF text length:", content.length);

            // Check if meaningful content was extracted
            const meaningfulContent = content.replace(/--- Page Break ---/g, '').trim();
            if (meaningfulContent.length < 50) {
              useOcr = true;
              toast({
                title: "Text extraction insufficient",
                description: "PDF appears scanned. Switching to OCR mode.",
              });
            }
          } catch (e) {
            console.error("PDF text extraction failed:", e);
            useOcr = true;
          }
        }

        if (useOcr) {
          if (!settings.ocrEnabled) {
            throw new Error("Text extraction failed and OCR is disabled. Enable OCR in settings to process this document.");
          }

          setStatusMessage(`Converting PDF to images (Quality: ${settings.imageScale}x)...`);
          const images = await extractPdfAsImages(file, settings.imageScale, settings.pageLimit);

          if (images.length === 0) {
            throw new Error("Could not extract any content from the PDF.");
          }

          setStatusMessage("Analyzing images with AI...");
          const { data, error } = await supabase.functions.invoke('parse-handoff', {
            body: { images },
          });

          if (error) throw new Error(error.message);
          if (!data.success) throw new Error(data.error || "Failed to parse handoff");

          finalizeImport(data.data?.patients || []);
          return;
        }
      } else {
        // Text file
        setStatusMessage("Reading text file...");
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (!useOcr && content.length < 50) {
        throw new Error("Could not extract text from the file. Try copying and pasting the handoff text directly or enabling 'Force OCR'.");
      }

      setStatusMessage("Parsing extracted text...");
      const { data, error } = await supabase.functions.invoke('parse-handoff', {
        body: { pdfContent: content },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Failed to parse handoff");

      finalizeImport(data.data?.patients || []);

    } catch (error) {
      console.error("Error parsing handoff:", error);
      toast({
        title: "Parsing failed",
        description: error instanceof Error ? error.message : "Failed to parse the handoff document.",
        variant: "destructive",
      });
      setIsLoading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const finalizeImport = (patients: ParsedPatient[]) => {
    if (patients.length === 0) {
      toast({
        title: "No patients found",
        description: "The AI couldn't extract any patients. detailed in this document.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setParsedPatients(patients);
    setSelectedPatients(new Set(patients.map((_: ParsedPatient, i: number) => i)));
    setStep("select");
    setIsLoading(false);
    toast({
      title: "Handoff parsed",
      description: `Found ${patients.length} patient(s). Select which to import.`,
    });
  };

  const handleTextPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.length < 50) {
        toast({
          title: "No content",
          description: "Please copy the handoff content to your clipboard first.",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);
      setStatusMessage("Processing pasted text...");
      setParsedPatients([]);
      setSelectedPatients(new Set());

      const { data, error } = await supabase.functions.invoke('parse-handoff', {
        body: { pdfContent: text },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Failed to parse handoff");

      finalizeImport(data.data?.patients || []);
    } catch (error) {
      console.error("Error parsing pasted content:", error);
      toast({
        title: "Parsing failed",
        description: error instanceof Error ? error.message : "Failed to parse the pasted content.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const togglePatient = (index: number) => {
    setSelectedPatients(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPatients.size === parsedPatients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(parsedPatients.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    const defaultSystems: PatientSystems = {
      neuro: '', cv: '', resp: '', renalGU: '', gi: '',
      endo: '', heme: '', infectious: '', skinLines: '', dispo: '',
    };

    const patientsToImport = parsedPatients
      .filter((_, i) => selectedPatients.has(i))
      .map(p => ({
        name: `${p.name}${p.mrn ? ` (${p.mrn})` : ''}${p.age ? ` ${p.age}` : ''}${p.sex ? p.sex : ''}`,
        bed: p.bed,
        clinicalSummary: p.handoffSummary,
        intervalEvents: p.intervalEvents || '',
        systems: p.systems || defaultSystems,
        medications: p.medications || { infusions: [], scheduled: [], prn: [] },
      }));

    if (patientsToImport.length === 0) {
      toast({
        title: "No patients selected",
        description: "Please select at least one patient to import.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage("Importing patients...");
    try {
      await onImportPatients(patientsToImport);
      toast({
        title: "Import successful",
        description: `Imported ${patientsToImport.length} patient(s).`,
      });
      handleClose();
    } catch (error) {
      console.error("Error importing patients:", error);
      toast({
        title: "Import failed",
        description: "Failed to import patients.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("upload");
    setParsedPatients([]);
    setSelectedPatients(new Set());
    setStatusMessage("");
  };

  const bedExists = (bed: string) => existingBeds.some(b => b.toLowerCase() === bed.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="bg-white/10 hover:bg-white/20">
          <FileUp className="h-4 w-4 mr-2" />
          Import Epic Handoff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex justify-between items-center pr-8">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import Epic Handoff
            </DialogTitle>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium leading-none">Import Settings</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ocr-enabled" className="flex flex-col gap-1">
                        <span>Enable OCR</span>
                        <span className="text-xs text-muted-foreground">For scanned PDFs/images</span>
                      </Label>
                      <Switch
                        id="ocr-enabled"
                        checked={settings.ocrEnabled}
                        onCheckedChange={(c) => updateSettings({ ocrEnabled: c })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="force-ocr" className="flex flex-col gap-1">
                        <span>Force OCR</span>
                        <span className="text-xs text-muted-foreground">Ignore extracted text</span>
                      </Label>
                      <Switch
                        id="force-ocr"
                        checked={settings.forceOcr}
                        onCheckedChange={(c) => updateSettings({ forceOcr: c })}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Image Quality (Upscale)</Label>
                        <span className="text-xs text-muted-foreground">{settings.imageScale}x</span>
                      </div>
                      <Slider
                        min={1.0}
                        max={3.0}
                        step={0.5}
                        value={[settings.imageScale]}
                        onValueChange={([v]) => updateSettings({ imageScale: v })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Higher quality improves accuracy but takes longer.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Page Limit</Label>
                        <span className="text-xs text-muted-foreground">{settings.pageLimit} parsed</span>
                      </div>
                      <Slider
                        min={1}
                        max={20}
                        step={1}
                        value={[settings.pageLimit]}
                        onValueChange={([v]) => updateSettings({ pageLimit: v })}
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground flex gap-3">
                <Info className="h-5 w-5 flex-shrink-0 text-blue-500" />
                <p>
                  Upload a PDF handoff from Epic or paste the handoff text.
                  The AI will automatically identify patients, beds, and clinical details.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors border-dashed border-2 flex flex-col justify-center items-center h-48"
                  onClick={() => fileInputRef.current?.click()}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,text/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <FileUp className="h-10 w-10 mb-4 text-primary/60" />
                  <p className="font-medium text-lg">Upload File</p>
                  <p className="text-sm text-muted-foreground mt-1">PDF or Text File</p>
                </Card>

                <Card className="p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors border-dashed border-2 flex flex-col justify-center items-center h-48"
                  onClick={handleTextPaste}>
                  <FileText className="h-10 w-10 mb-4 text-primary/60" />
                  <p className="font-medium text-lg">Paste Content</p>
                  <p className="text-sm text-muted-foreground mt-1">From Clipboard</p>
                </Card>
              </div>

              {isLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium animate-pulse">{statusMessage}</p>
                </div>
              )}
            </div>
          )}

          {step === "select" && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{parsedPatients.length} patients found</span>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedPatients.size === parsedPatients.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="space-y-2 pb-4">
                  {parsedPatients.map((patient, index) => {
                    const exists = bedExists(patient.bed);
                    return (
                      <Card
                        key={index}
                        className={`p-3 cursor-pointer transition-colors ${selectedPatients.has(index) ? 'border-primary bg-primary/5' : ''
                          } ${exists ? 'border-warning' : ''}`}
                        onClick={() => togglePatient(index)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedPatients.has(index)}
                            onChange={() => togglePatient(index)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono">
                                {patient.bed}
                              </Badge>
                              <span className="font-medium">{patient.name}</span>
                              {patient.age && (
                                <span className="text-sm text-muted-foreground">
                                  {patient.age} {patient.sex}
                                </span>
                              )}
                              {exists && (
                                <Badge variant="secondary" className="text-warning-foreground bg-warning/20">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Bed exists
                                </Badge>
                              )}
                            </div>
                            {patient.mrn && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                MRN: {patient.mrn}
                              </p>
                            )}
                            <p className="text-sm mt-1 line-clamp-2">
                              {stripHtml(patient.handoffSummary)}
                            </p>
                            {patient.intervalEvents && (
                              <p className="text-xs mt-1 text-muted-foreground line-clamp-1">
                                <span className="font-medium">Rounds:</span> {stripHtml(patient.intervalEvents)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {step === "select" && (
          <div className="flex justify-between items-center pt-4 border-t mt-auto flex-shrink-0">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground self-center">
                {selectedPatients.size} selected
              </span>
              <Button onClick={handleImport} disabled={selectedPatients.size === 0 || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import Selected</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
