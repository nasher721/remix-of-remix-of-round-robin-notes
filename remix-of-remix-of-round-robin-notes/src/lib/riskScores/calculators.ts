// APACHE II Score Calculator
// Reference: Knaus WA, et al. APACHE II: a severity of disease classification system. Crit Care Med. 1985
import { APACHE_II_CONDITIONS } from './riskConstants';

export interface APACHEIIResult {
  total: number;
  predictedMortality: number;
  components: {
    age: number;
    chronicHealth: number;
    physiological: number;
  };
}

export function calculateAPACHEII(
  age: number,
  chronicHealthConditions: string[],
  temperature: number, // Celsius
  meanArterialPressure: number,
  heartRate: number,
  respiratoryRate: number,
  pao2Fio2: number,
  arterialPh: number,
  sodium: number,
  potassium: number,
  creatinine: number,
  hematocrit: number,
  wbc: number,
  glasgowComaScale: number
): APACHEIIResult {
  // Age score
  let ageScore = 0;
  if (age >= 75) ageScore = 6;
  else if (age >= 65) ageScore = 5;
  else if (age >= 55) ageScore = 3;
  else if (age >= 45) ageScore = 2;

  // Chronic health score
  let chronicHealthScore = 0;
  if (chronicHealthConditions.includes(APACHE_II_CONDITIONS.SEVERE_ORGAN_FAILURE)) chronicHealthScore = 5;
  else if (chronicHealthConditions.includes(APACHE_II_CONDITIONS.IMMUNOCOMPROMISED)) chronicHealthScore = 3;

  // Physiological score
  let physiologicalScore = 0;

  // Temperature
  if (temperature >= 41) physiologicalScore += 4;
  else if (temperature >= 39) physiologicalScore += 3;
  else if (temperature >= 38.5) physiologicalScore += 1;
  else if (temperature <= 30) physiologicalScore += 4;
  else if (temperature <= 32) physiologicalScore += 3;
  else if (temperature <= 34) physiologicalScore += 2;
  else if (temperature <= 36) physiologicalScore += 1;

  // MAP
  if (meanArterialPressure < 50) physiologicalScore += 4;
  else if (meanArterialPressure < 70) physiologicalScore += 2;
  else if (meanArterialPressure > 160) physiologicalScore += 2;
  else if (meanArterialPressure > 130) physiologicalScore += 1;

  // Heart rate
  if (heartRate >= 180) physiologicalScore += 4;
  else if (heartRate >= 140) physiologicalScore += 3;
  else if (heartRate >= 110) physiologicalScore += 2;
  else if (heartRate < 40) physiologicalScore += 4;
  else if (heartRate < 55) physiologicalScore += 3;
  else if (heartRate < 70) physiologicalScore += 2;

  // Respiratory rate
  if (respiratoryRate >= 50) physiologicalScore += 4;
  else if (respiratoryRate >= 35) physiologicalScore += 3;
  else if (respiratoryRate < 6) physiologicalScore += 4;
  else if (respiratoryRate < 10) physiologicalScore += 3;

  // PaO2/FiO2
  if (pao2Fio2 < 100) physiologicalScore += 4;
  else if (pao2Fio2 < 200) physiologicalScore += 3;
  else if (pao2Fio2 < 300) physiologicalScore += 2;
  else if (pao2Fio2 < 400) physiologicalScore += 1;

  // Arterial pH
  if (arterialPh < 7.15) physiologicalScore += 4;
  else if (arterialPh < 7.25) physiologicalScore += 3;
  else if (arterialPh < 7.33) physiologicalScore += 2;
  else if (arterialPh > 7.7) physiologicalScore += 4;
  else if (arterialPh > 7.6) physiologicalScore += 3;
  else if (arterialPh > 7.5) physiologicalScore += 1;

  // Sodium
  if (sodium < 111) physiologicalScore += 4;
  else if (sodium < 120) physiologicalScore += 3;
  else if (sodium > 180) physiologicalScore += 4;
  else if (sodium > 160) physiologicalScore += 3;
  else if (sodium > 155) physiologicalScore += 2;
  else if (sodium > 150) physiologicalScore += 1;

  // Potassium
  if (potassium < 2.5) physiologicalScore += 4;
  else if (potassium < 3.0) physiologicalScore += 3;
  else if (potassium < 3.5) physiologicalScore += 1;
  else if (potassium >= 7.0) physiologicalScore += 4;
  else if (potassium >= 6.0) physiologicalScore += 3;
  else if (potassium >= 5.5) physiologicalScore += 1;

  // Creatinine
  if (creatinine >= 3.5) physiologicalScore += 4;
  else if (creatinine >= 2.0) physiologicalScore += 3;
  else if (creatinine >= 1.5) physiologicalScore += 2;
  else if (creatinine < 0.6) physiologicalScore += 2;

  // Hematocrit
  if (hematocrit < 20) physiologicalScore += 4;
  else if (hematocrit < 30) physiologicalScore += 2;
  else if (hematocrit > 60) physiologicalScore += 4;
  else if (hematocrit > 50) physiologicalScore += 2;

  // WBC
  if (wbc >= 40) physiologicalScore += 4;
  else if (wbc >= 20) physiologicalScore += 2;
  else if (wbc < 1) physiologicalScore += 4;
  else if (wbc < 3) physiologicalScore += 2;

  // Glasgow Coma Scale (15 - GCS)
  const gcsScore = 15 - glasgowComaScale;

  const total = ageScore + chronicHealthScore + physiologicalScore + gcsScore;

  // Predicted mortality (simplified formula)
  const logit = -3.517 + (total * 0.146);
  const predictedMortality = Math.exp(logit) / (1 + Math.exp(logit)) * 100;

  return {
    total,
    predictedMortality: Math.round(predictedMortality),
    components: {
      age: ageScore,
      chronicHealth: chronicHealthScore,
      physiological: physiologicalScore + gcsScore,
    },
  };
}

