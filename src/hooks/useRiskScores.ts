import { useMemo } from 'react';
import {
  calculateAPACHEII,
  calculateSOFA,
  calculateqSOFA,
  calculateCURB65,
  type APACHEIIResult,
  type SOFAResult,
  type qSOFAResult,
  type CURB65Result,
} from '@/lib/riskScores/calculators';
import type { Patient } from '@/types/patient';

interface RiskScores {
  apacheII: APACHEIIResult | null;
  sofa: SOFAResult | null;
  qsofa: qSOFAResult | null;
  curb65: CURB65Result | null;
}

export function useRiskScores(patient: Patient): RiskScores {
  const scores = useMemo((): RiskScores => {
    // Try to extract values from patient data
    const age = patient.age ?? 50;
    
    // Parse labs for values
    const labs = patient.labs || '';
    const creatinineMatch = labs.match(/creatinine[:\s]+([\d.]+)/i);
    const creatinine = creatinineMatch ? parseFloat(creatinineMatch[1]) : 1.0;
    
    const sodiumMatch = labs.match(/sodium[:\s]+([\d.]+)/i);
    const sodium = sodiumMatch ? parseFloat(sodiumMatch[1]) : 140;
    
    const potassiumMatch = labs.match(/potassium[:\s]+([\d.]+)/i);
    const potassium = potassiumMatch ? parseFloat(potassiumMatch[1]) : 4.0;
    
    const plateletsMatch = labs.match(/platelets[:\s]+([\d.]+)/i);
    const platelets = plateletsMatch ? parseFloat(plateletsMatch[1]) : 150;
    
    const bilirubinMatch = labs.match(/bilirubin[:\s]+([\d.]+)/i);
    const bilirubin = bilirubinMatch ? parseFloat(bilirubinMatch[1]) : 1.0;
    
    const wbcMatch = labs.match(/wbc[:\s]+([\d.]+)/i);
    const wbc = wbcMatch ? parseFloat(wbcMatch[1]) : 10;
    
    // Calculate APACHE II (simplified - would need more data in real use)
    let apacheII: APACHEIIResult | null = null;
    try {
      apacheII = calculateAPACHEII(
        age,
        [], // chronic conditions
        37, // temp
        80, // map
        80, // hr
        16, // rr
        300, // pao2/fio2
        7.4, // ph
        sodium,
        potassium,
        creatinine,
        40, // hct
        wbc,
        15 // gcs
      );
    } catch {
      apacheII = null;
    }

    // Calculate SOFA
    let sofa: SOFAResult | null = null;
    try {
      sofa = calculateSOFA(
        100, // pao2
        40, // fio2
        platelets,
        bilirubin,
        80, // map
        false, // vasopressors
        15, // gcs
        creatinine
      );
    } catch {
      sofa = null;
    }

    // Calculate qSOFA (would need vital signs)
    let qsofa: qSOFAResult | null = null;
    try {
      qsofa = calculateqSOFA(
        18, // rr
        120, // systolic
        false // altered mental
      );
    } catch {
      qsofa = null;
    }

    // Calculate CURB-65
    let curb65: CURB65Result | null = null;
    try {
      curb65 = calculateCURB65(
        false, // confusion
        5, // urea
        20, // rr
        { systolic: 120, diastolic: 80 },
        age
      );
    } catch {
      curb65 = null;
    }

    return {
      apacheII,
      sofa,
      qsofa,
      curb65,
    };
  }, [patient]);

  return scores;
}
