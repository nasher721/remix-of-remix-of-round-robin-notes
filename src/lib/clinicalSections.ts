/** Clinical section identity and compatibility. No React, storage or clinical inference. */
export const CLINICAL_SECTIONS = {
  neuro: { label: "NEURO", icon: "🧠", legacyLabels: ["Neuro"] },
  cv: { label: "CV", icon: "❤️", legacyLabels: ["Cardiovascular", "Cardio/Vasc"] },
  resp: { label: "RESP", icon: "🫁", legacyLabels: ["Respiratory", "Resp"] },
  renalGU: { label: "RENAL/GU", icon: "💧", legacyLabels: ["Renal/GU"] },
  gi: { label: "GI", icon: "🍽️", legacyLabels: ["GI/Nutrition"] },
  endo: { label: "ENDO", icon: "⚡", legacyLabels: ["Endocrine", "Endo"] },
  heme: { label: "HEME/ONC", icon: "🩸", legacyLabels: ["Hematology", "Heme"] },
  infectious: { label: "ID", icon: "🦠", legacyLabels: ["Infectious", "Infectious Disease", "ID/Infect"] },
  // Keep the established storage identity; never redistribute existing clinical text.
  skinLines: { label: "L/D/A", icon: "💉", legacyLabels: ["Skin/Lines"] },
  skin: { label: "SKIN", icon: "🩹", legacyLabels: [], optionalOnLegacy: true, insertAfter: "skinLines" },
  dispo: { label: "DISPO", icon: "🏠", legacyLabels: ["Disposition", "Dispo"] },
} as const;

export type SystemKey = keyof typeof CLINICAL_SECTIONS;
export type SystemField = `systems.${SystemKey}`;
type LegacyOptionalKey = { [K in SystemKey]: typeof CLINICAL_SECTIONS[K] extends { optionalOnLegacy: true } ? K : never }[SystemKey];
export type ClinicalSystemNotes = Record<Exclude<SystemKey, LegacyOptionalKey>, string> & Partial<Record<LegacyOptionalKey, string>>;

export const SYSTEM_KEYS = Object.keys(CLINICAL_SECTIONS) as SystemKey[];
export const SYSTEM_LABELS = Object.fromEntries(SYSTEM_KEYS.map((key) => [key, CLINICAL_SECTIONS[key].label])) as Record<SystemKey, string> & Record<string, string>;
export const SYSTEM_ICONS = Object.fromEntries(SYSTEM_KEYS.map((key) => [key, CLINICAL_SECTIONS[key].icon])) as Record<SystemKey, string> & Record<string, string>;
export const SYSTEM_FIELD_LABELS = Object.fromEntries(SYSTEM_KEYS.map((key) => [`systems.${key}`, SYSTEM_LABELS[key]])) as Record<SystemField, string>;

/** A fresh value object for every patient, including fields absent in older charts. */
export function createEmptySystems(): Record<SystemKey, string> {
  return Object.fromEntries(SYSTEM_KEYS.map((key) => [key, ""])) as Record<SystemKey, string>;
}

/** Preserve the existing built-in-only database parsing contract and text coercion. */
export function parseClinicalSystems(value: unknown): Record<SystemKey, string> {
  const notes = createEmptySystems();
  if (!value || typeof value !== "object" || Array.isArray(value)) return notes;
  const source = value as Record<string, unknown>;
  for (const key of SYSTEM_KEYS) notes[key] = String(source[key] || "");
  return notes;
}

/** Upgrade former default titles without replacing clinician-authored labels. */
export function resolveSystemLabel(key: string, savedLabel?: string): string {
  const definition = Object.prototype.hasOwnProperty.call(CLINICAL_SECTIONS, key) ? CLINICAL_SECTIONS[key as SystemKey] : undefined;
  if (!definition) return savedLabel ?? key;
  if (!savedLabel || (definition.legacyLabels as readonly string[]).includes(savedLabel)) return definition.label;
  return savedLabel;
}

export interface SystemConfig {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  enabled: boolean;
  sortOrder: number;
  isCustom: boolean;
}

export const DEFAULT_SYSTEMS: SystemConfig[] = SYSTEM_KEYS.map((key, sortOrder) => ({
  key, label: SYSTEM_LABELS[key], shortLabel: SYSTEM_LABELS[key], icon: SYSTEM_ICONS[key],
  enabled: true, sortOrder, isCustom: false,
}));

/** Merge new built-ins into saved preferences while retaining custom sections and order. */
export function mergeSystemsConfig(saved: SystemConfig[]): SystemConfig[] {
  const merged = [...saved].sort((a, b) => a.sortOrder - b.sortOrder).map((system) => {
    if (system.isCustom) return { ...system };
    const label = resolveSystemLabel(system.key, system.label);
    if (label !== system.label) return { ...system, label, shortLabel: label };
    return { ...system };
  });
  for (const system of DEFAULT_SYSTEMS) {
    if (merged.some((existing) => existing.key === system.key)) continue;
    const definition = CLINICAL_SECTIONS[system.key as SystemKey];
    const predecessor = "insertAfter" in definition ? merged.findIndex((existing) => existing.key === definition.insertAfter) : -1;
    if (predecessor !== -1) merged.splice(predecessor + 1, 0, { ...system });
    else merged.push({ ...system });
  }
  return merged.map((system, sortOrder) => ({ ...system, sortOrder }));
}
