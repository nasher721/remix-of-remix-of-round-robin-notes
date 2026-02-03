import * as React from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
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
import type { Patient } from "@/types/patient";

interface LabValue {
  name: string;
  key: string;
  value: number;
  unit: string;
  normalLow: number;
  normalHigh: number;
  criticalLow?: number;
  criticalHigh?: number;
  timestamp?: string;
  previousValues?: { value: number; timestamp: string }[];
}

interface ParsedLabResult {
  labs: LabValue[];
  rawText: string;
}

// Lab reference ranges
const LAB_REFERENCES: Record<string, { name: string; normalLow: number; normalHigh: number; criticalLow?: number; criticalHigh?: number; unit: string }> = {
  na: { name: 'Sodium', normalLow: 136, normalHigh: 145, criticalLow: 120, criticalHigh: 160, unit: 'mEq/L' },
  k: { name: 'Potassium', normalLow: 3.5, normalHigh: 5.0, criticalLow: 2.5, criticalHigh: 6.5, unit: 'mEq/L' },
  cl: { name: 'Chloride', normalLow: 98, normalHigh: 106, unit: 'mEq/L' },
  co2: { name: 'CO2/Bicarb', normalLow: 22, normalHigh: 29, criticalLow: 10, criticalHigh: 40, unit: 'mEq/L' },
  bun: { name: 'BUN', normalLow: 7, normalHigh: 20, criticalHigh: 100, unit: 'mg/dL' },
  cr: { name: 'Creatinine', normalLow: 0.7, normalHigh: 1.3, criticalHigh: 10, unit: 'mg/dL' },
  glu: { name: 'Glucose', normalLow: 70, normalHigh: 100, criticalLow: 40, criticalHigh: 500, unit: 'mg/dL' },
  ca: { name: 'Calcium', normalLow: 8.5, normalHigh: 10.5, criticalLow: 6.0, criticalHigh: 13.0, unit: 'mg/dL' },
  mg: { name: 'Magnesium', normalLow: 1.7, normalHigh: 2.2, criticalLow: 1.0, criticalHigh: 4.0, unit: 'mg/dL' },
  phos: { name: 'Phosphorus', normalLow: 2.5, normalHigh: 4.5, unit: 'mg/dL' },
  wbc: { name: 'WBC', normalLow: 4.5, normalHigh: 11.0, criticalLow: 1.0, criticalHigh: 50.0, unit: 'K/uL' },
  hgb: { name: 'Hemoglobin', normalLow: 12.0, normalHigh: 16.0, criticalLow: 5.0, criticalHigh: 20.0, unit: 'g/dL' },
  hct: { name: 'Hematocrit', normalLow: 36, normalHigh: 46, unit: '%' },
  plt: { name: 'Platelets', normalLow: 150, normalHigh: 400, criticalLow: 20, criticalHigh: 1000, unit: 'K/uL' },
  inr: { name: 'INR', normalLow: 0.9, normalHigh: 1.1, criticalHigh: 5.0, unit: '' },
  ptt: { name: 'PTT', normalLow: 25, normalHigh: 35, unit: 'sec' },
  lactate: { name: 'Lactate', normalLow: 0.5, normalHigh: 2.0, criticalHigh: 8.0, unit: 'mmol/L' },
  troponin: { name: 'Troponin', normalLow: 0, normalHigh: 0.04, criticalHigh: 1.0, unit: 'ng/mL' },
  bnp: { name: 'BNP', normalLow: 0, normalHigh: 100, criticalHigh: 1000, unit: 'pg/mL' },
  ast: { name: 'AST', normalLow: 10, normalHigh: 40, unit: 'U/L' },
  alt: { name: 'ALT', normalLow: 7, normalHigh: 56, unit: 'U/L' },
  alp: { name: 'Alk Phos', normalLow: 44, normalHigh: 147, unit: 'U/L' },
  tbili: { name: 'Total Bili', normalLow: 0.1, normalHigh: 1.2, criticalHigh: 12, unit: 'mg/dL' },
  albumin: { name: 'Albumin', normalLow: 3.5, normalHigh: 5.0, unit: 'g/dL' },
  ph: { name: 'pH', normalLow: 7.35, normalHigh: 7.45, criticalLow: 7.10, criticalHigh: 7.60, unit: '' },
  pco2: { name: 'pCO2', normalLow: 35, normalHigh: 45, criticalLow: 20, criticalHigh: 70, unit: 'mmHg' },
  po2: { name: 'pO2', normalLow: 80, normalHigh: 100, criticalLow: 40, unit: 'mmHg' },
};

