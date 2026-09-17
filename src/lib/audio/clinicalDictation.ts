/**
 * Clinical Speech Dictation & Terminology Normalizer.
 * Provides client-side speech-to-text with ICU critical-care abbreviation expansion
 * and automated phrase cleanups for bedside rounding.
 */

const ICU_CORRECTIONS: Array<[RegExp, string]> = [
  // Ventilator & Respiratory
  [/\b(?:p\s*e\s*e\s*p|peep)\b/gi, "PEEP"],
  [/\b(?:f\s*i\s*o\s*(?:2|two)|fio2)\b/gi, "FiO2"],
  [/\b(?:p\s*s\s*v|psv)\b/gi, "PSV"],
  [/\b(?:p\s*r\s*v\s*c|prvc)\b/gi, "PRVC"],
  [/\b(?:c\s*p\s*a\s*p|cpap)\b/gi, "CPAP"],
  [/\b(?:b\s*i\s*p\s*a\s*p|bipap)\b/gi, "BiPAP"],
  [/\b(?:a\s*r\s*d\s*s|ards)\b/gi, "ARDS"],
  [/\b(?:s\s*b\s*t|sbt)\b/gi, "SBT"],
  [/\b(?:r\s*s\s*b\s*i|rsbi)\b/gi, "RSBI"],
  [/\b(?:p\s*a\s*o\s*(?:2|two)|pao2)\b/gi, "PaO2"],
  [/\b(?:p\s*(?:a\s*)?c\s*o\s*(?:2|two)|paco2)\b/gi, "PaCO2"],
  [/\b(?:a\s*b\s*g|abg)\b/gi, "ABG"],
  [/\b(?:v\s*b\s*g|vbg)\b/gi, "VBG"],

  // Hemodynamics, Pressors & Sedation
  [/\b(?:leave\s*a\s*fed|levofed|levophed)\b/gi, "Levophed (norepinephrine)"],
  [/\b(?:nor\s*epi|norepi)\b/gi, "norepinephrine"],
  [/\b(?:vaso|vasopressin)\b/gi, "vasopressin"],
  [/\b(?:neo\s*synephrine|neosynephrine)\b/gi, "phenylephrine (Neo-Synephrine)"],
  [/\b(?:proper\s*fall|propofol)\b/gi, "propofol"],
  [/\b(?:press\s*a\s*dex|precedex|dexmedetomidine)\b/gi, "Precedex (dexmedetomidine)"],
  [/\b(?:nimbex|cisatracurium)\b/gi, "Nimbex (cisatracurium)"],
  [/\b(?:m\s*a\s*p|map)\b/gi, "MAP"],
  [/\b(?:c\s*v\s*p|cvp)\b/gi, "CVP"],
  [/\b(?:e\s*k\s*g|ekg|e\s*c\s*g|ecg)\b/gi, "ECG"],

  // Common ICU Labs & Scores
  [/\b(?:b\s*u\s*n|bun)\b/gi, "BUN"],
  [/\b(?:s\s*o\s*f\s*a|sofa)\b/gi, "SOFA"],
  [/\b(?:c\s*a\s*m\s*i\s*c\s*u|cam\s*icu)\b/gi, "CAM-ICU"],
  [/\b(?:r\s*a\s*s\s*s|rass)\b/gi, "RASS"],
  [/\b(?:g\s*c\s*s|gcs)\b/gi, "GCS"],
  [/\b(?:d\s*v\s*t|dvt)\b/gi, "DVT"],
  [/\b(?:p\s*e|pulmonary\s*embolism)\b/gi, "PE"],
  [/\b(?:g\s*i|gi)\b/gi, "GI"],
  [/\b(?:g\s*u|gu)\b/gi, "GU"],

  // Units of Measure
  [/\b(?:mics?\s*(?:per|\/)\s*(?:kilo|kg)\s*(?:per|\/)\s*min(?:ute)?)\b/gi, "mcg/kg/min"],
  [/\b(?:mics?\s*(?:per|\/)\s*min(?:ute)?)\b/gi, "mcg/min"],
  [/\b(?:units?\s*(?:per|\/)\s*(?:hr|hour))\b/gi, "units/hr"],
  [/\b(?:(?:cc|ccs|ml|mls)\s*(?:per|\/)\s*(?:hr|hour))\b/gi, "mL/hr"],
  [/\b(?:liters?\s*(?:per|\/)\s*min(?:ute)?)\b/gi, "L/min"],
  [/\b(?:m\s*g|milligrams?)\b/gi, "mg"],
];

/**
 * Pure function that normalizes raw voice transcription into standardized
 * ICU critical-care formatting.
 */
export function normalizeClinicalTranscript(raw: string): string {
  if (!raw || !raw.trim()) return "";

  let cleaned = raw.trim();

  for (const [pattern, replacement] of ICU_CORRECTIONS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Capitalize the first letter of the overall phrase or after punctuation
  cleaned = cleaned.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p1, p2) => `${p1}${p2.toUpperCase()}`);

  return cleaned;
}

export interface ClinicalDictationOptions {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (isListening: boolean) => void;
  lang?: string;
}

export interface ClinicalDictationSession {
  start: () => void;
  stop: () => void;
  isSupported: boolean;
}

/**
 * Creates a managed clinical speech recognition session using the browser's
 * native speech engine, with automated ICU phrase normalization on speech completion.
 */
export function createClinicalDictationSession(
  options: ClinicalDictationOptions,
): ClinicalDictationSession {
  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined;

  if (!SpeechRecognitionCtor) {
    return {
      start: () => {
        options.onError?.(
          "Voice dictation is not supported in this browser. Use Chrome, Safari, or Edge.",
        );
      },
      stop: () => {},
      isSupported: false,
    };
  }

  let recognition: InstanceType<typeof SpeechRecognitionCtor> | null = null;
  let isListening = false;
  let accumulatedFinal = "";

  const start = () => {
    if (isListening) return;

    try {
      recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = options.lang || "en-US";

      accumulatedFinal = "";
      isListening = true;
      options.onStateChange?.(true);

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) {
            const normalized = normalizeClinicalTranscript(transcript);
            accumulatedFinal = accumulatedFinal
              ? `${accumulatedFinal} ${normalized}`
              : normalized;
            options.onFinal(accumulatedFinal);
          } else {
            interim += transcript;
          }
        }

        if (interim) {
          options.onInterim?.(normalizeClinicalTranscript(interim));
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorType = event.error || "unknown";
        if (errorType === "no-speech") return; // Benign pause
        if (errorType === "aborted") return; // Intentional stop
        options.onError?.(`Speech recognition error: ${errorType}`);
        stop();
      };

      recognition.onend = () => {
        isListening = false;
        options.onStateChange?.(false);
      };

      recognition.start();
    } catch (err) {
      isListening = false;
      options.onStateChange?.(false);
      const message = err instanceof Error ? err.message : "Failed to start microphone";
      options.onError?.(message);
    }
  };

  const stop = () => {
    if (!isListening || !recognition) return;
    try {
      recognition.stop();
    } catch {
      // Ignore if already stopped
    } finally {
      isListening = false;
      options.onStateChange?.(false);
    }
  };

  return {
    start,
    stop,
    isSupported: true,
  };
}
