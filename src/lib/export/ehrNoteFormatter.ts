import type { Patient, PatientSystems } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import { DEFAULT_SYSTEMS, type SystemConfig } from "@/lib/clinicalSections";
import { getPatientIdentity } from "@/lib/patientIdentity";

/**
 * Strips HTML tags and entities, converting rich-text paragraphs and line breaks
 * into clean plain-text whitespace suitable for hospital EHR progress notes.
 */
export function stripHtmlToPlainText(raw: string | undefined): string {
  if (!raw) return "";

  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:lt|#60);/gi, "<")
    .replace(/&(?:gt|#62);/gi, ">")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface EHRFormatOptions {
  todos?: PatientTodo[];
  enabledSystems?: SystemConfig[];
  includeCompletedTodos?: boolean;
}

/**
 * Formats a patient's complete rounding note into standardized, uppercase-header
 * plain text for instant paste into Epic Hyperspace/Rover, Cerner, or Meditech.
 * Omit empty organ systems to eliminate EHR note whitespace clutter.
 */
export function formatPatientForEHR(
  patient: Patient,
  options: EHRFormatOptions = {},
): string {
  const {
    todos = [],
    enabledSystems = DEFAULT_SYSTEMS,
    includeCompletedTodos = false,
  } = options;

  const identity = getPatientIdentity(patient);
  const lines: string[] = [];

  // Patient Header
  const ageGenderParts = [
    patient.age ? `${patient.age}yo` : null,
    identity.gender !== "Not documented" ? identity.gender : null,
  ].filter(Boolean);
  const ageGender = ageGenderParts.length > 0 ? ` (${ageGenderParts.join(" ")})` : "";

  lines.push(`ICU ROUNDING NOTE — RM ${identity.room !== "Not documented" ? identity.room : (patient.bed || "Unassigned")} — ${identity.name}${ageGender}`);
  lines.push(`MRN: ${identity.mrn} | ADMIT: ${identity.admissionDate} | CODE: ${identity.codeStatus.toUpperCase()}`);
  if (identity.attending !== "Not documented") {
    lines.push(`ATTENDING: ${identity.attending}`);
  }

  // Clinical Summary
  const summaryText = stripHtmlToPlainText(patient.clinicalSummary);
  if (summaryText) {
    lines.push("");
    lines.push("CLINICAL SUMMARY / ACUTE PROBLEMS:");
    lines.push(summaryText);
  }

  // Interval Events
  const eventsText = stripHtmlToPlainText(patient.intervalEvents);
  if (eventsText) {
    lines.push("");
    lines.push("INTERVAL EVENTS & OVERNIGHT:");
    lines.push(eventsText);
  }

  // Systems Review (Omit empty sections)
  const activeSystems = enabledSystems.filter((s) => s.enabled);
  const populatedSystems: Array<{ label: string; text: string }> = [];

  for (const sys of activeSystems) {
    const rawValue = patient.systems[sys.key as keyof PatientSystems];
    const text = stripHtmlToPlainText(rawValue);
    if (text) {
      populatedSystems.push({
        label: sys.label.toUpperCase(),
        text,
      });
    }
  }

  if (populatedSystems.length > 0) {
    lines.push("");
    lines.push("SYSTEMS REVIEW & ASSESSMENT / PLAN:");
    for (const sys of populatedSystems) {
      lines.push(`${sys.label}:`);
      lines.push(sys.text);
      lines.push("");
    }
    // Trim trailing empty line from systems loop
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  // Labs & Diagnostics (if documented)
  const labsText = stripHtmlToPlainText(patient.labs);
  if (labsText) {
    lines.push("");
    lines.push("LABORATORY & DIAGNOSTIC DATA:");
    lines.push(labsText);
  }

  // Active Infusions & Medications (if documented)
  if (patient.medications) {
    const medLines: string[] = [];
    if (patient.medications.infusions?.length) {
      medLines.push(`Continuous Infusions: ${patient.medications.infusions.join(", ")}`);
    }
    if (patient.medications.scheduled?.length) {
      medLines.push(`Scheduled: ${patient.medications.scheduled.join(", ")}`);
    }
    if (patient.medications.prn?.length) {
      medLines.push(`PRN: ${patient.medications.prn.join(", ")}`);
    }
    const rawMeds = stripHtmlToPlainText(patient.medications.rawText);
    if (rawMeds && medLines.length === 0) {
      medLines.push(rawMeds);
    }

    if (medLines.length > 0) {
      lines.push("");
      lines.push("MEDICATIONS & INFUSIONS:");
      lines.push(...medLines);
    }
  }

  // Todos / Plan of Care
  const relevantTodos = includeCompletedTodos
    ? todos
    : todos.filter((t) => !t.completed);

  if (relevantTodos.length > 0) {
    lines.push("");
    lines.push("TODOS / DAILY PLAN OF CARE:");
    for (const t of relevantTodos) {
      const mark = t.completed ? "[X]" : "[ ]";
      lines.push(`- ${mark} ${t.content}`);
    }
  }

  return lines.join("\n");
}

/**
 * Copies plain text to the system clipboard with an asynchronous fallback
 * for restricted environments, older browsers, or non-transient user gestures.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  // Fallback using temporary textarea
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.opacity = "0";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}
