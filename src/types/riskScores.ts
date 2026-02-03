/**
 * Clinical Risk Score Types
 * Standardized ICU/Hospital risk calculators
 */

export type RiskScoreType = 'sofa' | 'qsofa' | 'curb65' | 'wells_dvt' | 'wells_pe' | 'apache2' | 'news2';

export interface RiskScoreResult {
  score: number;
  maxScore: number;
  interpretation: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recommendation?: string;
  color: string;
}

// SOFA Score (Sequential Organ Failure Assessment)
export interface SOFAInputs {
  pao2fio2?: number; // PaO2/FiO2 ratio
  onVentilator?: boolean;
  platelets?: number; // x10^3/uL
  bilirubin?: number; // mg/dL
  map?: number; // Mean arterial pressure mmHg
  dopamine?: number; // mcg/kg/min
  dobutamine?: boolean;
  epinephrine?: number; // mcg/kg/min
  norepinephrine?: number; // mcg/kg/min
  gcs?: number; // Glasgow Coma Scale 3-15
  creatinine?: number; // mg/dL
  urineOutput?: number; // mL/day
}

// qSOFA (Quick SOFA)
export interface QSOFAInputs {
  respiratoryRate?: number; // breaths/min
  alteredMentation?: boolean; // GCS < 15
  systolicBP?: number; // mmHg
}

// CURB-65 (Pneumonia Severity)
export interface CURB65Inputs {
  confusion?: boolean;
  bun?: number; // mg/dL (>19)
  respiratoryRate?: number; // >=30
  systolicBP?: number; // <90
  diastolicBP?: number; // <=60
  age?: number; // >=65
}

// Wells DVT Score
export interface WellsDVTInputs {
  activeCancer?: boolean; // +1
  paralysisParesis?: boolean; // +1
  recentImmobilization?: boolean; // +1
  localizedTenderness?: boolean; // +1
  entireLegSwollen?: boolean; // +1
  calfSwelling3cm?: boolean; // +1
  pittingEdema?: boolean; // +1
  collateralVeins?: boolean; // +1
  previousDVT?: boolean; // +1
  alternativeDiagnosisLikely?: boolean; // -2
}

// Wells PE Score
export interface WellsPEInputs {
  clinicalDVTSigns?: boolean; // +3
  alternativeDiagnosisLessLikely?: boolean; // +3
  heartRate100?: boolean; // +1.5
  immobilizationOrSurgery?: boolean; // +1.5
  previousPEOrDVT?: boolean; // +1.5
  hemoptysis?: boolean; // +1
  malignancy?: boolean; // +1
}

// NEWS2 Score (National Early Warning Score)
export interface NEWS2Inputs {
  respiratoryRate?: number;
  spo2?: number;
  onSupplementalO2?: boolean;
  temperature?: number;
  systolicBP?: number;
  heartRate?: number;
  consciousness?: 'alert' | 'confusion' | 'voice' | 'pain' | 'unresponsive';
}

// Patient Acuity derived from multiple factors
export interface PatientAcuity {
  level: 1 | 2 | 3 | 4 | 5; // 1 = stable, 5 = critical
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  factors: string[];
  calculatedScores: {
    scoreType: RiskScoreType;
    result: RiskScoreResult;
  }[];
}

