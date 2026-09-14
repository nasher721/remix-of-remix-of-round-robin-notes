import type { Patient } from "@/types/patient";
import { noteText } from "@/lib/continuousNote";
import { sanitizePatientImageHtml } from "@/lib/sanitize";
import {
  type AcceptedProjection,
  type Destination,
  DESTINATIONS,
  type Mode,
  type NoteBlock,
  PROFILE_VERSION,
  type Source,
} from "../../../supabase/functions/_shared/note-composer.ts";

function fieldValue(patient: Patient, field: Destination): string {
  return field.startsWith("systems.")
    ? (patient.systems as Record<string, string>)[field.slice(8)] ?? ""
    : patient[field as "clinicalSummary" | "intervalEvents"];
}
function plainText(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const first = template.content.firstElementChild;
  if (first instanceof HTMLElement && first.style.whiteSpace === "pre-wrap") {
    return first.textContent ?? "";
  }
  return noteText(html);
}
export function snapshotBlocks(patient: Patient): NoteBlock[] {
  return DESTINATIONS.flatMap((destination): NoteBlock[] => {
    const text = plainText(fieldValue(patient, destination));
    return text
      ? [{
        id: destination,
        destination,
        text,
        kind: destination === "clinicalSummary"
          ? "summary"
          : destination === "intervalEvents"
          ? "interval"
          : DESTINATIONS.indexOf(destination) >= 10
          ? "closing"
          : "system",
        claimIds: [],
        editVersion: 0,
        provenance: "saved",
        reviewed: true,
      }]
      : [];
  });
}
export function chartSource(patient: Patient, importedAt: string): Source {
  return {
    id: "chart",
    patientId: patient.id,
    type: "chart",
    assignment: "confirmed",
    importedAt,
    timeKind: "undated",
    text: JSON.stringify({
      name: patient.name,
      bed: patient.bed,
      age: patient.age,
      gender: patient.gender,
      note: snapshotBlocks(patient).map((b) => ({
        field: b.destination,
        text: b.text,
      })),
      labs: noteText(patient.labs),
      imaging: noteText(patient.imaging),
      medications: patient.medications,
      codeStatus: patient.codeStatus,
      warning:
        "Prior chart snapshot. Edit time is not clinical event time. Medication list does not establish administration.",
    }),
  };
}
export function projectReviewed(
  patient: Patient,
  blocks: NoteBlock[],
  clears: string[],
  mode: Mode,
  operationId: string,
): AcceptedProjection {
  const fields: AcceptedProjection["fields"] = {};
  const previous = snapshotBlocks(patient);
  for (const destination of DESTINATIONS) {
    const b = blocks.find((b) => b.destination === destination);
    const old = previous.find((b) => b.destination === destination);
    if (old && !b?.text.trim() && !clears.includes(destination)) {
      throw new Error("Review and accept the field clear before applying");
    }
    if (b?.text === old?.text) continue;
    const template = document.createElement("template");
    template.innerHTML = sanitizePatientImageHtml(
      fieldValue(patient, destination),
    );
    const images = [...template.content.querySelectorAll("img")].map((img) =>
      img.outerHTML
    ).join("");
    if (b) {
      const body = document.createElement("div");
      body.style.whiteSpace = "pre-wrap";
      body.textContent = b.text;
      fields[destination] = body.outerHTML + images;
    } else if (clears.includes(destination)) fields[destination] = images;
  }
  return {
    patientId: patient.id,
    expectedRevision: patient.revision ?? 0,
    operationId,
    fields,
    format: { profileVersion: PROFILE_VERSION, mode },
  };
}
