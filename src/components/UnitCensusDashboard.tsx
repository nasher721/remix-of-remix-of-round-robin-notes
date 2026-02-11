import * as React from "react";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  BedDouble,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  ChevronRight,
  RefreshCcw,
  Filter,
  Grid3X3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AcuitySummary, AcuityIndicator } from "./PatientAcuityBadge";
import { LabTrendBadge } from "./LabTrendingPanel";
import { ProtocolBadge } from "./SmartProtocolSuggestions";
import { calculatePatientAcuity } from "@/types/riskScores";
import type { Patient } from "@/types/patient";

interface UnitMetrics {
  totalPatients: number;
  criticalPatients: number;
  onVentilator: number;
  onPressors: number;
  abnormalLabs: number;
  pendingDischarge: number;
  newAdmissions: number;
}

interface PatientSummaryCard {
  patient: Patient;
  acuityLevel: number;
  hasAbnormalLabs: boolean;
  hasActiveProtocols: boolean;
  isOnVentilator: boolean;
  isOnPressors: boolean;
}

// Calculate unit metrics from patient list
const calculateUnitMetrics = (patients: Patient[]): UnitMetrics => {
  let criticalPatients = 0;
  let onVentilator = 0;
  let onPressors = 0;
  let abnormalLabs = 0;
  let pendingDischarge = 0;
  let newAdmissions = 0;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  patients.forEach(patient => {
    const allText = `${patient.clinicalSummary} ${patient.intervalEvents} ${Object.values(patient.systems).join(' ')}`.toLowerCase();

    // Check acuity
    const acuity = calculatePatientAcuity(patient.labs, patient.systems, patient.clinicalSummary);
    if (acuity.level >= 4) criticalPatients++;

    // Check ventilator status
    if (allText.includes('intubated') || allText.includes('ventilator') || allText.includes('on vent')) {
      onVentilator++;
    }

    // Check pressor status
    if (allText.includes('pressor') || allText.includes('vasopressor') || allText.includes('levophed') || allText.includes('norepinephrine')) {
      onPressors++;
    }

    // Check labs (simplified)
    if (patient.labs) {
      const labText = patient.labs.toLowerCase();
      // Look for critical lab patterns
      if (labText.match(/k[:\s]*(2\.\d|6\.[5-9]|[7-9])/i) ||
          labText.match(/na[:\s]*(1[0-2]\d|1[6-9]\d)/i) ||
          labText.match(/cr[:\s]*[5-9]/i)) {
        abnormalLabs++;
      }
    }

    // Check disposition
    if (patient.systems.dispo?.toLowerCase().includes('discharge') ||
        patient.systems.dispo?.toLowerCase().includes('home')) {
      pendingDischarge++;
    }

    // Check for new admissions (within 24h)
    const createdAt = new Date(patient.createdAt);
    if (createdAt > twentyFourHoursAgo) {
      newAdmissions++;
    }
  });

  return {
    totalPatients: patients.length,
    criticalPatients,
    onVentilator,
    onPressors,
    abnormalLabs,
    pendingDischarge,
    newAdmissions,
  };
};

// Create patient summary cards
const createPatientSummaries = (patients: Patient[]): PatientSummaryCard[] => {
  return patients.map(patient => {
    const allText = `${patient.clinicalSummary} ${patient.intervalEvents} ${Object.values(patient.systems).join(' ')}`.toLowerCase();
    const acuity = calculatePatientAcuity(patient.labs, patient.systems, patient.clinicalSummary);

    return {
      patient,
      acuityLevel: acuity.level,
      hasAbnormalLabs: patient.labs?.length > 0,
      hasActiveProtocols: allText.includes('sepsis') || allText.includes('intubated') || allText.includes('aki'),
      isOnVentilator: allText.includes('intubated') || allText.includes('ventilator') || allText.includes('on vent'),
      isOnPressors: allText.includes('pressor') || allText.includes('vasopressor') || allText.includes('levophed'),
    };
  }).sort((a, b) => b.acuityLevel - a.acuityLevel); // Sort by acuity (highest first)
};

interface UnitCensusDashboardProps {
  patients: Patient[];
  onPatientSelect?: (patient: Patient) => void;
  className?: string;
}