// Risk Score Calculator functions
export const calculateSOFA = (inputs: SOFAInputs): RiskScoreResult => {
  let score = 0;

  // Respiration (PaO2/FiO2)
  if (inputs.pao2fio2 !== undefined) {
    if (inputs.pao2fio2 < 100 && inputs.onVentilator) score += 4;
    else if (inputs.pao2fio2 < 200 && inputs.onVentilator) score += 3;
    else if (inputs.pao2fio2 < 300) score += 2;
    else if (inputs.pao2fio2 < 400) score += 1;
  }

  // Coagulation (Platelets)
  if (inputs.platelets !== undefined) {
    if (inputs.platelets < 20) score += 4;
    else if (inputs.platelets < 50) score += 3;
    else if (inputs.platelets < 100) score += 2;
    else if (inputs.platelets < 150) score += 1;
  }

  // Liver (Bilirubin)
  if (inputs.bilirubin !== undefined) {
    if (inputs.bilirubin >= 12) score += 4;
    else if (inputs.bilirubin >= 6) score += 3;
    else if (inputs.bilirubin >= 2) score += 2;
    else if (inputs.bilirubin >= 1.2) score += 1;
  }

  // Cardiovascular
  if (inputs.dopamine !== undefined || inputs.epinephrine !== undefined || inputs.norepinephrine !== undefined || inputs.dobutamine || inputs.map !== undefined) {
    if ((inputs.dopamine && inputs.dopamine > 15) || (inputs.epinephrine && inputs.epinephrine > 0.1) || (inputs.norepinephrine && inputs.norepinephrine > 0.1)) {
      score += 4;
    } else if ((inputs.dopamine && inputs.dopamine > 5) || (inputs.epinephrine && inputs.epinephrine <= 0.1) || (inputs.norepinephrine && inputs.norepinephrine <= 0.1)) {
      score += 3;
    } else if ((inputs.dopamine && inputs.dopamine <= 5) || inputs.dobutamine) {
      score += 2;
    } else if (inputs.map !== undefined && inputs.map < 70) {
      score += 1;
    }
  }

  // Central Nervous System (GCS)
  if (inputs.gcs !== undefined) {
    if (inputs.gcs < 6) score += 4;
    else if (inputs.gcs < 10) score += 3;
    else if (inputs.gcs < 13) score += 2;
    else if (inputs.gcs < 15) score += 1;
  }

  // Renal (Creatinine/Urine Output)
  if (inputs.creatinine !== undefined) {
    if (inputs.creatinine >= 5 || (inputs.urineOutput !== undefined && inputs.urineOutput < 200)) score += 4;
    else if (inputs.creatinine >= 3.5 || (inputs.urineOutput !== undefined && inputs.urineOutput < 500)) score += 3;
    else if (inputs.creatinine >= 2) score += 2;
    else if (inputs.creatinine >= 1.2) score += 1;
  }

  const interpretation = score === 0 ? 'No organ dysfunction' :
    score <= 5 ? 'Mild organ dysfunction' :
    score <= 10 ? 'Moderate organ dysfunction' :
    score <= 15 ? 'Severe organ dysfunction' : 'Very severe organ dysfunction';

  const riskLevel = score <= 5 ? 'low' : score <= 10 ? 'moderate' : score <= 15 ? 'high' : 'critical';

  const mortality = score <= 5 ? '<10%' : score <= 10 ? '15-20%' : score <= 15 ? '40-50%' : '>80%';

  return {
    score,
    maxScore: 24,
    interpretation,
    riskLevel,
    recommendation: `Estimated mortality: ${mortality}`,
    color: riskLevel === 'low' ? 'text-green-600' : riskLevel === 'moderate' ? 'text-amber-600' : riskLevel === 'high' ? 'text-orange-600' : 'text-red-600',
  };
};

export const calculateQSOFA = (inputs: QSOFAInputs): RiskScoreResult => {
  let score = 0;

  if (inputs.respiratoryRate !== undefined && inputs.respiratoryRate >= 22) score += 1;
  if (inputs.alteredMentation) score += 1;
  if (inputs.systolicBP !== undefined && inputs.systolicBP <= 100) score += 1;

  const riskLevel = score < 2 ? 'low' : score === 2 ? 'moderate' : 'high';

  return {
    score,
    maxScore: 3,
    interpretation: score >= 2 ? 'High risk for sepsis - consider ICU level care' : 'Lower risk - continue monitoring',
    riskLevel,
    recommendation: score >= 2 ? 'qSOFA ≥2: Consider sepsis workup, ICU evaluation' : 'Monitor closely, reassess if clinical change',
    color: riskLevel === 'low' ? 'text-green-600' : riskLevel === 'moderate' ? 'text-amber-600' : 'text-red-600',
  };
};

export const calculateCURB65 = (inputs: CURB65Inputs): RiskScoreResult => {
  let score = 0;

  if (inputs.confusion) score += 1;
  if (inputs.bun !== undefined && inputs.bun > 19) score += 1;
  if (inputs.respiratoryRate !== undefined && inputs.respiratoryRate >= 30) score += 1;
  if ((inputs.systolicBP !== undefined && inputs.systolicBP < 90) || (inputs.diastolicBP !== undefined && inputs.diastolicBP <= 60)) score += 1;
  if (inputs.age !== undefined && inputs.age >= 65) score += 1;

  const riskLevel = score <= 1 ? 'low' : score === 2 ? 'moderate' : 'high';
  const mortality = score === 0 ? '0.6%' : score === 1 ? '2.7%' : score === 2 ? '6.8%' : score === 3 ? '14%' : score === 4 ? '27.8%' : '57.3%';

  return {
    score,
    maxScore: 5,
    interpretation: score <= 1 ? 'Low severity - outpatient treatment possible' :
      score === 2 ? 'Moderate severity - consider hospital admission' :
      'High severity - ICU admission recommended',
    riskLevel,
    recommendation: `30-day mortality: ${mortality}. ${score <= 1 ? 'Outpatient treatment' : score === 2 ? 'Short hospital stay or closely supervised outpatient' : 'Hospital/ICU admission'}`,
    color: riskLevel === 'low' ? 'text-green-600' : riskLevel === 'moderate' ? 'text-amber-600' : 'text-red-600',
  };
};

