import type { Patient } from "@/types/patient";
import type { PatientTodo } from "@/types/todo";
import type { ColumnConfig } from "./types";
import { columnCombinations } from "./constants";
import { stripHtml as baseStripHtml, sanitizeAndCleanStyles } from "@/lib/sanitize";

// Re-export strip HTML for backward compatibility
export const stripHtml = baseStripHtml;

// Clean inline font styles from HTML while preserving structure AND sanitizing against XSS
export const cleanInlineStyles = sanitizeAndCleanStyles;

// Helper to escape RTF special characters
export const escapeRTF = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\par\n');
};

// Format todos for display
export const formatTodosForDisplay = (todos: PatientTodo[]): string => {
  if (todos.length === 0) return '';
  return todos.map(t => `${t.completed ? '☑' : '☐'} ${t.content}`).join('\n');
};

export const formatTodosHtml = (todos: PatientTodo[]): string => {
  if (todos.length === 0) return '<span class="empty">No todos</span>';
  return `<ul class="todos-list">${todos.map(t => 
    `<li class="todo-item ${t.completed ? 'completed' : ''}">
      <span class="todo-checkbox">${t.completed ? '☑' : '☐'}</span>
      <span class="todo-content">${t.content}</span>
    </li>`
  ).join('')}</ul>`;
};

// Get cell value from patient
export const getCellValue = (patient: Patient, field: string, patientNotes: Record<string, string>): string => {
  if (field === "clinicalSummary") return patient.clinicalSummary;
  if (field === "intervalEvents") return patient.intervalEvents;
  if (field === "imaging") return patient.imaging;
  if (field === "labs") return patient.labs;
  if (field === "notes") return patientNotes[patient.id] || "";
  if (field.startsWith("systems.")) {
    const systemKey = field.replace("systems.", "") as keyof typeof patient.systems;
    return patient.systems[systemKey];
  }
  return "";
};

// Check if a column is part of an active combination
export const isColumnCombined = (columnKey: string, combinedColumns: string[]): string | null => {
  for (const combo of columnCombinations) {
    if (combinedColumns.includes(combo.key) && combo.columns.includes(columnKey)) {
      return combo.key;
    }
  }
  return null;
};

// Get combined content for a patient
export const getCombinedContent = (
  patient: Patient, 
  combinationKey: string, 
  columns: ColumnConfig[],
  patientNotes: Record<string, string>
): string => {
  const combination = columnCombinations.find(c => c.key === combinationKey);
  if (!combination) return '';
  
  const sections: string[] = [];
  combination.columns.forEach(colKey => {
    const value = getCellValue(patient, colKey, patientNotes);
    if (value) {
      const label = columns.find(c => c.key === colKey)?.label || colKey;
      sections.push(`<div class="combined-section"><strong>${label}:</strong> ${cleanInlineStyles(value)}</div>`);
    }
  });
  
  return sections.join('');
};
