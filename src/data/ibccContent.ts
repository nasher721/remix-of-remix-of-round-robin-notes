/**
 * IBCC Content Data
 * Curated content from the Internet Book of Critical Care (EMCrit)
 * https://emcrit.org/ibcc/
 */

import type { IBCCChapter, IBCCCategory, ClinicalCalculator, ProtocolChecklist, MedicalSystem } from '@/types/ibcc';

export const IBCC_BASE_URL = 'https://emcrit.org/ibcc';

export const IBCC_CATEGORIES: IBCCCategory[] = [
  { id: 'resuscitation', name: 'Resuscitation', icon: '🫀', color: 'hsl(0 84% 60%)' },
  { id: 'cardiology', name: 'Cardiology', icon: '❤️', color: 'hsl(0 84% 50%)' },
  { id: 'pulmonology', name: 'Pulmonology', icon: '🫁', color: 'hsl(200 80% 50%)' },
  { id: 'nephrology', name: 'Nephrology', icon: '💧', color: 'hsl(210 80% 50%)' },
  { id: 'neurology', name: 'Neurology', icon: '🧠', color: 'hsl(280 60% 50%)' },
  { id: 'infectious', name: 'Infectious Disease', icon: '🦠', color: 'hsl(120 60% 40%)' },
  { id: 'endocrine', name: 'Endocrine', icon: '⚡', color: 'hsl(45 90% 50%)' },
  { id: 'hematology', name: 'Hematology', icon: '🩸', color: 'hsl(350 80% 45%)' },
  { id: 'gi', name: 'GI/Hepatology', icon: '🍽️', color: 'hsl(30 70% 50%)' },
  { id: 'toxicology', name: 'Toxicology', icon: '☠️', color: 'hsl(270 50% 40%)' },
  { id: 'procedures', name: 'Procedures', icon: '💉', color: 'hsl(180 50% 45%)' },
  { id: 'general', name: 'General Critical Care', icon: '🏥', color: 'hsl(220 60% 50%)' },
];

export const MEDICAL_SYSTEM_MAP: Record<MedicalSystem, { label: string; icon: string }> = {
  cardiology: { label: 'Cardiology', icon: '❤️' },
  pulmonology: { label: 'Pulmonology', icon: '🫁' },
  nephrology: { label: 'Nephrology', icon: '💧' },
  neurology: { label: 'Neurology', icon: '🧠' },
  infectious: { label: 'Infectious Disease', icon: '🦠' },
  endocrine: { label: 'Endocrine', icon: '⚡' },
  hematology: { label: 'Hematology', icon: '🩸' },
  gi: { label: 'GI/Hepatology', icon: '🍽️' },
  toxicology: { label: 'Toxicology', icon: '☠️' },
  resuscitation: { label: 'Resuscitation', icon: '🫀' },
  procedures: { label: 'Procedures', icon: '💉' },
  general: { label: 'General', icon: '🏥' },
};

