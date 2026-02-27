import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PrintSettings, PrintDataProps } from "@/lib/print/types";
import { PrintDocument } from "./PrintDocument";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

interface PrintPreviewProps extends PrintDataProps {
  settings: PrintSettings;
}

const ZOOM_LEVELS = [
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
  { value: 125, label: "125%" },
  { value: 150, label: "150%" },
  { value: 200, label: "200%" },
];

export function PrintPreview({ patients, patientTodos, patientNotes, settings }: PrintPreviewProps) {
  const [zoom, setZoom] = React.useState(100);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [mounted, setMounted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Defer CSS transition until after mount to avoid an initial-render flash
  React.useEffect(() => { setMounted(true); }, []);

  // Calculate approximate page count based on patients and settings
  const patientsPerPage = settings.onePatientPerPage ? 1 : Math.max(1, Math.ceil(patients.length / 3));
  const totalPages = Math.max(1, Math.ceil(patients.length / patientsPerPage));

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(200, prev + 25));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(50, prev - 25));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleResetZoom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-muted/30 border rounded-lg h-full flex flex-col overflow-hidden",
        isFullscreen && "fixed inset-0 z-50 rounded-none"
      )}
    >
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b gap-2 flex-wrap">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out (Ctrl+-)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Select
            value={zoom.toString()}
            onValueChange={(v) => setZoom(parseInt(v))}
          >
            <SelectTrigger className="w-[80px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZOOM_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value.toString()} className="text-xs">
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In (Ctrl++)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleResetZoom}
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset Zoom (Ctrl+0)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[60px] text-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Fullscreen Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Settings Summary */}
        <div className="text-xs text-muted-foreground hidden sm:block">
          {settings.printOrientation}, {settings.printFontSize}pt
        </div>
      </div>

      {/* Preview Content */}
      <ScrollArea className="flex-1 p-4">
        <div
          className={cn(
            "mx-auto origin-top",
            mounted && "transition-transform duration-200"
          )}
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", willChange: "transform" }}
        >
          <PrintDocument
            patients={patients}
            patientTodos={patientTodos}
            patientNotes={patientNotes}
            settings={settings}
            className="shadow-lg"
            documentId="preview"
          />
        </div>
      </ScrollArea>
    </div>
  );
}
