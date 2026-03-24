import { Button } from "@/components/ui/button";
import {
    FileText,
    FileSpreadsheet,
    Download,
    Printer,
    Type,
    Loader2
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PrintControlsProps {
    onExportPDF: () => void;
    onExportExcel: () => void;
    onExportWord: () => void;
    onExportTXT: () => void;
    onExportRTF: () => void;
    onExportMarkdown: () => void;
    onPrint: () => void;
    isGenerating: boolean;
}

export function PrintControls({
    onExportPDF,
    onExportExcel,
    onExportWord,
    onExportTXT,
    onExportRTF,
    onExportMarkdown,
    onPrint,
    isGenerating
}: PrintControlsProps) {
    return (
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Export options">
            {/* Screen reader live region for status announcements */}
            <div role="status" aria-live="polite" className="sr-only">
                {isGenerating ? 'Generating export document...' : ''}
            </div>

            <Button 
                type="button"
                onClick={onPrint} 
                disabled={isGenerating}
                aria-label={isGenerating ? 'Generating document' : 'Print document'}
                aria-busy={isGenerating}
            >
                {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                    <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isGenerating ? "Generating..." : "Print"}
            </Button>

            <Button 
                type="button"
                variant="outline" 
                onClick={onExportPDF} 
                disabled={isGenerating}
                aria-label="Export as PDF document"
            >
                <FileText className="mr-2 h-4 w-4 text-rose-400/80" aria-hidden="true" />
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
                PDF
            </Button>

            <Button 
                type="button"
                variant="outline" 
                onClick={onExportExcel} 
                disabled={isGenerating}
                aria-label="Export as Excel spreadsheet"
            >
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500/80" aria-hidden="true" />
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
                Excel
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        type="button"
                        variant="outline" 
                        disabled={isGenerating}
                        aria-label="More export formats"
                        aria-haspopup="menu"
                    >
                        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                        More Formats
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" role="menu">
                    <DropdownMenuItem 
                        onClick={onExportWord}
                        aria-label="Export as Word document"
                    >
                        <FileText className="mr-2 h-4 w-4 text-sky-500/80" aria-hidden="true" />
                        Word Document
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                        onClick={onExportRTF}
                        aria-label="Export as Rich Text Format"
                    >
                        <Type className="mr-2 h-4 w-4" aria-hidden="true" />
                        Rich Text (RTF)
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                        onClick={onExportTXT}
                        aria-label="Export as plain text"
                    >
                        <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                        Plain Text (TXT)
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                        onClick={onExportMarkdown}
                        aria-label="Export as Markdown"
                    >
                        <FileText className="mr-2 h-4 w-4 text-orange-400/80" aria-hidden="true" />
                        Markdown (.md)
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