export const IBCC_CHAPTERS: IBCCChapter[] = [
  // Resuscitation & Shock
  {
    id: 'shock',
    title: 'Approach to Shock',
    slug: 'shock',
    url: `${IBCC_BASE_URL}/shock/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'resuscitation')!,
    system: 'resuscitation',
    keywords: ['shock', 'hypotension', 'vasopressor', 'septic shock', 'cardiogenic shock', 'hypovolemic', 'distributive', 'MAP', 'lactate'],
    summary: 'Comprehensive approach to evaluating and managing shock states including distributive, cardiogenic, hypovolemic, and obstructive shock.',
  },
  {
    id: 'cardiac-arrest',
    title: 'Cardiac Arrest',
    slug: 'cardiac-arrest',
    url: `${IBCC_BASE_URL}/cardiac-arrest/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'resuscitation')!,
    system: 'resuscitation',
    keywords: ['cardiac arrest', 'ACLS', 'CPR', 'ROSC', 'PEA', 'asystole', 'VF', 'VT', 'epinephrine', 'defibrillation'],
    summary: 'Evidence-based approach to cardiac arrest including ACLS algorithms, medication timing, and post-resuscitation care.',
  },
  {
    id: 'vasopressors',
    title: 'Vasopressors & Inotropes',
    slug: 'vasopressors',
    url: `${IBCC_BASE_URL}/pressors/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'resuscitation')!,
    system: 'resuscitation',
    keywords: ['norepinephrine', 'vasopressin', 'epinephrine', 'dobutamine', 'dopamine', 'phenylephrine', 'inotrope', 'vasopressor'],
    summary: 'Selection and dosing of vasopressors and inotropes for various shock states.',
  },

  // Cardiology
  {
    id: 'afib',
    title: 'Atrial Fibrillation',
    slug: 'afib',
    url: `${IBCC_BASE_URL}/afib/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'cardiology')!,
    system: 'cardiology',
    keywords: ['atrial fibrillation', 'AF', 'AFib', 'rate control', 'rhythm control', 'anticoagulation', 'diltiazem', 'amiodarone', 'CHADS2'],
    summary: 'Management of atrial fibrillation including rate vs rhythm control and anticoagulation decisions.',
  },
  {
    id: 'stemi',
    title: 'STEMI',
    slug: 'stemi',
    url: `${IBCC_BASE_URL}/stemi/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'cardiology')!,
    system: 'cardiology',
    keywords: ['STEMI', 'myocardial infarction', 'MI', 'ACS', 'troponin', 'PCI', 'thrombolytics', 'chest pain', 'ECG', 'ST elevation'],
    summary: 'Diagnosis and management of ST-elevation myocardial infarction.',
  },
  {
    id: 'heart-failure',
    title: 'Acute Heart Failure',
    slug: 'chf',
    url: `${IBCC_BASE_URL}/chf/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'cardiology')!,
    system: 'cardiology',
    keywords: ['heart failure', 'CHF', 'pulmonary edema', 'cardiogenic shock', 'BNP', 'diuretics', 'furosemide', 'GDMT', 'EF'],
    summary: 'Approach to acute decompensated heart failure and cardiogenic pulmonary edema.',
  },
  {
    id: 'hypertensive-emergency',
    title: 'Hypertensive Emergency',
    slug: 'hypertensive-emergency',
    url: `${IBCC_BASE_URL}/hypertensive-emergency/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'cardiology')!,
    system: 'cardiology',
    keywords: ['hypertensive emergency', 'hypertensive urgency', 'blood pressure', 'nicardipine', 'labetalol', 'clevidipine', 'end organ damage'],
    summary: 'Identification and treatment of hypertensive emergencies with end-organ damage.',
  },

  // Pulmonology
  {
    id: 'ards',
    title: 'ARDS',
    slug: 'ards',
    url: `${IBCC_BASE_URL}/ards/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['ARDS', 'acute respiratory distress syndrome', 'lung protective ventilation', 'PEEP', 'prone positioning', 'P/F ratio', 'hypoxemia'],
    summary: 'Diagnosis and lung-protective management of ARDS including proning and PEEP strategies.',
  },
  {
    id: 'mechanical-ventilation',
    title: 'Mechanical Ventilation',
    slug: 'vent',
    url: `${IBCC_BASE_URL}/vent/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['mechanical ventilation', 'ventilator', 'tidal volume', 'PEEP', 'FiO2', 'sedation', 'weaning', 'extubation', 'respiratory failure'],
    summary: 'Comprehensive guide to mechanical ventilation modes, settings, and weaning.',
  },
  {
    id: 'copd',
    title: 'COPD Exacerbation',
    slug: 'copd',
    url: `${IBCC_BASE_URL}/copd/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['COPD', 'chronic obstructive pulmonary disease', 'bronchodilators', 'steroids', 'BiPAP', 'NIPPV', 'exacerbation'],
    summary: 'Management of acute COPD exacerbation including bronchodilators and ventilatory support.',
  },
  {
    id: 'asthma',
    title: 'Severe Asthma',
    slug: 'asthma',
    url: `${IBCC_BASE_URL}/asthma/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['asthma', 'status asthmaticus', 'bronchospasm', 'albuterol', 'magnesium', 'ketamine', 'intubation'],
    summary: 'Critical care approach to severe asthma exacerbation and status asthmaticus.',
  },
  {
    id: 'pulmonary-embolism',
    title: 'Pulmonary Embolism',
    slug: 'pe',
    url: `${IBCC_BASE_URL}/pe/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['pulmonary embolism', 'PE', 'DVT', 'VTE', 'anticoagulation', 'heparin', 'thrombolysis', 'D-dimer', 'CTA', 'right heart strain'],
    summary: 'Diagnosis and risk-stratified treatment of pulmonary embolism.',
  },

  // Nephrology
  {
    id: 'aki',
    title: 'Acute Kidney Injury',
    slug: 'aki',
    url: `${IBCC_BASE_URL}/aki/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'nephrology')!,
    system: 'nephrology',
    keywords: ['AKI', 'acute kidney injury', 'creatinine', 'renal failure', 'oliguria', 'dialysis', 'CRRT', 'uremia'],
    summary: 'Evaluation and management of acute kidney injury including dialysis indications.',
  },
  {
    id: 'hyperkalemia',
    title: 'Hyperkalemia',
    slug: 'hyperkalemia',
    url: `${IBCC_BASE_URL}/hyperkalemia/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'nephrology')!,
    system: 'nephrology',
    keywords: ['hyperkalemia', 'potassium', 'calcium gluconate', 'insulin', 'kayexalate', 'dialysis', 'ECG changes', 'peaked T waves'],
    summary: 'Emergent treatment of hyperkalemia and prevention of cardiac arrhythmias.',
  },
  {
    id: 'hyponatremia',
    title: 'Hyponatremia',
    slug: 'hyponatremia',
    url: `${IBCC_BASE_URL}/hyponatremia/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'nephrology')!,
    system: 'nephrology',
    keywords: ['hyponatremia', 'sodium', 'SIADH', 'hypertonic saline', 'fluid restriction', 'osmotic demyelination', 'cerebral edema'],
    summary: 'Safe correction of hyponatremia while avoiding osmotic demyelination syndrome.',
  },
  {
    id: 'acid-base',
    title: 'Acid-Base Disorders',
    slug: 'acid-base',
    url: `${IBCC_BASE_URL}/acid-base/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'nephrology')!,
    system: 'nephrology',
    keywords: ['acid-base', 'metabolic acidosis', 'metabolic alkalosis', 'respiratory acidosis', 'pH', 'bicarbonate', 'anion gap', 'lactate'],
    summary: 'Systematic approach to acid-base disorders including anion gap and compensation.',
  },

  // Endocrine
  {
    id: 'dka',
    title: 'Diabetic Ketoacidosis (DKA)',
    slug: 'dka',
    url: `${IBCC_BASE_URL}/dka/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['DKA', 'diabetic ketoacidosis', 'insulin', 'glucose', 'ketones', 'anion gap', 'potassium', 'bicarbonate', 'diabetes'],
    summary: 'Protocol-driven management of DKA including fluid resuscitation and insulin therapy.',
  },
  {
    id: 'hhs',
    title: 'Hyperosmolar Hyperglycemic State',
    slug: 'hhs',
    url: `${IBCC_BASE_URL}/hhs/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['HHS', 'hyperosmolar', 'hyperglycemia', 'dehydration', 'osmolality', 'altered mental status'],
    summary: 'Management of HHS with focus on gradual rehydration and glucose correction.',
  },
  {
    id: 'hypoglycemia',
    title: 'Hypoglycemia',
    slug: 'hypoglycemia',
    url: `${IBCC_BASE_URL}/hypoglycemia/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['hypoglycemia', 'low glucose', 'dextrose', 'glucagon', 'insulin overdose', 'altered mental status'],
    summary: 'Rapid recognition and treatment of hypoglycemia.',
  },
  {
    id: 'adrenal-crisis',
    title: 'Adrenal Crisis',
    slug: 'adrenal-crisis',
    url: `${IBCC_BASE_URL}/adrenal/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['adrenal crisis', 'adrenal insufficiency', 'cortisol', 'hydrocortisone', 'stress dose steroids', 'hypotension'],
    summary: 'Recognition and emergency treatment of adrenal crisis.',
  },
  {
    id: 'thyroid-storm',
    title: 'Thyroid Storm',
    slug: 'thyroid-storm',
    url: `${IBCC_BASE_URL}/thyroid-storm/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['thyroid storm', 'thyrotoxicosis', 'hyperthyroidism', 'PTU', 'methimazole', 'beta blocker', 'tachycardia', 'fever'],
    summary: 'Emergency management of thyroid storm with multi-drug therapy.',
  },

  // Neurology
  {
    id: 'stroke',
    title: 'Acute Ischemic Stroke',
    slug: 'stroke',
    url: `${IBCC_BASE_URL}/stroke/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'neurology')!,
    system: 'neurology',
    keywords: ['stroke', 'ischemic stroke', 'tPA', 'thrombectomy', 'NIHSS', 'blood pressure', 'CT', 'MRI'],
    summary: 'Time-critical management of acute ischemic stroke including reperfusion therapy.',
  },
  {
    id: 'status-epilepticus',
    title: 'Status Epilepticus',
    slug: 'status-epilepticus',
    url: `${IBCC_BASE_URL}/status-epilepticus/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'neurology')!,
    system: 'neurology',
    keywords: ['status epilepticus', 'seizure', 'benzodiazepine', 'lorazepam', 'levetiracetam', 'phenytoin', 'refractory'],
    summary: 'Tiered approach to status epilepticus from first-line to refractory treatment.',
  },
  {
    id: 'intracranial-hemorrhage',
    title: 'Intracranial Hemorrhage',
    slug: 'ich',
    url: `${IBCC_BASE_URL}/ich/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'neurology')!,
    system: 'neurology',
    keywords: ['ICH', 'intracranial hemorrhage', 'blood pressure', 'reversal', 'anticoagulation', 'ICP', 'herniation', 'neurosurgery'],
    summary: 'Critical care management of spontaneous intracranial hemorrhage.',
  },
  {
    id: 'meningitis',
    title: 'Meningitis',
    slug: 'meningitis',
    url: `${IBCC_BASE_URL}/meningitis/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'neurology')!,
    system: 'neurology',
    keywords: ['meningitis', 'CSF', 'lumbar puncture', 'antibiotics', 'dexamethasone', 'neck stiffness', 'encephalitis'],
    summary: 'Rapid diagnosis and empiric treatment of bacterial meningitis.',
  },

  // Infectious Disease
  {
    id: 'sepsis',
    title: 'Sepsis',
    slug: 'sepsis',
    url: `${IBCC_BASE_URL}/sepsis/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'infectious')!,
    system: 'infectious',
    keywords: ['sepsis', 'septic shock', 'SIRS', 'qSOFA', 'lactate', 'antibiotics', 'source control', 'fluid resuscitation'],
    summary: 'Evidence-based approach to sepsis and septic shock management.',
  },
  {
    id: 'pneumonia',
    title: 'Pneumonia',
    slug: 'pneumonia',
    url: `${IBCC_BASE_URL}/pna/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'infectious')!,
    system: 'infectious',
    keywords: ['pneumonia', 'CAP', 'HAP', 'VAP', 'antibiotics', 'respiratory failure', 'procalcitonin'],
    summary: 'Management of community-acquired and hospital-acquired pneumonia.',
  },
  {
    id: 'uti',
    title: 'Urinary Tract Infection',
    slug: 'uti',
    url: `${IBCC_BASE_URL}/uti/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'infectious')!,
    system: 'infectious',
    keywords: ['UTI', 'urinary tract infection', 'pyelonephritis', 'urosepsis', 'antibiotics', 'catheter'],
    summary: 'Approach to complicated UTI and urosepsis in critical care.',
  },
  {
    id: 'cdiff',
    title: 'C. difficile Infection',
    slug: 'cdiff',
    url: `${IBCC_BASE_URL}/cdiff/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'infectious')!,
    system: 'infectious',
    keywords: ['C. difficile', 'CDI', 'Clostridioides difficile', 'vancomycin', 'fidaxomicin', 'toxic megacolon', 'diarrhea'],
    summary: 'Severity-stratified treatment of C. difficile infection.',
  },

  // Hematology
  {
    id: 'anticoagulation-reversal',
    title: 'Anticoagulation Reversal',
    slug: 'anticoagulation-reversal',
    url: `${IBCC_BASE_URL}/anticoagulation-reversal/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'hematology')!,
    system: 'hematology',
    keywords: ['anticoagulation', 'reversal', 'warfarin', 'heparin', 'DOAC', 'vitamin K', 'PCC', 'FFP', 'bleeding'],
    summary: 'Rapid reversal of anticoagulation in life-threatening bleeding.',
  },
  {
    id: 'transfusion',
    title: 'Blood Transfusion',
    slug: 'transfusion',
    url: `${IBCC_BASE_URL}/transfusion/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'hematology')!,
    system: 'hematology',
    keywords: ['transfusion', 'PRBC', 'platelets', 'FFP', 'massive transfusion', 'hemoglobin', 'bleeding'],
    summary: 'Indications and approach to blood product transfusion.',
  },
  {
    id: 'dic',
    title: 'DIC',
    slug: 'dic',
    url: `${IBCC_BASE_URL}/dic/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'hematology')!,
    system: 'hematology',
    keywords: ['DIC', 'disseminated intravascular coagulation', 'coagulopathy', 'fibrinogen', 'D-dimer', 'platelets'],
    summary: 'Diagnosis and management of DIC with focus on treating underlying cause.',
  },

  // GI/Hepatology
  {
    id: 'gi-bleeding',
    title: 'GI Bleeding',
    slug: 'gib',
    url: `${IBCC_BASE_URL}/gib/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'gi')!,
    system: 'gi',
    keywords: ['GI bleeding', 'upper GI bleed', 'lower GI bleed', 'melena', 'hematemesis', 'endoscopy', 'PPI', 'transfusion'],
    summary: 'Risk stratification and management of acute GI hemorrhage.',
  },
  {
    id: 'hepatic-encephalopathy',
    title: 'Hepatic Encephalopathy',
    slug: 'hepatic-encephalopathy',
    url: `${IBCC_BASE_URL}/hepatic-encephalopathy/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'gi')!,
    system: 'gi',
    keywords: ['hepatic encephalopathy', 'cirrhosis', 'ammonia', 'lactulose', 'rifaximin', 'altered mental status', 'liver failure'],
    summary: 'Recognition and treatment of hepatic encephalopathy in liver disease.',
  },
  {
    id: 'acute-liver-failure',
    title: 'Acute Liver Failure',
    slug: 'alf',
    url: `${IBCC_BASE_URL}/alf/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'gi')!,
    system: 'gi',
    keywords: ['acute liver failure', 'ALF', 'INR', 'encephalopathy', 'acetaminophen', 'NAC', 'transplant'],
    summary: 'Critical care management of acute liver failure.',
  },
  {
    id: 'pancreatitis',
    title: 'Acute Pancreatitis',
    slug: 'pancreatitis',
    url: `${IBCC_BASE_URL}/pancreatitis/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'gi')!,
    system: 'gi',
    keywords: ['pancreatitis', 'lipase', 'amylase', 'fluid resuscitation', 'necrotizing pancreatitis', 'nutrition'],
    summary: 'Severity assessment and supportive care for acute pancreatitis.',
  },

  // Toxicology
  {
    id: 'acetaminophen',
    title: 'Acetaminophen Toxicity',
    slug: 'acetaminophen',
    url: `${IBCC_BASE_URL}/acetaminophen/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'toxicology')!,
    system: 'toxicology',
    keywords: ['acetaminophen', 'tylenol', 'NAC', 'N-acetylcysteine', 'liver failure', 'Rumack-Matthew nomogram', 'overdose'],
    summary: 'Risk stratification and NAC protocol for acetaminophen overdose.',
  },
  {
    id: 'opioid-overdose',
    title: 'Opioid Overdose',
    slug: 'opioid',
    url: `${IBCC_BASE_URL}/opioid/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'toxicology')!,
    system: 'toxicology',
    keywords: ['opioid', 'overdose', 'naloxone', 'narcan', 'respiratory depression', 'fentanyl', 'heroin'],
    summary: 'Naloxone dosing and supportive care for opioid toxicity.',
  },
  {
    id: 'alcohol-withdrawal',
    title: 'Alcohol Withdrawal',
    slug: 'alcohol-withdrawal',
    url: `${IBCC_BASE_URL}/alcohol-withdrawal/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'toxicology')!,
    system: 'toxicology',
    keywords: ['alcohol withdrawal', 'delirium tremens', 'DTs', 'benzodiazepine', 'phenobarbital', 'seizure', 'CIWA'],
    summary: 'Symptom-triggered and front-loading approaches to alcohol withdrawal.',
  },

  // Procedures
  {
    id: 'intubation',
    title: 'Airway Management',
    slug: 'airway',
    url: `${IBCC_BASE_URL}/airway/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'procedures')!,
    system: 'procedures',
    keywords: ['intubation', 'RSI', 'airway', 'laryngoscopy', 'video laryngoscopy', 'cricothyrotomy', 'difficult airway'],
    summary: 'Approach to emergency airway management and RSI.',
  },
  {
    id: 'central-line',
    title: 'Central Line Placement',
    slug: 'central-line',
    url: `${IBCC_BASE_URL}/central-line/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'procedures')!,
    system: 'procedures',
    keywords: ['central line', 'central venous catheter', 'IJ', 'subclavian', 'femoral', 'ultrasound', 'CVP'],
    summary: 'Ultrasound-guided central venous catheter placement technique.',
  },
  {
    id: 'lumbar-puncture',
    title: 'Lumbar Puncture',
    slug: 'lumbar-puncture',
    url: `${IBCC_BASE_URL}/lp/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'procedures')!,
    system: 'procedures',
    keywords: ['lumbar puncture', 'LP', 'CSF', 'spinal tap', 'meningitis', 'opening pressure'],
    summary: 'Indications, technique, and CSF interpretation for LP.',
  },
];

