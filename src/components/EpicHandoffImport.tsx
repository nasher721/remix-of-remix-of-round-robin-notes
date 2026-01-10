import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileUp, Loader2, FileText, Users, AlertCircle } from "lucide-react";

interface ParsedPatient {
  bed: string;
  name: string;
  mrn: string;
  age: string;
  sex: string;
  handoffSummary: string;
  bedStatus: string;
}

interface EpicHandoffImportProps {
  existingBeds: string[];
  onImportPatients: (patients: Array<{
    name: string;
    bed: string;
    clinicalSummary: string;
  }>) => Promise<void>;
}

export const EpicHandoffImport = ({ existingBeds, onImportPatients }: EpicHandoffImportProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedPatients, setParsedPatients] = useState<ParsedPatient[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"upload" | "select">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // For PDF files, we'll use the file content as base64
      // and let the AI parse it from the text representation
      const reader = new FileReader();
      reader.onload = () => {
        // Try to extract text from the file
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Accept both PDF and text files
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt') && !file.type.includes('text')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or text file from Epic.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setParsedPatients([]);
    setSelectedPatients(new Set());

    try {
      let content: string;
      
      if (file.name.endsWith('.pdf')) {
        // For PDFs, we'll read as text (some PDFs have embedded text)
        // The AI model can often extract structure even from partial text
        const reader = new FileReader();
        content = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const text = reader.result as string;
            // Try to extract readable portions
            resolve(text);
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } else {
        content = await readFileAsText(file);
      }

      // For demo/testing: if the PDF text is garbled, show a helpful message
      if (content.includes('%PDF') && !content.includes('Bed')) {
        toast({
          title: "PDF Parsing",
          description: "Processing PDF... If this doesn't work well, try copying and pasting the handoff text directly.",
        });
      }

      const { data, error } = await supabase.functions.invoke('parse-handoff', {
        body: { pdfContent: content },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to parse handoff");
      }

      const patients = data.data?.patients || [];
      if (patients.length === 0) {
        toast({
          title: "No patients found",
          description: "The AI couldn't extract any patients from this document. Try copying the text manually.",
          variant: "destructive",
        });
        return;
      }

      setParsedPatients(patients);
      // Pre-select all patients
      setSelectedPatients(new Set(patients.map((_: ParsedPatient, i: number) => i)));
      setStep("select");

      toast({
        title: "Handoff parsed",
        description: `Found ${patients.length} patient(s). Select which to import.`,
      });
    } catch (error) {
      console.error("Error parsing handoff:", error);
      toast({
        title: "Parsing failed",
        description: error instanceof Error ? error.message : "Failed to parse the handoff document.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
      setParsedPatients([]);
      setSelectedPatients(new Set());

      const { data, error } = await supabase.functions.invoke('parse-handoff', {
        body: { pdfContent: text },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to parse handoff");
      }

      const patients = data.data?.patients || [];
      if (patients.length === 0) {
        toast({
          title: "No patients found",
          description: "The AI couldn't extract any patients from the pasted text.",
          variant: "destructive",
        });
        return;
      }

      setParsedPatients(patients);
      setSelectedPatients(new Set(patients.map((_: ParsedPatient, i: number) => i)));
      setStep("select");

      toast({
        title: "Handoff parsed",
        description: `Found ${patients.length} patient(s). Select which to import.`,
      });
    } catch (error) {
      console.error("Error parsing pasted content:", error);
      toast({
        title: "Parsing failed",
        description: error instanceof Error ? error.message : "Failed to parse the pasted content.",
        variant: "destructive",
      });
    } finally {
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
    const patientsToImport = parsedPatients
      .filter((_, i) => selectedPatients.has(i))
      .map(p => ({
        name: `${p.name}${p.mrn ? ` (${p.mrn})` : ''}${p.age ? ` ${p.age}` : ''}${p.sex ? p.sex : ''}`,
        bed: p.bed,
        clinicalSummary: p.handoffSummary,
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
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Epic Handoff
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a PDF handoff from Epic or paste the handoff text. AI will extract patient data and integrate it by bed number.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,text/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">Upload File</p>
                <p className="text-xs text-muted-foreground mt-1">PDF or text file</p>
              </Card>

              <Card className="p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handleTextPaste}>
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">Paste from Clipboard</p>
                <p className="text-xs text-muted-foreground mt-1">Copy text first</p>
              </Card>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3">Parsing handoff with AI...</span>
              </div>
            )}
          </div>
        )}

        {step === "select" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">{parsedPatients.length} patients found</span>
              </div>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedPatients.size === parsedPatients.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {parsedPatients.map((patient, index) => {
                  const exists = bedExists(patient.bed);
                  return (
                    <Card 
                      key={index} 
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedPatients.has(index) ? 'border-primary bg-primary/5' : ''
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
                            {patient.handoffSummary}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-2 border-t">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
