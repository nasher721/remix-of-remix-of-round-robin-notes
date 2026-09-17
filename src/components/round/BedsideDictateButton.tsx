import * as React from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createClinicalDictationSession,
  type ClinicalDictationSession,
} from "@/lib/audio/clinicalDictation";
import { enqueueOfflineDictation } from "@/lib/audio/offlineAudioQueue";

export interface BedsideDictateButtonProps {
  systemLabel: string;
  onTranscript: (text: string) => void;
  patientId?: string;
  systemKey?: string;
  disabled?: boolean;
  className?: string;
}

export const BedsideDictateButton: React.FC<BedsideDictateButtonProps> = ({
  systemLabel,
  onTranscript,
  patientId,
  systemKey,
  disabled = false,
  className,
}) => {
  const [isListening, setIsListening] = React.useState(false);
  const [interimText, setInterimText] = React.useState("");
  const sessionRef = React.useRef<ClinicalDictationSession | null>(null);

  React.useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop();
      }
    };
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isListening) {
      sessionRef.current?.stop();
      return;
    }

    setInterimText("");
    const session = createClinicalDictationSession({
      onInterim: (text) => {
        setInterimText(text);
      },
      onFinal: (text) => {
        setInterimText("");
        onTranscript(text);

        if (patientId && systemKey) {
          void enqueueOfflineDictation({
            patientId,
            systemKey,
            transcript: text,
          }).then(() => {
            const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
            if (!isOnline) {
              toast.info("Offline: Dictation saved locally and queued for sync", {
                duration: 3000,
              });
            }
          });
        }
      },
      onStateChange: (listening) => {
        setIsListening(listening);
        if (!listening) {
          setInterimText("");
        }
      },
      onError: (err) => {
        toast.error(err);
      },
    });

    sessionRef.current = session;

    if (!session.isSupported) {
      toast.info(
        "Speech recognition is not supported in this browser. Use Chrome, Safari, or Edge.",
      );
      return;
    }

    session.start();
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {isListening && interimText ? (
        <span
          className="max-w-[180px] truncate text-xs italic text-primary animate-pulse"
          title={interimText}
        >
          &ldquo;{interimText}&rdquo;
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={isListening ? "destructive" : "outline"}
        className={cn(
          "h-7 gap-1.5 px-2 text-xs font-medium transition-all",
          isListening && "border-red-500/50 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400",
        )}
        onClick={handleToggle}
        disabled={disabled}
        aria-label={isListening ? `Stop dictating ${systemLabel}` : `Dictate notes for ${systemLabel}`}
        aria-pressed={isListening}
        title={isListening ? "Stop dictation" : `Dictate notes for ${systemLabel}`}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <MicOff className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
            <span className="hidden sm:inline">Listening…</span>
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="hidden sm:inline">Dictate</span>
          </>
        )}
      </Button>
    </div>
  );
};