// Clinical Calculators
export const CLINICAL_CALCULATORS: ClinicalCalculator[] = [
  {
    id: 'chads2vasc',
    name: 'CHA₂DS₂-VASc Score',
    description: 'Stroke risk in atrial fibrillation',
    chapterId: 'afib',
    inputs: [
      { id: 'chf', label: 'CHF History', type: 'boolean' },
      { id: 'htn', label: 'Hypertension', type: 'boolean' },
      { id: 'age75', label: 'Age ≥75', type: 'boolean' },
      { id: 'diabetes', label: 'Diabetes', type: 'boolean' },
      { id: 'stroke', label: 'Stroke/TIA/TE', type: 'boolean' },
      { id: 'vascular', label: 'Vascular Disease', type: 'boolean' },
      { id: 'age65', label: 'Age 65-74', type: 'boolean' },
      { id: 'female', label: 'Female Sex', type: 'boolean' },
    ],
    formula: (inputs) => {
      let score = 0;
      if (inputs.chf) score += 1;
      if (inputs.htn) score += 1;
      if (inputs.age75) score += 2;
      if (inputs.diabetes) score += 1;
      if (inputs.stroke) score += 2;
      if (inputs.vascular) score += 1;
      if (inputs.age65) score += 1;
      if (inputs.female) score += 1;
      
      const risk = score === 0 ? 'low' : score === 1 ? 'moderate' : 'high';
      const interpretation = score === 0 
        ? 'Low risk - anticoagulation generally not recommended'
        : score === 1 
        ? 'Moderate risk - consider anticoagulation'
        : 'High risk - anticoagulation recommended';
      
      return { value: score, interpretation, risk };
    },
  },
  {
    id: 'wells-pe',
    name: 'Wells Score for PE',
    description: 'Probability of pulmonary embolism',
    chapterId: 'pulmonary-embolism',
    inputs: [
      { id: 'dvt', label: 'Clinical signs of DVT', type: 'boolean' },
      { id: 'alternative', label: 'PE is #1 diagnosis or equally likely', type: 'boolean' },
      { id: 'hr100', label: 'Heart rate >100', type: 'boolean' },
      { id: 'immobile', label: 'Immobilization/surgery in past 4 weeks', type: 'boolean' },
      { id: 'prior', label: 'Previous PE or DVT', type: 'boolean' },
      { id: 'hemoptysis', label: 'Hemoptysis', type: 'boolean' },
      { id: 'cancer', label: 'Malignancy', type: 'boolean' },
    ],
    formula: (inputs) => {
      let score = 0;
      if (inputs.dvt) score += 3;
      if (inputs.alternative) score += 3;
      if (inputs.hr100) score += 1.5;
      if (inputs.immobile) score += 1.5;
      if (inputs.prior) score += 1.5;
      if (inputs.hemoptysis) score += 1;
      if (inputs.cancer) score += 1;
      
      const risk = score <= 4 ? 'low' : score <= 6 ? 'moderate' : 'high';
      const interpretation = score <= 4 
        ? 'PE unlikely - consider D-dimer'
        : 'PE likely - consider imaging';
      
      return { value: score, interpretation, risk };
    },
  },
  {
    id: 'meld',
    name: 'MELD Score',
    description: 'Liver disease severity',
    chapterId: 'acute-liver-failure',
    inputs: [
      { id: 'creatinine', label: 'Creatinine', type: 'number', unit: 'mg/dL', min: 0.1, max: 15 },
      { id: 'bilirubin', label: 'Bilirubin', type: 'number', unit: 'mg/dL', min: 0.1, max: 50 },
      { id: 'inr', label: 'INR', type: 'number', min: 0.8, max: 10 },
      { id: 'dialysis', label: 'Dialysis 2x in past week', type: 'boolean' },
    ],
    formula: (inputs) => {
      let cr = Number(inputs.creatinine) || 1;
      let bili = Number(inputs.bilirubin) || 1;
      let inr = Number(inputs.inr) || 1;
      
      if (cr < 1) cr = 1;
      if (cr > 4 || inputs.dialysis) cr = 4;
      if (bili < 1) bili = 1;
      if (inr < 1) inr = 1;
      
      const score = Math.round(
        10 * (0.957 * Math.log(cr) + 0.378 * Math.log(bili) + 1.120 * Math.log(inr) + 0.643)
      );
      
      const risk = score < 10 ? 'low' : score < 20 ? 'moderate' : score < 30 ? 'high' : 'critical';
      const mortality = score < 10 ? '1.9%' : score < 20 ? '6%' : score < 30 ? '19.6%' : '>50%';
      
      return { 
        value: score, 
        interpretation: `3-month mortality: ${mortality}`,
        risk 
      };
    },
  },
];

