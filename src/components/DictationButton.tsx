import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useDictation } from "@/hooks/useDictation";

interface DictationButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "ghost" | "outline" | "default";
  enhanceMedical?: boolean;
}

export const DictationButton = ({
  onTranscript,
  disabled = false,
  className,
  size = "sm",
  variant = "ghost",
  enhanceMedical = true,
}: DictationButtonProps) => {
  const { isRecording, isProcessing, toggleRecording } = useDictation({
    onTranscript,
    enhanceMedical,
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleRecording();
  };

  const buttonSize = size === "sm" ? "h-7 w-7 p-0" : size === "lg" ? "h-10 w-10 p-0" : "h-8 w-8 p-0";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isRecording ? "destructive" : variant}
            size="icon"
            onClick={handleClick}
            disabled={disabled || isProcessing}
            className={cn(
              buttonSize,
              isRecording && "animate-pulse",
              className
            )}
          >
            {isProcessing ? (
              <Loader2 className={cn(iconSize, "animate-spin")} />
            ) : isRecording ? (
              <MicOff className={iconSize} />
            ) : (
              <Mic className={iconSize} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>
            {isProcessing 
              ? "Processing..." 
              : isRecording 
              ? "Stop dictation" 
              : "Start medical dictation"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
