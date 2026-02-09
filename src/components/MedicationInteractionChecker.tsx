import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldX, XCircle, AlertCircle, Info, X, ChevronRight, ChevronDown } from "lucide-react";
import { type PatientMedications } from "@/types/patient";
import { toast } from "sonner";

interface MedicationInteraction {
  id: string;
  medicationA: string;
  medicationB: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  description: string;
  recommendation: string;
  category: 'drug-drug' | 'drug-condition' | 'drug-allergy';
}

const COMMON_DRUG_INTERACTIONS: Partial<MedicationInteraction>[] = [
  {
    medicationA: 'Warfarin',
    medicationB: 'Aspirin',
    severity: 'major',
    description: 'Increased risk of bleeding',
    recommendation: 'Monitor INR closely; consider alternative antiplatelet if bleeding risk high',
    category: 'drug-drug',
  },
  {
    medicationA: 'Warfarin',
    medicationB: 'NSAIDs',
    severity: 'major',
    description: 'Increased risk of gastrointestinal bleeding',
    recommendation: 'Avoid concomitant use; consider acetaminophen for pain',
    category: 'drug-drug',
  },
  {
    medicationA: 'Warfarin',
    medicationB: 'Amiodarone',
    severity: 'major',
    description: 'Amiodarone potentiates warfarin effect',
    recommendation: 'Reduce warfarin dose by 30-50%; monitor INR frequently',
    category: 'drug-drug',
  },
  {
    medicationA: 'Digoxin',
    medicationB: 'Amiodarone',
    severity: 'major',
    description: 'Increased digoxin levels',
    recommendation: 'Reduce digoxin dose by 50%; monitor serum levels',
    category: 'drug-drug',
  },
  {
    medicationA: 'ACE inhibitors',
    medicationB: 'Potassium supplements',
    severity: 'major',
    description: 'Risk of hyperkalemia',
    recommendation: 'Monitor potassium levels; consider dose reduction',
    category: 'drug-drug',
  },
  {
    medicationA: 'ACE inhibitors',
    medicationB: 'Spironolactone',
    severity: 'major',
    description: 'Risk of hyperkalemia',
    recommendation: 'Monitor potassium closely; may need to adjust doses',
    category: 'drug-drug',
  },
  {
    medicationA: 'SSRIs',
    medicationB: 'MAOIs',
    severity: 'contraindicated',
    description: 'Serotonin syndrome risk',
    recommendation: 'Do not use together; wait 2 weeks between discontinuation and starting',
    category: 'drug-drug',
  },
  {
    medicationA: 'SSRIs',
    medicationB: 'NSAIDs',
    severity: 'moderate',
    description: 'Increased bleeding risk',
    recommendation: 'Monitor for bleeding; consider gastroprotection',
    category: 'drug-drug',
  },
  {
    medicationA: 'Metformin',
    medicationB: 'IV contrast',
    severity: 'major',
    description: 'Risk of lactic acidosis',
    recommendation: 'Hold metformin before and after contrast study',
    category: 'drug-drug',
  },
  {
    medicationA: 'QT-prolonging agents',
    medicationB: 'Macrolides',
    severity: 'major',
    description: 'Increased risk of torsades de pointes',
    recommendation: 'Consider alternative antibiotic; monitor ECG',
    category: 'drug-drug',
  },
  {
    medicationA: 'Beta-blockers',
    medicationB: 'Calcium channel blockers',
    severity: 'moderate',
    description: 'Additive bradycardia and AV block',
    recommendation: 'Monitor heart rate and conduction',
    category: 'drug-drug',
  },
  {
    medicationA: 'Norepinephrine',
    medicationB: 'MAOIs',
    severity: 'major',
    description: 'Potentiated hypertensive response',
    recommendation: 'Reduce norepinephrine dose significantly if MAOI cannot be discontinued',
    category: 'drug-drug',
  },
  {
    medicationA: 'Epinephrine',
    medicationB: 'Beta-blockers',
    severity: 'moderate',
    description: 'Unopposed alpha stimulation causing severe hypertension',
    recommendation: 'Use caution; consider alternative vasopressor',
    category: 'drug-drug',
  },
  {
    medicationA: 'Heparin',
    medicationB: 'Aspirin',
    severity: 'major',
    description: 'Increased bleeding risk',
    recommendation: 'Monitor for bleeding; may need to adjust doses',
    category: 'drug-drug',
  },
  {
    medicationA: 'Vancomycin',
    medicationB: 'Aminoglycosides',
    severity: 'major',
    description: 'Additive nephrotoxicity',
    recommendation: 'Monitor renal function closely; consider alternative antibiotics',
    category: 'drug-drug',
  },
  {
    medicationA: 'Loop diuretics',
    medicationB: 'Aminoglycosides',
    severity: 'moderate',
    description: 'Increased risk of ototoxicity',
    recommendation: 'Monitor renal function and hearing',
    category: 'drug-drug',
  },
  {
    medicationA: 'Statins',
    medicationB: 'Macrolides',
    severity: 'moderate',
    description: 'Increased risk of myopathy',
    recommendation: 'Monitor CK levels; consider temporary statin hold',
    category: 'drug-drug',
  },
];