// SOFA Score Calculator
// Reference: Vincent JL, et al. The SOFA (Sepsis-related Organ Failure Assessment) score. Intensive Care Med. 1996

export interface SOFAResult {
  total: number;
  respiratory: number;
  coagulation: number;
  liver: number;
  cardiovascular: number;
  cns: number;
  renal: number;
}

export function calculateSOFA(
  pao2: number,
  fio2: number,
  platelets: number,
  bilirubin: number,
  map: number,
  vasopressors: boolean,
  gcs: number,
  creatinine: number,
  urineOutput?: number
): SOFAResult {
  // Respiratory (PaO2/FiO2 ratio)
  const pao2Fio2 = pao2 / (fio2 / 100);
  let respiratory = 0;
  if (pao2Fio2 < 100) respiratory = 4;
  else if (pao2Fio2 < 200) respiratory = 3;
  else if (pao2Fio2 < 300) respiratory = 2;
  else if (pao2Fio2 < 400) respiratory = 1;

  // Coagulation (Platelets)
  let coagulation = 0;
  if (platelets < 20) coagulation = 4;
  else if (platelets < 50) coagulation = 3;
  else if (platelets < 100) coagulation = 2;
  else if (platelets < 150) coagulation = 1;

  // Liver (Bilirubin in mg/dL)
  let liver = 0;
  if (bilirubin >= 12.0) liver = 4;
  else if (bilirubin >= 6.0) liver = 3;
  else if (bilirubin >= 2.0) liver = 2;
  else if (bilirubin >= 1.2) liver = 1;

  // Cardiovascular
  let cardiovascular = 0;
  if (vasopressors) cardiovascular = 3;
  else if (map < 70) cardiovascular = 1;

  // CNS (Glasgow Coma Scale)
  let cns = 0;
  if (gcs < 6) cns = 4;
  else if (gcs < 10) cns = 3;
  else if (gcs < 13) cns = 2;
  else if (gcs < 15) cns = 1;

  // Renal (Creatinine in mg/dL or urine output)
  let renal = 0;
  if (creatinine >= 5.0 || (urineOutput !== undefined && urineOutput < 200)) renal = 4;
  else if (creatinine >= 3.5 || (urineOutput !== undefined && urineOutput < 500)) renal = 3;
  else if (creatinine >= 2.0) renal = 2;
  else if (creatinine >= 1.2) renal = 1;

  return {
    total: respiratory + coagulation + liver + cardiovascular + cns + renal,
    respiratory,
    coagulation,
    liver,
    cardiovascular,
    cns,
    renal,
  };
}

