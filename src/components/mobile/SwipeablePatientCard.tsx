import { useState, useRef, useCallback } from "react";
import { Patient } from "@/types/patient";
import { ChevronRight, User, MapPin, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeablePatientCardProps {
  patient: Patient;
  onSelect: (patient: Patient) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  index: number;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 160;

export const SwipeablePatientCard = ({
  patient,
  onSelect,
  onDelete,
  onDuplicate,
  index,
}: SwipeablePatientCardProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    isDraggingRef.current = true;
  }, [translateX, isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    
    const deltaX = e.touches[0].clientX - startXRef.current;
    let newTranslateX = currentXRef.current + deltaX;
    
    // Clamp values with resistance at edges
    if (newTranslateX > 0) {
      newTranslateX = newTranslateX * 0.3; // Resistance when swiping right
    } else if (newTranslateX < -MAX_SWIPE) {
      newTranslateX = -MAX_SWIPE - (Math.abs(newTranslateX + MAX_SWIPE) * 0.3);
    }
    
    setTranslateX(newTranslateX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsAnimating(true);

    // Determine final position
    if (translateX < -SWIPE_THRESHOLD) {
      // Snap to reveal actions
      setTranslateX(-MAX_SWIPE);
    } else {
      // Snap back to closed
      setTranslateX(0);
    }

    setTimeout(() => setIsAnimating(false), 300);
  }, [translateX]);

  const handleActionClick = (action: "delete" | "duplicate") => {
    setIsAnimating(true);
    setTranslateX(0);
    
    setTimeout(() => {
      setIsAnimating(false);
      if (action === "delete") {
        onDelete(patient.id);
      } else {
        onDuplicate(patient.id);
      }
    }, 300);
  };

  const handleCardClick = () => {
    if (translateX < -10) {
      // If swiped open, close it instead of selecting
      setIsAnimating(true);
      setTranslateX(0);
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      onSelect(patient);
    }
  };

  const actionOpacity = Math.min(1, Math.abs(translateX) / SWIPE_THRESHOLD);
  const lastUpdatedLabel = new Date(patient.lastModified).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden animate-fade-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Action buttons revealed on swipe */}
      <div 
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: MAX_SWIPE }}
      >
        <button
          onClick={() => handleActionClick("duplicate")}
          className="flex-1 flex items-center justify-center bg-primary text-primary-foreground transition-opacity"
          style={{ opacity: actionOpacity }}
          aria-label="Duplicate patient"
        >
          <Copy className="h-5 w-5" />
        </button>
        <button
          onClick={() => handleActionClick("delete")}
          className="flex-1 flex items-center justify-center bg-destructive text-destructive-foreground transition-opacity"
          style={{ opacity: actionOpacity }}
          aria-label="Delete patient"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Main card content */}
      <div
        className={cn(
          "relative bg-background flex items-center gap-3 p-4 border-b border-border",
          isAnimating && "transition-transform duration-300 ease-out"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        {/* Avatar */}
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-6 w-6 text-primary" />
        </div>

        {/* Patient Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-base truncate">
              {patient.name || "Unnamed Patient"}
            </span>
            <span className="text-[10px] text-muted-foreground">Updated {lastUpdatedLabel}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {patient.bed && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {patient.bed}
              </span>
            )}
            {patient.clinicalSummary && (
              <span className="truncate">
                {patient.clinicalSummary.replace(/<[^>]*>/g, "").slice(0, 40)}...
              </span>
            )}
          </div>
          {/* Content indicators */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {patient.clinicalSummary && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Has clinical summary" />
            )}
            {patient.intervalEvents && (
              <span className="h-1.5 w-1.5 rounded-full bg-success" title="Has interval events" />
            )}
            {Object.values(patient.systems).some(v => v) && (
              <span className="h-1.5 w-1.5 rounded-full bg-warning" title="Has systems notes" />
            )}
          </div>
        </div>

        {/* Chevron - fades out when swiped */}
        <ChevronRight 
          className="h-5 w-5 text-muted-foreground flex-shrink-0 transition-opacity"
          style={{ opacity: 1 - actionOpacity }}
        />
      </div>

      {/* Swipe hint indicator */}
      {translateX === 0 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 pointer-events-none">
          ← swipe
        </div>
      )}
    </div>
  );
};