const ALLERGEN_DRUG_PAIRS: Record<string, string[]> = {
  'penicillin': ['amoxicillin', 'ampicillin', 'piperacillin', 'oxacillin', 'nafcillin'],
  'sulfa': ['sulfamethoxazole', 'sulfadiazine', 'sulfasalazine'],
  'aspirin': ['nsaids', 'ibuprofen', 'naproxen', 'ketorolac'],
  'codeine': ['morphine', 'hydrocodone', 'oxycodone', 'hydromorphone'],
  'latex': ['latex-containing products'],
};

const CONDITION_WARNINGS: Record<string, { medications: string[]; warning: string }> = {
  'renal failure': {
    medications: ['nsaids', 'aminoglycosides', 'amphotericin', 'acyclovir high dose', 'contrast dye'],
    warning: 'Avoid or dose-reduce due to renal impairment',
  },
  'liver failure': {
    medications: ['acetaminophen', 'statins', 'azoles', 'metronidazole'],
    warning: 'Use with caution or avoid in severe liver disease',
  },
  'heart failure': {
    medications: ['nsaids', 'calcium channel blockers (non-dihydropyridine)', 'thiazolidinediones'],
    warning: 'May exacerbate heart failure',
  },
  'myasthenia gravis': {
    medications: ['fluoroquinolones', 'macrolides', 'beta-blockers', 'magnesium'],
    warning: 'May worsen muscle weakness',
  },
};

interface MedicationInteractionCheckerProps {
  medications: PatientMedications;
  allergies?: string[];
  conditions?: string[];
}

