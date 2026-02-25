import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FileText,
  FileSpreadsheet,
  Printer,
  Loader2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobilePrintSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  isGenerating: boolean;
  orientation: 'portrait' | 'landscape';
  onOrientationChange: (orientation: 'portrait' | 'landscape') => void;
  patientCount: number;
}

export function MobilePrintSheet({
  open,
  onOpenChange,
  onExportPDF,
  onExportExcel,
  onPrint,
  isGenerating,
  orientation,
  onOrientationChange,
  patientCount,
}: MobilePrintSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-4 max-h-[80vh] overflow-y-auto">
        {/* Drag Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
        </div>

        <SheetHeader className="text-left pb-4">
          <SheetTitle className="text-xl">Export Report</SheetTitle>
          <SheetDescription>
            {patientCount} patient{patientCount !== 1 ? 's' : ''} will be included
          </SheetDescription>
        </SheetHeader>

        {/* Quick Export Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button
            size="lg"
            className="h-20 flex-col gap-1 bg-rose-500 hover:bg-rose-600 text-white"
            onClick={onExportPDF}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <FileText className="h-6 w-6" />
            )}
            <span className="text-sm font-medium">PDF</span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-20 flex-col gap-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
            onClick={onExportExcel}
            disabled={isGenerating}
          >
            <FileSpreadsheet className="h-6 w-6" />
            <span className="text-sm font-medium">Excel</span>
          </Button>
        </div>

        {/* Quick Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Quick Settings</h3>

          <div className="space-y-3">
            <Label className="text-base">Orientation</Label>
            <RadioGroup
              value={orientation}
              onValueChange={(value) => onOrientationChange(value as 'portrait' | 'landscape')}
              className="grid grid-cols-2 gap-3"
            >
              <div>
                <RadioGroupItem
                  value="portrait"
                  id="portrait"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="portrait"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer",
                    "[&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-ring [&:has(:focus-visible)]:ring-offset-2"
                  )}
                >
                  <div className="w-4 h-6 border-2 border-current rounded-sm mb-2" />
                  Portrait
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="landscape"
                  id="landscape"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="landscape"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer",
                    "[&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-ring [&:has(:focus-visible)]:ring-offset-2"
                  )}
                >
                  <div className="w-6 h-4 border-2 border-current rounded-sm mb-2" />
                  Landscape
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Print Button */}
        <div className="mt-6 pt-4 border-t">
          <Button
            size="lg"
            className="w-full h-12"
            onClick={onPrint}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-5 w-5" />
                Print Document
              </>
            )}
          </Button>
        </div>

        {/* More Formats Link */}
        <div className="mt-3 text-center">
          <p className="text-xs text-muted-foreground">
            Need more formats? Use the desktop version for Word, RTF, TXT, and Markdown exports.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
