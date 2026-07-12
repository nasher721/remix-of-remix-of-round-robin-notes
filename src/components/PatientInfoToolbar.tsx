import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  User, Hash, Calendar, DoorOpen, AlertCircle, Stethoscope,
  ClipboardList, CalendarDays, AlertTriangle, Pill, Activity,
  TestTube, Settings, ChevronDown, GripVertical, RotateCcw
} from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { PATIENT_INFO_TOOLBAR_ITEMS, DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS } from "@/constants/config";
import { PatientInfoToolbarCustomizeDialog } from "./PatientInfoToolbarCustomizeDialog";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types/patient";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  User, Hash, Calendar, DoorOpen, AlertCircle, Stethoscope,
  ClipboardList, CalendarDays, AlertTriangle, Pill, Activity, TestTube,
  GripVertical, RotateCcw
};

const ICON_CLASS = "h-3.5 w-3.5";

interface PatientInfoToolbarProps {
  onInsert: (text: string) => void;
  patient?: Patient | null;
  className?: string;
}

const formatMedications = (patient: Patient): string => {
  const { infusions, scheduled, prn, rawText } = patient.medications;
  if (rawText?.trim()) return rawText;

  const medications = [...infusions, ...scheduled, ...prn].filter(Boolean);
  return medications.length > 0 ? medications.join(", ") : "[Medications]";
};

const formatVitals = (patient: Patient): string => {
  if (!patient.vitals) return "[Vitals]";

  const values = [
    patient.vitals.temp && `Temp ${patient.vitals.temp}`,
    patient.vitals.hr && `HR ${patient.vitals.hr}`,
    patient.vitals.bp && `BP ${patient.vitals.bp}`,
    patient.vitals.rr && `RR ${patient.vitals.rr}`,
    patient.vitals.spo2 && `SpO₂ ${patient.vitals.spo2}`,
  ].filter((value): value is string => Boolean(value));

  return values.length > 0 ? values.join(", ") : "[Vitals]";
};

export const PatientInfoToolbar = ({
  onInsert,
  patient,
  className
}: PatientInfoToolbarProps) => {
  const {
    patientInfoToolbarMode,
    patientInfoToolbarButtons,
    setPatientInfoToolbarButtons
  } = useSettings();

  const [customizeOpen, setCustomizeOpen] = React.useState(false);

  const visibleItems = React.useMemo(() => {
    if (patientInfoToolbarMode === 'full') {
      return PATIENT_INFO_TOOLBAR_ITEMS;
    }
    return PATIENT_INFO_TOOLBAR_ITEMS.filter(item =>
      patientInfoToolbarButtons.includes(item.id)
    );
  }, [patientInfoToolbarMode, patientInfoToolbarButtons]);

  const dropdownItems = React.useMemo(() => {
    return PATIENT_INFO_TOOLBAR_ITEMS.filter(
      item => !visibleItems.some(v => v.id === item.id)
    );
  }, [visibleItems]);

  const handleInsert = React.useCallback((itemId: string) => {
    if (!patient) {
      onInsert(`[${itemId}]`);
      return;
    }

    let value = "";
    switch (itemId) {
      case "patientName":
        value = patient.name || "[Name]";
        break;
      case "mrn":
        value = patient.mrn || "[MRN]";
        break;
      case "dob":
        value = "[DOB]";
        break;
      case "room":
        value = patient.bed || "[Room]";
        break;
      case "codeStatus":
        value = patient.codeStatus || "[Code Status]";
        break;
      case "attending":
        value = patient.attendingPhysician || "[Attending]";
        break;
      case "diagnosis":
        value = "[Diagnosis]";
        break;
      case "admissionDate":
        value = "[Admission]";
        break;
      case "allergies":
        value = "[No Allergies]";
        break;
      case "medications":
        value = formatMedications(patient);
        break;
      case "vitals":
        value = formatVitals(patient);
        break;
      case "labs":
        value = patient.labs || "[Labs]";
        break;
      default:
        value = `[${itemId}]`;
    }

    onInsert(value);
  }, [patient, onInsert]);

  const handleReset = React.useCallback(() => {
    setPatientInfoToolbarButtons([...DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS]);
  }, [setPatientInfoToolbarButtons]);

  return (
    <div className={cn("flex items-center gap-1 px-2 py-1 border-b bg-muted/30", className)}>
      <div className="flex items-center gap-1 overflow-x-auto flex-1">
        {visibleItems.map((item) => {
          const Icon = iconMap[item.icon] || User;
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleInsert(item.id)}
              className="h-7 px-2 gap-1 shrink-0"
              title={item.label}
            >
              <Icon className={ICON_CLASS} />
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}

        {dropdownItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 shrink-0"
              >
                <span className="text-xs">More</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                Additional Fields
              </DropdownMenuLabel>
              {dropdownItems.map((item) => {
                const Icon = iconMap[item.icon] || User;
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => handleInsert(item.id)}
                    className="gap-2"
                  >
                    <Icon className={ICON_CLASS} />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-7 w-7 p-0"
          title="Reset to default"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCustomizeOpen(true)}
          className="h-7 gap-1 px-2"
        >
          <Settings className="h-3 w-3" />
          <span className="text-xs">Customize</span>
        </Button>
      </div>

      <PatientInfoToolbarCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
      />
    </div>
  );
};