export function MedicationInteractionChecker({
  medications,
  allergies = [],
  conditions = [],
}: MedicationInteractionCheckerProps) {
  const [open, setOpen] = React.useState(false);
  const [interactions, setInteractions] = React.useState<MedicationInteraction[]>([]);
  const [allergyAlerts, setAllergyAlerts] = React.useState<MedicationInteraction[]>([]);
  const [conditionAlerts, setConditionAlerts] = React.useState<MedicationInteraction[]>([]);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const allMedications = React.useMemo(() => [
    ...medications.infusions,
    ...medications.scheduled,
    ...medications.prn,
  ], [medications]);

  const normalizeMedName = (name: string): string => {
    return name.toLowerCase().trim();
  };

  const checkForInteractions = React.useCallback(() => {
    const foundInteractions: MedicationInteraction[] = [];
    const foundAllergyAlerts: MedicationInteraction[] = [];
    const foundConditionAlerts: MedicationInteraction[] = [];

    const normalizedMeds = allMedications.map(m => normalizeMedName(m));

    COMMON_DRUG_INTERACTIONS.forEach((interaction, idx) => {
      if (!interaction.medicationA || !interaction.medicationB) return;

      const medA = interaction.medicationA.toLowerCase();
      const medB = interaction.medicationB.toLowerCase();

      const hasMedA = normalizedMeds.some(med => 
        med.includes(medA) || medA.includes(med)
      );
      const hasMedB = normalizedMeds.some(med => 
        med.includes(medB) || medB.includes(med)
      );

      if (hasMedA && hasMedB) {
        foundInteractions.push({
          id: `ddi-${idx}`,
          ...interaction,
        } as MedicationInteraction);
      }
    });

    allergies.forEach(allergy => {
      const normAllergy = normalizeMedName(allergy);
      const relatedDrugs = ALLERGEN_DRUG_PAIRS[normAllergy] || [];

      relatedDrugs.forEach(drug => {
        if (normalizedMeds.some(med => med.includes(drug))) {
          foundAllergyAlerts.push({
            id: `allergy-${normAllergy}-${drug}`,
            medicationA: allergy,
            medicationB: drug,
            severity: 'contraindicated',
            description: `Patient allergic to ${allergy}, which is related to ${drug}`,
            recommendation: 'Discontinue immediately; consider alternative',
            category: 'drug-allergy',
          });
        }
      });
    });

    conditions.forEach(condition => {
      const normCondition = normalizeMedName(condition);
      const warning = CONDITION_WARNINGS[normCondition];

      if (warning) {
        warning.medications.forEach(med => {
          if (normalizedMeds.some(medication => medication.includes(med))) {
            foundConditionAlerts.push({
              id: `condition-${normCondition}-${med}`,
              medicationA: condition,
              medicationB: med,
              severity: 'major',
              description: warning.warning,
              recommendation: 'Consider alternative therapy or dose adjustment',
              category: 'drug-condition',
            });
          }
        });
      }
    });

    setInteractions(foundInteractions);
    setAllergyAlerts(foundAllergyAlerts);
    setConditionAlerts(foundConditionAlerts);

    const totalAlerts = foundInteractions.length + foundAllergyAlerts.length + foundConditionAlerts.length;
    if (totalAlerts > 0) {
      toast.error(`Found ${totalAlerts} medication alert${totalAlerts > 1 ? 's' : ''}`);
    }
  }, [allMedications, allergies, conditions]);

  React.useEffect(() => {
    if (open) {
      checkForInteractions();
    }
  }, [open, checkForInteractions]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getSeverityIcon = (severity: MedicationInteraction['severity']) => {
    switch (severity) {
      case 'contraindicated':
        return <XCircle className="h-4 w-4" />;
      case 'major':
        return <AlertTriangle className="h-4 w-4" />;
      case 'moderate':
        return <ShieldX className="h-4 w-4" />;
      case 'minor':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: MedicationInteraction['severity']) => {
    switch (severity) {
      case 'contraindicated':
        return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800';
      case 'major':
        return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950 dark:border-yellow-800';
      case 'minor':
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800';
    }
  };

  const totalAlerts = interactions.length + allergyAlerts.length + conditionAlerts.length;
  const contraindicatedCount = [
    ...interactions,
    ...allergyAlerts,
    ...conditionAlerts,
  ].filter(i => i.severity === 'contraindicated').length;
  const majorCount = [
    ...interactions,
    ...allergyAlerts,
    ...conditionAlerts,
  ].filter(i => i.severity === 'major').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 relative">
          <ShieldX className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Interactions</span>
          {totalAlerts > 0 && (
            <Badge 
              variant={contraindicatedCount > 0 ? 'destructive' : 'secondary'} 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
            >
              {totalAlerts}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Medication Interaction Checker</DialogTitle>
          <DialogDescription>
            {totalAlerts > 0 
              ? `Found ${totalAlerts} alert${totalAlerts > 1 ? 's' : ''}`
              : 'No interactions detected'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {allergyAlerts.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Allergy Alerts</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                {allergyAlerts.map(alert => (
                  <div key={alert.id} className="p-2 border border-red-200 dark:border-red-800 rounded">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(alert.id)}>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(alert.severity)}
                        <span className="font-medium">{alert.medicationA} × {alert.medicationB}</span>
                      </div>
                      {expandedIds.has(alert.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                    {expandedIds.has(alert.id) && (
                      <div className="mt-2 text-sm space-y-1">
                        <p>{alert.description}</p>
                        <p className="font-medium">{alert.recommendation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {interactions.filter(i => i.severity === 'contraindicated').length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Contraindicated Interactions</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                {interactions.filter(i => i.severity === 'contraindicated').map(interaction => (
                  <div key={interaction.id} className={`p-3 border rounded ${getSeverityColor(interaction.severity)}`}>
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(interaction.id)}>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(interaction.severity)}
                        <span className="font-semibold">{interaction.medicationA} × {interaction.medicationB}</span>
                      </div>
                      {expandedIds.has(interaction.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                    {expandedIds.has(interaction.id) && (
                      <div className="mt-2 text-sm space-y-1">
                        <p>{interaction.description}</p>
                        <p className="font-medium">{interaction.recommendation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {interactions.filter(i => i.severity === 'major').length > 0 && (
            <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertTitle className="text-orange-900 dark:text-orange-100">Major Interactions</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                {interactions.filter(i => i.severity === 'major').map(interaction => (
                  <div key={interaction.id} className={`p-3 border rounded ${getSeverityColor(interaction.severity)}`}>
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(interaction.id)}>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(interaction.severity)}
                        <span className="font-semibold">{interaction.medicationA} × {interaction.medicationB}</span>
                      </div>
                      {expandedIds.has(interaction.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                    {expandedIds.has(interaction.id) && (
                      <div className="mt-2 text-sm space-y-1">
                        <p>{interaction.description}</p>
                        <p className="font-medium">{interaction.recommendation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {interactions.filter(i => i.severity === 'moderate').length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <ShieldX className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                Moderate Interactions
              </h3>
              {interactions.filter(i => i.severity === 'moderate').map(interaction => (
                <div key={interaction.id} className={`p-3 border rounded ${getSeverityColor(interaction.severity)}`}>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(interaction.id)}>
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(interaction.severity)}
                      <span className="font-medium">{interaction.medicationA} × {interaction.medicationB}</span>
                    </div>
                    {expandedIds.has(interaction.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  {expandedIds.has(interaction.id) && (
                    <div className="mt-2 text-sm space-y-1">
                      <p>{interaction.description}</p>
                      <p className="font-medium">{interaction.recommendation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {interactions.filter(i => i.severity === 'minor').length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Minor Interactions
              </h3>
              {interactions.filter(i => i.severity === 'minor').map(interaction => (
                <div key={interaction.id} className={`p-3 border rounded ${getSeverityColor(interaction.severity)}`}>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(interaction.id)}>
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(interaction.severity)}
                      <span className="font-medium">{interaction.medicationA} × {interaction.medicationB}</span>
                    </div>
                    {expandedIds.has(interaction.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  {expandedIds.has(interaction.id) && (
                    <div className="mt-2 text-sm space-y-1">
                      <p>{interaction.description}</p>
                      <p className="font-medium">{interaction.recommendation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {conditionAlerts.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
              <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertTitle className="text-yellow-900 dark:text-yellow-100">Condition-Based Alerts</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                {conditionAlerts.map(alert => (
                  <div key={alert.id} className={`p-3 border rounded ${getSeverityColor(alert.severity)}`}>
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(alert.id)}>
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        <span className="font-medium">{alert.medicationA} - {alert.medicationB}</span>
                      </div>
                      {expandedIds.has(alert.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                    {expandedIds.has(alert.id) && (
                      <div className="mt-2 text-sm space-y-1">
                        <p>{alert.description}</p>
                        <p className="font-medium">{alert.recommendation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {totalAlerts === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-green-100 dark:bg-green-950 rounded-full p-4 mb-4">
                <ShieldX className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Interactions Detected</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No drug-drug interactions, allergy alerts, or condition-based warnings found for the current medications.
              </p>
            </div>
          )}
        </div>

        {totalAlerts > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={() => setExpandedIds(new Set(allMedications.map((_, i) => `expand-all-${i}`)))} variant="outline" className="flex-1">
              Expand All
            </Button>
            <Button onClick={() => setExpandedIds(new Set())} variant="outline" className="flex-1">
              Collapse All
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
