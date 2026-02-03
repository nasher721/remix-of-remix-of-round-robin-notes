import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PrintSettings, PrintDataProps } from "@/lib/print/types";
import { PrintDocument } from "./PrintDocument";

interface PrintPreviewProps extends PrintDataProps {
    settings: PrintSettings;
}

export function PrintPreview({ patients, patientTodos, patientNotes, settings }: PrintPreviewProps) {
    return (
        <div className="bg-muted/30 border rounded-lg h-full flex flex-col overflow-hidden">
            <div className="p-2 bg-muted/50 border-b text-xs text-center text-muted-foreground">
                Preview ({settings.printOrientation}, {settings.printFontSize}pt)
            </div>

            <ScrollArea className="flex-1 p-4">
                <PrintDocument
                    patients={patients}
                    patientTodos={patientTodos}
                    patientNotes={patientNotes}
                    settings={settings}
                    className={cn("mx-auto origin-top transition-all duration-300 shadow-sm")}
                    documentId="preview"
                />
            </ScrollArea>
        </div>
    );
}
