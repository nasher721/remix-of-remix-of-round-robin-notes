import type { DecisionCandidate } from "@/types/decisionScribe";
import type {
  Patient,
  PatientMedications,
  PatientSystems,
} from "@/types/patient";

export type DecisionMutation =
  | {
      kind: "patient";
      field: keyof Patient | `systems.${keyof PatientSystems}`;
      value: unknown;
    }
  | { kind: "todo"; content: string; id: string };

const systemAliases: Array<[keyof PatientSystems, string[]]> = [
  ["renalGU", ["renal", "kidney", "gu", "urinary"]],
  ["skinLines", ["skin", "line", "lines", "drain", "wound"]],
  [
    "infectious",
    ["infectious", "infection", "sepsis", "cultures", "antibiotic"],
  ],
  ["heme", ["hematology", "hematologic", "heme", "blood", "coagulation"]],
  ["cv", ["cardiovascular", "cardiac", "heart", " cv ", "cv:"]],
  [
    "resp",
    ["respiratory", "respiration", "pulmonary", "lung", "oxygen", "ventilator"],
  ],
  ["gi", ["gastrointestinal", "gastric", "abdomen", "bowel", "gi"]],
  ["endo", ["endocrine", "diabetes", "thyroid", "endo"]],
  ["dispo", ["disposition", "dispo", "discharge"]],
  ["neuro", ["neurologic", "neurological", "neuro", "brain", "seizure"]],
];

export function inferSystemKey(candidate: DecisionCandidate): keyof PatientSystems {
  const text =
    ` ${candidate.proposedContent} ${candidate.currentValue ?? ""} `.toLowerCase();
  const matchesAlias = (value: string, alias: string) => {
    const valueTokens = value.match(/[a-z]+/g) ?? [];
    const aliasTokens = alias.toLowerCase().match(/[a-z]+/g) ?? [];
    if (!aliasTokens.length) return false;
    return valueTokens.some((_, index) =>
      aliasTokens.every((token, offset) => valueTokens[index + offset] === token),
    );
  };
  return (
    systemAliases.find(([, aliases]) =>
      aliases.some((alias) => matchesAlias(text, alias)),
    )?.[0] ?? "neuro"
  );
}

function removeSystemValue(current: string, requested: string): string {
  const target = requested.trim();
  if (!target || !current.trim())
    throw new Error("System removal unavailable without a deterministic value");
  const lines = current.split(/\n+/);
  const remaining = lines.filter((line) => line.trim() !== target);
  if (remaining.length !== lines.length) return remaining.join("\n").trim();
  throw new Error("System removal unavailable without a deterministic value");
}

export function mapDecisionCandidate(
  candidate: DecisionCandidate,
  patient: Patient,
  operationId: string,
): DecisionMutation {
  const content = candidate.proposedContent.trim();
  if (candidate.destination === "todo")
    return { kind: "todo", content, id: `decision-${operationId}` };

  if (candidate.destination === "systems") {
    const key =
      (candidate as DecisionCandidate & { systemKey?: keyof PatientSystems })
        .systemKey ?? inferSystemKey(candidate);
    const change = candidate.changeType;
    const current = patient.systems[key] ?? "";
    if (
      (candidate as DecisionCandidate & { inverseAction?: string })
        .inverseAction === "restore"
    ) {
      return { kind: "patient", field: `systems.${key}`, value: content };
    }
    if (change === "remove" || change === "stop" || change === "discontinue") {
      const requested =
        candidate.currentValue?.trim() ||
        content.replace(/^(stop|remove|discontinue)\s+/i, "");
      return {
        kind: "patient",
        field: `systems.${key}`,
        value: removeSystemValue(current, requested),
      };
    }
    return {
      kind: "patient",
      field: `systems.${key}`,
      value: current ? `${current}\n${content}` : content,
    };
  }

  if (candidate.destination === "medications") {
    const medications: PatientMedications = {
      infusions: [...patient.medications.infusions],
      scheduled: [...patient.medications.scheduled],
      prn: [...patient.medications.prn],
      ...(patient.medications.rawText !== undefined
        ? { rawText: patient.medications.rawText }
        : {}),
    };
    const change = candidate.changeType;
    if (
      (candidate as DecisionCandidate & { inverseAction?: string })
        .inverseAction === "restore"
    ) {
      const previousMedications = (
        candidate as DecisionCandidate & {
          previousMedications?: PatientMedications;
        }
      ).previousMedications;
      if (previousMedications) {
        return {
          kind: "patient",
          field: "medications",
          value: {
            infusions: [...previousMedications.infusions],
            scheduled: [...previousMedications.scheduled],
            prn: [...previousMedications.prn],
            ...(previousMedications.rawText !== undefined
              ? { rawText: previousMedications.rawText }
              : {}),
          },
        };
      }
      const previousContent = candidate.currentValue?.trim() || content;
      try {
        const parsed: unknown = JSON.parse(previousContent);
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as PatientMedications).infusions) &&
          Array.isArray((parsed as PatientMedications).scheduled) &&
          Array.isArray((parsed as PatientMedications).prn)
        ) {
          return { kind: "patient", field: "medications", value: parsed };
        }
      } catch {
        // Legacy projections may contain a single prior medication string.
      }
      if (previousContent) {
        return {
          kind: "patient",
          field: "medications",
          value: { infusions: [], scheduled: [previousContent], prn: [] },
        };
      }
      throw new Error("Medication restore unavailable without a typed previous state");
    }
    if (change === "stop" || change === "discontinue" || change === "remove") {
      const requested = content
        .replace(/^(stop|remove|discontinue)\s+/i, "")
        .toLowerCase();
      (["infusions", "scheduled", "prn"] as const).forEach((key) => {
        medications[key] = medications[key].filter(
          (item) => !requested.includes(item.toLowerCase()),
        );
      });
      return { kind: "patient", field: "medications", value: medications };
    }
    return {
      kind: "patient",
      field: "medications",
      value: { ...medications, scheduled: [...medications.scheduled, content] },
    };
  }

  return { kind: "patient", field: candidate.destination, value: content };
}
