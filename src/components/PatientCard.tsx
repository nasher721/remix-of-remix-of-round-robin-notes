import { Patient } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FileText, Calendar, Copy, Trash2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor";
interface PatientCardProps {
  patient: Patient;
  onUpdate: (id: number, field: string, value: any) => void;
  onRemove: (id: number) => void;
  onDuplicate: (id: number) => void;
  onToggleCollapse: (id: number) => void;
}

const systemLabels = {
  neuro: "🧠 Neuro",
  cv: "❤️ CV",
  resp: "🫁 Resp",
  renalGU: "💧 Renal/GU",
  gi: "🍽️ GI",
  endo: "⚡ Endo",
  heme: "🩸 Heme",
  infectious: "🦠 Infectious",
  skinLines: "🩹 Skin/Lines",
  dispo: "🏠 Disposition"
};

export const PatientCard = ({ patient, onUpdate, onRemove, onDuplicate, onToggleCollapse }: PatientCardProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const addTimestamp = (field: string) => {
    const timestamp = new Date().toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
    const currentValue = field.includes('.') 
      ? patient.systems[field.split('.')[1] as keyof typeof patient.systems]
      : patient[field as keyof Patient];
    const newValue = `[${timestamp}] ${currentValue || ''}`;
    onUpdate(patient.id, field, newValue);
  };

  const clearSection = (field: string) => {
    if (confirm('Clear this section?')) {
      onUpdate(patient.id, field, '');
    }
  };

  return (
    <Card className="print-avoid-break border-l-4 border-l-primary bg-card hover:shadow-lg transition-all duration-300">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 pb-4 border-b-2 border-border mb-6">
          <div className="flex gap-3 flex-1 flex-wrap">
            <Input
              placeholder="Patient Name"
              value={patient.name}
              onChange={(e) => onUpdate(patient.id, 'name', e.target.value)}
              className="max-w-[250px] font-semibold text-base border-2 focus:border-primary"
            />
            <Input
              placeholder="Bed/Room"
              value={patient.bed}
              onChange={(e) => onUpdate(patient.id, 'bed', e.target.value)}
              className="max-w-[150px] border-2 focus:border-primary"
            />
          </div>
          <div className="flex gap-2 no-print">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onToggleCollapse(patient.id)}
              title={patient.collapsed ? "Expand" : "Collapse"}
            >
              {patient.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onDuplicate(patient.id)}
              title="Duplicate"
              className="hover:bg-accent hover:text-accent-foreground"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onRemove(patient.id)}
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!patient.collapsed && (
          <div className="space-y-4">
            {/* Clinical Summary */}
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm uppercase tracking-wide">Clinical Summary</h3>
                  <span className="text-xs text-muted-foreground">
                    ({patient.clinicalSummary.length} chars)
                  </span>
                </div>
                <div className="flex gap-1 no-print">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addTimestamp('clinicalSummary')}
                    title="Add timestamp"
                  >
                    <Clock className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearSection('clinicalSummary')}
                    className="hover:bg-warning hover:text-warning-foreground"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <RichTextEditor
                value={patient.clinicalSummary}
                onChange={(value) => onUpdate(patient.id, 'clinicalSummary', value)}
                placeholder="Enter clinical summary..."
                minHeight="80px"
              />
            </div>

            {/* Interval Events */}
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm uppercase tracking-wide">Interval Events</h3>
                  <span className="text-xs text-muted-foreground">
                    ({patient.intervalEvents.length} chars)
                  </span>
                </div>
                <div className="flex gap-1 no-print">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addTimestamp('intervalEvents')}
                    title="Add timestamp"
                  >
                    <Clock className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearSection('intervalEvents')}
                    className="hover:bg-warning hover:text-warning-foreground"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <RichTextEditor
                value={patient.intervalEvents}
                onChange={(value) => onUpdate(patient.id, 'intervalEvents', value)}
                placeholder="Enter interval events..."
                minHeight="80px"
              />
            </div>

            {/* Systems Review */}
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <h3 className="font-semibold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="text-primary">⚕️</span> Systems Review
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(systemLabels).map(([key, label]) => (
                  <div key={key} className="border border-border rounded-md p-2 bg-card hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium flex items-center gap-1">
                        {label}
                      </label>
                      <div className={`w-2 h-2 rounded-full ${patient.systems[key as keyof typeof patient.systems] ? 'bg-success' : 'bg-muted'}`} />
                    </div>
                    <RichTextEditor
                      value={patient.systems[key as keyof typeof patient.systems]}
                      onChange={(value) => onUpdate(patient.id, `systems.${key}`, value)}
                      placeholder={`Enter ${label} notes...`}
                      minHeight="60px"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
