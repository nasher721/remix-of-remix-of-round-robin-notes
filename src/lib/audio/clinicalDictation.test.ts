import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeClinicalTranscript,
  createClinicalDictationSession,
} from "./clinicalDictation";

describe("normalizeClinicalTranscript", () => {
  it("returns empty string for falsy input", () => {
    assert.equal(normalizeClinicalTranscript(""), "");
    assert.equal(normalizeClinicalTranscript("   "), "");
  });

  it("normalizes ventilator parameters and respiratory abbreviations", () => {
    const raw = "weaned peep from 12 to 8, tolerating psv 5/5 on fio2 40 percent";
    const cleaned = normalizeClinicalTranscript(raw);
    assert.match(cleaned, /PEEP/);
    assert.match(cleaned, /PSV/);
    assert.match(cleaned, /FiO2/);
  });

  it("normalizes pressors and critical care sedatives", () => {
    const raw = "titrating leave a fed for map > 65, started proper fall at 20 mics per kilo per min";
    const cleaned = normalizeClinicalTranscript(raw);
    assert.match(cleaned, /Levophed \(norepinephrine\)/);
    assert.match(cleaned, /MAP/);
    assert.match(cleaned, /propofol/);
    assert.match(cleaned, /mcg\/kg\/min/);
  });

  it("normalizes ICU labs and scores", () => {
    const raw = "abg showed pao2 95 on paco2 42, sofa score is 7, cam icu negative";
    const cleaned = normalizeClinicalTranscript(raw);
    assert.match(cleaned, /ABG/);
    assert.match(cleaned, /PaO2/);
    assert.match(cleaned, /PaCO2/);
    assert.match(cleaned, /SOFA/);
    assert.match(cleaned, /CAM-ICU/);
  });

  it("handles capitalizations after sentence breaks", () => {
    const raw = "patient resting comfortably. no acute distress. lungs clear.";
    const cleaned = normalizeClinicalTranscript(raw);
    assert.match(cleaned, /^Patient resting comfortably\. No acute distress\. Lungs clear\.$/);
  });
});

describe("createClinicalDictationSession", () => {
  it("gracefully detects unsupported environments when window SpeechRecognition is absent", () => {
    let capturedError = "";
    const session = createClinicalDictationSession({
      onFinal: () => {},
      onError: (err) => {
        capturedError = err;
      },
    });
    // In node test environment, SpeechRecognition is absent
    assert.equal(session.isSupported, false);
    session.start();
    assert.match(capturedError, /not supported/i);
  });
});
