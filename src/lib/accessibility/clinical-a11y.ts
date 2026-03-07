/**
 * Clinical Accessibility Utilities
 * 
 * Healthcare-specific accessibility helpers for:
 * - Patient data reading
 * - Critical alert announcements
 * - Status updates
 * - Form validation
 */

import * as React from 'react';
import { announce } from './aria-live';
import { useAnnouncer } from './aria-live';

/**
 * Hook to announce patient-related updates
 */
export function usePatientAnnouncer() {
  const { announce } = useAnnouncer();

  return {
    announcePatientAdded: (name: string) => {
      announce(`Patient ${name} added to the list`, 'polite');
    },
    announcePatientRemoved: (name: string) => {
      announce(`Patient ${name} removed from the list`, 'polite');
    },
    announcePatientUpdated: (name: string, field: string) => {
      announce(`${name}'s ${field} updated`, 'polite');
    },
    announcePatientSelected: (name: string) => {
      announce(`Selected patient: ${name}`, 'polite');
    },
  };
}

/**
 * Hook to announce critical alerts
 */
export function useCriticalAlertAnnouncer() {
  const { announce } = useAnnouncer();

  return {
    announceCriticalValue: (test: string, value: string) => {
      announce(`Critical ${test}: ${value}. Immediate attention required.`, 'assertive');
    },
    announceAllergyAlert: (allergen: string) => {
      announce(`Alert: Patient has allergy to ${allergen}`, 'assertive');
    },
    announceCodeStatus: (status: string) => {
      announce(`Code status: ${status}`, 'assertive');
    },
    announceSyncError: () => {
      announce('Sync error detected. Some data may not be saved.', 'assertive');
    },
  };
}

/**
 * Hook for announcing form validation errors
 */
export function useFormAnnouncer() {
  const { announce } = useAnnouncer();

  return {
    announceFieldError: (fieldName: string, error: string) => {
      announce(`Error in ${fieldName}: ${error}`, 'assertive');
    },
    announceFormSubmitted: () => {
      announce('Form submitted successfully', 'polite');
    },
    announceFormErrors: (count: number) => {
      announce(`Form has ${count} error${count === 1 ? '' : 's'}. Please review and correct.`, 'assertive');
    },
    announceRequiredField: (fieldName: string) => {
      announce(`${fieldName} is required`, 'assertive');
    },
  };
}

/**
 * Hook for announcing navigation changes
 */
export function useNavigationAnnouncer() {
  const { announce } = useAnnouncer();

  return {
    announcePageChange: (pageName: string) => {
      announce(`Navigated to ${pageName}`, 'polite');
    },
    announceTabChange: (tabName: string) => {
      announce(`Switched to ${tabName} tab`, 'polite');
    },
    announceViewChange: (viewName: string) => {
      announce(`Switched to ${viewName} view`, 'polite');
    },
  };
}

/**
 * Hook for announcing loading states
 */
export function useLoadingAnnouncer() {
  const { announce } = useAnnouncer();

  return {
    announceLoading: (operation: string) => {
      announce(`Loading ${operation}...`, 'polite');
    },
    announceLoadingComplete: (operation: string) => {
      announce(`${operation} loaded`, 'polite');
    },
    announceSaving: () => {
      announce('Saving changes...', 'polite');
    },
    announceSaved: () => {
      announce('Changes saved successfully', 'polite');
    },
  };
}

/**
 * Generate ARIA attributes for patient data tables
 */
export function getPatientTableA11yProps(
  patients: Array<{ id: string; name: string }>
): React.TableHTMLAttributes<HTMLTableElement> {
  return {
    role: 'table',
    'aria-label': 'Patient list',
    'aria-describedby': 'patient-list-description',
    'aria-rowcount': patients.length,
  };
}

/**
 * Generate ARIA attributes for medication lists
 */
export function getMedicationListA11yProps(
  medications: Array<{ name: string; dose: string }>
): React.HTMLAttributes<HTMLUListElement> {
  return {
    role: 'list',
    'aria-label': `Medication list with ${medications.length} items`,
  };
}

/**
 * Generate ARIA attributes for vital signs display
 */
export function getVitalsA11yProps(
  vitals: Record<string, string | number>
): React.HTMLAttributes<HTMLDivElement> {
  const vitalDescriptions = Object.entries(vitals)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  return {
    role: 'region',
    'aria-label': 'Vital signs',
    'aria-description': vitalDescriptions,
  };
}

/**
 * Hook to announce count changes (useful for patient count, todo count, etc.)
 */
export function useCountAnnouncer(itemName: string) {
  const previousCountRef = React.useRef<number>(0);
  const { announce } = useAnnouncer();

  const announceCount = React.useCallback(
    (count: number) => {
      const previousCount = previousCountRef.current;
      const diff = count - previousCount;

      if (diff > 0) {
        announce(`${diff} ${itemName}${diff === 1 ? '' : 's'} added. Total: ${count}`, 'polite');
      } else if (diff < 0) {
        announce(`${Math.abs(diff)} ${itemName}${Math.abs(diff) === 1 ? '' : 's'} removed. Total: ${count}`, 'polite');
      }

      previousCountRef.current = count;
    },
    [announce, itemName]
  );

  return { announceCount };
}

/**
 * Generate screen reader only text for status indicators
 */
export function getStatusA11yText(status: 'stable' | 'critical' | 'improving' | 'declining'): string {
  const statusMap = {
    stable: 'Patient status: Stable',
    critical: 'Patient status: Critical - immediate attention required',
    improving: 'Patient status: Improving',
    declining: 'Patient status: Declining - attention required',
  };
  return statusMap[status];
}

/**
 * Hook for accessible patient search
 */
export function useAccessiblePatientSearch(
  patients: Array<{ id: string; name: string }>,
  onSelect: (id: string) => void
) {
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const { announce } = useAnnouncer();

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = prev < patients.length - 1 ? prev + 1 : 0;
            announce(`${patients[next]?.name}, ${next + 1} of ${patients.length}`);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = prev > 0 ? prev - 1 : patients.length - 1;
            announce(`${patients[next]?.name}, ${next + 1} of ${patients.length}`);
            return next;
          });
          break;
        case 'Enter':
          if (activeIndex >= 0) {
            onSelect(patients[activeIndex].id);
          }
          break;
        case 'Escape':
          setActiveIndex(-1);
          break;
      }
    },
    [activeIndex, patients, onSelect, announce]
  );

  return {
    activeIndex,
    handleKeyDown,
    setActiveIndex,
  };
}

/**
 * Utility to format numbers for screen readers
 * Makes large numbers or decimals more readable
 */
export function formatNumberForScreenReader(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  
  if (isNaN(n)) return String(num);
  
  // Format based on magnitude
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString();
  }
  
  // Handle decimals - read digit by digit if small
  if (Math.abs(n) < 1 && n !== 0) {
    const str = n.toString();
    return str.replace('.', ' point ').split('').join(' ');
  }
  
  return String(n);
}

/**
 * Generate ARIA attributes for expandable sections
 */
export function getExpandableSectionProps(
  isExpanded: boolean,
  sectionId: string,
  triggerId: string
): {
  trigger: React.ButtonHTMLAttributes<HTMLButtonElement>;
  content: React.HTMLAttributes<HTMLDivElement>;
} {
  return {
    trigger: {
      'aria-expanded': isExpanded,
      'aria-controls': sectionId,
      id: triggerId,
    },
    content: {
      id: sectionId,
      'aria-labelledby': triggerId,
      role: 'region',
      hidden: !isExpanded,
    },
  };
}
