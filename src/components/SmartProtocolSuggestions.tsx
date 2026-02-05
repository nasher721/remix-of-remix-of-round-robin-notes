import * as React from "react";
import {
  Lightbulb,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Activity,
  Droplets,
  Wind,
  Heart,
  Thermometer,
  Brain,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import type { Patient } from "@/types/patient";
import type { Protocol } from "@/types/protocols";

interface SuggestedProtocol {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  relevance: 'high' | 'medium' | 'low';
  triggers: string[];
  items: { id: string; label: string; completed: boolean }[];
  category: string;
}

// Protocol definitions with trigger keywords
const PROTOCOL_DEFINITIONS: {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
  triggerPatterns: RegExp[];
  items: string[];
}[] = [
  {
    id: 'sepsis-3hr',
    name: 'Sepsis 3-Hour Bundle',
    description: 'Initial resuscitation within 3 hours of sepsis identification',
    icon: Thermometer,
    category: 'Infectious Disease',
    triggerPatterns: [
      /sepsis|septic/i,
      /fever.*(infection|source)/i,
      /lactate.*(elevated|high|\d+\.\d+ (mmol|mg))/i,
      /bacteremia/i,
      /pressor|vasopressor|levophed|norepinephrine/i,
    ],
    items: [
      'Measure lactate level',
      'Obtain blood cultures before antibiotics',
      'Administer broad-spectrum antibiotics',
      'Administer 30 mL/kg crystalloid for hypotension or lactate >=4',
    ],
  },
  {
    id: 'sepsis-6hr',
    name: 'Sepsis 6-Hour Bundle',
    description: 'Continued management within 6 hours',
    icon: Thermometer,
    category: 'Infectious Disease',
    triggerPatterns: [
      /sepsis|septic/i,
      /septic shock/i,
    ],
    items: [
      'Apply vasopressors for hypotension not responding to fluid',
      'Remeasure lactate if initial elevated',
      'Reassess volume status and tissue perfusion',
    ],
  },
  {
    id: 'vap-prevention',
    name: 'VAP Prevention Bundle',
    description: 'Ventilator-associated pneumonia prevention',
    icon: Wind,
    category: 'Respiratory',
    triggerPatterns: [
      /intubated|ventilator|vent|mechanical ventilation/i,
      /ett|endotracheal/i,
      /on vent/i,
    ],
    items: [
      'Elevate head of bed 30-45 degrees',
      'Daily sedation interruption and assessment',
      'Daily assessment of readiness to extubate',
      'Peptic ulcer prophylaxis',
      'DVT prophylaxis',
      'Oral care with chlorhexidine',
    ],
  },
  {
    id: 'cauti-prevention',
    name: 'CAUTI Prevention Bundle',
    description: 'Catheter-associated UTI prevention',
    icon: Droplets,
    category: 'Infectious Disease',
    triggerPatterns: [
      /foley|urinary catheter|indwelling catheter/i,
      /cauti/i,
    ],
    items: [
      'Daily assessment of catheter necessity',
      'Maintain closed drainage system',
      'Keep drainage bag below bladder level',
      'Proper hand hygiene before/after handling',
      'Consider catheter removal or alternative',
    ],
  },
  {
    id: 'clabsi-prevention',
    name: 'CLABSI Prevention Bundle',
    description: 'Central line-associated bloodstream infection prevention',
    icon: Activity,
    category: 'Infectious Disease',
    triggerPatterns: [
      /central line|central venous|cvl|picc|port/i,
      /clabsi/i,
      /line infection/i,
    ],
    items: [
      'Daily assessment of line necessity',
      'Chlorhexidine skin antisepsis',
      'Optimal catheter site selection',
      'Daily inspection of insertion site',
      'Proper hand hygiene',
    ],
  },
  {
    id: 'dvt-prophylaxis',
    name: 'DVT Prophylaxis',
    description: 'Venous thromboembolism prevention',
    icon: Heart,
    category: 'Hematology',
    triggerPatterns: [
      /dvt|pe|vte/i,
      /immobile|bedridden/i,
      /surgery|post-op/i,
      /malignancy|cancer/i,
    ],
    items: [
      'Risk assessment completed',
      'Pharmacologic prophylaxis ordered',
      'Mechanical prophylaxis (SCDs) applied',
      'Early mobilization when appropriate',
      'Document contraindications if not given',
    ],
  },
  {
    id: 'gi-bleed',
    name: 'GI Bleed Management',
    description: 'Acute gastrointestinal bleeding protocol',
    icon: Droplets,
    category: 'GI',
    triggerPatterns: [
      /gi bleed|gastrointestinal bleed/i,
      /melena|hematemesis|hematochezia/i,
      /coffee.ground|bloody.stool/i,
      /ugib|lgib/i,
    ],
    items: [
      'Establish two large-bore IVs',
      'Type and cross for 2-4 units PRBCs',
      'GI consult',
      'NPO status',
      'PPI infusion initiated',
      'Monitor hemoglobin q6h',
      'Consider ICU admission',
    ],
  },
  {
    id: 'acs-nstemi',
    name: 'NSTEMI/Unstable Angina Protocol',
    description: 'Acute coronary syndrome management',
    icon: Heart,
    category: 'Cardiovascular',
    triggerPatterns: [
      /nstemi|unstable angina|acs/i,
      /troponin.*(elevated|positive|rise)/i,
      /chest pain.*(cardiac|angina)/i,
      /mi|myocardial infarction/i,
    ],
    items: [
      'Aspirin 325mg (if not given)',
      'P2Y12 inhibitor (clopidogrel/ticagrelor)',
      'Anticoagulation (heparin)',
      'Beta-blocker (if no contraindication)',
      'Statin (high intensity)',
      'Cardiology consult',
      'Serial troponins q6h',
      'Consider cardiac catheterization timing',
    ],
  },
  {
    id: 'stroke-protocol',
    name: 'Acute Stroke Protocol',
    description: 'Time-sensitive stroke management',
    icon: Brain,
    category: 'Neurology',
    triggerPatterns: [
      /stroke|cva/i,
      /tia|transient ischemic/i,
      /aphasia|hemiparesis|facial droop/i,
      /thrombolytic|tpa|alteplase/i,
    ],
    items: [
      'NIHSS score documented',
      'CT head completed',
      'Blood glucose checked',
      'tPA eligibility assessed',
      'Neurology consult',
      'Swallow evaluation before PO',
      'BP management per protocol',
      'DVT prophylaxis',
    ],
  },
  {
    id: 'dka-management',
    name: 'DKA Management Protocol',
    description: 'Diabetic ketoacidosis treatment',
    icon: Activity,
    category: 'Endocrine',
    triggerPatterns: [
      /dka|diabetic ketoacidosis/i,
      /ketoacidosis/i,
      /anion gap.*(elevated|high|\d{2,})/i,
    ],
    items: [
      'IV fluid resuscitation initiated',
      'Insulin drip started',
      'Potassium replacement protocol',
      'Q1h glucose monitoring',
      'Q2-4h BMP monitoring',
      'Identify precipitating cause',
      'Transition to SQ insulin when appropriate',
    ],
  },
  {
    id: 'aki-management',
    name: 'Acute Kidney Injury Protocol',
    description: 'AKI evaluation and management',
    icon: Droplets,
    category: 'Renal',
    triggerPatterns: [
      /aki|acute kidney injury/i,
      /creatinine.*(rising|elevated|increased)/i,
      /oliguria|anuria/i,
      /renal failure/i,
    ],
    items: [
      'Identify and treat underlying cause',
      'Review medication list for nephrotoxins',
      'Optimize volume status',
      'Foley catheter if obstruction suspected',
      'Renal ultrasound if indicated',
      'Nephrology consult if severe',
      'Monitor urine output',
      'Avoid contrast if possible',
    ],
  },
  {
    id: 'fall-prevention',
    name: 'Fall Prevention Protocol',
    description: 'Patient safety and fall prevention',
    icon: Shield,
    category: 'Safety',
    triggerPatterns: [
      /fall risk|falls/i,
      /confused|delirium|altered/i,
      /elderly.*(admission|admit)/i,
      /mobility.*(impaired|limited)/i,
    ],
    items: [
      'Fall risk assessment completed',
      'Bed alarm activated if indicated',
      'Non-skid footwear',
      'Call light within reach',
      'Bed in lowest position',
      'Environment cleared of hazards',
      'Medication review for fall-risk meds',
    ],
  },
];

// Analyze patient data and suggest protocols
const analyzePatientForProtocols = (patient: Patient): SuggestedProtocol[] => {
  const suggestions: SuggestedProtocol[] = [];
  const allText = `${patient.clinicalSummary} ${patient.intervalEvents} ${patient.labs} ${patient.imaging} ${Object.values(patient.systems).join(' ')}`.toLowerCase();

  for (const protocol of PROTOCOL_DEFINITIONS) {
    const matchedTriggers: string[] = [];

    for (const pattern of protocol.triggerPatterns) {
      const match = allText.match(pattern);
      if (match) {
        matchedTriggers.push(match[0]);
      }
    }

    if (matchedTriggers.length > 0) {
      // Determine relevance based on number of triggers matched
      const relevance: 'high' | 'medium' | 'low' =
        matchedTriggers.length >= 3 ? 'high' :
        matchedTriggers.length >= 2 ? 'medium' : 'low';

      suggestions.push({
        id: protocol.id,
        name: protocol.name,
        description: protocol.description,
        icon: protocol.icon,
        relevance,
        triggers: [...new Set(matchedTriggers)], // Remove duplicates
        items: protocol.items.map((label, idx) => ({
          id: `${protocol.id}-${idx}`,
          label,
          completed: false,
        })),
        category: protocol.category,
      });
    }
  }

  // Sort by relevance
  return suggestions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.relevance] - order[b.relevance];
  });
};