export const calculateWellsDVT = (inputs: WellsDVTInputs): RiskScoreResult => {
  let score = 0;

  if (inputs.activeCancer) score += 1;
  if (inputs.paralysisParesis) score += 1;
  if (inputs.recentImmobilization) score += 1;
  if (inputs.localizedTenderness) score += 1;
  if (inputs.entireLegSwollen) score += 1;
  if (inputs.calfSwelling3cm) score += 1;
  if (inputs.pittingEdema) score += 1;
  if (inputs.collateralVeins) score += 1;
  if (inputs.previousDVT) score += 1;
  if (inputs.alternativeDiagnosisLikely) score -= 2;

  const riskLevel = score < 1 ? 'low' : score <= 2 ? 'moderate' : 'high';
  const probability = score < 1 ? '5%' : score <= 2 ? '17%' : '53%';

  return {
    score,
    maxScore: 9,
    interpretation: `${riskLevel === 'low' ? 'Low' : riskLevel === 'moderate' ? 'Moderate' : 'High'} probability of DVT`,
    riskLevel,
    recommendation: `Pre-test probability: ${probability}. ${score < 1 ? 'D-dimer testing recommended' : score <= 2 ? 'D-dimer or ultrasound' : 'Duplex ultrasound recommended'}`,
    color: riskLevel === 'low' ? 'text-green-600' : riskLevel === 'moderate' ? 'text-amber-600' : 'text-red-600',
  };
};

export const calculateWellsPE = (inputs: WellsPEInputs): RiskScoreResult => {
  let score = 0;

  if (inputs.clinicalDVTSigns) score += 3;
  if (inputs.alternativeDiagnosisLessLikely) score += 3;
  if (inputs.heartRate100) score += 1.5;
  if (inputs.immobilizationOrSurgery) score += 1.5;
  if (inputs.previousPEOrDVT) score += 1.5;
  if (inputs.hemoptysis) score += 1;
  if (inputs.malignancy) score += 1;

  const riskLevel = score <= 4 ? 'low' : score <= 6 ? 'moderate' : 'high';
  const probability = score <= 4 ? '8%' : score <= 6 ? '28%' : '74%';

  return {
    score,
    maxScore: 12.5,
    interpretation: `${riskLevel === 'low' ? 'PE Unlikely' : riskLevel === 'moderate' ? 'PE Possible' : 'PE Likely'}`,
    riskLevel,
    recommendation: `Pre-test probability: ${probability}. ${score <= 4 ? 'PERC rule or D-dimer' : score <= 6 ? 'D-dimer, if positive CT-PA' : 'CT-PA recommended'}`,
    color: riskLevel === 'low' ? 'text-green-600' : riskLevel === 'moderate' ? 'text-amber-600' : 'text-red-600',
  };
};

export const calculateNEWS2 = (inputs: NEWS2Inputs): RiskScoreResult => {
  let score = 0;

  // Respiratory rate
  if (inputs.respiratoryRate !== undefined) {
    if (inputs.respiratoryRate <= 8) score += 3;
    else if (inputs.respiratoryRate <= 11) score += 1;
    else if (inputs.respiratoryRate >= 25) score += 3;
    else if (inputs.respiratoryRate >= 21) score += 2;
  }

  // SpO2
  if (inputs.spo2 !== undefined) {
    if (inputs.spo2 <= 91) score += 3;
    else if (inputs.spo2 <= 93) score += 2;
    else if (inputs.spo2 <= 95) score += 1;
  }

  // Supplemental O2
  if (inputs.onSupplementalO2) score += 2;

  // Temperature
  if (inputs.temperature !== undefined) {
    if (inputs.temperature <= 35) score += 3;
    else if (inputs.temperature <= 36) score += 1;
    else if (inputs.temperature >= 39.1) score += 2;
    else if (inputs.temperature >= 38.1) score += 1;
  }

  // Systolic BP
  if (inputs.systolicBP !== undefined) {
    if (inputs.systolicBP <= 90) score += 3;
    else if (inputs.systolicBP <= 100) score += 2;
    else if (inputs.systolicBP <= 110) score += 1;
    else if (inputs.systolicBP >= 220) score += 3;
  }

  // Heart rate
  if (inputs.heartRate !== undefined) {
    if (inputs.heartRate <= 40) score += 3;
    else if (inputs.heartRate <= 50) score += 1;
    else if (inputs.heartRate >= 131) score += 3;
    else if (inputs.heartRate >= 111) score += 2;
    else if (inputs.heartRate >= 91) score += 1;
  }

  // Consciousness
  if (inputs.consciousness !== undefined && inputs.consciousness !== 'alert') {
    score += 3;
  }

  const riskLevel = score <= 4 ? 'low' : score <= 6 ? 'moderate' : 'high';

  return {
    score,
    maxScore: 20,
    interpretation: score <= 4 ? 'Low clinical risk' : score <= 6 ? 'Medium clinical risk - urgent response' : 'High clinical risk - emergency response',
    riskLevel: score >= 7 ? 'critical' : riskLevel,
    recommendation: score <= 4 ? 'Continue routine monitoring' : score <= 6 ? 'Urgent clinical review needed' : 'Immediate clinical review - consider ICU transfer',
    color: score <= 4 ? 'text-green-600' : score <= 6 ? 'text-amber-600' : 'text-red-600',
  };
};

