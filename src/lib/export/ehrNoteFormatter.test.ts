import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPatientForEHR, stripHtmlToPlainText } from "./ehrNoteFormatter";
import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import { createEmptySystems } from "@/lib/clinicalSections";

const mockPatient: Patient = {
  id: "patient-1",
  patientNumber: 1,
  name: "John Doe",
  bed: "12A",
  mrn: "12345678",
  age: 68,
  gender: "male",
  admissionDate: "2026-09-10",
  codeStatus: "full",
  attendingPhysician: "Dr. Smith",
  clinicalSummary: "<p>Acute hypoxic respiratory failure secondary to severe viral pneumonia.</p>",
  intervalEvents: "Extubated at 04:00, weaning high flow.",
  imaging: "CXR clear without focal infiltrates",
  systems: {
    ...createEmptySystems(),
    neuro: "Alert, oriented x 4. RASS 0, CAM-ICU negative.",
    resp: "High flow nasal cannula 35L 40%. Breathing comfortably without retractions.",
  },
  labs: "K 4.2, Cr 1.1, PaO2 88 on 40%",
  medications: {
    infusions: ["Levophed 0.04 mcg/kg/min"],
    scheduled: ["Ceftriaxone 2g IV Q24H", "Enoxaparin 40mg SQ daily"],
    prn: [],
  },
  collapsed: false,
  createdAt: "2026-09-10T12:00:00.000Z",
  lastModified: "2026-09-17T10:00:00.000Z",
  fieldTimestamps: {},
};

const mockTodos: PatientTodo[] = [
  {
    id: "todo-1",
    patientId: "patient-1",
    userId: "user-1",
    section: null,
    content: "Discontinue Foley catheter",
    completed: false,
    createdAt: "2026-09-17T06:00:00.000Z",
    updatedAt: "2026-09-17T06:00:00.000Z",
  },
  {
    id: "todo-2",
    patientId: "patient-1",
    userId: "user-1",
    section: null,
    content: "Obtain afternoon chest X-ray",
    completed: true,
    createdAt: "2026-09-17T06:00:00.000Z",
    updatedAt: "2026-09-17T06:00:00.000Z",
  },
];

describe("stripHtmlToPlainText", () => {
  it("converts HTML breaks and paragraphs into clean newlines", () => {
    const html = "<p>Line 1</p><p>Line 2<br/>Line 3</p>";
    const text = stripHtmlToPlainText(html);
    assert.equal(text, "Line 1\n\nLine 2\nLine 3");
  });

  it("handles entity decodings and strips tags", () => {
    const html = "<b>PEEP &amp; FiO2 &gt; 50%</b>";
    const text = stripHtmlToPlainText(html);
    assert.equal(text, "PEEP & FiO2 > 50%");
  });

  it("returns empty string for undefined or empty input", () => {
    assert.equal(stripHtmlToPlainText(""), "");
    assert.equal(stripHtmlToPlainText(undefined), "");
  });
});

describe("formatPatientForEHR", () => {
  it("formats standard clinical note with uppercase headers", () => {
    const formatted = formatPatientForEHR(mockPatient, { todos: mockTodos });

    assert.match(formatted, /^ICU ROUNDING NOTE — RM 12A — John Doe \(68yo Male\)/m);
    assert.match(formatted, /MRN: 12345678 \| ADMIT: 2026-09-10 \| CODE: FULL CODE/);
    assert.match(formatted, /ATTENDING: Dr\. Smith/);
    assert.match(formatted, /CLINICAL SUMMARY \/ ACUTE PROBLEMS:\nAcute hypoxic respiratory failure/);
    assert.match(formatted, /INTERVAL EVENTS & OVERNIGHT:\nExtubated at 04:00/);
    assert.match(formatted, /SYSTEMS REVIEW & ASSESSMENT \/ PLAN:/);
    assert.match(formatted, /NEURO:\nAlert, oriented x 4/);
    assert.match(formatted, /RESP:\nHigh flow nasal cannula/);
    assert.match(formatted, /MEDICATIONS & INFUSIONS:\nContinuous Infusions: Levophed/);
    assert.match(formatted, /TODOS \/ DAILY PLAN OF CARE:\n- \[ \] Discontinue Foley catheter/);
  });

  it("omits empty organ systems to eliminate note clutter", () => {
    const formatted = formatPatientForEHR(mockPatient, { todos: mockTodos });

    // Renal, GI, Endocrine are empty in mockPatient and must NOT appear in the systems section
    assert.doesNotMatch(formatted, /RENAL\/GU:\n\n/);
    assert.doesNotMatch(formatted, /GI:\n\n/);
    assert.doesNotMatch(formatted, /ENDO:\n\n/);
  });

  it("omits completed todos by default unless requested", () => {
    const pendingOnly = formatPatientForEHR(mockPatient, { todos: mockTodos });
    assert.match(pendingOnly, /- \[ \] Discontinue Foley catheter/);
    assert.doesNotMatch(pendingOnly, /- \[X\] Obtain afternoon chest X-ray/);

    const withCompleted = formatPatientForEHR(mockPatient, {
      todos: mockTodos,
      includeCompletedTodos: true,
    });
    assert.match(withCompleted, /- \[ \] Discontinue Foley catheter/);
    assert.match(withCompleted, /- \[X\] Obtain afternoon chest X-ray/);
  });
});
