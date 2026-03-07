/**
 * Accessibility Utilities
 * 
 * Comprehensive accessibility support for the Round Robin Notes application.
 * Includes ARIA live regions, keyboard navigation, focus management, and
 * clinical-specific accessibility features.
 */

// ARIA Live Announcer
export {
  AriaLiveProvider,
  useAnnouncer,
  announce,
  setGlobalAnnouncer,
} from './aria-live';

// Keyboard Navigation
export {
  Keys,
  useFocusTrap,
  getFocusableElements,
  useRovingTabIndex,
  useAutoFocus,
  useFocusOnChange,
  useEscapeKey,
  useHasHover,
  usePrefersReducedMotion,
  useClickOutside,
  createAccessibleButtonProps,
} from './keyboard';

// Clinical Accessibility
export {
  usePatientAnnouncer,
  useCriticalAlertAnnouncer,
  useFormAnnouncer,
  useNavigationAnnouncer,
  useLoadingAnnouncer,
  getPatientTableA11yProps,
  getMedicationListA11yProps,
  getVitalsA11yProps,
  useCountAnnouncer,
  getStatusA11yText,
  useAccessiblePatientSearch,
  formatNumberForScreenReader,
  getExpandableSectionProps,
} from './clinical-a11y';
