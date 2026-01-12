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

  // ============================================
  // ARDS - Comprehensive Content
  // ============================================
  ards: {
    keyPearls: [
      {
        id: 'ards-pearl-1',
        text: 'Low tidal volume ventilation (6 mL/kg IBW) is the ONLY proven intervention to reduce ARDS mortality.',
        importance: 'critical',
        category: 'Ventilation',
      },
      {
        id: 'ards-pearl-2',
        text: 'Use IDEAL body weight, not actual weight, for tidal volume calculations. Obese patients get the same Vt as lean patients of same height.',
        importance: 'critical',
        category: 'Ventilation',
      },
      {
        id: 'ards-pearl-3',
        text: 'Prone positioning for 16+ hours/day reduces mortality in moderate-severe ARDS (P/F <150).',
        importance: 'critical',
        category: 'Positioning',
      },
      {
        id: 'ards-pearl-4',
        text: 'Plateau pressure <30 cm H2O and driving pressure <15 cm H2O are key ventilator targets.',
        importance: 'high',
        category: 'Ventilation',
      },
      {
        id: 'ards-pearl-5',
        text: 'Conservative fluid strategy improves oxygenation and reduces ventilator days in ARDS.',
        importance: 'high',
        category: 'Fluids',
      },
      {
        id: 'ards-pearl-6',
        text: 'PEEP improves oxygenation but optimal PEEP strategy remains debated. Use ARDSNet tables or driving pressure-guided approach.',
        importance: 'moderate',
        category: 'Ventilation',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'ards-dx-1',
        title: 'Berlin Definition of ARDS',
        criteria: [
          { id: 'dx-1-1', text: 'Acute onset within 1 week of clinical insult or new/worsening respiratory symptoms', required: true },
          { id: 'dx-1-2', text: 'Bilateral opacities on chest imaging not fully explained by effusions, collapse, or nodules', required: true },
          { id: 'dx-1-3', text: 'Respiratory failure not fully explained by cardiac failure or fluid overload', required: true },
          { id: 'dx-1-4', text: 'Impaired oxygenation with PEEP ≥5 cm H2O', required: true },
        ],
        notes: 'Objective assessment (echo) needed to exclude hydrostatic edema if no risk factor present',
      },
      {
        id: 'ards-dx-2',
        title: 'ARDS Severity Classification',
        criteria: [
          { id: 'dx-2-1', text: 'Mild: P/F 200-300 mmHg', value: 'P/F 200-300' },
          { id: 'dx-2-2', text: 'Moderate: P/F 100-200 mmHg', value: 'P/F 100-200' },
          { id: 'dx-2-3', text: 'Severe: P/F <100 mmHg', value: 'P/F <100' },
        ],
        notes: 'All with PEEP ≥5 cm H2O. Mortality increases with severity.',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'ards-tx-1',
        phase: 'Initial',
        title: 'Lung-Protective Ventilation',
        timing: 'Immediate',
        actions: [
          { id: 'tx-1-1', text: 'Calculate ideal body weight: Male = 50 + 2.3(height in inches - 60); Female = 45.5 + 2.3(height in inches - 60)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Set tidal volume 6 mL/kg IBW (range 4-8 mL/kg)', priority: 'immediate', details: 'Start at 6, may reduce to 4 if plateau pressure high' },
          { id: 'tx-1-3', text: 'Set initial PEEP using ARDSNet Low PEEP/High FiO2 table', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Target plateau pressure ≤30 cm H2O', priority: 'immediate' },
          { id: 'tx-1-5', text: 'Target pH 7.25-7.45, allow permissive hypercapnia', priority: 'urgent' },
        ],
        notes: 'ARDSNet protocol: target Vt 6 mL/kg IBW, Pplat ≤30, SpO2 88-95%',
      },
      {
        id: 'ards-tx-2',
        phase: 'Moderate-Severe',
        title: 'Adjunctive Therapies',
        timing: 'If P/F <150',
        actions: [
          { id: 'tx-2-1', text: 'Initiate prone positioning 16+ hours/day', priority: 'urgent', details: 'PROSEVA trial: mortality benefit in moderate-severe ARDS' },
          { id: 'tx-2-2', text: 'Consider neuromuscular blockade for first 48 hours', priority: 'routine', details: 'Cisatracurium - may improve oxygenation' },
          { id: 'tx-2-3', text: 'Conservative fluid strategy once hemodynamically stable', priority: 'routine' },
          { id: 'tx-2-4', text: 'Optimize PEEP using driving pressure (Pplat - PEEP) <15 cm H2O', priority: 'routine' },
        ],
      },
      {
        id: 'ards-tx-3',
        phase: 'Refractory',
        title: 'Rescue Therapies',
        timing: 'If failing conventional therapy',
        actions: [
          { id: 'tx-3-1', text: 'Consider inhaled pulmonary vasodilators (iNO, epoprostenol)', priority: 'routine', details: 'Improve oxygenation but no mortality benefit' },
          { id: 'tx-3-2', text: 'Consider ECMO referral for refractory hypoxemia', priority: 'routine', details: 'P/F <80 for >6 hours or pH <7.25 with PaCO2 ≥60' },
          { id: 'tx-3-3', text: 'Recruitment maneuvers with caution', priority: 'routine', details: 'May cause hemodynamic instability' },
        ],
      },
    ],
    medications: [
      {
        id: 'ards-med-1',
        name: 'Cisatracurium',
        genericName: 'cisatracurium besylate',
        category: 'adjunct',
        indication: 'Neuromuscular blockade for severe ARDS',
        dosing: [
          { route: 'IV', dose: '0.1-0.2 mg/kg bolus, then 1-3 mcg/kg/min infusion', notes: 'Train-of-four monitoring' },
        ],
        contraindications: ['Myasthenia gravis'],
        sideEffects: ['ICU-acquired weakness with prolonged use', 'Requires deep sedation'],
        monitoringParameters: ['Train-of-four', 'Sedation depth'],
        pearls: [
          'Consider for first 48 hours in severe ARDS',
          'Reduces oxygen consumption, prevents ventilator dyssynchrony',
        ],
      },
      {
        id: 'ards-med-2',
        name: 'Inhaled Epoprostenol',
        genericName: 'epoprostenol sodium',
        category: 'rescue',
        indication: 'Refractory hypoxemia in ARDS',
        dosing: [
          { route: 'INH', dose: '10-50 ng/kg/min via ventilator circuit', notes: 'Titrate to oxygenation' },
        ],
        sideEffects: ['Systemic hypotension if absorbed', 'Rebound hypoxemia if stopped abruptly'],
        monitoringParameters: ['SpO2', 'Blood pressure'],
        pearls: [
          'Improves V/Q matching by dilating vessels in ventilated lung units',
          'No mortality benefit but may buy time',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'ards-pitfall-1',
        title: 'Using actual body weight for tidal volume',
        description: 'Calculating Vt based on actual weight instead of ideal body weight',
        consequence: 'Obese patients receive dangerously high tidal volumes causing VILI',
        prevention: 'Always use IBW formula based on HEIGHT, not weight',
        severity: 'critical',
      },
      {
        id: 'ards-pitfall-2',
        title: 'Not proning early enough',
        description: 'Delaying prone positioning until patient is moribund',
        consequence: 'Missing window of mortality benefit',
        prevention: 'Initiate proning when P/F <150 with FiO2 ≥0.6, not as last resort',
        severity: 'major',
      },
      {
        id: 'ards-pitfall-3',
        title: 'Ignoring driving pressure',
        description: 'Focusing only on plateau pressure without calculating driving pressure',
        consequence: 'Suboptimal PEEP settings, ongoing lung injury',
        prevention: 'Target driving pressure (Pplat - PEEP) <15 cm H2O',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Cardiogenic pulmonary edema',
      'Diffuse alveolar hemorrhage',
      'Acute eosinophilic pneumonia',
      'Acute interstitial pneumonia (AIP)',
      'Drug-induced lung injury',
      'Pulmonary vasculitis',
    ],
    tables: [
      {
        id: 'ards-table-1',
        title: 'ARDSNet Low PEEP/FiO2 Table',
        headers: ['FiO2', 'PEEP (cm H2O)'],
        rows: [
          ['0.3', '5'],
          ['0.4', '5-8'],
          ['0.5', '8-10'],
          ['0.6', '10'],
          ['0.7', '10-14'],
          ['0.8', '14'],
          ['0.9', '14-18'],
          ['1.0', '18-24'],
        ],
      },
    ],
  },

  // ============================================
  // PULMONARY EMBOLISM - Comprehensive Content
  // ============================================
  'pulmonary-embolism': {
    keyPearls: [
      {
        id: 'pe-pearl-1',
        text: 'Risk stratify ALL PEs. Massive (hypotensive), submassive (RV strain, elevated biomarkers), low-risk. Treatment differs dramatically.',
        importance: 'critical',
        category: 'Risk Stratification',
      },
      {
        id: 'pe-pearl-2',
        text: 'Hypotensive PE (massive) = systemic thrombolysis or catheter-directed therapy. Do not delay for testing.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'pe-pearl-3',
        text: 'RV strain on echo + elevated troponin = submassive PE. Consider advanced therapies if clinical deterioration.',
        importance: 'high',
        category: 'Risk Stratification',
      },
      {
        id: 'pe-pearl-4',
        text: 'PERC rule: If ALL 8 criteria negative, no D-dimer needed. Low pretest probability + negative D-dimer = PE ruled out.',
        importance: 'high',
        category: 'Diagnosis',
      },
      {
        id: 'pe-pearl-5',
        text: 'Avoid aggressive fluid resuscitation in PE. RV is preload-sensitive. Small boluses (250-500 mL) if needed.',
        importance: 'high',
        category: 'Resuscitation',
      },
      {
        id: 'pe-pearl-6',
        text: 'Thrombolysis window is longer than stroke - can consider up to 14 days after symptom onset.',
        importance: 'moderate',
        category: 'Treatment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'pe-dx-1',
        title: 'PERC Rule (PE Ruled Out if ALL negative)',
        criteria: [
          { id: 'dx-1-1', text: 'Age <50 years' },
          { id: 'dx-1-2', text: 'Heart rate <100 bpm' },
          { id: 'dx-1-3', text: 'SpO2 ≥95% on room air' },
          { id: 'dx-1-4', text: 'No hemoptysis' },
          { id: 'dx-1-5', text: 'No estrogen use' },
          { id: 'dx-1-6', text: 'No prior DVT/PE' },
          { id: 'dx-1-7', text: 'No unilateral leg swelling' },
          { id: 'dx-1-8', text: 'No surgery/trauma requiring hospitalization in past 4 weeks' },
        ],
        notes: 'Only apply PERC if clinical gestalt is LOW probability',
      },
      {
        id: 'pe-dx-2',
        title: 'PE Severity Classification',
        criteria: [
          { id: 'dx-2-1', text: 'Massive (High-risk): Hypotension (SBP <90 or drop >40 for 15+ min), obstructive shock, cardiac arrest', value: 'High-risk' },
          { id: 'dx-2-2', text: 'Submassive (Intermediate-risk): RV dysfunction AND/OR elevated biomarkers (troponin, BNP)', value: 'Intermediate-risk' },
          { id: 'dx-2-3', text: 'Low-risk: No hemodynamic compromise, no RV dysfunction, normal biomarkers', value: 'Low-risk' },
        ],
      },
      {
        id: 'pe-dx-3',
        title: 'Signs of RV Strain (Echo)',
        criteria: [
          { id: 'dx-3-1', text: 'RV dilation (RV:LV ratio >0.9 or >1.0)', value: 'RV dilated' },
          { id: 'dx-3-2', text: 'RV hypokinesis with apical sparing (McConnell sign)' },
          { id: 'dx-3-3', text: 'Septal flattening or bowing into LV (D-sign)' },
          { id: 'dx-3-4', text: 'TAPSE <16 mm (tricuspid annular plane systolic excursion)' },
          { id: 'dx-3-5', text: 'Elevated PA pressure (TR jet velocity)' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'pe-tx-1',
        phase: 'Initial',
        title: 'Immediate Stabilization',
        timing: '0-30 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Assess hemodynamic stability (BP, HR, perfusion)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Supplemental O2 to maintain SpO2 >90%', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Obtain EKG, troponin, BNP', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Bedside echo if hemodynamically unstable', priority: 'immediate', details: 'Look for RV strain, McConnell sign' },
          { id: 'tx-1-5', text: 'Start anticoagulation unless contraindicated', priority: 'immediate' },
        ],
      },
      {
        id: 'pe-tx-2',
        phase: 'Risk-Stratified',
        title: 'Definitive Treatment',
        timing: '30-60 minutes',
        actions: [
          { id: 'tx-2-1', text: 'MASSIVE PE: Systemic thrombolysis (tPA) or catheter-directed therapy', priority: 'immediate', details: 'Alteplase 100 mg over 2 hours' },
          { id: 'tx-2-2', text: 'SUBMASSIVE PE: Close monitoring, consider thrombolysis if deterioration', priority: 'urgent', details: 'Half-dose tPA may have better safety profile' },
          { id: 'tx-2-3', text: 'LOW-RISK PE: Anticoagulation alone, consider early discharge', priority: 'routine' },
          { id: 'tx-2-4', text: 'Vasopressors if hypotensive (norepinephrine preferred)', priority: 'urgent' },
        ],
      },
      {
        id: 'pe-tx-3',
        phase: 'Refractory',
        title: 'Rescue Therapies',
        timing: 'If failing initial treatment',
        actions: [
          { id: 'tx-3-1', text: 'Catheter-directed thrombolysis or thrombectomy', priority: 'urgent' },
          { id: 'tx-3-2', text: 'Surgical embolectomy for contraindication to thrombolysis', priority: 'urgent' },
          { id: 'tx-3-3', text: 'VA-ECMO as bridge in refractory obstructive shock', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'pe-med-1',
        name: 'Alteplase (tPA)',
        genericName: 'alteplase',
        category: 'first-line',
        indication: 'Systemic thrombolysis for massive PE',
        dosing: [
          { route: 'IV', dose: '100 mg over 2 hours', notes: 'Standard dose for PE' },
          { route: 'IV', dose: '50 mg bolus over 15 min', notes: 'Half-dose option for submassive PE' },
          { route: 'IV', dose: '50 mg bolus', notes: 'Cardiac arrest dose' },
        ],
        contraindications: ['Active bleeding', 'Recent stroke (<3 months)', 'Intracranial neoplasm', 'Recent major surgery (<3 weeks)'],
        sideEffects: ['Major bleeding (6-13%)', 'Intracranial hemorrhage (1-3%)'],
        monitoringParameters: ['Bleeding', 'Neurologic status'],
        pearls: [
          'Half-dose may be as effective with less bleeding',
          'Do not delay for labs in cardiac arrest',
        ],
      },
      {
        id: 'pe-med-2',
        name: 'Unfractionated Heparin',
        genericName: 'heparin sodium',
        category: 'first-line',
        indication: 'Anticoagulation for PE',
        dosing: [
          { route: 'IV', dose: '80 units/kg bolus, then 18 units/kg/hr infusion', notes: 'Target aPTT 1.5-2.5x control' },
        ],
        contraindications: ['Active major bleeding', 'Severe thrombocytopenia', 'HIT'],
        sideEffects: ['Bleeding', 'HIT', 'Osteoporosis (long-term)'],
        monitoringParameters: ['aPTT q6h until stable', 'Platelets', 'Hemoglobin'],
        pearls: [
          'Preferred if thrombolysis anticipated (shorter half-life, reversible)',
          'Can continue through thrombolysis',
        ],
      },
      {
        id: 'pe-med-3',
        name: 'Enoxaparin',
        genericName: 'enoxaparin sodium',
        category: 'first-line',
        indication: 'Anticoagulation for low-intermediate risk PE',
        dosing: [
          { route: 'SC', dose: '1 mg/kg q12h or 1.5 mg/kg daily', renalAdjustment: 'CrCl <30: 1 mg/kg daily' },
        ],
        contraindications: ['CrCl <15', 'Active major bleeding'],
        monitoringParameters: ['Anti-Xa levels if renal impairment', 'Platelets'],
        pearls: [
          'No monitoring needed in most patients',
          'Avoid if thrombolysis may be needed',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'pe-pitfall-1',
        title: 'Not risk stratifying PE',
        description: 'Treating all PEs with anticoagulation alone',
        consequence: 'Missed opportunity for thrombolysis in massive PE, death from RV failure',
        prevention: 'Assess hemodynamics, get echo and biomarkers in all intermediate-high probability cases',
        severity: 'critical',
      },
      {
        id: 'pe-pitfall-2',
        title: 'Aggressive fluid resuscitation',
        description: 'Giving large fluid boluses to hypotensive PE patient',
        consequence: 'RV overload, worsening septal bowing, LV failure',
        prevention: 'Small boluses only (250-500 mL), prefer vasopressors',
        severity: 'critical',
      },
      {
        id: 'pe-pitfall-3',
        title: 'Over-relying on D-dimer',
        description: 'Ordering D-dimer in high-probability patients or ruling out PE based on D-dimer',
        consequence: 'Missed PE due to false interpretation',
        prevention: 'D-dimer only useful in LOW pretest probability. High probability → go straight to CTA.',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Acute coronary syndrome',
      'Aortic dissection',
      'Pneumothorax',
      'Pneumonia',
      'Pericarditis/tamponade',
      'Musculoskeletal pain',
    ],
  },

  // ============================================
  // ACUTE KIDNEY INJURY - Comprehensive Content
  // ============================================
  aki: {
    keyPearls: [
      {
        id: 'aki-pearl-1',
        text: 'Classify AKI as prerenal, intrinsic, or postrenal. History and FENa can differentiate, but FENa is unreliable with diuretics.',
        importance: 'critical',
        category: 'Classification',
      },
      {
        id: 'aki-pearl-2',
        text: 'Stop all nephrotoxins immediately: NSAIDs, aminoglycosides, contrast, ACE-I/ARBs in hypovolemia.',
        importance: 'critical',
        category: 'Prevention',
      },
      {
        id: 'aki-pearl-3',
        text: 'Emergent dialysis indications: Acidosis (refractory), Electrolytes (hyperK), Ingestion (toxic), Overload (fluid), Uremia (symptoms). AEIOU.',
        importance: 'critical',
        category: 'Dialysis',
      },
      {
        id: 'aki-pearl-4',
        text: 'Renal ultrasound for ALL new AKI to rule out obstruction. Hydronephrosis = urgent urology consult.',
        importance: 'high',
        category: 'Diagnosis',
      },
      {
        id: 'aki-pearl-5',
        text: 'ATN takes 7-21 days to recover. Prerenal AKI improves within 24-48 hours of volume correction.',
        importance: 'moderate',
        category: 'Prognosis',
      },
      {
        id: 'aki-pearl-6',
        text: 'Urine output <0.5 mL/kg/hr for 6 hours is AKI by KDIGO criteria, even with normal creatinine.',
        importance: 'moderate',
        category: 'Diagnosis',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'aki-dx-1',
        title: 'KDIGO AKI Definition (any of)',
        criteria: [
          { id: 'dx-1-1', text: 'Increase in SCr ≥0.3 mg/dL within 48 hours', required: true, value: '≥0.3 mg/dL rise' },
          { id: 'dx-1-2', text: 'Increase in SCr ≥1.5x baseline within 7 days', required: true, value: '≥1.5x baseline' },
          { id: 'dx-1-3', text: 'Urine output <0.5 mL/kg/hr for 6 hours', required: true, value: '<0.5 mL/kg/hr' },
        ],
        notes: 'Only one criterion needed for diagnosis',
      },
      {
        id: 'aki-dx-2',
        title: 'KDIGO AKI Staging',
        criteria: [
          { id: 'dx-2-1', text: 'Stage 1: SCr 1.5-1.9x baseline OR ≥0.3 mg/dL increase OR UOP <0.5 mL/kg/hr for 6-12 hrs', value: 'Stage 1' },
          { id: 'dx-2-2', text: 'Stage 2: SCr 2.0-2.9x baseline OR UOP <0.5 mL/kg/hr for ≥12 hrs', value: 'Stage 2' },
          { id: 'dx-2-3', text: 'Stage 3: SCr ≥3x baseline OR SCr ≥4.0 OR RRT OR UOP <0.3 mL/kg/hr for ≥24 hrs OR anuria ≥12 hrs', value: 'Stage 3' },
        ],
      },
      {
        id: 'aki-dx-3',
        title: 'Prerenal vs ATN (Urine Indices)',
        criteria: [
          { id: 'dx-3-1', text: 'FENa <1% suggests prerenal', value: 'FENa <1%' },
          { id: 'dx-3-2', text: 'FENa >2% suggests ATN', value: 'FENa >2%' },
          { id: 'dx-3-3', text: 'FEUrea <35% suggests prerenal (use if on diuretics)', value: 'FEUrea <35%' },
          { id: 'dx-3-4', text: 'Urine Na <20 suggests prerenal', value: 'UNa <20' },
        ],
        notes: 'FENa unreliable with diuretics, contrast, sepsis. Use FEUrea instead.',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'aki-tx-1',
        phase: 'Immediate',
        title: 'Initial Assessment',
        timing: '0-2 hours',
        actions: [
          { id: 'tx-1-1', text: 'Review medications - stop all nephrotoxins', priority: 'immediate', details: 'NSAIDs, aminoglycosides, ACE-I/ARBs, contrast' },
          { id: 'tx-1-2', text: 'Check potassium - treat if >5.5 mEq/L', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Order renal ultrasound to rule out obstruction', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Assess volume status (JVP, edema, orthostatics)', priority: 'immediate' },
          { id: 'tx-1-5', text: 'Urinalysis with microscopy - look for muddy brown casts (ATN), RBC casts (GN)', priority: 'urgent' },
        ],
      },
      {
        id: 'aki-tx-2',
        phase: 'Etiology-Specific',
        title: 'Targeted Treatment',
        timing: '2-24 hours',
        actions: [
          { id: 'tx-2-1', text: 'PRERENAL: IV fluid resuscitation with crystalloids', priority: 'urgent', details: 'Target MAP >65, urine output >0.5 mL/kg/hr' },
          { id: 'tx-2-2', text: 'OBSTRUCTIVE: Urgent Foley catheter, urology consult for stent/nephrostomy', priority: 'immediate' },
          { id: 'tx-2-3', text: 'INTRINSIC: Supportive care, avoid further nephrotoxins', priority: 'routine' },
          { id: 'tx-2-4', text: 'Consider nephrology consult for suspected glomerulonephritis or unclear etiology', priority: 'routine' },
        ],
      },
      {
        id: 'aki-tx-3',
        phase: 'Dialysis',
        title: 'Renal Replacement Therapy',
        timing: 'When indicated',
        actions: [
          { id: 'tx-3-1', text: 'Emergent dialysis for: Refractory hyperkalemia, severe acidosis, uremic symptoms, refractory fluid overload', priority: 'immediate' },
          { id: 'tx-3-2', text: 'Place dialysis catheter (IJ or femoral)', priority: 'urgent' },
          { id: 'tx-3-3', text: 'Choose modality: CRRT if hemodynamically unstable, IHD if stable', priority: 'routine' },
        ],
        notes: 'Remember AEIOU: Acidosis, Electrolytes, Ingestion, Overload, Uremia',
      },
    ],
    medications: [
      {
        id: 'aki-med-1',
        name: 'Furosemide',
        genericName: 'furosemide',
        category: 'adjunct',
        indication: 'Volume overload in AKI',
        dosing: [
          { route: 'IV', dose: '40-80 mg bolus or infusion 5-20 mg/hr', notes: 'Double dose if no response' },
        ],
        contraindications: ['Anuria', 'Severe hypovolemia'],
        sideEffects: ['Hypokalemia', 'Hyponatremia', 'Ototoxicity (high doses)'],
        monitoringParameters: ['Urine output', 'Potassium', 'Creatinine'],
        pearls: [
          'Does NOT improve renal outcomes or mortality',
          'Use for volume management, not to "make kidneys work"',
        ],
      },
      {
        id: 'aki-med-2',
        name: 'Calcium Gluconate',
        genericName: 'calcium gluconate',
        category: 'first-line',
        indication: 'Cardiac membrane stabilization in hyperkalemia',
        dosing: [
          { route: 'IV', dose: '1-2 grams over 5-10 minutes', notes: 'Can repeat if EKG changes persist' },
        ],
        monitoringParameters: ['EKG', 'Potassium'],
        pearls: [
          'First step in hyperkalemia with EKG changes',
          'Does NOT lower potassium - stabilizes the heart',
        ],
      },
      {
        id: 'aki-med-3',
        name: 'Sodium Bicarbonate',
        genericName: 'sodium bicarbonate',
        category: 'adjunct',
        indication: 'Severe metabolic acidosis in AKI',
        dosing: [
          { route: 'IV', dose: '150 mEq in 1L D5W or 50-100 mEq bolus', notes: 'Target pH >7.20' },
        ],
        contraindications: ['Severe fluid overload'],
        sideEffects: ['Volume overload', 'Hypokalemia', 'Hypernatremia'],
        pearls: [
          'May worsen intracellular acidosis in some settings',
          'Consider if pH <7.1-7.2 and bridge to dialysis',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'aki-pitfall-1',
        title: 'Missing urinary obstruction',
        description: 'Not obtaining renal ultrasound in new AKI',
        consequence: 'Delayed decompression of obstructed kidney, irreversible damage',
        prevention: 'Renal ultrasound for ALL new AKI within first 24 hours',
        severity: 'critical',
      },
      {
        id: 'aki-pitfall-2',
        title: 'Continuing nephrotoxins',
        description: 'Not reviewing medication list for nephrotoxic drugs',
        consequence: 'Ongoing renal injury, prolonged AKI, need for dialysis',
        prevention: 'Stop NSAIDs, aminoglycosides, ACE-I/ARBs immediately in AKI',
        severity: 'critical',
      },
      {
        id: 'aki-pitfall-3',
        title: 'Using diuretics to treat AKI',
        description: 'Giving furosemide believing it will improve renal function',
        consequence: 'False reassurance from urine output, delayed dialysis, worse outcomes',
        prevention: 'Diuretics only for VOLUME management, not to treat AKI',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Prerenal azotemia (hypovolemia, CHF, cirrhosis)',
      'Acute tubular necrosis',
      'Interstitial nephritis (drug-induced)',
      'Glomerulonephritis',
      'Obstructive uropathy',
      'Atheroembolic disease',
      'Contrast nephropathy',
      'Hepatorenal syndrome',
    ],
  },

  // ============================================
  // STATUS EPILEPTICUS - Comprehensive Content
  // ============================================
  'status-epilepticus': {
    keyPearls: [
      {
        id: 'se-pearl-1',
        text: 'Definition: Seizure >5 minutes OR ≥2 seizures without return to baseline. Do not wait 30 minutes to treat.',
        importance: 'critical',
        category: 'Definition',
      },
      {
        id: 'se-pearl-2',
        text: 'Benzodiazepines are FIRST-LINE. Give immediately. IM midazolam is as effective as IV lorazepam.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'se-pearl-3',
        text: 'Check glucose immediately - hypoglycemia is reversible cause. Give D50 if glucose <60 or unknown.',
        importance: 'critical',
        category: 'Workup',
      },
      {
        id: 'se-pearl-4',
        text: 'Phenytoin/fosphenytoin requires 20 minutes to infuse. Start it early, do not wait for benzo failure.',
        importance: 'high',
        category: 'Treatment',
      },
      {
        id: 'se-pearl-5',
        text: 'Nonconvulsive status epilepticus: If patient does not wake up after seizure control, get STAT EEG.',
        importance: 'high',
        category: 'Diagnosis',
      },
      {
        id: 'se-pearl-6',
        text: 'Levetiracetam has fewer drug interactions and no cardiac effects. Consider as second-line agent.',
        importance: 'moderate',
        category: 'Treatment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'se-dx-1',
        title: 'Status Epilepticus Definition',
        criteria: [
          { id: 'dx-1-1', text: 'Continuous seizure activity lasting >5 minutes', required: true },
          { id: 'dx-1-2', text: 'OR ≥2 discrete seizures without return to baseline consciousness', required: true },
        ],
        notes: 'Older definition of 30 minutes is outdated - treatment should begin at 5 minutes',
      },
      {
        id: 'se-dx-2',
        title: 'Stages of Status Epilepticus',
        criteria: [
          { id: 'dx-2-1', text: 'Early SE: 5-10 minutes', value: 'Early' },
          { id: 'dx-2-2', text: 'Established SE: 10-30 minutes', value: 'Established' },
          { id: 'dx-2-3', text: 'Refractory SE: Continues despite 2 appropriate AED trials', value: 'Refractory' },
          { id: 'dx-2-4', text: 'Super-refractory SE: Continues >24 hours despite anesthesia', value: 'Super-refractory' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'se-tx-1',
        phase: 'Stabilization',
        title: 'Immediate (0-5 min)',
        timing: '0-5 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Protect airway, position patient safely', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Check fingerstick glucose', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Give D50 25-50 mL IV if glucose <60 or unknown', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Establish IV access', priority: 'immediate' },
          { id: 'tx-1-5', text: 'Give thiamine 100 mg IV if alcohol/malnutrition suspected', priority: 'urgent' },
        ],
      },
      {
        id: 'se-tx-2',
        phase: 'First-Line',
        title: 'Benzodiazepines (5-10 min)',
        timing: '5-10 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Lorazepam 4 mg IV (may repeat x1 in 5 min)', priority: 'immediate', details: 'Total max 8 mg' },
          { id: 'tx-2-2', text: 'OR Midazolam 10 mg IM if no IV access', priority: 'immediate', details: 'IM midazolam = IV lorazepam efficacy' },
          { id: 'tx-2-3', text: 'OR Diazepam 10 mg IV (may repeat x1)', priority: 'immediate' },
          { id: 'tx-2-4', text: 'Prepare second-line agent while giving benzo', priority: 'urgent' },
        ],
        notes: 'Do NOT wait for benzo to fail before ordering second-line agent',
      },
      {
        id: 'se-tx-3',
        phase: 'Second-Line',
        title: 'AED Loading (10-30 min)',
        timing: '10-30 minutes',
        actions: [
          { id: 'tx-3-1', text: 'Fosphenytoin 20 mg PE/kg IV at 150 mg PE/min', priority: 'urgent', details: 'Monitor for hypotension, arrhythmia' },
          { id: 'tx-3-2', text: 'OR Levetiracetam 60 mg/kg IV (max 4500 mg) over 15 min', priority: 'urgent', details: 'Fewer drug interactions, no cardiac effects' },
          { id: 'tx-3-3', text: 'OR Valproate 40 mg/kg IV over 10 min', priority: 'urgent', details: 'Avoid in liver disease, pregnancy' },
          { id: 'tx-3-4', text: 'If seizures continue, prepare for third-line treatment', priority: 'routine' },
        ],
      },
      {
        id: 'se-tx-4',
        phase: 'Third-Line (Refractory)',
        title: 'Anesthetic Agents (>30 min)',
        timing: '>30 minutes',
        actions: [
          { id: 'tx-4-1', text: 'Intubate for airway protection', priority: 'immediate' },
          { id: 'tx-4-2', text: 'Start continuous EEG monitoring', priority: 'immediate' },
          { id: 'tx-4-3', text: 'Propofol: 2 mg/kg bolus, then 20-200 mcg/kg/min', priority: 'urgent' },
          { id: 'tx-4-4', text: 'OR Midazolam: 0.2 mg/kg bolus, then 0.05-2 mg/kg/hr', priority: 'urgent' },
          { id: 'tx-4-5', text: 'OR Pentobarbital: 5 mg/kg bolus, then 1-5 mg/kg/hr', priority: 'urgent', details: 'For super-refractory cases' },
        ],
        notes: 'Target burst suppression on EEG for 24-48 hours, then slow wean',
      },
    ],
    medications: [
      {
        id: 'se-med-1',
        name: 'Lorazepam',
        genericName: 'lorazepam',
        category: 'first-line',
        indication: 'First-line treatment for status epilepticus',
        dosing: [
          { route: 'IV', dose: '4 mg over 2 minutes, may repeat x1 in 5 min', maxDose: '8 mg total' },
        ],
        sideEffects: ['Respiratory depression', 'Hypotension', 'Sedation'],
        monitoringParameters: ['Respiratory status', 'Blood pressure', 'Mental status'],
        pearls: [
          'Longer duration of action than diazepam',
          'Requires refrigeration for stability',
        ],
      },
      {
        id: 'se-med-2',
        name: 'Midazolam',
        genericName: 'midazolam',
        category: 'first-line',
        indication: 'First-line when IV access not available',
        dosing: [
          { route: 'IM', dose: '10 mg (5 mg if <40 kg)', notes: 'RAMPART trial: IM midazolam = IV lorazepam' },
          { route: 'IV', dose: '0.2 mg/kg bolus for refractory SE', notes: 'Then 0.05-2 mg/kg/hr infusion' },
        ],
        sideEffects: ['Respiratory depression', 'Hypotension'],
        pearls: [
          'IM route is rapid and effective',
          'Room temperature stable - ideal for EMS',
        ],
      },
      {
        id: 'se-med-3',
        name: 'Fosphenytoin',
        genericName: 'fosphenytoin sodium',
        category: 'second-line',
        indication: 'Second-line AED for status epilepticus',
        dosing: [
          { route: 'IV', dose: '20 mg PE/kg at 150 mg PE/min', maxDose: '30 mg PE/kg if needed' },
        ],
        contraindications: ['Sinus bradycardia', 'SA block', 'Second/third degree AV block'],
        sideEffects: ['Hypotension', 'Arrhythmias', 'Purple glove syndrome (phenytoin only)'],
        monitoringParameters: ['Blood pressure', 'EKG during infusion', 'Phenytoin levels'],
        pearls: [
          'Fosphenytoin can be given faster and IM; phenytoin is IV only',
          'Requires ~20 min to infuse - start early',
        ],
      },
      {
        id: 'se-med-4',
        name: 'Levetiracetam',
        genericName: 'levetiracetam',
        category: 'second-line',
        indication: 'Alternative second-line AED',
        dosing: [
          { route: 'IV', dose: '60 mg/kg over 15 minutes', maxDose: '4500 mg' },
        ],
        sideEffects: ['Agitation', 'Somnolence'],
        pearls: [
          'No drug interactions - ideal for polypharmacy patients',
          'No cardiac effects - safe in cardiac disease',
          'Renal dosing required',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'se-pitfall-1',
        title: 'Waiting too long to treat',
        description: 'Observing seizure without treatment, waiting for spontaneous termination',
        consequence: 'Seizures become harder to treat over time, neuronal injury accumulates',
        prevention: 'Treat as status epilepticus at 5 minutes. Give benzos IMMEDIATELY.',
        severity: 'critical',
      },
      {
        id: 'se-pitfall-2',
        title: 'Not checking glucose',
        description: 'Treating seizure without checking fingerstick glucose',
        consequence: 'Missed hypoglycemia - easily reversible cause',
        prevention: 'Fingerstick glucose is part of initial assessment',
        severity: 'critical',
      },
      {
        id: 'se-pitfall-3',
        title: 'Underdosing benzodiazepines',
        description: 'Giving inadequate benzo doses due to fear of respiratory depression',
        consequence: 'Seizure continues, need for more aggressive treatment',
        prevention: 'Use full doses: Lorazepam 4 mg, Midazolam 10 mg. Be prepared to manage airway.',
        severity: 'major',
      },
      {
        id: 'se-pitfall-4',
        title: 'Missing nonconvulsive status',
        description: 'Patient stops convulsing but remains altered - assuming seizure resolved',
        consequence: 'Ongoing subclinical seizures causing brain injury',
        prevention: 'If patient does not wake up after treatment, get STAT EEG',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Psychogenic nonepileptic seizures (PNES)',
      'Convulsive syncope',
      'Movement disorders (dystonia, chorea)',
      'Rigors/shivering',
      'Decerebrate/decorticate posturing',
    ],
  },

  // ============================================
  // CARDIAC ARREST - Comprehensive Content
  // ============================================
  'cardiac-arrest': {
    keyPearls: [
      {
        id: 'ca-pearl-1',
        text: 'High-quality CPR is the most important intervention. Push hard (2+ inches), fast (100-120/min), allow full recoil, minimize interruptions.',
        importance: 'critical',
        category: 'CPR',
      },
      {
        id: 'ca-pearl-2',
        text: 'Shockable rhythms (VF/pVT): Defibrillate immediately. Every minute of delay reduces survival by 7-10%.',
        importance: 'critical',
        category: 'Defibrillation',
      },
      {
        id: 'ca-pearl-3',
        text: 'Think Hs and Ts for reversible causes: Hypovolemia, Hypoxia, H+, Hypo/HyperK, Hypothermia, Tension PTX, Tamponade, Toxins, Thrombosis (PE/MI).',
        importance: 'critical',
        category: 'Reversible Causes',
      },
      {
        id: 'ca-pearl-4',
        text: 'Epinephrine timing: Give every 3-5 minutes. For shockable rhythms, give after 2nd shock.',
        importance: 'high',
        category: 'Medications',
      },
      {
        id: 'ca-pearl-5',
        text: 'ETCO2 <10 mmHg after 20 min of CPR predicts non-survival. Consider termination if no ROSC and ETCO2 persistently low.',
        importance: 'high',
        category: 'Prognosis',
      },
      {
        id: 'ca-pearl-6',
        text: 'Post-ROSC: Avoid hyperoxia (target SpO2 94-98%), maintain normothermia or targeted temperature management, emergent cath for STEMI.',
        importance: 'high',
        category: 'Post-Arrest',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'ca-dx-1',
        title: 'Cardiac Arrest Recognition',
        criteria: [
          { id: 'dx-1-1', text: 'Unresponsive patient', required: true },
          { id: 'dx-1-2', text: 'No normal breathing (agonal gasps do not count)', required: true },
          { id: 'dx-1-3', text: 'No pulse (check <10 seconds)', required: true },
        ],
        notes: 'Do not delay CPR to confirm - start immediately if unresponsive and not breathing normally',
      },
      {
        id: 'ca-dx-2',
        title: 'Arrest Rhythms',
        criteria: [
          { id: 'dx-2-1', text: 'VF: Chaotic, irregular waveforms, no organized QRS', value: 'Shockable' },
          { id: 'dx-2-2', text: 'pVT: Wide-complex regular rhythm, no pulse', value: 'Shockable' },
          { id: 'dx-2-3', text: 'Asystole: Flatline, no electrical activity', value: 'Non-shockable' },
          { id: 'dx-2-4', text: 'PEA: Organized rhythm but no pulse', value: 'Non-shockable' },
        ],
      },
      {
        id: 'ca-dx-3',
        title: 'Hs and Ts (Reversible Causes)',
        criteria: [
          { id: 'dx-3-1', text: 'Hypovolemia', value: 'H' },
          { id: 'dx-3-2', text: 'Hypoxia', value: 'H' },
          { id: 'dx-3-3', text: 'Hydrogen ion (acidosis)', value: 'H' },
          { id: 'dx-3-4', text: 'Hypo/Hyperkalemia', value: 'H' },
          { id: 'dx-3-5', text: 'Hypothermia', value: 'H' },
          { id: 'dx-3-6', text: 'Tension pneumothorax', value: 'T' },
          { id: 'dx-3-7', text: 'Tamponade (cardiac)', value: 'T' },
          { id: 'dx-3-8', text: 'Toxins', value: 'T' },
          { id: 'dx-3-9', text: 'Thrombosis (PE)', value: 'T' },
          { id: 'dx-3-10', text: 'Thrombosis (coronary/MI)', value: 'T' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'ca-tx-1',
        phase: 'Immediate',
        title: 'BLS Response',
        timing: '0-2 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Confirm unresponsive, not breathing normally, no pulse', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Call for help, get AED/defibrillator', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Start CPR: 30 compressions : 2 breaths (or continuous compressions with advanced airway)', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Compression rate 100-120/min, depth ≥2 inches (5 cm)', priority: 'immediate' },
        ],
      },
      {
        id: 'ca-tx-2',
        phase: 'Shockable Rhythm',
        title: 'VF/pVT Algorithm',
        timing: 'When rhythm identified',
        actions: [
          { id: 'tx-2-1', text: 'Defibrillate immediately (biphasic 120-200J)', priority: 'immediate' },
          { id: 'tx-2-2', text: 'Resume CPR immediately for 2 minutes', priority: 'immediate' },
          { id: 'tx-2-3', text: 'Establish IV/IO access', priority: 'urgent' },
          { id: 'tx-2-4', text: 'Epinephrine 1 mg IV after 2nd shock, then q3-5 min', priority: 'urgent' },
          { id: 'tx-2-5', text: 'Amiodarone 300 mg IV after 3rd shock', priority: 'urgent' },
          { id: 'tx-2-6', text: 'Continue cycles: CPR → Rhythm check → Shock if indicated', priority: 'routine' },
        ],
      },
      {
        id: 'ca-tx-3',
        phase: 'Non-Shockable Rhythm',
        title: 'Asystole/PEA Algorithm',
        timing: 'When rhythm identified',
        actions: [
          { id: 'tx-3-1', text: 'Continue high-quality CPR', priority: 'immediate' },
          { id: 'tx-3-2', text: 'Epinephrine 1 mg IV as soon as possible, then q3-5 min', priority: 'immediate' },
          { id: 'tx-3-3', text: 'Search for and treat reversible causes (Hs and Ts)', priority: 'urgent' },
          { id: 'tx-3-4', text: 'Consider: Ultrasound to assess cardiac activity and reversible causes', priority: 'routine' },
          { id: 'tx-3-5', text: 'PEA with narrow QRS: Consider PE - give tPA', priority: 'routine' },
        ],
        notes: 'PEA often has an underlying reversible cause - focus on Hs and Ts',
      },
      {
        id: 'ca-tx-4',
        phase: 'ROSC',
        title: 'Post-Arrest Care',
        timing: 'After ROSC achieved',
        actions: [
          { id: 'tx-4-1', text: 'Optimize ventilation: Target SpO2 94-98%, avoid hyperoxia', priority: 'immediate' },
          { id: 'tx-4-2', text: 'Maintain MAP ≥65 mmHg (vasopressors if needed)', priority: 'immediate' },
          { id: 'tx-4-3', text: 'Obtain 12-lead EKG - emergent cath if STEMI', priority: 'immediate' },
          { id: 'tx-4-4', text: 'Targeted temperature management 32-36°C for 24 hours', priority: 'urgent', details: 'For comatose patients' },
          { id: 'tx-4-5', text: 'ICU admission, continuous monitoring', priority: 'urgent' },
          { id: 'tx-4-6', text: 'Treat underlying cause identified during arrest', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'ca-med-1',
        name: 'Epinephrine',
        genericName: 'epinephrine',
        category: 'first-line',
        indication: 'Vasopressor in cardiac arrest',
        dosing: [
          { route: 'IV', dose: '1 mg every 3-5 minutes', notes: 'Give as soon as possible in non-shockable rhythms' },
          { route: 'IV', dose: '1 mg after 2nd shock', notes: 'For shockable rhythms' },
        ],
        sideEffects: ['Post-ROSC hypertension', 'Tachyarrhythmias'],
        pearls: [
          'Alpha effect (vasoconstriction) is key - increases coronary perfusion pressure',
          'Push dose: 10-20 mcg boluses for post-ROSC hypotension',
        ],
      },
      {
        id: 'ca-med-2',
        name: 'Amiodarone',
        genericName: 'amiodarone',
        category: 'first-line',
        indication: 'Refractory VF/pVT',
        dosing: [
          { route: 'IV', dose: '300 mg after 3rd shock', notes: 'First dose' },
          { route: 'IV', dose: '150 mg for subsequent dose', notes: 'If VF/pVT recurs' },
        ],
        sideEffects: ['Hypotension', 'Bradycardia (post-ROSC)'],
        pearls: [
          'Give after 3rd shock if VF/pVT persists',
          'Alternative: Lidocaine 1-1.5 mg/kg',
        ],
      },
      {
        id: 'ca-med-3',
        name: 'Sodium Bicarbonate',
        genericName: 'sodium bicarbonate',
        category: 'adjunct',
        indication: 'Known or suspected hyperkalemia or TCA overdose',
        dosing: [
          { route: 'IV', dose: '50-100 mEq bolus', notes: 'Do not give routinely' },
        ],
        pearls: [
          'Not recommended for routine use in arrest',
          'Give for hyperkalemia, TCA overdose, prolonged arrest with known acidosis',
        ],
      },
      {
        id: 'ca-med-4',
        name: 'Calcium Chloride',
        genericName: 'calcium chloride',
        category: 'adjunct',
        indication: 'Hyperkalemia, hypocalcemia, calcium channel blocker overdose',
        dosing: [
          { route: 'IV', dose: '1-2 grams (10% solution) slow push', notes: 'Via central line preferred' },
        ],
        pearls: [
          'Calcium chloride has 3x the elemental calcium of calcium gluconate',
          'Give for known hyperkalemia or CCB toxicity',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'ca-pitfall-1',
        title: 'Poor quality CPR',
        description: 'Shallow compressions, slow rate, incomplete recoil, excessive pauses',
        consequence: 'Inadequate coronary and cerebral perfusion, reduced survival',
        prevention: 'Push hard (≥2 in), fast (100-120/min), full recoil, minimize interruptions <10 sec',
        severity: 'critical',
      },
      {
        id: 'ca-pitfall-2',
        title: 'Delayed defibrillation',
        description: 'Continuing CPR without checking rhythm or delaying shock for VF/pVT',
        consequence: 'VF degrades to asystole over time. Every minute without shock reduces survival 7-10%.',
        prevention: 'Early rhythm check, immediate defibrillation for shockable rhythms',
        severity: 'critical',
      },
      {
        id: 'ca-pitfall-3',
        title: 'Not addressing reversible causes',
        description: 'Running ACLS algorithm without considering Hs and Ts',
        consequence: 'Treatable cause (hyperK, PE, tamponade, tension PTX) not addressed',
        prevention: 'Actively think through Hs and Ts during every arrest. Use bedside ultrasound.',
        severity: 'critical',
      },
      {
        id: 'ca-pitfall-4',
        title: 'Hyperoxia post-ROSC',
        description: 'Leaving FiO2 at 100% after ROSC',
        consequence: 'Increased oxidative stress, worse neurologic outcomes',
        prevention: 'Target SpO2 94-98%, wean FiO2 as soon as ROSC achieved',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Ventricular fibrillation (primary cardiac)',
      'Pulseless ventricular tachycardia',
      'Asystole',
      'Pulseless electrical activity (with underlying cause)',
      'Respiratory arrest leading to cardiac arrest',
    ],
    tables: [
      {
        id: 'ca-table-1',
        title: 'ACLS Drug Dosing Quick Reference',
        headers: ['Drug', 'Dose', 'Timing'],
        rows: [
          ['Epinephrine', '1 mg IV/IO', 'q3-5 min'],
          ['Amiodarone', '300 mg, then 150 mg', 'After 3rd shock'],
          ['Lidocaine', '1-1.5 mg/kg, then 0.5-0.75 mg/kg', 'Alternative to amiodarone'],
          ['Sodium bicarb', '50-100 mEq', 'HyperK, TCA OD only'],
          ['Calcium chloride', '1-2 g', 'HyperK, CCB OD'],
          ['Magnesium', '1-2 g', 'Torsades de pointes'],
        ],
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