// Calculate patient acuity from available data
export const calculatePatientAcuity = (
  labText: string,
  systemsData: Record<string, string>,
  clinicalSummary: string
): PatientAcuity => {
  const factors: string[] = [];
  const calculatedScores: { scoreType: RiskScoreType; result: RiskScoreResult }[] = [];

  // Parse labs to extract values
  const extractValue = (text: string, patterns: RegExp[]): number | undefined => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) return val;
      }
    }
    return undefined;
  };

  const normalizedLabs = labText.toLowerCase();
  const normalizedSummary = clinicalSummary.toLowerCase();
  const allText = `${normalizedLabs} ${normalizedSummary} ${Object.values(systemsData).join(' ').toLowerCase()}`;

  // Check for critical keywords
  if (allText.includes('intubated') || allText.includes('ventilator') || allText.includes('on vent')) {
    factors.push('Mechanical ventilation');
  }
  if (allText.includes('pressor') || allText.includes('vasopressor') || allText.includes('levophed') || allText.includes('norepinephrine')) {
    factors.push('On vasopressors');
  }
  if (allText.includes('code') || allText.includes('arrest') || allText.includes('cpr')) {
    factors.push('Code status concern');
  }
  if (allText.includes('sepsis') || allText.includes('septic')) {
    factors.push('Sepsis');
  }
  if (allText.includes('aki') || allText.includes('acute kidney')) {
    factors.push('Acute kidney injury');
  }
  if (allText.includes('ards') || allText.includes('respiratory failure')) {
    factors.push('Respiratory failure');
  }
  if (allText.includes('gi bleed') || allText.includes('melena') || allText.includes('hematemesis')) {
    factors.push('GI bleeding');
  }
  if (allText.includes('stroke') || allText.includes('cva')) {
    factors.push('Stroke');
  }
  if (allText.includes('mi') || allText.includes('stemi') || allText.includes('nstemi') || allText.includes('myocardial infarction')) {
    factors.push('Acute coronary syndrome');
  }

  // Extract lab values for qSOFA calculation
  const rr = extractValue(normalizedLabs, [/rr[:\s]+(\d+)/i, /resp[:\s]+(\d+)/i, /respiratory[:\s]+(\d+)/i]);
  const sbp = extractValue(normalizedLabs, [/sbp[:\s]+(\d+)/i, /systolic[:\s]+(\d+)/i, /bp[:\s]+(\d+)/i]);

  // Check GCS or mental status
  const gcs = extractValue(allText, [/gcs[:\s]+(\d+)/i, /glasgow[:\s]+(\d+)/i]);
  const alteredMentation = allText.includes('confused') || allText.includes('altered') || allText.includes('ams') || (gcs !== undefined && gcs < 15);

  // Calculate qSOFA if we have data
  if (rr !== undefined || sbp !== undefined || alteredMentation) {
    const qsofaResult = calculateQSOFA({
      respiratoryRate: rr,
      systolicBP: sbp,
      alteredMentation,
    });
    calculatedScores.push({ scoreType: 'qsofa', result: qsofaResult });
    if (qsofaResult.score >= 2) {
      factors.push(`qSOFA ${qsofaResult.score}/3`);
    }
  }

  // Calculate acuity level based on factors
  let level: 1 | 2 | 3 | 4 | 5 = 1;

  if (factors.includes('Mechanical ventilation') || factors.includes('On vasopressors')) {
    level = 5;
  } else if (factors.includes('Sepsis') || factors.includes('Acute coronary syndrome') || factors.includes('Stroke')) {
    level = 4;
  } else if (factors.includes('Respiratory failure') || factors.includes('GI bleeding') || factors.includes('Acute kidney injury')) {
    level = 3;
  } else if (factors.length > 0) {
    level = 2;
  }

  // Upgrade based on risk scores
  for (const { result } of calculatedScores) {
    if (result.riskLevel === 'critical' && level < 5) level = 5;
    else if (result.riskLevel === 'high' && level < 4) level = 4;
    else if (result.riskLevel === 'moderate' && level < 3) level = 3;
  }

  const acuityConfig = {
    1: { label: 'Stable', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    2: { label: 'Guarded', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    3: { label: 'Moderate', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    4: { label: 'Serious', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
    5: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  };

  return {
    level,
    ...acuityConfig[level],
    factors: factors.length > 0 ? factors : ['No high-risk factors identified'],
    calculatedScores,
  };
};