interface SmartProtocolSuggestionsProps {
  patient: Patient;
  className?: string;
  onApplyProtocol?: (protocol: SuggestedProtocol) => void;
}

export function SmartProtocolSuggestions({
  patient,
  className,
  onApplyProtocol,
}: SmartProtocolSuggestionsProps) {
  const [expandedProtocol, setExpandedProtocol] = React.useState<string | null>(null);
  const [completedItems, setCompletedItems] = React.useState<Record<string, boolean>>({});

  const suggestions = React.useMemo(() => {
    return analyzePatientForProtocols(patient);
  }, [patient]);

  const highPriorityCount = suggestions.filter(s => s.relevance === 'high').length;

  const toggleItem = (itemId: string) => {
    setCompletedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const getProtocolProgress = (protocol: SuggestedProtocol) => {
    const completed = protocol.items.filter(item => completedItems[item.id]).length;
    return (completed / protocol.items.length) * 100;
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2 h-8 relative", className)}
        >
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Protocols</span>
          {highPriorityCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
            >
              {highPriorityCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Suggested Protocols
            {suggestions.length > 0 && (
              <Badge variant="outline">{suggestions.length} found</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            Based on patient data, these protocols may be relevant. Review and apply as clinically appropriate.
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4">
          <div className="space-y-3 pr-4">
            {suggestions.map((protocol) => {
              const progress = getProtocolProgress(protocol);
              const IconComponent = protocol.icon;

              return (
                <Collapsible
                  key={protocol.id}
                  open={expandedProtocol === protocol.id}
                  onOpenChange={(open) => setExpandedProtocol(open ? protocol.id : null)}
                >
                  <Card className={cn(
                    "transition-all",
                    protocol.relevance === 'high' && "border-red-200 bg-red-50/30",
                    protocol.relevance === 'medium' && "border-amber-200 bg-amber-50/30"
                  )}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="py-3 cursor-pointer hover:bg-secondary/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            protocol.relevance === 'high' ? "bg-red-100 text-red-600" :
                            protocol.relevance === 'medium' ? "bg-amber-100 text-amber-600" :
                            "bg-blue-100 text-blue-600"
                          )}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm">{protocol.name}</CardTitle>
                              <Badge
                                variant={protocol.relevance === 'high' ? 'destructive' : 'outline'}
                                className="text-[10px] capitalize"
                              >
                                {protocol.relevance}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{protocol.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Progress value={progress} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground">
                                {protocol.items.filter(i => completedItems[i.id]).length}/{protocol.items.length}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            expandedProtocol === protocol.id && "rotate-90"
                          )} />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-4">
                        {/* Triggers */}
                        <div className="mb-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Detected in notes:</p>
                          <div className="flex flex-wrap gap-1">
                            {protocol.triggers.map((trigger, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px]">
                                {trigger}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Checklist items */}
                        <div className="space-y-2">
                          {protocol.items.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-start gap-2 p-2 rounded-lg transition-colors cursor-pointer",
                                completedItems[item.id]
                                  ? "bg-green-50 border border-green-200"
                                  : "bg-secondary/30 hover:bg-secondary/50"
                              )}
                              onClick={() => toggleItem(item.id)}
                            >
                              <div className={cn(
                                "flex items-center justify-center w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0",
                                completedItems[item.id]
                                  ? "bg-green-500 border-green-500"
                                  : "border-muted-foreground/30"
                              )}>
                                {completedItems[item.id] && (
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <span className={cn(
                                "text-sm",
                                completedItems[item.id] && "line-through text-muted-foreground"
                              )}>
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              // Mark all as complete
                              const updates: Record<string, boolean> = {};
                              protocol.items.forEach(item => {
                                updates[item.id] = true;
                              });
                              setCompletedItems(prev => ({ ...prev, ...updates }));
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Complete All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Reset all
                              const updates: Record<string, boolean> = {};
                              protocol.items.forEach(item => {
                                updates[item.id] = false;
                              });
                              setCompletedItems(prev => ({ ...prev, ...updates }));
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Compact badge showing protocol count
interface ProtocolBadgeProps {
  patient: Patient;
  className?: string;
}

export function ProtocolBadge({ patient, className }: ProtocolBadgeProps) {
  const suggestions = React.useMemo(() => {
    return analyzePatientForProtocols(patient);
  }, [patient]);

  const highPriority = suggestions.filter(s => s.relevance === 'high').length;
  const mediumPriority = suggestions.filter(s => s.relevance === 'medium').length;

  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {highPriority > 0 && (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <ClipboardList className="h-3 w-3" />
          {highPriority}
        </Badge>
      )}
      {mediumPriority > 0 && (
        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
          {mediumPriority}
        </Badge>
      )}
    </div>
  );
}

export default SmartProtocolSuggestions;
