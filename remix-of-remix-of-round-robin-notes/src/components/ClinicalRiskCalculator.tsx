import * as React from "react";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Info,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  calculateSOFA,
  calculateQSOFA,
  calculateCURB65,
  calculateWellsDVT,
  calculateWellsPE,
  calculateNEWS2,
  calculateApache2,
  type SOFAInputs,
  type QSOFAInputs,
  type CURB65Inputs,
  type WellsDVTInputs,
  type WellsPEInputs,
  type NEWS2Inputs,
  type Apache2Inputs,
  type RiskScoreResult,
} from "@/types/riskScores";

interface ClinicalRiskCalculatorProps {
  className?: string;
  patientLabs?: string;
  patientSummary?: string;
}

type ScoreTab = 'qsofa' | 'sofa' | 'curb65' | 'wells_dvt' | 'wells_pe' | 'news2' | 'apache2';

const RiskLevelIcon = ({ level }: { level: string }) => {
  switch (level) {
    case 'low':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'moderate':
      return <AlertCircle className="h-4 w-4 text-amber-600" />;
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default:
      return <Info className="h-4 w-4 text-blue-600" />;
  }
};

const ScoreDisplay = ({ result, title }: { result: RiskScoreResult | null; title: string }) => {
  if (!result) return null;

  const bgColor = result.riskLevel === 'low' ? 'bg-green-50 border-green-200' :
    result.riskLevel === 'moderate' ? 'bg-amber-50 border-amber-200' :
    result.riskLevel === 'high' ? 'bg-orange-50 border-orange-200' :
    'bg-red-50 border-red-200';

  return (
    <div className={cn("p-4 rounded-lg border-2 transition-all", bgColor)}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">{title}</h4>
        <div className="flex items-center gap-2">
          <RiskLevelIcon level={result.riskLevel} />
          <Badge className={cn(
            "capitalize",
            result.riskLevel === 'low' && "bg-green-100 text-green-800",
            result.riskLevel === 'moderate' && "bg-amber-100 text-amber-800",
            result.riskLevel === 'high' && "bg-orange-100 text-orange-800",
            result.riskLevel === 'critical' && "bg-red-100 text-red-800"
          )}>
            {result.riskLevel}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="text-3xl font-bold">{result.score}</div>
        <div className="text-sm text-muted-foreground">/ {result.maxScore} points</div>
      </div>
      <p className={cn("text-sm font-medium mb-2", result.color)}>{result.interpretation}</p>
      {result.recommendation && (
        <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded">{result.recommendation}</p>
      )}
    </div>
  );
};