// Protocol Checklists
export const PROTOCOL_CHECKLISTS: ProtocolChecklist[] = [
  {
    id: 'sepsis-bundle',
    name: 'Sepsis Hour-1 Bundle',
    chapterId: 'sepsis',
    items: [
      { id: 's1', text: 'Measure lactate level', category: 'Labs', timeframe: '1 hour' },
      { id: 's2', text: 'Obtain blood cultures before antibiotics', category: 'Labs', timeframe: '1 hour' },
      { id: 's3', text: 'Administer broad-spectrum antibiotics', category: 'Treatment', timeframe: '1 hour' },
      { id: 's4', text: 'Begin rapid fluid resuscitation (30 mL/kg crystalloid)', category: 'Resuscitation', timeframe: '1 hour' },
      { id: 's5', text: 'Apply vasopressors if hypotensive after fluid bolus', category: 'Resuscitation', timeframe: '1 hour' },
      { id: 's6', text: 'Re-measure lactate if initial lactate elevated', category: 'Labs', timeframe: '6 hours' },
    ],
  },
  {
    id: 'dka-protocol',
    name: 'DKA Management Protocol',
    chapterId: 'dka',
    items: [
      { id: 'd1', text: 'Initial labs: BMP, VBG, ketones, CBC', category: 'Diagnosis' },
      { id: 'd2', text: 'Start IV fluids: NS 1-2L bolus then 250-500 mL/hr', category: 'Fluids' },
      { id: 'd3', text: 'Check potassium before starting insulin', category: 'Labs' },
      { id: 'd4', text: 'Start insulin drip: 0.1 units/kg/hr (if K+ >3.3)', category: 'Insulin' },
      { id: 'd5', text: 'Add potassium to fluids (goal K+ 4-5)', category: 'Electrolytes' },
      { id: 'd6', text: 'Add dextrose when glucose <250', category: 'Fluids' },
      { id: 'd7', text: 'Check BMP and glucose q1-2h', category: 'Monitoring' },
      { id: 'd8', text: 'Transition to subQ insulin when gap closes', category: 'Transition' },
    ],
  },
  {
    id: 'intubation-checklist',
    name: 'RSI Intubation Checklist',
    chapterId: 'intubation',
    items: [
      { id: 'i1', text: 'Prepare equipment: ETT, stylet, laryngoscope, bougie', category: 'Preparation' },
      { id: 'i2', text: 'Attach monitors: SpO2, ETCO2, ECG', category: 'Monitoring' },
      { id: 'i3', text: 'Position patient (sniffing position)', category: 'Positioning' },
      { id: 'i4', text: 'Preoxygenate: 100% FiO2 for 3+ minutes', category: 'Preoxygenation' },
      { id: 'i5', text: 'Draw up medications: induction + paralytic', category: 'Medications' },
      { id: 'i6', text: 'Administer induction agent', category: 'Induction' },
      { id: 'i7', text: 'Administer paralytic', category: 'Paralysis' },
      { id: 'i8', text: 'Wait for paralysis (60-90 seconds)', category: 'Paralysis' },
      { id: 'i9', text: 'Laryngoscopy and intubation', category: 'Intubation' },
      { id: 'i10', text: 'Confirm placement: ETCO2, bilateral breath sounds, CXR', category: 'Confirmation' },
    ],
  },
];

