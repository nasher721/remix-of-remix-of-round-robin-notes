import type { Patient, PatientMedications } from "@/types/patient";
import { sanitizeHtml, sanitizePastedHtml } from "@/lib/sanitize";

export interface NoteSection {
  key: string;
  label: string;
  group: "summary" | "events" | "systems" | "results" | "medications";
  html: string;
}

/** Keep line boundaries when exporting notes and converting medication rows. */
export function noteText(html: string): string {
  // Detached template content is inert, including images. No need to run the
  // display sanitizer repeatedly just to count words on every keystroke.
  const template = document.createElement("template");
  template.innerHTML = html;
  const root = template.content;
  root.querySelectorAll("script,style").forEach((node) => node.remove());
  root.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  root.querySelectorAll("p,div,li,h1,h2,h3,tr").forEach((node) => node.append("\n"));
  return (root.textContent ?? "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function hasNoteContent(html: string): boolean {
  return Boolean(noteText(html)) || /<img\b/i.test(html);
}

export function buildNoteSections(patient: Patient, systems: readonly { key: string; label: string }[]): NoteSection[] {
  const allSystems = patient.systems as unknown as Record<string, string>;
  // Include documented disabled/custom systems so the full note never hides existing content.
  const known = new Set(systems.map((system) => system.key));
  const displayedSystems = [...systems, ...Object.keys(allSystems)
    .filter((key) => !known.has(key) && hasNoteContent(allSystems[key]))
    .map((key) => ({ key, label: key }))];
  const medications = patient.medications;
  const medRows = (key: "infusions" | "scheduled" | "prn") =>
    (medications?.[key] ?? []).map((text) => `<div>${sanitizePastedHtml("", text)}</div>`).join("");
  return [
    { key: "clinicalSummary", label: "Clinical summary", group: "summary", html: patient.clinicalSummary },
    { key: "intervalEvents", label: "Interval events", group: "events", html: patient.intervalEvents },
    ...displayedSystems.map((system): NoteSection => ({ key: `systems.${system.key}`, label: system.label, group: "systems", html: allSystems[system.key] ?? "" })),
    { key: "labs", label: "Labs", group: "results", html: patient.labs },
    { key: "imaging", label: "Imaging", group: "results", html: patient.imaging },
    { key: "medications.infusions", label: "Continuous infusions", group: "medications", html: medRows("infusions") },
    { key: "medications.scheduled", label: "Scheduled medications", group: "medications", html: medRows("scheduled") },
    { key: "medications.prn", label: "PRN medications", group: "medications", html: medRows("prn") },
    { key: "medications.rawText", label: "Medication notes", group: "medications", html: sanitizePastedHtml("", medications?.rawText ?? "") },
  ];
}

export interface NoteUpdate { field: string; value: unknown }

/** Validate the entire structure before returning any writes. Never guess section boundaries. */
export function readNoteUpdates(root: HTMLElement, sections: readonly NoteSection[], medications: PatientMedications): NoteUpdate[] | null {
  if (root.childNodes.length !== sections.length) return null;
  const updates: NoteUpdate[] = [];
  const nextMedications = { ...medications };
  let medicationsChanged = false;
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    const wrapper = root.children[index] as HTMLElement | undefined;
    const heading = wrapper?.children[0];
    const body = wrapper?.children[1] as HTMLElement | undefined;
    if (wrapper?.dataset.noteSection !== section.key || wrapper.childNodes.length !== 2 ||
        heading?.tagName !== "H2" || heading.textContent !== section.label ||
        body?.dataset.noteBody !== section.key) return null;
    if (body.innerHTML === section.html) continue;
    const html = sanitizeHtml(body.innerHTML);
    if (html === sanitizeHtml(section.html || "<p><br></p>")) continue;
    if (section.key.startsWith("medications.")) {
      const key = section.key.slice("medications.".length) as keyof PatientMedications;
      const text = noteText(html);
      // Formatting changes alone must not rewrite structured medication lists.
      if (text === noteText(section.html)) continue;
      if (key === "rawText") nextMedications.rawText = text;
      else nextMedications[key] = text.split("\n").map((row) => row.trim()).filter(Boolean);
      medicationsChanged = true;
    } else {
      updates.push({ field: section.key, value: hasNoteContent(html) ? html : "" });
    }
  }
  if (medicationsChanged) updates.push({ field: "medications", value: nextMedications });
  return updates;
}

export function copyableNote(sections: readonly NoteSection[]): string {
  return sections.filter((section) => hasNoteContent(section.html))
    .map((section) => `${section.label.toUpperCase()}\n${noteText(section.html)}${/<img\b/i.test(section.html) ? "\n[Image attachment — view in chart]" : ""}`)
    .join("\n\n");
}
