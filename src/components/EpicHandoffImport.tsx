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

interface ParsedPatient {
  bed: string;
  name: string;
  mrn: string;
  age: string;
  sex: string;
  handoffSummary: string;
  intervalEvents: string;
  bedStatus: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
}

interface EpicHandoffImportProps {
  existingBeds: string[];
  onImportPatients: (patients: Array<{
    name: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    imaging: string;
    labs: string;
    systems: PatientSystems;
  }>) => Promise<void>;
}

// Load PDF.js from CDN and extract text
const loadPdfJs = async () => {
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return (window as any).pdfjsLib;
};

const extractPdfText = async (file: File): Promise<string> => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = "";
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    
    fullText += pageText + "\n\n--- Page Break ---\n\n";
  }
  
  return fullText;
};

// Convert PDF pages to base64 images for OCR
const extractPdfAsImages = async (file: File): Promise<string[]> => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const images: string[] = [];
  const scale = 2.0; // Higher resolution for better OCR
  
  for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) { // Limit to 10 pages
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert to base64 JPEG (smaller than PNG)
    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    images.push(imageData);
  }
  
  return images;
};

export const EpicHandoffImport = ({ existingBeds, onImportPatients }: EpicHandoffImportProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedPatients, setParsedPatients] = useState<ParsedPatient[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"upload" | "select">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
        // Use PDF.js to properly extract text from the PDF
        toast({
          title: "Extracting PDF text",
          description: "Reading PDF content...",
        });
        content = await extractPdfText(file);
        console.log("Extracted PDF text length:", content.length);
        
        // Check if meaningful content was extracted (not just page breaks)
        const meaningfulContent = content.replace(/--- Page Break ---/g, '').trim();
        if (meaningfulContent.length < 50) {
          // Fall back to OCR - convert pages to images
          toast({
            title: "Using OCR",
            description: "PDF appears scanned. Converting to images for AI vision processing...",
          });
          
          const images = await extractPdfAsImages(file);
          if (images.length === 0) {
            toast({
              title: "Failed to process PDF",
              description: "Could not extract content from this PDF.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          
          // Send images for OCR processing
          const { data, error } = await supabase.functions.invoke('parse-handoff', {
            body: { images },
          });

          if (error) throw new Error(error.message);
          if (!data.success) throw new Error(data.error || "Failed to parse handoff");

          const patients = data.data?.patients || [];
          if (patients.length === 0) {
            toast({
              title: "No patients found",
              description: "The AI couldn't extract any patients from this document.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }

          setParsedPatients(patients);
          setSelectedPatients(new Set(patients.map((_: ParsedPatient, i: number) => i)));
          setStep("select");
          toast({
            title: "Handoff parsed (OCR)",
            description: `Found ${patients.length} patient(s). Select which to import.`,
          });
          setIsLoading(false);
          return;
        }
      } else {
        // For text files, read directly
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (content.length < 50) {
        toast({
          title: "No content extracted",
          description: "Could not extract text from the file. Try copying and pasting the handoff text directly.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
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
    const defaultSystems: PatientSystems = {
      neuro: '',
      cv: '',
      resp: '',
      renalGU: '',
      gi: '',
      endo: '',
      heme: '',
      infectious: '',
      skinLines: '',
      dispo: '',
    };

    const patientsToImport = parsedPatients
      .filter((_, i) => selectedPatients.has(i))
      .map(p => ({
        name: `${p.name}${p.mrn ? ` (${p.mrn})` : ''}${p.age ? ` ${p.age}` : ''}${p.sex ? p.sex : ''}`,
        bed: p.bed,
        clinicalSummary: p.handoffSummary,
        intervalEvents: p.intervalEvents || '',
        imaging: p.imaging || '',
        labs: p.labs || '',
        systems: p.systems || defaultSystems,
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
                          {patient.intervalEvents && (
                            <p className="text-xs mt-1 text-muted-foreground line-clamp-1">
                              <span className="font-medium">Rounds:</span> {patient.intervalEvents}
                            </p>
                          )}
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
