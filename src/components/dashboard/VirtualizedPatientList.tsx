import * as React from "react";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
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

// Default row heights - collapsed vs expanded
const COLLAPSED_HEIGHT = 80;
const EXPANDED_HEIGHT = 650;

// Row component for the virtualized list
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
  style: React.CSSProperties;
} & RowProps): React.ReactElement | null => {
  const patient = patients[index];
  
  if (!patient) return null;

  return (
    <div 
      style={style} 
      {...ariaAttributes}
      data-row-index={index}
      className="virtualized-row"
    >
      <div className="pb-4">
        <PatientCard
          patient={patient}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onToggleCollapse={onToggleCollapse}
          autotexts={autotexts}
        />
      </div>
    </div>
  );
};

export const VirtualizedPatientList = React.memo(({
  patients,
  autotexts,
  onUpdatePatient,
  onRemovePatient,
  onDuplicatePatient,
  onToggleCollapse,
}: VirtualizedPatientListProps) => {
  const listRef = React.useRef<ListImperativeAPI>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(600);

  // Create a unique key based on patient IDs and collapsed states
  const listKey = React.useMemo(() => {
    return patients.map(p => `${p.id}-${p.collapsed}`).join(',');
  }, [patients]);

  // Dynamic row height hook from react-window
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: EXPANDED_HEIGHT,
    key: listKey,
  });

  // Calculate container height based on viewport
  React.useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 48;
        setContainerHeight(Math.max(400, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Set up ResizeObserver to track row height changes
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Find all virtualized rows and observe them
    const observeRows = () => {
      const rows = container.querySelectorAll('.virtualized-row');
      if (rows.length > 0) {
        return dynamicRowHeight.observeRowElements(rows);
      }
      return undefined;
    };

    // Initial observation
    let cleanup = observeRows();

    // Set up mutation observer to catch new rows
    const mutationObserver = new MutationObserver(() => {
      cleanup?.();
      cleanup = observeRows();
    });

    mutationObserver.observe(container, { 
      childList: true, 
      subtree: true,
      attributes: false,
    });

    return () => {
      cleanup?.();
      mutationObserver.disconnect();
    };
  }, [dynamicRowHeight]);

  // Update row heights when collapsed state changes
  React.useEffect(() => {
    patients.forEach((patient, index) => {
      const height = patient.collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT;
      dynamicRowHeight.setRowHeight(index, height);
    });
  }, [patients, dynamicRowHeight]);

  // Stable callback for remove with confirmation
  const handleRemove = React.useCallback((id: string) => {
    if (confirm('Remove this patient from rounds?')) {
      onRemovePatient(id);
    }
  }, [onRemovePatient]);

  // Memoize row props to prevent re-renders
  const rowProps = React.useMemo<RowProps>(() => ({
    patients,
    autotexts,
    onUpdate: onUpdatePatient,
    onRemove: handleRemove,
    onDuplicate: onDuplicatePatient,
    onToggleCollapse,
  }), [patients, autotexts, onUpdatePatient, handleRemove, onDuplicatePatient, onToggleCollapse]);

  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <span className="text-3xl">🏥</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Ready to Start Rounds</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Click "Add Patient" to add your first patient to the list.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full" style={{ height: containerHeight }}>
      <List
        listRef={listRef}
        rowCount={patients.length}
        rowHeight={dynamicRowHeight}
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
