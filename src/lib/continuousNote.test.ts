import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNoteSections, copyableNote, noteText, readNoteUpdates, type NoteSection } from "./continuousNote";
import { defaultMedications, defaultSystems, type Patient } from "@/types/patient";
import { sanitizeHtml } from "./sanitize";

const patient: Patient = {
  id: "synthetic-note", name: "Synthetic patient", mrn: "", bed: "TEST", patientNumber: 1,
  clinicalSummary: "<p><strong>Test summary</strong></p>", intervalEvents: "",
  systems: { ...defaultSystems, neuro: "<ul><li>Test assessment</li></ul>", dispo: "Hidden system content" },
  labs: "<table><tbody><tr><td>Test result</td></tr></tbody></table>",
  imaging: '<p>Test scan</p><img data-patient-image-key="owner/patient/image.png">',
  medications: { ...defaultMedications, infusions: ["Test infusion"], scheduled: ["Test medication A", "Test medication B"], rawText: "Original source text" },
  fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "",
};

function documentFor(sections: NoteSection[]) {
  const root = document.createElement("div");
  sections.forEach((section) => {
    const wrapper = document.createElement("div");
    wrapper.dataset.noteSection = section.key;
    const heading = document.createElement("h2");
    heading.textContent = section.label;
    const body = document.createElement("div");
    body.dataset.noteBody = section.key;
    body.innerHTML = sanitizeHtml(section.html || "<p><br></p>");
    wrapper.append(heading, body);
    root.append(wrapper);
  });
  return root;
}

describe("continuous note field integrity", () => {
  it("opening the combined view produces no writes and retains documented hidden systems", () => {
    const sections = buildNoteSections(patient, [{ key: "neuro", label: "Neuro" }]);
    assert.ok(sections.some((section) => section.key === "systems.dispo"));
    assert.deepEqual(readNoteUpdates(documentFor(sections), sections, patient.medications), []);
  });

  it("editing one field preserves all other rich text, attachments and medication categories", () => {
    const sections = buildNoteSections(patient, [{ key: "neuro", label: "Neuro" }]);
    const root = documentFor(sections);
    root.querySelector('[data-note-body="intervalEvents"]')!.innerHTML = "<p>New event</p>";
    assert.deepEqual(readNoteUpdates(root, sections, patient.medications), [{ field: "intervalEvents", value: "<p>New event</p>" }]);
    assert.match(root.innerHTML, /data-patient-image-key/);
    assert.match(root.innerHTML, /<strong>Test summary/);
    assert.match(root.innerHTML, /<table>/);
  });

  it("coalesces edits to medication categories into one update and preserves raw source text", () => {
    const sections = buildNoteSections(patient, []);
    const root = documentFor(sections);
    root.querySelector('[data-note-body="medications.scheduled"]')!.innerHTML = "<div>Updated A</div><div>Updated B</div>";
    root.querySelector('[data-note-body="medications.prn"]')!.innerHTML = "PRN A<br>PRN B";
    assert.deepEqual(readNoteUpdates(root, sections, patient.medications), [{ field: "medications", value: {
      ...patient.medications, scheduled: ["Updated A", "Updated B"], prn: ["PRN A", "PRN B"],
    } }]);
  });

  it("rejects missing, duplicated or renamed section boundaries without partial writes", () => {
    const sections = buildNoteSections(patient, []);
    for (const mutate of [
      (root: HTMLElement) => root.firstElementChild!.remove(),
      (root: HTMLElement) => root.append(root.firstElementChild!.cloneNode(true)),
      (root: HTMLElement) => { root.querySelector("h2")!.textContent = "Renamed"; },
      (root: HTMLElement) => root.prepend(document.createTextNode("Unassigned text")),
    ]) {
      const root = documentFor(sections);
      root.querySelector('[data-note-body="intervalEvents"]')!.innerHTML = "Must not partially save";
      mutate(root);
      assert.equal(readNoteUpdates(root, sections, patient.medications), null);
    }
  });

  it("sanitizes edited HTML and supports clearing a section", () => {
    const sections = buildNoteSections(patient, []);
    const root = documentFor(sections);
    root.querySelector('[data-note-body="clinicalSummary"]')!.innerHTML = "<p><br></p>";
    root.querySelector('[data-note-body="intervalEvents"]')!.innerHTML = '<p onclick="alert(1)">Text<script>alert(1)</script></p>';
    assert.deepEqual(readNoteUpdates(root, sections, patient.medications), [
      { field: "clinicalSummary", value: "" }, { field: "intervalEvents", value: "<p>Text</p>" },
    ]);
  });

  it("exports readable line breaks and an attachment reference without empty section boilerplate", () => {
    assert.equal(noteText("<p>First</p><ul><li>Second</li><li>Third</li></ul>"), "First\nSecond\nThird");
    const text = copyableNote(buildNoteSections(patient, []));
    assert.match(text, /CLINICAL SUMMARY\nTest summary/);
    assert.match(text, /\[Image attachment/);
    assert.doesNotMatch(text, /INTERVAL EVENTS|<strong>|data-patient-image/);
  });
});