export function UnitCensusDashboard({
  patients,
  onPatientSelect,
  className,
}: UnitCensusDashboardProps) {
  const [sortBy, setSortBy] = React.useState<'acuity' | 'room' | 'name'>('acuity');
  const [filterCritical, setFilterCritical] = React.useState(false);

  const metrics = React.useMemo(() => calculateUnitMetrics(patients), [patients]);
  const patientSummaries = React.useMemo(() => {
    let summaries = createPatientSummaries(patients);

    if (filterCritical) {
      summaries = summaries.filter(s => s.acuityLevel >= 4);
    }

    // Sort
    switch (sortBy) {
      case 'room':
        summaries.sort((a, b) => a.patient.bed.localeCompare(b.patient.bed));
        break;
      case 'name':
        summaries.sort((a, b) => a.patient.name.localeCompare(b.patient.name));
        break;
      default: // acuity
        summaries.sort((a, b) => b.acuityLevel - a.acuityLevel);
    }

    return summaries;
  }, [patients, sortBy, filterCritical]);

  const acuityColors = {
    1: 'bg-green-500',
    2: 'bg-blue-500',
    3: 'bg-amber-500',
    4: 'bg-orange-500',
    5: 'bg-red-500',
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2 h-8 relative", className)}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Census</span>
          {metrics.criticalPatients > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
            >
              {metrics.criticalPatients}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[640px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Unit Census Dashboard
            <Badge variant="outline" className="ml-2">
              {metrics.totalPatients} patients
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          <div className="space-y-6 pr-4">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className={cn(
                "transition-all",
                metrics.criticalPatients > 0 && "border-red-200 bg-red-50/50"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={cn(
                      "h-4 w-4",
                      metrics.criticalPatients > 0 ? "text-red-600" : "text-muted-foreground"
                    )} />
                    <span className="text-xs text-muted-foreground">Critical</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{metrics.criticalPatients}</p>
                </CardContent>
              </Card>

              <Card className={cn(
                "transition-all",
                metrics.onVentilator > 0 && "border-blue-200 bg-blue-50/50"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">On Vent</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{metrics.onVentilator}</p>
                </CardContent>
              </Card>

              <Card className={cn(
                "transition-all",
                metrics.onPressors > 0 && "border-purple-200 bg-purple-50/50"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-muted-foreground">Pressors</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{metrics.onPressors}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-muted-foreground">Discharge</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{metrics.pendingDischarge}</p>
                </CardContent>
              </Card>
            </div>

            {/* Acuity Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Acuity Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AcuitySummary patients={patients} />
              </CardContent>
            </Card>

            {/* Unit Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-secondary/30 rounded-lg text-center">
                <Clock className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-lg font-bold mt-1">{metrics.newAdmissions}</p>
                <p className="text-[10px] text-muted-foreground">New (24h)</p>
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg text-center">
                <Droplets className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-lg font-bold mt-1">{metrics.abnormalLabs}</p>
                <p className="text-[10px] text-muted-foreground">Abnl Labs</p>
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg text-center">
                <BedDouble className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-lg font-bold mt-1">{metrics.totalPatients}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>

            {/* Patient List Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Patient Overview</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant={filterCritical ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilterCritical(!filterCritical)}
                >
                  <Filter className="h-3 w-3 mr-1" />
                  Critical Only
                </Button>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acuity">Acuity</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Patient Grid */}
            <div className="grid grid-cols-1 gap-2">
              {patientSummaries.map(({ patient, acuityLevel, isOnVentilator, isOnPressors }) => (
                <Card
                  key={patient.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    acuityLevel >= 4 && "border-l-4 border-l-red-500",
                    acuityLevel === 3 && "border-l-4 border-l-amber-500"
                  )}
                  onClick={() => onPatientSelect?.(patient)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Acuity indicator */}
                      <div className={cn(
                        "w-3 h-3 rounded-full flex-shrink-0",
                        acuityColors[acuityLevel as keyof typeof acuityColors],
                        acuityLevel >= 4 && "animate-pulse"
                      )} />

                      {/* Patient info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {patient.name || 'Unnamed'}
                          </span>
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">
                            {patient.bed || 'No bed'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {patient.clinicalSummary?.slice(0, 60) || 'No summary'}...
                        </p>
                      </div>

                      {/* Status indicators */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isOnVentilator && (
                          <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700">
                            <Wind className="h-3 w-3" />
                          </Badge>
                        )}
                        {isOnPressors && (
                          <Badge variant="outline" className="text-[10px] bg-purple-50 border-purple-200 text-purple-700">
                            <Heart className="h-3 w-3" />
                          </Badge>
                        )}
                        <LabTrendBadge labText={patient.labs} />
                        <ProtocolBadge patient={patient} />
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {patientSummaries.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>{filterCritical ? 'No critical patients' : 'No patients on unit'}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-secondary/30 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Compact census badge for header
interface CensusBadgeProps {
  patients: Patient[];
  className?: string;
}

export function CensusBadge({ patients, className }: CensusBadgeProps) {
  const metrics = React.useMemo(() => calculateUnitMetrics(patients), [patients]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant="outline" className="gap-1">
        <Users className="h-3 w-3" />
        {metrics.totalPatients}
      </Badge>
      {metrics.criticalPatients > 0 && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {metrics.criticalPatients}
        </Badge>
      )}
      {metrics.onVentilator > 0 && (
        <Badge variant="outline" className="text-blue-600 border-blue-300 gap-1">
          <Wind className="h-3 w-3" />
          {metrics.onVentilator}
        </Badge>
      )}
    </div>
  );
}

export default UnitCensusDashboard;
