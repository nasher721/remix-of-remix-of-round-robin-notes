import type { SpeakerRole } from "../../../types/decisionScribe";

export interface SyntheticIcuExchange { id: string; hazard: string; patientLabel: string; turns: Array<{ speaker: SpeakerRole; text: string }>; expectedSignals: string[]; }

/** Synthetic corpus: labels are deliberately fictional and contain no patient identifiers. */
export const ICU_DECISION_CORPUS: readonly SyntheticIcuExchange[] = [
  { id: "synthetic-overlap-01", hazard: "overlap-and-interruption", patientLabel: "SYNTH-A", turns: [{ speaker: "physician", text: "For SYNTH-A, continue the norepinephrine—" }, { speaker: "nurse", text: "Pressure is 82." }, { speaker: "physician", text: "—at the current dose and reassess in ten minutes." }], expectedSignals: ["continue", "timing", "task"] },
  { id: "synthetic-negation-02", hazard: "negation-and-abbreviation", patientLabel: "SYNTH-B", turns: [{ speaker: "resident", text: "No new focal deficit; CTH is stable." }, { speaker: "physician", text: "Do not restart anticoagulation today." }], expectedSignals: ["negated", "discontinue"] },
  { id: "synthetic-med-change-03", hazard: "medication-change", patientLabel: "SYNTH-C", turns: [{ speaker: "physician", text: "Stop the infusion, transition to enteral dosing, and document the change." }], expectedSignals: ["stop", "modify", "destination"] },
  { id: "synthetic-competing-04", hazard: "competing-recommendations", patientLabel: "SYNTH-D", turns: [{ speaker: "fellow", text: "We could diurese this afternoon." }, { speaker: "physician", text: "Let's defer that decision until the repeat ultrasound." }], expectedSignals: ["proposed", "deferred", "question"] },
  { id: "synthetic-conditional-05", hazard: "conditional-plan", patientLabel: "SYNTH-E", turns: [{ speaker: "physician", text: "If the trial is tolerated, remove the drain tomorrow; otherwise keep it and reassess." }], expectedSignals: ["conditional", "remove", "contingency"] },
  { id: "synthetic-assignment-06", hazard: "task-assignment", patientLabel: "SYNTH-F", turns: [{ speaker: "physician", text: "Please have the resident call radiology and update the family after the scan." }], expectedSignals: ["assign", "task", "timing"] },
  { id: "synthetic-transition-07", hazard: "patient-transition", patientLabel: "SYNTH-G", turns: [{ speaker: "physician", text: "Next patient—SYNTH-G: continue neuro checks, but no changes to the ventilator plan." }], expectedSignals: ["patient-binding", "continue", "negated"] },
];

export const icuDecisionCorpus = ICU_DECISION_CORPUS;
export const syntheticIcuDecisionCorpus = ICU_DECISION_CORPUS;
