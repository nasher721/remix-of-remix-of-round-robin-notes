import { memo, useCallback, useMemo, useRef, useEffect, useState, CSSProperties, ReactElement } from "react";
import { List, ListImperativeAPI } from "react-window";
import { PatientCard } from "@/components/PatientCard";
import type { Patient } from "@/types/patient";
import type { AutoText } from "@/types/autotext";

interface VirtualizedPatientListProps {
  patients: Patient[];
  autotexts: AutoText[];
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  onRemovePatient: (id: string) => void;
  onDuplicatePatient: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

interface RowProps {
  patients: Patient[];
  autotexts: AutoText[];
  onUpdate: (id: string, field: string, value: unknown) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

// Estimated row heights - collapsed vs expanded
const COLLAPSED_HEIGHT = 80;
const EXPANDED_HEIGHT = 600;
const GAP = 16;

// Row component for the virtualized list - must match react-window v2 API
const PatientRowComponent = ({ 
  index, 
  style,
  ariaAttributes,
  patients,
  autotexts,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleCollapse,
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
    <div style={{ ...style, paddingBottom: GAP }} {...ariaAttributes}>
      <PatientCard
        patient={patient}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        onToggleCollapse={onToggleCollapse}
        autotexts={autotexts}
      />
    </div>
  );
};

export const VirtualizedPatientList = memo(({
  patients,
  autotexts,
  onUpdatePatient,
  onRemovePatient,
  onDuplicatePatient,
  onToggleCollapse,
}: VirtualizedPatientListProps) => {
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Get row height based on collapsed state
  const getRowHeight = useCallback((index: number) => {
    const patient = patients[index];
    return (patient?.collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT) + GAP;
  }, [patients]);

  // Calculate container height based on viewport
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 48; // 48px for bottom padding
        setContainerHeight(Math.max(400, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Stable callback for remove with confirmation
  const handleRemove = useCallback((id: string) => {
    if (confirm('Remove this patient from rounds?')) {
      onRemovePatient(id);
    }
  }, [onRemovePatient]);

  // Memoize row props to prevent re-renders
  const rowProps = useMemo<RowProps>(() => ({
    patients,
    autotexts,
    onUpdate: onUpdatePatient,
    onRemove: handleRemove,
    onDuplicate: onDuplicatePatient,
    onToggleCollapse,
  }), [patients, autotexts, onUpdatePatient, handleRemove, onDuplicatePatient, onToggleCollapse]);

  return (
    <div ref={containerRef} className="w-full" style={{ height: containerHeight }}>
      <List
        listRef={listRef}
        rowCount={patients.length}
        rowHeight={getRowHeight}
        rowComponent={PatientRowComponent}
        rowProps={rowProps}
        overscanCount={2}
        className="scrollbar-thin"
        style={{ height: containerHeight, width: '100%' }}
      />
    </div>
  );
});

VirtualizedPatientList.displayName = "VirtualizedPatientList";
