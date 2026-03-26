import { Button } from "@/components/ui/button";
import {
    FileText,
    FileSpreadsheet,
    Printer,
    Type,
    Loader2,
    MoreHorizontal
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

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

function generateFilename(extension: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `patient-rounding-${year}-${month}-${day}.${extension}`;
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
    const filenamePreview = generateFilename('pdf');

    return (
        <div className="flex flex-col gap-2">
            <output className="sr-only">
                {isGenerating ? 'Generating export document...' : ''}
            </output>

            <div 
                className="flex items-center gap-2 flex-wrap" 
                role="toolbar" 
                aria-label="Export options"
                aria-busy={isGenerating}
            >
                <Button 
                    type="button"
                    onClick={onPrint} 
                    disabled={isGenerating}
                    aria-label={isGenerating ? 'Generating document' : 'Print document'}
                    className="gap-2"
                >
                    {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                    ) : (
                        <Printer className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">Print</span>
                    <span className="sm:hidden">Print</span>
                </Button>

                <Button 
                    type="button"
                    variant="outline" 
                    onClick={onExportPDF} 
                    disabled={isGenerating}
                    aria-label="Export as PDF document"
                    className="gap-2"
                >
                    <FileText className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    <span className="hidden sm:inline">PDF</span>
                </Button>

                <Button 
                    type="button"
                    variant="outline" 
                    onClick={onExportExcel} 
                    disabled={isGenerating}
                    aria-label="Export as Excel spreadsheet"
                    className="gap-2"
                >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    <span className="hidden sm:inline">Excel</span>
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            type="button"
                            variant="outline" 
                            disabled={isGenerating}
                            aria-label="More export formats"
                            aria-haspopup="menu"
                            className="gap-2"
                        >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">More</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" role="menu">
                        <DropdownMenuItem 
                            onClick={onExportWord}
                            aria-label="Export as Word document"
                        >
                            <FileText className="mr-2 h-4 w-4 text-sky-500" aria-hidden="true" />
                            Word (.docx)
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={onExportRTF}
                            aria-label="Export as Rich Text Format"
                        >
                            <Type className="mr-2 h-4 w-4 text-violet-500" aria-hidden="true" />
                            Rich Text (.rtf)
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={onExportTXT}
                            aria-label="Export as plain text"
                        >
                            <FileText className="mr-2 h-4 w-4 text-slate-500" aria-hidden="true" />
                            Plain Text (.txt)
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={onExportMarkdown}
                            aria-label="Export as Markdown"
                        >
                            <FileText className="mr-2 h-4 w-4 text-orange-500" aria-hidden="true" />
                            Markdown (.md)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {!isGenerating && (
                <div className="flex items-center gap-2">
                    <Separator orientation="horizontal" className="flex-1" />
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                        {filenamePreview}
                    </span>
                </div>
            )}

            {isGenerating && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-pulse w-full" />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Generating...
                    </span>
                </div>
            )}
        </div>
    );
}
