import { Patient } from "@/types/patient";
import { ChevronRight, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobilePatientListProps {
  patients: Patient[];
  onPatientSelect: (patient: Patient) => void;
  searchQuery?: string;
}

export const MobilePatientList = ({ patients, onPatientSelect, searchQuery }: MobilePatientListProps) => {
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
    <div className="divide-y divide-border">
      {patients.map((patient, index) => (
        <button
          key={patient.id}
          onClick={() => onPatientSelect(patient)}
          className={cn(
            "w-full flex items-center gap-3 p-4 text-left transition-colors active:bg-secondary/80",
            "animate-fade-in"
          )}
          style={{ animationDelay: `${index * 30}ms` }}
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
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
              {patient.intervalEvents && (
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              )}
              {Object.values(patient.systems).some(v => v) && (
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              )}
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </button>
      ))}
    </div>
  );
};
