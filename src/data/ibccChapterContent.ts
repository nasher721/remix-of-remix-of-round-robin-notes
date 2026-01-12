/**
 * IBCC Chapter Content Data
 * Comprehensive clinical content for embedded reference
 */

import type { IBCCChapterContent } from '@/types/ibcc';

/**
 * Content lookup by chapter ID
 */
export const CHAPTER_CONTENT: Record<string, IBCCChapterContent> = {
  // ============================================
  // SEPSIS - Comprehensive Content
  // ============================================
  sepsis: {
    keyPearls: [
      {
        id: 'sepsis-pearl-1',
        text: 'Early antibiotics save lives. Every hour of delay in antibiotics increases mortality by 7.6% in septic shock.',
        importance: 'critical',
        category: 'Antibiotics',
      },
      {
        id: 'sepsis-pearl-2',
        text: 'Lactate clearance is more important than absolute lactate value. Target >10% clearance every 2 hours.',
        importance: 'critical',
        category: 'Resuscitation',
      },
      {
        id: 'sepsis-pearl-3',
        text: 'Norepinephrine is the first-line vasopressor. Start early - do not delay for fluid resuscitation.',
        importance: 'high',
        category: 'Vasopressors',
      },
      {
        id: 'sepsis-pearl-4',
        text: 'Source control within 6-12 hours is essential. Undrained abscesses = ongoing sepsis.',
        importance: 'high',
        category: 'Source Control',
      },
      {
        id: 'sepsis-pearl-5',
        text: 'Avoid excessive fluid resuscitation. After initial 30 mL/kg, reassess before giving more.',
        importance: 'high',
        category: 'Fluids',
      },
      {
        id: 'sepsis-pearl-6',
        text: 'qSOFA (≥2 of: RR≥22, AMS, SBP≤100) identifies patients at risk - but sensitivity is low for screening.',
        importance: 'moderate',
        category: 'Diagnosis',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'sepsis-dx-1',
        title: 'Sepsis-3 Definition',
        criteria: [
          { id: 'dx-1-1', text: 'Suspected or documented infection', required: true },
          { id: 'dx-1-2', text: 'SOFA score increase ≥2 from baseline', required: true, value: 'SOFA ≥2' },
          { id: 'dx-1-3', text: 'Organ dysfunction present', required: true },
        ],
        notes: 'Sepsis = life-threatening organ dysfunction caused by dysregulated host response to infection',
      },
      {
        id: 'sepsis-dx-2',
        title: 'Septic Shock Criteria',
        criteria: [
          { id: 'dx-2-1', text: 'Sepsis present', required: true },
          { id: 'dx-2-2', text: 'Vasopressor required to maintain MAP ≥65 mmHg', required: true, value: 'MAP ≥65' },
          { id: 'dx-2-3', text: 'Lactate >2 mmol/L despite adequate fluid resuscitation', required: true, value: '>2 mmol/L' },
        ],
        notes: 'Septic shock has ~40% hospital mortality',
      },
      {
        id: 'sepsis-dx-3',
        title: 'qSOFA (Quick SOFA)',
        criteria: [
          { id: 'dx-3-1', text: 'Respiratory rate ≥22/min', value: 'RR ≥22' },
          { id: 'dx-3-2', text: 'Altered mental status (GCS <15)', value: 'GCS <15' },
          { id: 'dx-3-3', text: 'Systolic blood pressure ≤100 mmHg', value: 'SBP ≤100' },
        ],
        notes: 'qSOFA ≥2 suggests high risk, but low sensitivity - use clinical judgment',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'sepsis-tx-1',
        phase: 'Hour 1',
        title: 'Immediate Resuscitation',
        timing: '0-60 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Obtain blood cultures (2 sets) before antibiotics', priority: 'immediate', details: 'Do not delay antibiotics if cultures will take >45 min' },
          { id: 'tx-1-2', text: 'Administer broad-spectrum antibiotics', priority: 'immediate', details: 'Within 1 hour of recognition' },
          { id: 'tx-1-3', text: 'Measure lactate level', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Begin crystalloid 30 mL/kg for hypotension or lactate ≥4', priority: 'immediate' },
        ],
        notes: 'Sepsis Hour-1 Bundle - these 4 interventions must all begin within 1 hour',
      },
      {
        id: 'sepsis-tx-2',
        phase: 'Hours 1-6',
        title: 'Hemodynamic Optimization',
        timing: '1-6 hours',
        actions: [
          { id: 'tx-2-1', text: 'Start norepinephrine if MAP <65 despite fluids', priority: 'urgent', details: 'Target MAP 65-70 mmHg' },
          { id: 'tx-2-2', text: 'Repeat lactate if initial was elevated', priority: 'urgent' },
          { id: 'tx-2-3', text: 'Assess fluid responsiveness before additional boluses', priority: 'urgent', details: 'Passive leg raise, pulse pressure variation' },
          { id: 'tx-2-4', text: 'Central venous access for vasopressors', priority: 'routine' },
          { id: 'tx-2-5', text: 'Consider arterial line for hemodynamic monitoring', priority: 'routine' },
        ],
      },
      {
        id: 'sepsis-tx-3',
        phase: 'Hours 6-24',
        title: 'Source Control & De-escalation',
        timing: '6-24 hours',
        actions: [
          { id: 'tx-3-1', text: 'Identify and control source of infection', priority: 'urgent', details: 'Imaging, drainage, debridement as needed' },
          { id: 'tx-3-2', text: 'Narrow antibiotics based on culture results', priority: 'routine' },
          { id: 'tx-3-3', text: 'Wean vasopressors if stable', priority: 'routine' },
          { id: 'tx-3-4', text: 'Reassess need for stress-dose steroids', priority: 'routine', details: 'If refractory shock despite vasopressors' },
        ],
      },
    ],
    medications: [
      {
        id: 'sepsis-med-1',
        name: 'Norepinephrine',
        genericName: 'norepinephrine bitartrate',
        category: 'first-line',
        indication: 'First-line vasopressor for septic shock',
        dosing: [
          { route: 'IV', dose: '0.01-0.5 mcg/kg/min', notes: 'Start at 5-10 mcg/min, titrate to MAP' },
        ],
        contraindications: ['Hypovolemia (relative)'],
        sideEffects: ['Tissue necrosis with extravasation', 'Arrhythmias', 'Peripheral ischemia'],
        monitoringParameters: ['MAP', 'Heart rate', 'Lactate', 'Urine output'],
        pearls: [
          'Can run peripherally short-term (dilute, large vein, above antecubital fossa)',
          'No maximum dose - titrate to effect',
        ],
      },
      {
        id: 'sepsis-med-2',
        name: 'Vasopressin',
        genericName: 'arginine vasopressin',
        category: 'second-line',
        indication: 'Add to norepinephrine in refractory septic shock',
        dosing: [
          { route: 'IV', dose: '0.03-0.04 units/min', notes: 'Fixed dose, not titrated' },
        ],
        contraindications: ['Mesenteric ischemia (relative)'],
        sideEffects: ['Digital ischemia', 'Hyponatremia', 'Cardiac ischemia'],
        monitoringParameters: ['Sodium', 'Peripheral perfusion', 'MAP'],
        pearls: [
          'Add when norepinephrine dose is 0.25-0.5 mcg/kg/min',
          'Allows norepinephrine dose reduction',
        ],
      },
      {
        id: 'sepsis-med-3',
        name: 'Hydrocortisone',
        genericName: 'hydrocortisone sodium succinate',
        category: 'adjunct',
        indication: 'Refractory septic shock despite vasopressors',
        dosing: [
          { route: 'IV', dose: '50 mg q6h or 200 mg/day continuous', notes: 'Continue for ~7 days, then taper' },
        ],
        contraindications: ['Active fungal infection (relative)'],
        sideEffects: ['Hyperglycemia', 'Immunosuppression', 'Sodium retention'],
        monitoringParameters: ['Blood glucose', 'Sodium'],
        pearls: [
          'Start if still requiring high-dose vasopressor >4-6 hours',
          'No ACTH stim test needed before starting',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'sepsis-pitfall-1',
        title: 'Delayed antibiotics',
        description: 'Waiting for cultures, imaging, or "complete workup" before starting antibiotics',
        consequence: '7.6% increased mortality per hour of delay in septic shock',
        prevention: 'Start empiric broad-spectrum antibiotics within 1 hour of sepsis recognition',
        severity: 'critical',
      },
      {
        id: 'sepsis-pitfall-2',
        title: 'Excessive crystalloid resuscitation',
        description: 'Giving >30 mL/kg without reassessing fluid responsiveness',
        consequence: 'Pulmonary edema, increased ventilator days, worse outcomes',
        prevention: 'After initial 30 mL/kg, assess fluid responsiveness before additional boluses',
        severity: 'major',
      },
      {
        id: 'sepsis-pitfall-3',
        title: 'Delayed vasopressors',
        description: 'Waiting to "finish fluids" before starting vasopressors',
        consequence: 'Prolonged hypotension, tissue hypoperfusion, organ failure',
        prevention: 'Start norepinephrine early if MAP <65 despite initial fluids',
        severity: 'major',
      },
      {
        id: 'sepsis-pitfall-4',
        title: 'Ignoring source control',
        description: 'Focusing only on antibiotics without addressing drainable collections',
        consequence: 'Ongoing sepsis despite appropriate antibiotics',
        prevention: 'Early imaging, drainage of abscesses within 6-12 hours',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Cardiogenic shock (check echo)',
      'Hypovolemic shock (bleeding, GI losses)',
      'Anaphylaxis',
      'Adrenal crisis',
      'Drug overdose/toxin',
      'Severe pancreatitis',
    ],
  },

  // ============================================
  // DKA - Comprehensive Content
  // ============================================
  dka: {
    keyPearls: [
      {
        id: 'dka-pearl-1',
        text: 'Potassium before insulin! Check K+ before starting insulin. If K+ <3.3, replete K+ first.',
        importance: 'critical',
        category: 'Electrolytes',
      },
      {
        id: 'dka-pearl-2',
        text: 'Fluid resuscitation is the most important initial therapy. Start with 1-2L NS in first hour.',
        importance: 'critical',
        category: 'Fluids',
      },
      {
        id: 'dka-pearl-3',
        text: 'Add dextrose when glucose <250 mg/dL. Do not stop insulin - continue until anion gap closes.',
        importance: 'high',
        category: 'Insulin',
      },
      {
        id: 'dka-pearl-4',
        text: 'Cerebral edema risk: Avoid rapid glucose drops >100 mg/dL/hr, especially in pediatrics.',
        importance: 'high',
        category: 'Complications',
      },
      {
        id: 'dka-pearl-5',
        text: 'Transition to SC insulin when: eating, anion gap closed, glucose <200, bicarb >15.',
        importance: 'moderate',
        category: 'Transition',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'dka-dx-1',
        title: 'DKA Diagnostic Criteria',
        criteria: [
          { id: 'dx-1-1', text: 'Blood glucose >250 mg/dL', required: true, value: '>250 mg/dL' },
          { id: 'dx-1-2', text: 'Arterial pH <7.3 or serum bicarbonate <18 mEq/L', required: true },
          { id: 'dx-1-3', text: 'Elevated anion gap (>12)', required: true, value: 'AG >12' },
          { id: 'dx-1-4', text: 'Ketonemia or ketonuria', required: true },
        ],
      },
      {
        id: 'dka-dx-2',
        title: 'Severity Classification',
        criteria: [
          { id: 'dx-2-1', text: 'Mild: pH 7.25-7.30, Bicarb 15-18, Alert', value: 'Mild' },
          { id: 'dx-2-2', text: 'Moderate: pH 7.00-7.24, Bicarb 10-14, Drowsy', value: 'Moderate' },
          { id: 'dx-2-3', text: 'Severe: pH <7.00, Bicarb <10, Stupor/Coma', value: 'Severe' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'dka-tx-1',
        phase: 'Hour 0-1',
        title: 'Initial Resuscitation',
        timing: '0-60 minutes',
        actions: [
          { id: 'tx-1-1', text: 'NS 1-2 L IV bolus (15-20 mL/kg)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Check BMP, VBG, beta-hydroxybutyrate', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Check potassium level', priority: 'immediate', details: 'Do NOT start insulin if K <3.3' },
          { id: 'tx-1-4', text: 'Search for precipitating cause', priority: 'urgent', details: 'Infection, MI, medication noncompliance' },
        ],
      },
      {
        id: 'dka-tx-2',
        phase: 'Hours 1-12',
        title: 'Insulin & Electrolyte Management',
        timing: '1-12 hours',
        actions: [
          { id: 'tx-2-1', text: 'Start insulin infusion 0.1 units/kg/hr', priority: 'urgent', details: 'After confirming K ≥3.3' },
          { id: 'tx-2-2', text: 'Continue IV fluids 250-500 mL/hr', priority: 'urgent' },
          { id: 'tx-2-3', text: 'Add K+ 20-40 mEq/L to fluids if K <5.2', priority: 'urgent' },
          { id: 'tx-2-4', text: 'Check glucose q1h, BMP q2-4h', priority: 'routine' },
          { id: 'tx-2-5', text: 'Add D5 when glucose <250 mg/dL', priority: 'routine' },
        ],
      },
      {
        id: 'dka-tx-3',
        phase: 'Resolution',
        title: 'Transition to Subcutaneous Insulin',
        timing: 'When AG closed',
        actions: [
          { id: 'tx-3-1', text: 'Confirm: AG closed, glucose <200, pH >7.3, bicarb >15', priority: 'routine' },
          { id: 'tx-3-2', text: 'Give SC long-acting insulin', priority: 'routine', details: 'Overlap with IV infusion by 2-4 hours' },
          { id: 'tx-3-3', text: 'Stop IV insulin 2-4 hours after SC dose', priority: 'routine' },
          { id: 'tx-3-4', text: 'Start oral intake when tolerating', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'dka-med-1',
        name: 'Regular Insulin',
        genericName: 'insulin regular',
        category: 'first-line',
        indication: 'IV insulin infusion for DKA',
        dosing: [
          { route: 'IV', dose: '0.1 units/kg/hr continuous', notes: 'Target glucose drop 50-75 mg/dL/hr' },
        ],
        sideEffects: ['Hypoglycemia', 'Hypokalemia'],
        monitoringParameters: ['Blood glucose q1h', 'Potassium q2-4h'],
        pearls: [
          'Do not bolus insulin - go straight to infusion',
          'Continue until anion gap closes, not just glucose normalizes',
        ],
      },
      {
        id: 'dka-med-2',
        name: 'Potassium Chloride',
        genericName: 'KCl',
        category: 'first-line',
        indication: 'Potassium replacement in DKA',
        dosing: [
          { route: 'IV', dose: '20-40 mEq/L in IV fluids', notes: 'Add to fluids if K <5.2' },
        ],
        contraindications: ['K >5.2 mEq/L', 'Severe renal failure'],
        monitoringParameters: ['Potassium q2-4h', 'EKG if K <3 or >6'],
        pearls: [
          'If K <3.3, hold insulin and replete K first',
          'Total body K is depleted even if serum K is normal',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'dka-pitfall-1',
        title: 'Starting insulin before checking potassium',
        description: 'Giving insulin when K+ is critically low',
        consequence: 'Life-threatening hypokalemia, cardiac arrhythmias',
        prevention: 'Always check K+ first. If K <3.3, replete K before starting insulin',
        severity: 'critical',
      },
      {
        id: 'dka-pitfall-2',
        title: 'Stopping insulin when glucose normalizes',
        description: 'Discontinuing insulin based on glucose alone',
        consequence: 'Persistent ketoacidosis, DKA recurrence',
        prevention: 'Continue insulin until anion gap closes, add dextrose to maintain glucose 150-200',
        severity: 'critical',
      },
      {
        id: 'dka-pitfall-3',
        title: 'Missing the precipitant',
        description: 'Treating DKA without identifying underlying cause',
        consequence: 'Recurrent DKA, missed serious diagnosis (MI, infection)',
        prevention: 'Always search for precipitating cause - infection, MI, medication noncompliance',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Alcoholic ketoacidosis',
      'Starvation ketosis',
      'Hyperosmolar hyperglycemic state (HHS)',
      'Lactic acidosis',
      'Toxic ingestion (methanol, ethylene glycol)',
    ],
  },

  // ============================================
  // SHOCK - Comprehensive Content
  // ============================================
  shock: {
    keyPearls: [
      {
        id: 'shock-pearl-1',
        text: 'Think in categories: Distributive, Cardiogenic, Hypovolemic, Obstructive. Each has different treatment.',
        importance: 'critical',
        category: 'Classification',
      },
      {
        id: 'shock-pearl-2',
        text: 'Bedside echo is essential. 5-view cardiac exam can rapidly identify cardiogenic vs non-cardiogenic shock.',
        importance: 'critical',
        category: 'Diagnosis',
      },
      {
        id: 'shock-pearl-3',
        text: 'MAP ≥65 is the target, but some patients need higher. Use end-organ perfusion markers.',
        importance: 'high',
        category: 'Targets',
      },
      {
        id: 'shock-pearl-4',
        text: 'Lactate clearance >10% every 2 hours indicates adequate resuscitation.',
        importance: 'high',
        category: 'Monitoring',
      },
      {
        id: 'shock-pearl-5',
        text: 'Cold extremities with low SvO2 = cardiogenic. Warm extremities with high SvO2 = distributive.',
        importance: 'moderate',
        category: 'Diagnosis',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'shock-dx-1',
        title: 'Shock Definition',
        criteria: [
          { id: 'dx-1-1', text: 'Systolic BP <90 mmHg or MAP <65 mmHg', required: true },
          { id: 'dx-1-2', text: 'Evidence of tissue hypoperfusion', required: true },
          { id: 'dx-1-3', text: 'Elevated lactate (>2 mmol/L)', value: '>2 mmol/L' },
          { id: 'dx-1-4', text: 'Oliguria (<0.5 mL/kg/hr)', value: '<0.5 mL/kg/hr' },
          { id: 'dx-1-5', text: 'Altered mental status' },
          { id: 'dx-1-6', text: 'Mottled skin/delayed cap refill' },
        ],
      },
      {
        id: 'shock-dx-2',
        title: 'Shock Classification',
        criteria: [
          { id: 'dx-2-1', text: 'Distributive: Warm, vasodilated, high CO, low SVR (sepsis, anaphylaxis)' },
          { id: 'dx-2-2', text: 'Cardiogenic: Cold, low CO, high SVR, elevated filling pressures' },
          { id: 'dx-2-3', text: 'Hypovolemic: Cold, low CO, low filling pressures (hemorrhage, dehydration)' },
          { id: 'dx-2-4', text: 'Obstructive: PE, tamponade, tension pneumothorax' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'shock-tx-1',
        phase: 'Immediate',
        title: 'Rapid Assessment',
        timing: '0-15 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Obtain IV access (2 large-bore IVs or central line)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Bedside echo to classify shock type', priority: 'immediate', details: 'LV function, RV strain, IVC, pericardial effusion' },
          { id: 'tx-1-3', text: 'Labs: Lactate, BMP, CBC, troponin, VBG', priority: 'immediate' },
          { id: 'tx-1-4', text: 'EKG - rule out STEMI', priority: 'immediate' },
        ],
      },
      {
        id: 'shock-tx-2',
        phase: 'Resuscitation',
        title: 'Type-Specific Treatment',
        timing: '15-60 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Distributive: Fluids + early vasopressors (norepinephrine)', priority: 'urgent' },
          { id: 'tx-2-2', text: 'Cardiogenic: Cautious fluids, inotropes (dobutamine), consider mechanical support', priority: 'urgent' },
          { id: 'tx-2-3', text: 'Hypovolemic: Aggressive fluid/blood resuscitation, identify source', priority: 'urgent' },
          { id: 'tx-2-4', text: 'Obstructive: Treat underlying cause (tPA for PE, pericardiocentesis, needle decompression)', priority: 'immediate' },
        ],
      },
    ],
    medications: [
      {
        id: 'shock-med-1',
        name: 'Norepinephrine',
        category: 'first-line',
        indication: 'First-line vasopressor for most shock states',
        dosing: [
          { route: 'IV', dose: '0.01-0.5 mcg/kg/min', notes: 'Start 5-10 mcg/min, titrate to MAP' },
        ],
        pearls: ['Preferred in distributive shock', 'Also reasonable in cardiogenic shock'],
      },
      {
        id: 'shock-med-2',
        name: 'Dobutamine',
        category: 'first-line',
        indication: 'Inotrope for cardiogenic shock',
        dosing: [
          { route: 'IV', dose: '2.5-20 mcg/kg/min', notes: 'Titrate to cardiac output' },
        ],
        sideEffects: ['Tachycardia', 'Hypotension', 'Arrhythmias'],
        pearls: ['May need to combine with norepinephrine', 'Avoid in hypovolemia'],
      },
      {
        id: 'shock-med-3',
        name: 'Epinephrine',
        category: 'rescue',
        indication: 'Anaphylaxis, refractory cardiogenic shock',
        dosing: [
          { route: 'IM', dose: '0.3-0.5 mg (1:1000)', notes: 'For anaphylaxis' },
          { route: 'IV', dose: '0.01-0.5 mcg/kg/min', notes: 'For shock' },
        ],
        pearls: ['First-line in anaphylaxis', 'Increases myocardial O2 demand'],
      },
    ],
    pitfalls: [
      {
        id: 'shock-pitfall-1',
        title: 'Not classifying shock type',
        description: 'Treating all shock the same way',
        consequence: 'Wrong treatment - fluids harm cardiogenic shock, vasopressors alone fail in hypovolemia',
        prevention: 'Bedside echo within 15 minutes to classify shock',
        severity: 'critical',
      },
      {
        id: 'shock-pitfall-2',
        title: 'Fixating on blood pressure alone',
        description: 'Achieving target MAP without assessing perfusion',
        consequence: 'Missed tissue hypoperfusion, ongoing shock despite "normal" BP',
        prevention: 'Follow lactate clearance, urine output, mental status, skin perfusion',
        severity: 'major',
      },
    ],
  },
};

/**
 * Get content for a chapter by ID
 */
export function getChapterContent(chapterId: string): IBCCChapterContent | undefined {
  return CHAPTER_CONTENT[chapterId];
}

/**
 * Check if a chapter has embedded content
 */
export function hasChapterContent(chapterId: string): boolean {
  return chapterId in CHAPTER_CONTENT;
}