// Keyword mapping for context detection
export const KEYWORD_PATTERNS: Record<string, string[]> = {
  'shock': ['hypotension', 'low bp', 'vasopressor', 'septic shock', 'cardiogenic shock', 'MAP <65'],
  'dka': ['diabetic ketoacidosis', 'DKA', 'anion gap', 'ketones', 'high glucose', 'type 1 diabetes'],
  'sepsis': ['infection', 'fever', 'SIRS', 'leukocytosis', 'lactate elevated', 'qSOFA'],
  'ards': ['respiratory failure', 'hypoxemia', 'bilateral infiltrates', 'P/F ratio', 'PEEP'],
  'afib': ['atrial fibrillation', 'irregular rhythm', 'rapid ventricular response', 'RVR'],
  'aki': ['acute kidney injury', 'rising creatinine', 'oliguria', 'renal failure'],
  'hyperkalemia': ['high potassium', 'K+ elevated', 'peaked T waves', 'EKG changes'],
  'stroke': ['CVA', 'hemiparesis', 'facial droop', 'slurred speech', 'NIH stroke scale'],
  'pulmonary-embolism': ['PE', 'DVT', 'chest pain', 'tachycardia', 'hypoxia', 'D-dimer elevated'],
  'gi-bleeding': ['melena', 'hematemesis', 'hematochezia', 'dropping hemoglobin', 'GI bleed'],
};
