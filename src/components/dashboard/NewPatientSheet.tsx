import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultMedicationsValue, defaultSystemsValue } from "@/services/patientService";
import type { PatientSystems, PatientMedications } from "@/types/patient";
import { Loader2 } from "lucide-react";

export type NewPatientSubmitPayload = {
  name: string;
  mrn?: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
};

type NewPatientSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewPatientSubmitPayload) => Promise<void>;
};

export const NewPatientSheet = ({ open, onOpenChange, onSubmit }: NewPatientSheetProps) => {
  const [name, setName] = React.useState("");
  const [mrn, setMrn] = React.useState("");
  const [bed, setBed] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setMrn("");
      setBed("");
      setNameError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Patient name is required");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmed,
        mrn: mrn.trim(),
        bed: bed.trim(),
        clinicalSummary: "",
        intervalEvents: "",
        imaging: "",
        labs: "",
        systems: defaultSystemsValue,
        medications: defaultMedicationsValue,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>New patient</SheetTitle>
          <SheetDescription>
            Name is required. Add MRN and bed or location when you have them—both help with safe handoffs.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="new-patient-name">Patient name</Label>
            <Input
              id="new-patient-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="e.g. Jane Doe"
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "new-patient-name-error" : undefined}
              className="min-h-11"
            />
            {nameError ? (
              <p id="new-patient-name-error" className="text-sm text-destructive" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-patient-mrn">MRN (optional)</Label>
            <Input
              id="new-patient-mrn"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              placeholder="Medical record number"
              autoComplete="off"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-patient-bed">Bed / location (optional)</Label>
            <Input
              id="new-patient-bed"
              value={bed}
              onChange={(e) => setBed(e.target.value)}
              placeholder="e.g. MICU 12"
              autoComplete="off"
              className="min-h-11"
            />
          </div>
          <SheetFooter className="flex-row justify-end gap-2 sm:justify-end mt-auto pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                  Adding…
                </>
              ) : (
                "Add patient"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