// qSOFA Calculator
const QSOFACalculator = () => {
  const [inputs, setInputs] = React.useState<QSOFAInputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);

  const calculate = () => {
    setResult(calculateQSOFA(inputs));
  };

  React.useEffect(() => {
    if (inputs.respiratoryRate !== undefined || inputs.systolicBP !== undefined || inputs.alteredMentation !== undefined) {
      calculate();
    }
  }, [inputs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label>Respiratory Rate (breaths/min)</Label>
          <Input
            type="number"
            placeholder="22"
            value={inputs.respiratoryRate ?? ''}
            onChange={(e) => setInputs({ ...inputs, respiratoryRate: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
          <p className="text-xs text-muted-foreground">+1 if &ge;22 breaths/min</p>
        </div>
        <div className="space-y-2">
          <Label>Systolic Blood Pressure (mmHg)</Label>
          <Input
            type="number"
            placeholder="100"
            value={inputs.systolicBP ?? ''}
            onChange={(e) => setInputs({ ...inputs, systolicBP: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
          <p className="text-xs text-muted-foreground">+1 if &le;100 mmHg</p>
        </div>
        <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
          <div>
            <Label>Altered Mentation</Label>
            <p className="text-xs text-muted-foreground">GCS &lt; 15 or confusion</p>
          </div>
          <Switch
            checked={inputs.alteredMentation ?? false}
            onCheckedChange={(checked) => setInputs({ ...inputs, alteredMentation: checked })}
          />
        </div>
      </div>
      <ScoreDisplay result={result} title="qSOFA Score" />
    </div>
  );
};

// CURB-65 Calculator
const CURB65Calculator = () => {
  const [inputs, setInputs] = React.useState<CURB65Inputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);

  React.useEffect(() => {
    const hasInput = Object.values(inputs).some(v => v !== undefined);
    if (hasInput) {
      setResult(calculateCURB65(inputs));
    }
  }, [inputs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
          <div>
            <Label>Confusion</Label>
            <p className="text-xs text-muted-foreground">New disorientation</p>
          </div>
          <Switch
            checked={inputs.confusion ?? false}
            onCheckedChange={(checked) => setInputs({ ...inputs, confusion: checked })}
          />
        </div>
        <div className="space-y-2">
          <Label>BUN (mg/dL)</Label>
          <Input
            type="number"
            placeholder="20"
            value={inputs.bun ?? ''}
            onChange={(e) => setInputs({ ...inputs, bun: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
          <p className="text-xs text-muted-foreground">+1 if &gt;19 mg/dL (or urea &gt;7 mmol/L)</p>
        </div>
        <div className="space-y-2">
          <Label>Respiratory Rate</Label>
          <Input
            type="number"
            placeholder="30"
            value={inputs.respiratoryRate ?? ''}
            onChange={(e) => setInputs({ ...inputs, respiratoryRate: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
          <p className="text-xs text-muted-foreground">+1 if &ge;30 breaths/min</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Systolic BP</Label>
            <Input
              type="number"
              placeholder="90"
              value={inputs.systolicBP ?? ''}
              onChange={(e) => setInputs({ ...inputs, systolicBP: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label>Diastolic BP</Label>
            <Input
              type="number"
              placeholder="60"
              value={inputs.diastolicBP ?? ''}
              onChange={(e) => setInputs({ ...inputs, diastolicBP: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">+1 if SBP &lt;90 or DBP &le;60 mmHg</p>
        <div className="space-y-2">
          <Label>Age (years)</Label>
          <Input
            type="number"
            placeholder="65"
            value={inputs.age ?? ''}
            onChange={(e) => setInputs({ ...inputs, age: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
          <p className="text-xs text-muted-foreground">+1 if &ge;65 years</p>
        </div>
      </div>
      <ScoreDisplay result={result} title="CURB-65 Score" />
    </div>
  );
};

// Wells DVT Calculator
const WellsDVTCalculator = () => {
  const [inputs, setInputs] = React.useState<WellsDVTInputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);

  React.useEffect(() => {
    const hasInput = Object.values(inputs).some(v => v === true);
    if (hasInput) {
      setResult(calculateWellsDVT(inputs));
    }
  }, [inputs]);

  const criteria = [
    { key: 'activeCancer', label: 'Active cancer', points: '+1', field: 'activeCancer' },
    { key: 'paralysisParesis', label: 'Paralysis/paresis/immobilization of legs', points: '+1', field: 'paralysisParesis' },
    { key: 'recentImmobilization', label: 'Bedridden >3 days or major surgery <12 weeks', points: '+1', field: 'recentImmobilization' },
    { key: 'localizedTenderness', label: 'Localized tenderness along deep venous system', points: '+1', field: 'localizedTenderness' },
    { key: 'entireLegSwollen', label: 'Entire leg swollen', points: '+1', field: 'entireLegSwollen' },
    { key: 'calfSwelling3cm', label: 'Calf swelling >3cm vs asymptomatic leg', points: '+1', field: 'calfSwelling3cm' },
    { key: 'pittingEdema', label: 'Pitting edema in symptomatic leg', points: '+1', field: 'pittingEdema' },
    { key: 'collateralVeins', label: 'Collateral superficial veins (non-varicose)', points: '+1', field: 'collateralVeins' },
    { key: 'previousDVT', label: 'Previous documented DVT', points: '+1', field: 'previousDVT' },
    { key: 'alternativeDiagnosisLikely', label: 'Alternative diagnosis as likely or more likely', points: '-2', field: 'alternativeDiagnosisLikely' },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {criteria.map((c) => (
          <div key={c.key} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors">
            <div className="flex-1">
              <span className="text-sm">{c.label}</span>
              <span className={cn("ml-2 text-xs font-mono", c.points === '-2' ? 'text-green-600' : 'text-blue-600')}>({c.points})</span>
            </div>
            <Switch
              checked={inputs[c.field as keyof WellsDVTInputs] ?? false}
              onCheckedChange={(checked) => setInputs({ ...inputs, [c.field]: checked })}
            />
          </div>
        ))}
      </div>
      <ScoreDisplay result={result} title="Wells DVT Score" />
    </div>
  );
};

// Wells PE Calculator
const WellsPECalculator = () => {
  const [inputs, setInputs] = React.useState<WellsPEInputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);

  React.useEffect(() => {
    const hasInput = Object.values(inputs).some(v => v === true);
    if (hasInput) {
      setResult(calculateWellsPE(inputs));
    }
  }, [inputs]);

  const criteria = [
    { key: 'clinicalDVTSigns', label: 'Clinical signs/symptoms of DVT', points: '+3', field: 'clinicalDVTSigns' },
    { key: 'alternativeDiagnosisLessLikely', label: 'PE is #1 diagnosis or equally likely', points: '+3', field: 'alternativeDiagnosisLessLikely' },
    { key: 'heartRate100', label: 'Heart rate >100 bpm', points: '+1.5', field: 'heartRate100' },
    { key: 'immobilizationOrSurgery', label: 'Immobilization or surgery in past 4 weeks', points: '+1.5', field: 'immobilizationOrSurgery' },
    { key: 'previousPEOrDVT', label: 'Previous PE or DVT', points: '+1.5', field: 'previousPEOrDVT' },
    { key: 'hemoptysis', label: 'Hemoptysis', points: '+1', field: 'hemoptysis' },
    { key: 'malignancy', label: 'Malignancy (treatment in last 6 months or palliative)', points: '+1', field: 'malignancy' },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {criteria.map((c) => (
          <div key={c.key} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors">
            <div className="flex-1">
              <span className="text-sm">{c.label}</span>
              <span className="ml-2 text-xs font-mono text-blue-600">({c.points})</span>
            </div>
            <Switch
              checked={inputs[c.field as keyof WellsPEInputs] ?? false}
              onCheckedChange={(checked) => setInputs({ ...inputs, [c.field]: checked })}
            />
          </div>
        ))}
      </div>
      <ScoreDisplay result={result} title="Wells PE Score" />
    </div>
  );
};

// NEWS2 Calculator
const NEWS2Calculator = () => {
  const [inputs, setInputs] = React.useState<NEWS2Inputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);

  React.useEffect(() => {
    const hasInput = Object.values(inputs).some(v => v !== undefined);
    if (hasInput) {
      setResult(calculateNEWS2(inputs));
    }
  }, [inputs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Resp Rate</Label>
          <Input
            type="number"
            placeholder="16"
            value={inputs.respiratoryRate ?? ''}
            onChange={(e) => setInputs({ ...inputs, respiratoryRate: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label>SpO2 (%)</Label>
          <Input
            type="number"
            placeholder="97"
            value={inputs.spo2 ?? ''}
            onChange={(e) => setInputs({ ...inputs, spo2: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label>Temperature</Label>
          <Input
            type="number"
            step="0.1"
            placeholder="37.0"
            value={inputs.temperature ?? ''}
            onChange={(e) => setInputs({ ...inputs, temperature: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label>Systolic BP</Label>
          <Input
            type="number"
            placeholder="120"
            value={inputs.systolicBP ?? ''}
            onChange={(e) => setInputs({ ...inputs, systolicBP: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label>Heart Rate</Label>
          <Input
            type="number"
            placeholder="80"
            value={inputs.heartRate ?? ''}
            onChange={(e) => setInputs({ ...inputs, heartRate: e.target.value ? parseFloat(e.target.value) : undefined })}
          />
        </div>
        <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
          <Switch
            checked={inputs.onSupplementalO2 ?? false}
            onCheckedChange={(checked) => setInputs({ ...inputs, onSupplementalO2: checked })}
          />
          <Label className="text-sm">On O2</Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Consciousness</Label>
        <div className="flex flex-wrap gap-2">
          {(['alert', 'confusion', 'voice', 'pain', 'unresponsive'] as const).map((level) => (
            <Button
              key={level}
              variant={inputs.consciousness === level ? "default" : "outline"}
              size="sm"
              onClick={() => setInputs({ ...inputs, consciousness: level })}
              className="capitalize"
            >
              {level === 'alert' ? 'Alert' : level.charAt(0).toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
      <ScoreDisplay result={result} title="NEWS2 Score" />
    </div>
  );
};

// SOFA Calculator (more complex)
const SOFACalculator = () => {
  const [inputs, setInputs] = React.useState<SOFAInputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['respiration']);

  React.useEffect(() => {
    const hasInput = Object.values(inputs).some(v => v !== undefined && v !== false);
    if (hasInput) {
      setResult(calculateSOFA(inputs));
    }
  }, [inputs]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  return (
    <div className="space-y-4">
      {/* Respiration */}
      <Collapsible open={expandedSections.includes('respiration')} onOpenChange={() => toggleSection('respiration')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Respiration</span>
            {expandedSections.includes('respiration') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 space-y-3">
          <div className="space-y-2">
            <Label>PaO2/FiO2 Ratio</Label>
            <Input
              type="number"
              placeholder="400"
              value={inputs.pao2fio2 ?? ''}
              onChange={(e) => setInputs({ ...inputs, pao2fio2: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={inputs.onVentilator ?? false}
              onCheckedChange={(checked) => setInputs({ ...inputs, onVentilator: checked })}
            />
            <Label>On mechanical ventilation</Label>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Coagulation */}
      <Collapsible open={expandedSections.includes('coagulation')} onOpenChange={() => toggleSection('coagulation')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Coagulation</span>
            {expandedSections.includes('coagulation') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3">
          <div className="space-y-2">
            <Label>Platelets (x10^3/uL)</Label>
            <Input
              type="number"
              placeholder="150"
              value={inputs.platelets ?? ''}
              onChange={(e) => setInputs({ ...inputs, platelets: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Liver */}
      <Collapsible open={expandedSections.includes('liver')} onOpenChange={() => toggleSection('liver')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Liver</span>
            {expandedSections.includes('liver') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3">
          <div className="space-y-2">
            <Label>Bilirubin (mg/dL)</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="1.0"
              value={inputs.bilirubin ?? ''}
              onChange={(e) => setInputs({ ...inputs, bilirubin: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Cardiovascular */}
      <Collapsible open={expandedSections.includes('cardiovascular')} onOpenChange={() => toggleSection('cardiovascular')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Cardiovascular</span>
            {expandedSections.includes('cardiovascular') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 space-y-3">
          <div className="space-y-2">
            <Label>MAP (mmHg)</Label>
            <Input
              type="number"
              placeholder="70"
              value={inputs.map ?? ''}
              onChange={(e) => setInputs({ ...inputs, map: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Dopamine (mcg/kg/min)</Label>
              <Input
                type="number"
                step="0.1"
                value={inputs.dopamine ?? ''}
                onChange={(e) => setInputs({ ...inputs, dopamine: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>Norepinephrine (mcg/kg/min)</Label>
              <Input
                type="number"
                step="0.01"
                value={inputs.norepinephrine ?? ''}
                onChange={(e) => setInputs({ ...inputs, norepinephrine: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* CNS */}
      <Collapsible open={expandedSections.includes('cns')} onOpenChange={() => toggleSection('cns')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">CNS</span>
            {expandedSections.includes('cns') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3">
          <div className="space-y-2">
            <Label>Glasgow Coma Scale (3-15)</Label>
            <Input
              type="number"
              min={3}
              max={15}
              placeholder="15"
              value={inputs.gcs ?? ''}
              onChange={(e) => setInputs({ ...inputs, gcs: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Renal */}
      <Collapsible open={expandedSections.includes('renal')} onOpenChange={() => toggleSection('renal')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Renal</span>
            {expandedSections.includes('renal') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 space-y-3">
          <div className="space-y-2">
            <Label>Creatinine (mg/dL)</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="1.0"
              value={inputs.creatinine ?? ''}
              onChange={(e) => setInputs({ ...inputs, creatinine: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label>Urine Output (mL/day)</Label>
            <Input
              type="number"
              placeholder="1500"
              value={inputs.urineOutput ?? ''}
              onChange={(e) => setInputs({ ...inputs, urineOutput: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ScoreDisplay result={result} title="SOFA Score" />
    </div>
  );
};

// APACHE II Calculator
const Apache2Calculator = () => {
  const [inputs, setInputs] = React.useState<Apache2Inputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['age', 'vitals']);

  React.useEffect(() => {
    const hasInput = Object.values(inputs).some(v => v !== undefined && v !== false);
    if (hasInput) {
      setResult(calculateApache2(inputs));
    }
  }, [inputs]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  return (
    <div className="space-y-4">
      {/* Age */}
      <Collapsible open={expandedSections.includes('age')} onOpenChange={() => toggleSection('age')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Age Points</span>
            {expandedSections.includes('age') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3">
          <div className="space-y-2">
            <Label>Age (years)</Label>
            <Input
              type="number"
              min={0}
              max={150}
              placeholder="45"
              value={inputs.age ?? ''}
              onChange={(e) => setInputs({ ...inputs, age: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>&lt;45: 0 pts | 45-54: 2 pts</div>
              <div>55-64: 3 pts | 65-74: 5 pts | &ge;75: 6 pts</div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Chronic Health */}
      <Collapsible open={expandedSections.includes('chronic')} onOpenChange={() => toggleSection('chronic')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Chronic Health</span>
            {expandedSections.includes('chronic') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 space-y-3">
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
            <div>
              <Label>Severe organ insufficiency</Label>
              <p className="text-xs text-muted-foreground">Cirrhosis, NYHA class IV heart failure, severe COPD</p>
            </div>
            <Switch
              checked={inputs.chronicHealth?.severeOrganInsufficiency ?? false}
              onCheckedChange={(checked) => setInputs({
                ...inputs,
                chronicHealth: { ...inputs.chronicHealth, severeOrganInsufficiency: checked }
              })}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
            <div>
              <Label>Immunocompromised</Label>
              <p className="text-xs text-muted-foreground">Chemotherapy, radiation, high-dose steroids</p>
            </div>
            <Switch
              checked={inputs.chronicHealth?.immunocompromised ?? false}
              onCheckedChange={(checked) => setInputs({
                ...inputs,
                chronicHealth: { ...inputs.chronicHealth, immunocompromised: checked }
              })}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
            <div>
              <Label>Postoperative admission</Label>
              <p className="text-xs text-muted-foreground">Admitted after surgery</p>
            </div>
            <Switch
              checked={inputs.chronicHealth?.postoperative ?? false}
              onCheckedChange={(checked) => setInputs({
                ...inputs,
                chronicHealth: { ...inputs.chronicHealth, postoperative: checked }
              })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Vitals */}
      <Collapsible open={expandedSections.includes('vitals')} onOpenChange={() => toggleSection('vitals')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Vitals</span>
            {expandedSections.includes('vitals') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Temperature (°C)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="37.0"
                value={inputs.temperature ?? ''}
                onChange={(e) => setInputs({ ...inputs, temperature: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>MAP (mmHg)</Label>
              <Input
                type="number"
                placeholder="90"
                value={inputs.map ?? ''}
                onChange={(e) => setInputs({ ...inputs, map: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Heart Rate</Label>
              <Input
                type="number"
                placeholder="80"
                value={inputs.heartRate ?? ''}
                onChange={(e) => setInputs({ ...inputs, heartRate: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>Resp Rate</Label>
              <Input
                type="number"
                placeholder="16"
                value={inputs.respiratoryRate ?? ''}
                onChange={(e) => setInputs({ ...inputs, respiratoryRate: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>PaCO2 (mmHg)</Label>
              <Input
                type="number"
                placeholder="40"
                value={inputs.paco2 ?? ''}
                onChange={(e) => setInputs({ ...inputs, paco2: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>Arterial pH</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="7.40"
                value={inputs.arterialPh ?? ''}
                onChange={(e) => setInputs({ ...inputs, arterialPh: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Respiratory / Oxygenation */}
      <Collapsible open={expandedSections.includes('oxygenation')} onOpenChange={() => toggleSection('oxygenation')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Oxygenation</span>
            {expandedSections.includes('oxygenation') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>PaO2 (mmHg)</Label>
              <Input
                type="number"
                placeholder="100"
                value={inputs.pao2 ?? ''}
                onChange={(e) => setInputs({ ...inputs, pao2: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>FiO2 (0.21-1.0)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.21"
                max="1.0"
                placeholder="0.21"
                value={inputs.fio2 ?? ''}
                onChange={(e) => setInputs({ ...inputs, fio2: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Labs */}
      <Collapsible open={expandedSections.includes('labs')} onOpenChange={() => toggleSection('labs')}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30">
            <span className="font-medium">Laboratory Values</span>
            {expandedSections.includes('labs') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Na+ (mEq/L)</Label>
              <Input
                type="number"
                placeholder="140"
                value={inputs.serumSodium ?? ''}
                onChange={(e) => setInputs({ ...inputs, serumSodium: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>K+ (mEq/L)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="4.0"
                value={inputs.serumPotassium ?? ''}
                onChange={(e) => setInputs({ ...inputs, serumPotassium: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Creatinine (mg/dL)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="1.0"
                value={inputs.creatinine ?? ''}
                onChange={(e) => setInputs({ ...inputs, creatinine: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>Hematocrit (%)</Label>
              <Input
                type="number"
                placeholder="40"
                value={inputs.hematocrit ?? ''}
                onChange={(e) => setInputs({ ...inputs, hematocrit: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>WBC (x10³/µL)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="8.0"
                value={inputs.wbc ?? ''}
                onChange={(e) => setInputs({ ...inputs, wbc: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>GCS (3-15)</Label>
              <Input
                type="number"
                min={3}
                max={15}
                placeholder="15"
                value={inputs.glasgowComaScale ?? ''}
                onChange={(e) => setInputs({ ...inputs, glasgowComaScale: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
            <Switch
              checked={inputs.acuteRenalFailure ?? false}
              onCheckedChange={(checked) => setInputs({ ...inputs, acuteRenalFailure: checked })}
            />
            <Label className="text-sm">Acute Renal Failure</Label>
            <p className="text-xs text-muted-foreground">(urine output &lt;500 mL/day, BUN &gt;100, or Cr &gt;3.5)</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ScoreDisplay result={result} title="APACHE II Score" />
    </div>
  );
};

export function ClinicalRiskCalculator({ className }: ClinicalRiskCalculatorProps) {
  const [activeTab, setActiveTab] = React.useState<ScoreTab>('qsofa');

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2 h-8", className)}
        >
          <Calculator className="h-4 w-4" />
          <span className="hidden sm:inline">Risk Scores</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[420px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Clinical Risk Calculators
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ScoreTab)}>
            <TabsList className="grid grid-cols-4 lg:grid-cols-7 h-auto gap-1 p-1">
              <TabsTrigger value="qsofa" className="text-xs px-2 py-1.5">qSOFA</TabsTrigger>
              <TabsTrigger value="sofa" className="text-xs px-2 py-1.5">SOFA</TabsTrigger>
              <TabsTrigger value="apache2" className="text-xs px-2 py-1.5">APACHE II</TabsTrigger>
              <TabsTrigger value="curb65" className="text-xs px-2 py-1.5">CURB-65</TabsTrigger>
              <TabsTrigger value="wells_dvt" className="text-xs px-2 py-1.5">Wells DVT</TabsTrigger>
              <TabsTrigger value="wells_pe" className="text-xs px-2 py-1.5">Wells PE</TabsTrigger>
              <TabsTrigger value="news2" className="text-xs px-2 py-1.5">NEWS2</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="qsofa" className="m-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Quick SOFA</CardTitle>
                    <p className="text-xs text-muted-foreground">Rapid bedside sepsis screening</p>
                  </CardHeader>
                  <CardContent>
                    <QSOFACalculator />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sofa" className="m-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">SOFA Score</CardTitle>
                    <p className="text-xs text-muted-foreground">Sequential Organ Failure Assessment</p>
                  </CardHeader>
                  <CardContent>
                    <SOFACalculator />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="apache2" className="m-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">APACHE II Score</CardTitle>
                    <p className="text-xs text-muted-foreground">Acute Physiology and Chronic Health Evaluation II</p>
                  </CardHeader>
                  <CardContent>
                    <Apache2Calculator />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="curb65" className="m-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">CURB-65</CardTitle>
                    <p className="text-xs text-muted-foreground">Pneumonia severity score</p>
                  </CardHeader>
                  <CardContent>
                    <CURB65Calculator />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wells_dvt" className="m-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Wells Criteria - DVT</CardTitle>
                    <p className="text-xs text-muted-foreground">Deep vein thrombosis probability</p>
                  </CardHeader>
                  <CardContent>
                    <WellsDVTCalculator />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wells_pe" className="m-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Wells Criteria - PE</CardTitle>
                    <p className="text-xs text-muted-foreground">Pulmonary embolism probability</p>
                  </CardHeader>
                  <CardContent>
                    <WellsPECalculator />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="news2" className="m-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">NEWS2</CardTitle>
                    <p className="text-xs text-muted-foreground">National Early Warning Score 2</p>
                  </CardHeader>
                  <CardContent>
                    <NEWS2Calculator />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="mt-6 p-3 bg-secondary/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Disclaimer:</strong> These calculators are for educational purposes and clinical decision support only.
            Always use clinical judgment and refer to primary literature for patient care decisions.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ClinicalRiskCalculator;
