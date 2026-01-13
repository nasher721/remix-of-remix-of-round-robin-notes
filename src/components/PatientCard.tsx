import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, Copy, Trash2, ChevronDown, ChevronUp, Clock, ImageIcon, TestTube } from "lucide-react";
import { useState } from "react";
import { RichTextEditor } from "./RichTextEditor";
import { AutoText } from "@/types/autotext";
import { defaultAutotexts } from "@/data/autotexts";
import type { Patient, PatientSystems } from "@/types/patient";
import { SYSTEM_LABELS, SYSTEM_ICONS } from "@/constants/systems";

interface PatientCardProps {
  patient: Patient;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  autotexts?: AutoText[];
  globalFontSize?: number;
}

export const PatientCard = ({ 
  patient, 
  onUpdate, 
  onRemove, 
  onDuplicate, 
  onToggleCollapse,
  autotexts = defaultAutotexts,
  globalFontSize = 14
}: PatientCardProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const addTimestamp = (field: string) => {
    const timestamp = new Date().toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
    const currentValue = field.includes('.') 
      ? patient.systems[field.split('.')[1] as keyof PatientSystems]
      : patient[field as keyof Patient];
    const newValue = `[${timestamp}] ${currentValue || ''}`;
    onUpdate(patient.id, field, newValue);
  };

  const clearSection = (field: string) => {
    if (confirm('Clear this section?')) {
      onUpdate(patient.id, field, '');
    }
  };

  const hasSystemContent = (key: string) => {
    return Boolean(patient.systems[key as keyof PatientSystems]);
  };

  return (
    <div className="print-avoid-break bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 p-5 border-b border-border">
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">👤</span>
            </div>
            <div className="flex gap-3 flex-1 flex-wrap">
              <Input
                placeholder="Patient Name"
                value={patient.name}
                onChange={(e) => onUpdate(patient.id, 'name', e.target.value)}
                className="max-w-[220px] font-medium bg-transparent border-0 border-b-2 border-transparent hover:border-border focus:border-primary rounded-none px-0 h-auto py-1 text-base"
              />
              <Input
                placeholder="Bed/Room"
                value={patient.bed}
                onChange={(e) => onUpdate(patient.id, 'bed', e.target.value)}
                className="max-w-[120px] bg-transparent border-0 border-b-2 border-transparent hover:border-border focus:border-primary rounded-none px-0 h-auto py-1 text-muted-foreground"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 no-print">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleCollapse(patient.id)}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title={patient.collapsed ? "Expand" : "Collapse"}
          >
            {patient.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(patient.id)}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(patient.id)}
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!patient.collapsed && (
        <div className="p-5 space-y-5">
          {/* Clinical Summary */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">Clinical Summary</h3>
                {patient.clinicalSummary && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {patient.clinicalSummary.length} chars
                  </span>
                )}
              </div>
              <div className="flex gap-1 no-print">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addTimestamp('clinicalSummary')}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  title="Add timestamp"
                >
                  <Clock className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearSection('clinicalSummary')}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
              <RichTextEditor
                value={patient.clinicalSummary}
                onChange={(value) => onUpdate(patient.id, 'clinicalSummary', value)}
                placeholder="Enter clinical summary..."
                minHeight="80px"
                autotexts={autotexts}
                fontSize={globalFontSize}
              />
            </div>
          </div>

          {/* Interval Events */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">Interval Events</h3>
                {patient.intervalEvents && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {patient.intervalEvents.length} chars
                  </span>
                )}
              </div>
              <div className="flex gap-1 no-print">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addTimestamp('intervalEvents')}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  title="Add timestamp"
                >
                  <Clock className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearSection('intervalEvents')}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
              <RichTextEditor
                value={patient.intervalEvents}
                onChange={(value) => onUpdate(patient.id, 'intervalEvents', value)}
                placeholder="Enter interval events..."
                minHeight="80px"
                autotexts={autotexts}
                fontSize={globalFontSize}
              />
            </div>
          </div>

          {/* Imaging & Labs Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Imaging */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium">Imaging</h3>
                  {patient.imaging && (
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {patient.imaging.length} chars
                    </span>
                  )}
                </div>
                <div className="flex gap-1 no-print">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearSection('imaging')}
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.imaging}
                  onChange={(value) => onUpdate(patient.id, 'imaging', value)}
                  placeholder="X-rays, CT, MRI, Echo..."
                  minHeight="60px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                />
              </div>
            </div>

            {/* Labs */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TestTube className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium">Labs</h3>
                  {patient.labs && (
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {patient.labs.length} chars
                    </span>
                  )}
                </div>
                <div className="flex gap-1 no-print">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearSection('labs')}
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                <RichTextEditor
                  value={patient.labs}
                  onChange={(value) => onUpdate(patient.id, 'labs', value)}
                  placeholder="CBC, BMP, LFTs, coags..."
                  minHeight="60px"
                  autotexts={autotexts}
                  fontSize={globalFontSize}
                />
              </div>
            </div>
          </div>

          {/* Systems Review */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-primary text-sm">⚕️</span>
              <h3 className="text-sm font-medium">Systems Review</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Object.entries(SYSTEM_LABELS).map(([key, label]) => (
                <div 
                  key={key} 
                  className={`rounded-lg p-3 border transition-all duration-200 ${
                    hasSystemContent(key) 
                      ? 'bg-card border-primary/20 shadow-sm' 
                      : 'bg-secondary/30 border-border/50 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <span>{SYSTEM_ICONS[key]}</span>
                      {label}
                    </label>
                    {hasSystemContent(key) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    )}
                  </div>
                  <RichTextEditor
                    value={patient.systems[key as keyof PatientSystems]}
                    onChange={(value) => onUpdate(patient.id, `systems.${key}`, value)}
                    placeholder={`${label}...`}
                    minHeight="50px"
                    autotexts={autotexts}
                    fontSize={globalFontSize}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
