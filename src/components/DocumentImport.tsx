import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { FileText, FileUp, Loader2, FileType } from "lucide-react";
import { toast } from "sonner";
import mammoth from "mammoth";
import { extractPdfText } from "@/lib/import-utils";

interface DocumentImportProps {
  onImport: (content: string) => void;
  disabled?: boolean;
}

export const DocumentImport = ({ onImport, disabled }: DocumentImportProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setOpen(false); // Close dialog on selection to show loading toast/state elsewhere if needed, or keep open.
    // Actually, let's keep it closed and show toast loading or relies on parent. 
    // But since the parent passed `onImport`, we probably want to trigger that.

    try {
      const fileName = file.name.toLowerCase();
      let importedContent = "";

      if (fileName.endsWith(".txt")) {
        const text = await file.text();
        importedContent = text.split("\n").map(line => line || "<br>").join("<br>");
        toast.success(`Imported ${file.name}`);
      } else if (fileName.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        importedContent = result.value;
        toast.success(`Imported ${file.name}`);
      } else if (fileName.endsWith(".pdf")) {
        try {
          const text = await extractPdfText(file);
          importedContent = text.replace(/\n/g, "<br>");
          toast.success(`Imported ${file.name}`);
        } catch (e) {
          console.error("PDF Import failed", e);
          toast.error("Failed to extract text from PDF");
          setIsLoading(false);
          return;
        }
      } else {
        toast.error("Unsupported file type. Please use .txt, .docx, or .pdf");
        setIsLoading(false);
        return;
      }

      onImport(importedContent);
    } catch (error) {
      console.error("Document import error:", error);
      toast.error("Failed to import document");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isLoading}
          title="Import Document"
          className="h-8 w-8 p-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Document
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".txt,.docx,.pdf"
          />

          <Card className="col-span-2 p-6 border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-sm">Click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .txt, .docx, .pdf
              </p>
            </div>
          </Card>

          <div className="col-span-2 grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/20 rounded-md text-xs text-muted-foreground">
              <FileType className="h-4 w-4" />
              <span>Text</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/20 rounded-md text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Word</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/20 rounded-md text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>PDF</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
