import { memo, useCallback, useMemo, useRef, useEffect, useState, CSSProperties, ReactElement } from "react";
import { List, ListImperativeAPI } from "react-window";
import { Patient } from "@/types/patient";
import { SwipeablePatientCard } from "./SwipeablePatientCard";

interface VirtualizedMobilePatientListProps {
  patients: Patient[];
  onPatientSelect: (patient: Patient) => void;
  onPatientDelete: (id: string) => void;
  onPatientDuplicate: (id: string) => void;
  searchQuery?: string;
}

interface RowProps {
  patients: Patient[];
  onSelect: (patient: Patient) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const ROW_HEIGHT = 88; // Fixed height for mobile cards

// Row component for the virtualized list
const PatientRowComponent = ({ 
  index, 
  style,
  ariaAttributes,
  patients,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number;
  style: CSSProperties;
} & RowProps): ReactElement | null => {
  const patient = patients[index];
  
  if (!patient) return null;

  return (
    <div style={style} {...ariaAttributes} className="border-b border-border">
      <SwipeablePatientCard
        patient={patient}
        onSelect={onSelect}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        index={index}
      />
    </div>
  );
};

export const VirtualizedMobilePatientList = memo(({
  patients,
  onPatientSelect,
  onPatientDelete,
  onPatientDuplicate,
  searchQuery,
}: VirtualizedMobilePatientListProps) => {
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  // Calculate container height based on viewport
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Account for mobile nav bar (64px) and some padding
        const availableHeight = window.innerHeight - rect.top - 80;
        setContainerHeight(Math.max(300, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Memoize row props to prevent re-renders
  const rowProps = useMemo<RowProps>(() => ({
    patients,
    onSelect: onPatientSelect,
    onDelete: onPatientDelete,
    onDuplicate: onPatientDuplicate,
  }), [patients, onPatientSelect, onPatientDelete, onPatientDuplicate]);

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <span className="text-3xl">🏥</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">
          {searchQuery ? "No patients found" : "Ready to Start Rounds"}
        </h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          {searchQuery
            ? "Try adjusting your search."
            : "Tap the + button below to add your first patient."}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <List
        listRef={listRef}
        rowCount={patients.length}
        rowHeight={ROW_HEIGHT}
        rowComponent={PatientRowComponent}
        rowProps={rowProps}
        overscanCount={3}
        className="scrollbar-thin"
        style={{ height: containerHeight, width: '100%' }}
      />
      
      {/* Swipe hint for first-time users */}
      {patients.length === 1 && (
        <div className="py-4 px-6 text-center text-xs text-muted-foreground animate-fade-in">
          💡 Swipe left on a patient for quick actions
        </div>
      )}
    </div>
  );
});

VirtualizedMobilePatientList.displayName = "VirtualizedMobilePatientList";