// qSOFA Score Calculator
// Reference: Seymour CW, et al. Assessment of Clinical Criteria for Sepsis. JAMA. 2016

export interface qSOFAResult {
  total: number;
  components: {
    respiratory: number;
    systolicBP: number;
    alteredMental: number;
  };
  isPositive: boolean;
}

export function calculateqSOFA(
  respiratoryRate: number,
  systolicBP: number,
  alteredMentalStatus: boolean
): qSOFAResult {
  const respiratoryScore = respiratoryRate >= 22 ? 1 : 0;
  const systolicBPScore = systolicBP <= 100 ? 1 : 0;
  const alteredMentalScore = alteredMentalStatus ? 1 : 0;

  return {
    total: respiratoryScore + systolicBPScore + alteredMentalScore,
    components: {
      respiratory: respiratoryScore,
      systolicBP: systolicBPScore,
      alteredMental: alteredMentalScore,
    },
    isPositive: (respiratoryScore + systolicBPScore + alteredMentalScore) >= 2,
  };
}

// CURB-65 Score Calculator
// Reference: Lim WS, et al. Defining community acquired pneumonia severity on presentation to hospital. Thorax. 2003

export interface CURB65Result {
  total: number;
  predictedMortality: number;
  recommendation: string;
  components: {
    confusion: number;
    urea: number;
    respiratory: number;
    bloodPressure: number;
    age65: number;
  };
}

export function calculateCURB65(
  confusion: boolean,
  urea: number, // mmol/L
  respiratoryRate: number,
  bloodPressure: { systolic: number; diastolic: number },
  age: number
): CURB65Result {
  const confusionScore = confusion ? 1 : 0;
  const ureaScore = urea > 7 ? 1 : 0;
  const respiratoryScore = respiratoryRate >= 30 ? 1 : 0;
  const bloodPressureScore = bloodPressure.systolic < 90 || bloodPressure.diastolic <= 60 ? 1 : 0;
  const ageScore = age >= 65 ? 1 : 0;

  const total = confusionScore + ureaScore + respiratoryScore + bloodPressureScore + ageScore;

  let predictedMortality: number;
  let recommendation: string;

  switch (total) {
    case 0:
      predictedMortality = 0.6;
      recommendation = 'Home treatment recommended';
      break;
    case 1:
      predictedMortality = 2.7;
      recommendation = 'Consider outpatient treatment';
      break;
    case 2:
      predictedMortality = 6.8;
      recommendation = 'Hospital admission recommended';
      break;
    case 3:
      predictedMortality = 14.0;
      recommendation = 'Inpatient treatment with monitoring';
      break;
    case 4:
      predictedMortality = 27.8;
      recommendation = 'ICU admission recommended';
      break;
    case 5:
      predictedMortality = 47.6;
      recommendation = 'ICU admission with aggressive treatment';
      break;
    default:
      predictedMortality = 0;
      recommendation = 'Unable to calculate';
  }

  return {
    total,
    predictedMortality,
    recommendation,
    components: {
      confusion: confusionScore,
      urea: ureaScore,
      respiratory: respiratoryScore,
      bloodPressure: bloodPressureScore,
      age65: ageScore,
    },
  };
}
