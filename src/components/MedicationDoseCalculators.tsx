import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, Pill, Activity, Droplets, Copy, Info, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface RenalDoseResult {
  originalDose: string;
  adjustedDose: string;
  adjustmentPercent: number;
  category: 'no adjustment' | 'mild' | 'moderate' | 'severe';
  recommendations: string[];
}

interface TitrationTable {
  rate: number;
  doseRange: string;
  indications: string[];
  precautions: string[];
}

export function MedicationDoseCalculators() {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('renal');

  const renalState = React.useMemo(() => ({
    age: '',
    weight: '',
    gender: 'male' as 'male' | 'female',
    serumCreatinine: '',
    currentDose: '',
    medicationType: 'vancomycin' as string,
  }), []);

  const [renalResult, setRenalResult] = React.useState<RenalDoseResult | null>(null);

  const weightBasedState = React.useMemo(() => ({
    weight: '',
    medication: 'norepinephrine' as string,
  }), []);

  const [weightBasedResult, setWeightBasedResult] = React.useState<string>('');

  const calculateCrCl = (age: number, weight: number, gender: 'male' | 'female', serumCr: number): number => {
    if (gender === 'male') {
      return ((140 - age) * weight) / (72 * serumCr);
    } else {
      return ((140 - age) * weight * 0.85) / (72 * serumCr);
    }
  };

  const getRenalDoseAdjustment = (crcl: number, medication: string): RenalDoseResult => {
    const recommendations: string[] = [];
    let category: 'no adjustment' | 'mild' | 'moderate' | 'severe' = 'no adjustment';
    let adjustedDose = '';
    let adjustmentPercent = 0;

    const commonMedications: Record<string, {
      normal: string;
      mild: string;
      moderate: string;
      severe: string;
    }> = {
      vancomycin: {
        normal: '15-20 mg/kg q8-12h',
        mild: '15 mg/kg q12-24h',
        moderate: '15 mg/kg q24-48h',
        severe: '15 mg/kg q48-72h',
      },
      amikacin: {
        normal: '15-20 mg/kg q8-12h',
        mild: '15 mg/kg q12-24h',
        moderate: '15 mg/kg q24-48h',
        severe: '15 mg/kg q48-72h',
      },
      gentamicin: {
        normal: '5-7 mg/kg q24h',
        mild: '5 mg/kg q24-36h',
        moderate: '5 mg/kg q36-48h',
        severe: '5 mg/kg q48-72h',
      },
      levofloxacin: {
        normal: '500-750 mg q24h',
        mild: '500 mg q24h',
        moderate: '500 mg q48h',
        severe: '500 mg q48h',
      },
      ciprofloxacin: {
        normal: '400 mg q8-12h',
        mild: '400 mg q12h',
        moderate: '400 mg q24h',
        severe: '200 mg q24h',
      },
      acyclovir: {
        normal: '5-10 mg/kg q8h',
        mild: '5 mg/kg q12h',
        moderate: '5 mg/kg q24h',
        severe: '2.5 mg/kg q24h',
      },
    };

    const med = commonMedications[medication];
    if (!med) {
      return {
        originalDose: 'Dose per standard dosing',
        adjustedDose: 'See drug monograph',
        adjustmentPercent: 0,
        category: 'no adjustment',
        recommendations: ['Consult drug reference for renal dosing'],
      };
    }

    if (crcl >= 50) {
      adjustedDose = med.normal;
      category = 'no adjustment';
      recommendations.push('No dose adjustment required');
    } else if (crcl >= 30) {
      adjustedDose = med.mild;
      category = 'mild';
      adjustmentPercent = 25;
      recommendations.push('Mild renal impairment - consider dose reduction');
    } else if (crcl >= 10) {
      adjustedDose = med.moderate;
      category = 'moderate';
      adjustmentPercent = 50;
      recommendations.push('Moderate renal impairment - dose reduction recommended');
      recommendations.push('Monitor drug levels if available');
    } else {
      adjustedDose = med.severe;
      category = 'severe';
      adjustmentPercent = 75;
      recommendations.push('Severe renal impairment - significant dose reduction');
      recommendations.push('Consider alternative medication');
      recommendations.push('Monitor drug levels closely');
    }

    recommendations.push(`CrCl: ${crcl.toFixed(1)} mL/min`);
    recommendations.push('Adjust based on clinical response and drug levels');

    return {
      originalDose: med.normal,
      adjustedDose,
      adjustmentPercent,
      category,
      recommendations,
    };
  };

  const handleRenalCalculate = () => {
    const age = parseInt(renalState.age);
    const weight = parseFloat(renalState.weight);
    const serumCr = parseFloat(renalState.serumCreatinine);

    if (!age || !weight || !serumCr) {
      toast.error('Please fill in all fields');
      return;
    }

    const crcl = calculateCrCl(age, weight, renalState.gender, serumCr);
    const result = getRenalDoseAdjustment(crcl, renalState.medicationType);
    setRenalResult(result);
    toast.success('Calculated successfully');
  };

  const TITRATION_TABLES: Record<string, TitrationTable[]> = {
    norepinephrine: [
      { rate: 0.01, doseRange: '0.01-0.03 mcg/kg/min', indications: ['Low-normal BP'], precautions: ['Monitor cardiac output'] },
      { rate: 0.05, doseRange: '0.03-0.1 mcg/kg/min', indications: ['Septic shock', 'Cardiogenic shock'], precautions: ['Watch for ischemia'] },
      { rate: 0.2, doseRange: '0.1-0.5 mcg/kg/min', indications: ['Refractory shock'], precautions: ['High doses cause vasoconstriction'] },
      { rate: 0.5, doseRange: '0.5-3 mcg/kg/min', indications: ['Extreme cases'], precautions: ['Consider vasopressin'] },
    ],
    epinephrine: [
      { rate: 0.01, doseRange: '0.01-0.03 mcg/kg/min', indications: ['Early shock'], precautions: ['Beta effects dominate'] },
      { rate: 0.1, doseRange: '0.03-0.1 mcg/kg/min', indications: ['Anaphylaxis'], precautions: ['Tachycardia common'] },
      { rate: 0.2, doseRange: '0.1-0.5 mcg/kg/min', indications: ['Septic shock'], precautions: ['Alpha effects increase'] },
    ],
    dopamine: [
      { rate: 2, doseRange: '< 2 mcg/kg/min', indications: ['Renal vasodilation'], precautions: ['Controversial benefit'] },
      { rate: 5, doseRange: '2-10 mcg/kg/min', indications: ['Inotropy'], precautions: ['Arrhythmias at >5'] },
      { rate: 15, doseRange: '10-20 mcg/kg/min', indications: ['Vasopressor'], precautions: ['Prefer norepinephrine'] },
    ],
    vasopressin: [
      { rate: 0.03, doseRange: '0.01-0.03 U/min', indications: ['Adjunct to norepi'], precautions: ['Monitor sNa'] },
      { rate: 0.04, doseRange: '0.03-0.04 U/min', indications: ['Vasodilatory shock'], precautions: ['Max dose 0.04'] },
    ],
    dobutamine: [
      { rate: 2.5, doseRange: '2-5 mcg/kg/min', indications: ['Low cardiac output'], precautions: ['Hypotension possible'] },
      { rate: 10, doseRange: '5-20 mcg/kg/min', indications: ['Cardiogenic shock'], precautions: ['Monitor arrhythmias'] },
    ],
    milrinone: [
      { rate: 0.375, doseRange: '0.25-0.5 mcg/kg/min', indications: ['CHF exacerbation'], precautions: ['Requires bolus'] },
    ],
  };

  const calculateWeightBasedDose = () => {
    const weight = parseFloat(weightBasedState.weight);
    if (!weight) {
      toast.error('Please enter weight');
      return;
    }

    const table = TITRATION_TABLES[weightBasedState.medication];
    if (!table) return;

    const rates = table.map(row => ({
      rate: (weight * row.rate).toFixed(2),
      ...row,
    }));

    setWeightBasedResult(JSON.stringify(rates, null, 2));
    toast.success('Calculated successfully');
  };

  const getRenalCategoryColor = (category: string) => {
    switch (category) {
      case 'no adjustment': return 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800';
      case 'mild': return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800';
      case 'moderate': return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800';
      case 'severe': return 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Calculator className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Dose Calc</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Medication Dose Calculators</DialogTitle>
          <DialogDescription>
            Calculate renal-adjusted doses and weight-based medication dosing
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="renal">Renal Dosing</TabsTrigger>
            <TabsTrigger value="titration">Titration Tables</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            <TabsContent value="renal" className="space-y-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Creatinine Clearance Calculator
                  </CardTitle>
                  <CardDescription>
                    Calculate CrCl using Cockcroft-Gault equation and get dose adjustments
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="age">Age (years)</Label>
                      <Input
                        id="age"
                        type="number"
                        placeholder="65"
                        value={renalState.age}
                        onChange={(e) => {
                          renalState.age = e.target.value;
                          setRenalResult(null);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        placeholder="70"
                        value={renalState.weight}
                        onChange={(e) => {
                          renalState.weight = e.target.value;
                          setRenalResult(null);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <select
                        id="gender"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={renalState.gender}
                        onChange={(e) => {
                          renalState.gender = e.target.value as 'male' | 'female';
                          setRenalResult(null);
                        }}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="serumCr">Serum Creatinine (mg/dL)</Label>
                      <Input
                        id="serumCr"
                        type="number"
                        step="0.01"
                        placeholder="1.2"
                        value={renalState.serumCreatinine}
                        onChange={(e) => {
                          renalState.serumCreatinine = e.target.value;
                          setRenalResult(null);
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="medicationType">Medication</Label>
                    <select
                      id="medicationType"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={renalState.medicationType}
                      onChange={(e) => {
                        renalState.medicationType = e.target.value;
                        setRenalResult(null);
                      }}
                    >
                      <option value="vancomycin">Vancomycin</option>
                      <option value="amikacin">Amikacin</option>
                      <option value="gentamicin">Gentamicin</option>
                      <option value="levofloxacin">Levofloxacin</option>
                      <option value="ciprofloxacin">Ciprofloxacin</option>
                      <option value="acyclovir">Acyclovir</option>
                    </select>
                  </div>

                  <Button onClick={handleRenalCalculate} className="w-full">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Dose Adjustment
                  </Button>
                </CardContent>
              </Card>

              {renalResult && (
                <Card className={getRenalCategoryColor(renalResult.category)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Dose Adjustment Results</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {renalResult.adjustmentPercent}% adjustment
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Original Dose (Normal Renal Function)</Label>
                      <div className="text-lg font-semibold">{renalResult.originalDose}</div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Adjusted Dose</Label>
                      <div className="text-2xl font-bold text-primary">{renalResult.adjustedDose}</div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Recommendations</Label>
                      <ul className="space-y-1">
                        {renalResult.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Info className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `Adjusted dose: ${renalResult.adjustedDose}\n\n` +
                          renalResult.recommendations.join('\n')
                        );
                        toast.success('Copied to clipboard');
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Results
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="titration" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5" />
                    Vasopressor Titration Tables
                  </CardTitle>
                  <CardDescription>
                    Calculate infusion rates based on patient weight
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="weight-titration">Patient Weight (kg)</Label>
                      <Input
                        id="weight-titration"
                        type="number"
                        placeholder="70"
                        value={weightBasedState.weight}
                        onChange={(e) => {
                          weightBasedState.weight = e.target.value;
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="medication-titration">Medication</Label>
                      <select
                        id="medication-titration"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={weightBasedState.medication}
                        onChange={(e) => {
                          weightBasedState.medication = e.target.value;
                          setWeightBasedResult('');
                        }}
                      >
                        <option value="norepinephrine">Norepinephrine</option>
                        <option value="epinephrine">Epinephrine</option>
                        <option value="dopamine">Dopamine</option>
                        <option value="vasopressin">Vasopressin</option>
                        <option value="dobutamine">Dobutamine</option>
                        <option value="milrinone">Milrinone</option>
                      </select>
                    </div>
                  </div>

                  <Button onClick={calculateWeightBasedDose} className="w-full">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Infusion Rates
                  </Button>
                </CardContent>
              </Card>

              {weightBasedResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Titration Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      {weightBasedResult}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        navigator.clipboard.writeText(weightBasedResult);
                        toast.success('Copied to clipboard');
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Results
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Important Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>• These calculators provide general guidance only</p>
                  <p>• Always verify calculations independently</p>
                  <p>• Adjust based on clinical response and drug levels</p>
                  <p>• Consult hospital protocols and drug references</p>
                  <p>• Use ideal body weight for obese patients (40% IBW adjustment)</p>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
