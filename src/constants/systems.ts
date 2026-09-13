/**
 * System Labels and Icons
 * Centralized constants for medical system categorization
 */

export const SYSTEM_LABELS: Record<string, string> = {
  neuro: "NEURO",
  cv: "CV",
  resp: "RESP",
  renalGU: "RENAL/GU",
  gi: "GI",
  endo: "ENDO",
  heme: "HEME/ONC",
  infectious: "ID",
  skinLines: "L/D/A",
  skin: "SKIN",
  dispo: "DISPO",
};

export const SYSTEM_LABELS_SHORT: Record<string, string> = { ...SYSTEM_LABELS };

export const SYSTEM_ICONS: Record<string, string> = {
  neuro: "🧠",
  cv: "❤️",
  resp: "🫁",
  renalGU: "💧",
  gi: "🍽️",
  endo: "⚡",
  heme: "🩸",
  infectious: "🦠",
  skinLines: "💉",
  skin: "🩹",
  dispo: "🏠",
};

export const SYSTEM_KEYS = Object.keys(SYSTEM_LABELS) as Array<keyof typeof SYSTEM_LABELS>;
