import type { ClinicalPhrase, PhraseField } from "@/types/phrases";

export const samplePhrase: ClinicalPhrase = {
  id: "phrase-1",
  userId: "user-1",
  name: "Daily Note",
  description: "Test phrase",
  content: "Patient {{name}} is {{status}}. {{symptoms}}",
  shortcut: ".note",
  hotkey: null,
  contextTriggers: {},
  isActive: true,
  isShared: false,
  usageCount: 0,
  lastUsedAt: null,
  version: 1,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

export const sampleFields: PhraseField[] = [
  {
    id: "field-1",
    phraseId: "phrase-1",
    fieldKey: "name",
    fieldType: "patient_data",
    label: "Name",
    options: { source: "name" },
    sortOrder: 1,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "field-2",
    phraseId: "phrase-1",
    fieldKey: "status",
    fieldType: "text",
    label: "Status",
    defaultValue: "stable",
    sortOrder: 2,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "field-3",
    phraseId: "phrase-1",
    fieldKey: "symptoms",
    fieldType: "checkbox",
    label: "Symptoms",
    sortOrder: 3,
    createdAt: "2024-01-01T00:00:00Z",
  },
];
