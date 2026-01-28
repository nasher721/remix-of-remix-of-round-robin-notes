import * as React from "react";
import {
  ArrowRightLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Plus,
  X,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Patient } from "@/types/patient";
import type { HandoffData, SBARNote, IfThenPlan } from "@/types/handoff";
import { createEmptyHandoff, generateSBARFromPatient, CODE_STATUS_OPTIONS } from "@/types/handoff";

interface MobileHandoffProps {
  patient: Patient;
  handoff?: HandoffData;
  onSave: (handoff: HandoffData) => void;
  onComplete: () => void;
  className?: string;
}

export function MobileHandoff({
  patient,
  handoff: initialHandoff,
  onSave,
  onComplete,
  className,
}: MobileHandoffProps) {
  const [handoff, setHandoff] = React.useState<HandoffData>(() =>
    initialHandoff || createEmptyHandoff(patient.id, patient.name, patient.bed)
  );
  const [expandedSection, setExpandedSection] = React.useState<string | null>("sbar");

  const updateHandoff = (updates: Partial<HandoffData>) => {
    setHandoff(prev => ({ ...prev, ...updates }));
  };

  const updateSBAR = (field: keyof SBARNote, value: string) => {
    updateHandoff({
      sbar: { ...handoff.sbar, [field]: value },
    });
  };

  const autoGenerate = () => {
    const sbar = generateSBARFromPatient({
      name: patient.name,
      bed: patient.bed,
      clinicalSummary: patient.clinicalSummary,
      intervalEvents: patient.intervalEvents,
      labs: patient.labs,
      systems: patient.systems,
    });
    updateHandoff({ sbar });
  };

  const addIfThenPlan = () => {
    const newPlan: IfThenPlan = {
      id: `plan-${Date.now()}`,
      condition: '',
      action: '',
      priority: 'routine',
    };
    updateHandoff({
      ifThenPlans: [...handoff.ifThenPlans, newPlan],
    });
  };

  const updateIfThenPlan = (planId: string, updates: Partial<IfThenPlan>) => {
    updateHandoff({
      ifThenPlans: handoff.ifThenPlans.map(p =>
        p.id === planId ? { ...p, ...updates } : p
      ),
    });
  };

  const removeIfThenPlan = (planId: string) => {
    updateHandoff({
      ifThenPlans: handoff.ifThenPlans.filter(p => p.id !== planId),
    });
  };

  const isSBARComplete = handoff.sbar.situation && handoff.sbar.assessment;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Patient Header */}
      <div className="p-4 border-b bg-secondary/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">{patient.name}</h2>
            <p className="text-sm text-muted-foreground">Bed: {patient.bed}</p>
          </div>
          {isSBARComplete && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          )}
        </div>

        {/* Code Status & One-Liner */}
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Select
              value={handoff.codeStatus || 'full'}
              onValueChange={(v) => updateHandoff({ codeStatus: v })}
            >
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CODE_STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={autoGenerate}
              className="gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-fill
            </Button>
          </div>
          <Input
            value={handoff.oneLiner}
            onChange={(e) => updateHandoff({ oneLiner: e.target.value })}
            placeholder="One-liner summary..."
            className="h-9"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* SBAR Section */}
          <Collapsible
            open={expandedSection === 'sbar'}
            onOpenChange={(open) => setExpandedSection(open ? 'sbar' : null)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">SBAR</span>
                    {isSBARComplete && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {expandedSection === 'sbar' ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <SBARField
                    letter="S"
                    label="Situation"
                    value={handoff.sbar.situation}
                    onChange={(v) => updateSBAR('situation', v)}
                    placeholder="What is happening right now?"
                    color="blue"
                  />
                  <SBARField
                    letter="B"
                    label="Background"
                    value={handoff.sbar.background}
                    onChange={(v) => updateSBAR('background', v)}
                    placeholder="What is the clinical context?"
                    color="green"
                  />
                  <SBARField
                    letter="A"
                    label="Assessment"
                    value={handoff.sbar.assessment}
                    onChange={(v) => updateSBAR('assessment', v)}
                    placeholder="What do you think is going on?"
                    color="amber"
                  />
                  <SBARField
                    letter="R"
                    label="Recommendation"
                    value={handoff.sbar.recommendation}
                    onChange={(v) => updateSBAR('recommendation', v)}
                    placeholder="What do you need?"
                    color="purple"
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* If-Then Plans */}
          <Collapsible
            open={expandedSection === 'ifthen'}
            onOpenChange={(open) => setExpandedSection(open ? 'ifthen' : null)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">If-Then Plans</span>
                    {handoff.ifThenPlans.length > 0 && (
                      <Badge variant="secondary">{handoff.ifThenPlans.length}</Badge>
                    )}
                  </div>
                  {expandedSection === 'ifthen' ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  {handoff.ifThenPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-3 bg-secondary/30 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={plan.priority === 'urgent' ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {plan.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeIfThenPlan(plan.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        value={plan.condition}
                        onChange={(e) => updateIfThenPlan(plan.id, { condition: e.target.value })}
                        placeholder="If..."
                        className="h-9"
                      />
                      <Input
                        value={plan.action}
                        onChange={(e) => updateIfThenPlan(plan.id, { action: e.target.value })}
                        placeholder="Then..."
                        className="h-9"
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addIfThenPlan}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add If-Then Plan
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Anticipatory Guidance */}
          <Collapsible
            open={expandedSection === 'guidance'}
            onOpenChange={(open) => setExpandedSection(open ? 'guidance' : null)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">Anticipatory Guidance</span>
                  </div>
                  {expandedSection === 'guidance' ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <Textarea
                    value={handoff.anticipatoryGuidance}
                    onChange={(e) => updateHandoff({ anticipatoryGuidance: e.target.value })}
                    placeholder="What might happen and what to do about it..."
                    rows={4}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 border-t bg-background/80 backdrop-blur-xl safe-area-bottom">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onSave(handoff)}
          >
            Save Draft
          </Button>
          <Button
            className="flex-1"
            onClick={onComplete}
            disabled={!isSBARComplete}
          >
            Complete Handoff
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SBARFieldProps {
  letter: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  color: 'blue' | 'green' | 'amber' | 'purple';
}

function SBARField({ letter, label, value, onChange, placeholder, color }: SBARFieldProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          "w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
          colorClasses[color]
        )}>
          {letter}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-none"
      />
    </div>
  );
}

// Compact handoff summary for patient list
interface HandoffSummaryProps {
  handoff?: HandoffData;
  onClick?: () => void;
}

export function HandoffSummary({ handoff, onClick }: HandoffSummaryProps) {
  if (!handoff) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className="w-full justify-start gap-2 h-9"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Create Handoff
      </Button>
    );
  }

  const isComplete = handoff.sbar.situation && handoff.sbar.assessment;

  return (
    <button
      onClick={onClick}
      className="w-full p-3 bg-purple-50/50 rounded-lg border border-purple-200/50 text-left active:bg-purple-100/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-purple-700">Handoff</span>
        {isComplete ? (
          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
            Ready
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">Draft</Badge>
        )}
      </div>
      {handoff.oneLiner && (
        <p className="text-sm line-clamp-2">{handoff.oneLiner}</p>
      )}
      {handoff.ifThenPlans.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {handoff.ifThenPlans.length} if-then plan{handoff.ifThenPlans.length > 1 ? 's' : ''}
        </p>
      )}
    </button>
  );
}

export default MobileHandoff;
