import * as React from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Activity,
  Heart,
  Thermometer,
  Info,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { calculatePatientAcuity, type PatientAcuity } from "@/types/riskScores";
import type { Patient } from "@/types/patient";

interface PatientAcuityBadgeProps {
  patient: Patient;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

const AcuityIcon = ({ level }: { level: number }) => {
  switch (level) {
    case 1:
      return <CheckCircle className="h-3 w-3" />;
    case 2:
      return <Info className="h-3 w-3" />;
    case 3:
      return <AlertCircle className="h-3 w-3" />;
    case 4:
      return <AlertTriangle className="h-3 w-3" />;
    case 5:
      return <AlertTriangle className="h-3 w-3 animate-pulse" />;
    default:
      return <Activity className="h-3 w-3" />;
  }
};

const AcuityBar = ({ level, className }: { level: number; className?: string }) => {
  return (
    <div className={cn("flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-2 rounded-full transition-all",
            i <= level
              ? level === 1
                ? "bg-green-500"
                : level === 2
                ? "bg-blue-500"
                : level === 3
                ? "bg-amber-500"
                : level === 4
                ? "bg-orange-500"
                : "bg-red-500"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );
};

export function PatientAcuityBadge({
  patient,
  size = 'sm',
  showDetails = false,
  className,
}: PatientAcuityBadgeProps) {
  const acuity = React.useMemo(() => {
    return calculatePatientAcuity(
      patient.labs,
      patient.systems,
      patient.clinicalSummary
    );
  }, [patient.labs, patient.systems, patient.clinicalSummary]);

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 transition-all cursor-pointer",
        acuity.color,
        acuity.bgColor,
        acuity.borderColor,
        size === 'sm' && "text-[10px] px-1.5 py-0",
        size === 'md' && "text-xs px-2 py-0.5",
        size === 'lg' && "text-sm px-2.5 py-1",
        acuity.level === 5 && "animate-pulse",
        className
      )}
    >
      <AcuityIcon level={acuity.level} />
      {size !== 'sm' && <span>{acuity.label}</span>}
      {size === 'sm' && <span>{acuity.level}</span>}
    </Badge>
  );

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AcuityBar level={acuity.level} />
                <span className="font-semibold">{acuity.label}</span>
              </div>
              {acuity.factors.length > 0 && (
                <ul className="text-xs space-y-0.5">
                  {acuity.factors.slice(0, 3).map((factor, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {factor}
                    </li>
                  ))}
                  {acuity.factors.length > 3 && (
                    <li className="text-muted-foreground">+{acuity.factors.length - 3} more</li>
                  )}
                </ul>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-0">
          {badgeContent}
          <ChevronDown className="h-3 w-3 ml-1 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Patient Acuity</h4>
            <AcuityBar level={acuity.level} />
          </div>

          <div className={cn(
            "p-3 rounded-lg border",
            acuity.bgColor,
            acuity.borderColor
          )}>
            <div className="flex items-center gap-2">
              <AcuityIcon level={acuity.level} />
              <span className={cn("font-semibold", acuity.color)}>
                Level {acuity.level}: {acuity.label}
              </span>
            </div>
          </div>

          {acuity.factors.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground mb-2">Contributing Factors</h5>
              <ul className="space-y-1.5">
                {acuity.factors.map((factor, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      acuity.level >= 4 ? "bg-red-500" :
                      acuity.level >= 3 ? "bg-amber-500" :
                      "bg-blue-500"
                    )} />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {acuity.calculatedScores.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground mb-2">Risk Scores</h5>
              <div className="space-y-2">
                {acuity.calculatedScores.map(({ scoreType, result }) => (
                  <div key={scoreType} className="flex items-center justify-between text-sm">
                    <span className="uppercase text-xs font-mono">{scoreType}</span>
                    <Badge variant="outline" className={cn("text-xs", result.color)}>
                      {result.score}/{result.maxScore}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Compact acuity indicator for lists
interface AcuityIndicatorProps {
  patient: Patient;
  className?: string;
}

export function AcuityIndicator({ patient, className }: AcuityIndicatorProps) {
  const acuity = React.useMemo(() => {
    return calculatePatientAcuity(
      patient.labs,
      patient.systems,
      patient.clinicalSummary
    );
  }, [patient.labs, patient.systems, patient.clinicalSummary]);

  const colorMap = {
    1: 'bg-green-500',
    2: 'bg-blue-500',
    3: 'bg-amber-500',
    4: 'bg-orange-500',
    5: 'bg-red-500',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              colorMap[acuity.level],
              acuity.level === 5 && "animate-pulse",
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <span>{acuity.label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Acuity summary for unit overview
interface AcuitySummaryProps {
  patients: Patient[];
  className?: string;
}

export function AcuitySummary({ patients, className }: AcuitySummaryProps) {
  const acuityDistribution = React.useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    patients.forEach(patient => {
      const acuity = calculatePatientAcuity(
        patient.labs,
        patient.systems,
        patient.clinicalSummary
      );
      dist[acuity.level]++;
    });
    return dist;
  }, [patients]);

  const total = patients.length;

  const labels = {
    1: 'Stable',
    2: 'Guarded',
    3: 'Moderate',
    4: 'Serious',
    5: 'Critical',
  };

  const colors = {
    1: 'bg-green-500',
    2: 'bg-blue-500',
    3: 'bg-amber-500',
    4: 'bg-orange-500',
    5: 'bg-red-500',
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
        {([5, 4, 3, 2, 1] as const).map((level) => {
          const count = acuityDistribution[level];
          const percentage = total > 0 ? (count / total) * 100 : 0;
          if (percentage === 0) return null;
          return (
            <TooltipProvider key={level}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn("transition-all", colors[level])}
                    style={{ width: `${percentage}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {labels[level]}: {count} ({percentage.toFixed(0)}%)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {([5, 4, 3, 2, 1] as const).map((level) => {
          const count = acuityDistribution[level];
          if (count === 0) return null;
          return (
            <div key={level} className="flex items-center gap-1">
              <div className={cn("w-2 h-2 rounded-full", colors[level])} />
              <span className="text-muted-foreground">{labels[level]}:</span>
              <span className="font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PatientAcuityBadge;