// Parse lab values from text
const parseLabsFromText = (text: string): ParsedLabResult => {
  const labs: LabValue[] = [];
  const normalizedText = text.toLowerCase();

  for (const [key, ref] of Object.entries(LAB_REFERENCES)) {
    // Try multiple patterns
    const patterns = [
      new RegExp(`${key}[:\\s]+([\\d.]+)`, 'i'),
      new RegExp(`${ref.name}[:\\s]+([\\d.]+)`, 'i'),
      new RegExp(`${key}\\s*=\\s*([\\d.]+)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          labs.push({
            name: ref.name,
            key,
            value,
            unit: ref.unit,
            normalLow: ref.normalLow,
            normalHigh: ref.normalHigh,
            criticalLow: ref.criticalLow,
            criticalHigh: ref.criticalHigh,
          });
          break;
        }
      }
    }
  }

  return { labs, rawText: text };
};

// Get lab status
const getLabStatus = (lab: LabValue): { status: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high'; color: string } => {
  if (lab.criticalLow !== undefined && lab.value < lab.criticalLow) {
    return { status: 'critical_low', color: 'text-red-600 bg-red-50 border-red-200' };
  }
  if (lab.criticalHigh !== undefined && lab.value > lab.criticalHigh) {
    return { status: 'critical_high', color: 'text-red-600 bg-red-50 border-red-200' };
  }
  if (lab.value < lab.normalLow) {
    return { status: 'low', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  }
  if (lab.value > lab.normalHigh) {
    return { status: 'high', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  }
  return { status: 'normal', color: 'text-green-600 bg-green-50 border-green-200' };
};

// Mini sparkline component
const Sparkline = ({ values, width = 60, height = 20 }: { values: number[]; width?: number; height?: number }) => {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const isIncreasing = values[values.length - 1] > values[0];

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={isIncreasing ? '#ef4444' : '#22c55e'}
        strokeWidth="1.5"
        points={points}
      />
      {/* End point */}
      <circle
        cx={(values.length - 1) / (values.length - 1) * width}
        cy={height - ((values[values.length - 1] - min) / range) * height}
        r="2"
        fill={isIncreasing ? '#ef4444' : '#22c55e'}
      />
    </svg>
  );
};

// Trend indicator
const TrendIndicator = ({ current, previous }: { current: number; previous?: number }) => {
  if (previous === undefined) return <Minus className="h-3 w-3 text-muted-foreground" />;

  const change = current - previous;
  const percentChange = (change / previous) * 100;

  if (Math.abs(percentChange) < 1) {
    return <Minus className="h-3 w-3 text-muted-foreground" aria-label="Stable" />;
  }

  if (change > 0) {
    return (
      <div className="flex items-center gap-0.5 text-red-600" title={`+${percentChange.toFixed(1)}%`}>
        <TrendingUp className="h-3 w-3" />
        <span className="text-[10px]">+{percentChange.toFixed(0)}%</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 text-green-600" title={`${percentChange.toFixed(1)}%`}>
      <TrendingDown className="h-3 w-3" />
      <span className="text-[10px]">{percentChange.toFixed(0)}%</span>
    </div>
  );
};

// Lab card component
const LabCard = ({ lab, expanded = false }: { lab: LabValue; expanded?: boolean }) => {
  const { status, color } = getLabStatus(lab);
  const isCritical = status.includes('critical');

  return (
    <div className={cn(
      "p-2 rounded-lg border transition-all",
      color,
      isCritical && "animate-pulse"
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {isCritical && <AlertTriangle className="h-3 w-3" />}
          <span className="text-xs font-medium">{lab.name}</span>
        </div>
        {lab.previousValues && lab.previousValues.length > 0 && (
          <TrendIndicator
            current={lab.value}
            previous={lab.previousValues[lab.previousValues.length - 1]?.value}
          />
        )}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={cn("text-lg font-bold", isCritical && "text-red-700")}>{lab.value}</span>
        <span className="text-xs text-muted-foreground">{lab.unit}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {lab.normalLow} - {lab.normalHigh}
      </div>
      {expanded && lab.previousValues && lab.previousValues.length > 1 && (
        <div className="mt-2 pt-2 border-t border-current/20">
          <Sparkline values={[...lab.previousValues.map(p => p.value), lab.value]} />
        </div>
      )}
    </div>
  );
};

interface LabTrendingPanelProps {
  patients: Patient[];
  className?: string;
}

export function LabTrendingPanel({ patients, className }: LabTrendingPanelProps) {
  const [expandedPatient, setExpandedPatient] = React.useState<string | null>(null);

  // Parse labs for each patient
  const patientLabs = React.useMemo(() => {
    return patients.map(patient => ({
      patient,
      parsedLabs: parseLabsFromText(patient.labs),
    }));
  }, [patients]);

  // Count abnormal labs
  const abnormalCount = patientLabs.reduce((count, { parsedLabs }) => {
    return count + parsedLabs.labs.filter(lab => {
      const { status } = getLabStatus(lab);
      return status !== 'normal';
    }).length;
  }, 0);

  const criticalCount = patientLabs.reduce((count, { parsedLabs }) => {
    return count + parsedLabs.labs.filter(lab => {
      const { status } = getLabStatus(lab);
      return status.includes('critical');
    }).length;
  }, 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2 h-8 relative", className)}
        >
          <Activity className="h-4 w-4" />
          <span className="hidden sm:inline">Lab Trends</span>
          {abnormalCount > 0 && (
            <Badge
              variant={criticalCount > 0 ? "destructive" : "outline"}
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
            >
              {abnormalCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Lab Trending Overview
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} Critical</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          <div className="space-y-4 pr-4">
            {patientLabs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No patient data available</p>
              </div>
            ) : (
              patientLabs.map(({ patient, parsedLabs }) => {
                if (parsedLabs.labs.length === 0) return null;

                const abnormalLabs = parsedLabs.labs.filter(lab => {
                  const { status } = getLabStatus(lab);
                  return status !== 'normal';
                });

                const criticalLabs = abnormalLabs.filter(lab => {
                  const { status } = getLabStatus(lab);
                  return status.includes('critical');
                });

                return (
                  <Collapsible
                    key={patient.id}
                    open={expandedPatient === patient.id}
                    onOpenChange={(open) => setExpandedPatient(open ? patient.id : null)}
                  >
                    <Card className={cn(
                      "transition-all",
                      criticalLabs.length > 0 && "border-red-300 bg-red-50/30"
                    )}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="py-3 cursor-pointer hover:bg-secondary/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div>
                                <CardTitle className="text-sm">{patient.name || 'Unnamed Patient'}</CardTitle>
                                <p className="text-xs text-muted-foreground">{patient.bed || 'No bed'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {criticalLabs.length > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {criticalLabs.length} Critical
                                </Badge>
                              )}
                              {abnormalLabs.length > 0 && abnormalLabs.length !== criticalLabs.length && (
                                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                                  {abnormalLabs.length - criticalLabs.length} Abnormal
                                </Badge>
                              )}
                              {expandedPatient === patient.id ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          {/* Critical labs first */}
                          {criticalLabs.length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Critical Values
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                {criticalLabs.map(lab => (
                                  <LabCard key={lab.key} lab={lab} expanded />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* All labs grid */}
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">All Labs</h4>
                            <div className="grid grid-cols-3 gap-2">
                              {parsedLabs.labs.map(lab => (
                                <LabCard key={lab.key} lab={lab} />
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Compact version for patient card header
interface LabTrendBadgeProps {
  labText: string;
  className?: string;
}

export function LabTrendBadge({ labText, className }: LabTrendBadgeProps) {
  const { labs } = parseLabsFromText(labText);

  if (labs.length === 0) return null;

  const criticalLabs = labs.filter(lab => {
    const { status } = getLabStatus(lab);
    return status.includes('critical');
  });

  const abnormalLabs = labs.filter(lab => {
    const { status } = getLabStatus(lab);
    return status !== 'normal' && !status.includes('critical');
  });

  if (criticalLabs.length === 0 && abnormalLabs.length === 0) {
    return (
      <Badge variant="outline" className={cn("text-green-600 border-green-300", className)}>
        Labs WNL
      </Badge>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {criticalLabs.length > 0 && (
        <Badge variant="destructive" className="text-xs gap-1">
          <AlertTriangle className="h-3 w-3" />
          {criticalLabs.length}
        </Badge>
      )}
      {abnormalLabs.length > 0 && (
        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
          {abnormalLabs.length} abnl
        </Badge>
      )}
    </div>
  );
}

export default LabTrendingPanel;
