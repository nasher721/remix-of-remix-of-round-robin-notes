import { Patient } from "@/types/patient";
import { SwipeablePatientCard } from "./SwipeablePatientCard";
import { Button } from "@/components/ui/button";

interface MobilePatientListProps {
  patients: Patient[];
  onPatientSelect: (patient: Patient) => void;
  onPatientDelete: (id: string) => void;
  onPatientDuplicate: (id: string) => void;
  searchQuery?: string;
  onAddPatient?: () => void;
  onOpenImport?: () => void;
}

export const MobilePatientList = ({
  patients,
  onPatientSelect,
  onPatientDelete,
  onPatientDuplicate,
  searchQuery,
  onAddPatient,
  onOpenImport,
}: MobilePatientListProps) => {
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
        {!searchQuery && (
          <div className="flex flex-col gap-2 mt-6 w-full max-w-xs">
            <Button onClick={onAddPatient} className="w-full" disabled={!onAddPatient}>
              Add patient
            </Button>
            <Button variant="outline" onClick={onOpenImport} className="w-full" disabled={!onOpenImport}>
              Import from Epic
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {patients.map((patient, index) => (
        <SwipeablePatientCard
          key={patient.id}
          patient={patient}
          onSelect={onPatientSelect}
          onDelete={onPatientDelete}
          onDuplicate={onPatientDuplicate}
          index={index}
        />
      ))}
      
      {/* Swipe hint for first-time users */}
      {patients.length === 1 && (
        <div className="py-4 px-6 text-center text-xs text-muted-foreground animate-fade-in">
          💡 Swipe left on a patient for quick actions
        </div>
      )}
    </div>
  );
};
