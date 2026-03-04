import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PatientCard } from "@/components/PatientCard";
import type { Patient } from "@/types/patient";
import type { AutoText } from "@/types/autotext";
import { useDashboard } from "@/contexts/DashboardContext";
import { GripVertical } from "lucide-react";

/**
 * Sortable wrapper for PatientCard
 */
interface SortablePatientCardProps {
  patient: Patient;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  autotexts: AutoText[];
}

const SortablePatientCard = React.memo(({
  patient,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleCollapse,
  autotexts,
}: SortablePatientCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: patient.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative" data-patient-id={patient.id}>
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      
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
});

SortablePatientCard.displayName = "SortablePatientCard";

/**
 * Sortable Patient List with drag-and-drop reordering
 */
export const SortablePatientList = React.memo(() => {
  const {
    filteredPatients: patients,
    autotexts,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    onToggleCollapse,
    onReorderPatients,
  } = useDashboard() as {
    filteredPatients: Patient[];
    autotexts: AutoText[];
    onUpdatePatient: (id: string, field: string, value: unknown) => void;
    onRemovePatient: (id: string) => void;
    onDuplicatePatient: (id: string) => void;
    onToggleCollapse: (id: string) => void;
    onReorderPatients?: (activeId: string, overId: string) => void;
  };

  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      if (onReorderPatients) {
        onReorderPatients(active.id as string, over.id as string);
      }
    }

    setActiveId(null);
  };

  // Stable callback for remove with confirmation
  const handleRemove = React.useCallback((id: string) => {
    if (confirm('Remove this patient from rounds?')) {
      onRemovePatient(id);
    }
  }, [onRemovePatient]);

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

  const activePatient = activeId ? patients.find(p => p.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={patients.map(p => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="w-full space-y-4 group">
          {patients.map((patient) => (
            <SortablePatientCard
              key={patient.id}
              patient={patient}
              onUpdate={onUpdatePatient}
              onRemove={handleRemove}
              onDuplicate={onDuplicatePatient}
              onToggleCollapse={onToggleCollapse}
              autotexts={autotexts}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activePatient ? (
          <div className="opacity-90 shadow-xl">
            <PatientCard
              patient={activePatient}
              onUpdate={onUpdatePatient}
              onRemove={handleRemove}
              onDuplicate={onDuplicatePatient}
              onToggleCollapse={onToggleCollapse}
              autotexts={autotexts}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});

SortablePatientList.displayName = "SortablePatientList";

// Keep the old export for backwards compatibility
export const VirtualizedPatientList = SortablePatientList;
