import * as React from "react";
import { Button } from "@/components/ui/button";
import {
    FileText,
    FileSpreadsheet,
    Download,
    Printer,
    FileJson,
    Type
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
    onPrint: () => void;
    isGenerating: boolean;
}

export function PrintControls({
    onExportPDF,
    onExportExcel,
    onExportWord,
    onExportTXT,
    onExportRTF,
    onPrint,
    isGenerating
}: PrintControlsProps) {
    return (
        <div className="flex flex-wrap gap-2">
            <Button onClick={onPrint} disabled={isGenerating}>
                <Printer className="mr-2 h-4 w-4" />
                Print
            </Button>

            <Button variant="outline" onClick={onExportPDF} disabled={isGenerating}>
                <FileText className="mr-2 h-4 w-4 text-red-500" />
                PDF
            </Button>

            <Button variant="outline" onClick={onExportExcel} disabled={isGenerating}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                Excel
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isGenerating}>
                        <Download className="mr-2 h-4 w-4" />
                        More Formats
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onExportWord}>
                        <FileText className="mr-2 h-4 w-4 text-blue-600" />
                        Word Document
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onExportRTF}>
                        <Type className="mr-2 h-4 w-4" />
                        Rich Text (RTF)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onExportTXT}>
                        <FileText className="mr-2 h-4 w-4" />
                        Plain Text (TXT)
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
