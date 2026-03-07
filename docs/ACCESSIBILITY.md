# Accessibility Guide (a11y)

This document describes the accessibility features and best practices for Round Robin Notes.

## Overview

Round Robin Notes is committed to WCAG 2.1 AA compliance to ensure the application is accessible to all users, including those using screen readers, keyboard navigation, and other assistive technologies. This is especially critical for healthcare applications.

## Current Accessibility Features

### ✅ Implemented

- **Skip to Content Link** - Keyboard users can skip navigation
- **ARIA Live Regions** - Screen reader announcements for dynamic content
- **Focus Management** - Focus trapping in modals, focus restoration
- **Keyboard Navigation** - Full keyboard support for all interactions
- **Semantic HTML** - Proper heading hierarchy, landmarks, labels
- **Reduced Motion Support** - Respects user preferences
- **High Contrast** - Supports high contrast modes
- **Screen Reader Optimization** - Hidden decorative elements, meaningful labels

## ARIA Live Announcer

The `AriaLiveProvider` enables screen reader announcements without visual changes.

### Setup

```tsx
import { AriaLiveProvider } from '@/lib/accessibility';

function App() {
  return (
    <AriaLiveProvider>
      {/* Your app */}
    </AriaLiveProvider>
  );
}
```

### Usage

```tsx
import { useAnnouncer } from '@/lib/accessibility';

function PatientCard({ patient }) {
  const { announce } = useAnnouncer();

  const handleSave = async () => {
    await savePatient(patient);
    announce(`Patient ${patient.name} updated successfully`);
  };

  return <button onClick={handleSave}>Save</button>;
}
```

### Clinical Announcements

```tsx
import { 
  usePatientAnnouncer, 
  useCriticalAlertAnnouncer,
  useFormAnnouncer 
} from '@/lib/accessibility';

function PatientDashboard() {
  const patientAnnouncer = usePatientAnnouncer();
  const alertAnnouncer = useCriticalAlertAnnouncer();
  const formAnnouncer = useFormAnnouncer();

  // Announce patient changes
  const addPatient = (name) => {
    patientAnnouncer.announcePatientAdded(name);
  };

  // Announce critical alerts
  const showCriticalValue = (test, value) => {
    alertAnnouncer.announceCriticalValue(test, value);
  };

  // Announce form errors
  const handleSubmit = () => {
    if (errors.length > 0) {
      formAnnouncer.announceFormErrors(errors.length);
    }
  };
}
```

## Keyboard Navigation

### Focus Management

```tsx
import { useFocusTrap, useAutoFocus } from '@/lib/accessibility';

function Modal({ isOpen, onClose }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Trap focus within modal
  useFocusTrap(containerRef, { enabled: isOpen });

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {/* Modal content */}
    </div>
  );
}
```

### Roving Tabindex

For lists, menus, and toolbars:

```tsx
import { useRovingTabIndex } from '@/lib/accessibility';

function PatientList({ patients }) {
  const containerRef = useRef<HTMLUListElement>(null);
  const { activeIndex, handleKeyDown } = useRovingTabIndex(
    containerRef, 
    'vertical'
  );

  return (
    <ul 
      ref={containerRef}
      onKeyDown={handleKeyDown}
      role="listbox"
    >
      {patients.map((patient, index) => (
        <li
          key={patient.id}
          tabIndex={index === activeIndex ? 0 : -1}
          role="option"
          aria-selected={index === activeIndex}
        >
          {patient.name}
        </li>
      ))}
    </ul>
  );
}
```

### Keyboard Shortcuts

Common keyboard patterns:

| Key | Action |
|-----|--------|
| `Tab` | Move to next focusable element |
| `Shift + Tab` | Move to previous focusable element |
| `Enter` / `Space` | Activate button or link |
| `Escape` | Close modal, cancel action |
| `Arrow Keys` | Navigate within lists, menus |
| `Home` | Go to first item |
| `End` | Go to last item |

## Focus Management

### Auto Focus

```tsx
import { useAutoFocus } from '@/lib/accessibility';

function SearchInput() {
  // Focus on mount
  const inputRef = useAutoFocus<HTMLInputElement>();
  
  return <input ref={inputRef} type="search" />;
}
```

### Focus on Change

```tsx
import { useFocusOnChange } from '@/lib/accessibility';

function PatientForm({ patientId }) {
  // Focus when patient changes
  const nameRef = useFocusOnChange<HTMLInputElement>([patientId]);
  
  return <input ref={nameRef} name="patientName" />;
}
```

## ARIA Attributes

### Expandable Sections

```tsx
import { getExpandableSectionProps } from '@/lib/accessibility';

function CollapsibleSection({ title, children }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sectionId = 'section-' + useId();
  const triggerId = 'trigger-' + useId();

  const { trigger, content } = getExpandableSectionProps(
    isExpanded,
    sectionId,
    triggerId
  );

  return (
    <>
      <button
        {...trigger}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {title}
        <span aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
      </button>
      <div {...content}>
        {isExpanded && children}
      </div>
    </>
  );
}
```

### Status Indicators

```tsx
import { getStatusA11yText } from '@/lib/accessibility';

function PatientStatus({ status }) {
  return (
    <span 
      className={`status-badge status-${status}`}
      aria-label={getStatusA11yText(status)}
    >
      <span aria-hidden="true">
        {status === 'critical' ? '⚠️' : '✓'}
      </span>
      {status}
    </span>
  );
}
```

## Patient Data Accessibility

### Accessible Patient Search

```tsx
import { useAccessiblePatientSearch } from '@/lib/accessibility';

function PatientSearch({ patients, onSelect }) {
  const { activeIndex, handleKeyDown } = useAccessiblePatientSearch(
    patients,
    onSelect
  );

  return (
    <div role="search">
      <input
        type="search"
        aria-label="Search patients"
        aria-controls="search-results"
        aria-activedescendant={`patient-${activeIndex}`}
      />
      <ul
        id="search-results"
        role="listbox"
        onKeyDown={handleKeyDown}
      >
        {patients.map((patient, index) => (
          <li
            key={patient.id}
            id={`patient-${index}`}
            role="option"
            aria-selected={index === activeIndex}
          >
            {patient.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Number Formatting for Screen Readers

```tsx
import { formatNumberForScreenReader } from '@/lib/accessibility';

function LabValue({ value, unit }) {
  return (
    <span aria-label={`${formatNumberForScreenReader(value)} ${unit}`}>
      {value} {unit}
    </span>
  );
}
```

## Reduced Motion

```tsx
import { usePrefersReducedMotion } from '@/lib/accessibility';

function AnimatedPanel({ children }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

## Testing Accessibility

### Manual Testing Checklist

- [ ] Can navigate with keyboard only (Tab, Shift+Tab)
- [ ] Skip link appears on Tab
- [ ] Focus is visible on all interactive elements
- [ ] Modals trap focus and restore on close
- [ ] Form errors are announced by screen reader
- [ ] Dynamic content is announced
- [ ] All images have alt text
- [ ] Color is not the only means of conveying information

### Screen Reader Testing

Test with:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)

### Automated Testing

Use axe DevTools browser extension or:

```bash
npm install -D @axe-core/react
```

```tsx
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import axe from '@axe-core/react';

if (process.env.NODE_ENV !== 'production') {
  axe(React, ReactDOM, 1000);
}
```

## Common Patterns

### Buttons vs Links

```tsx
// Use <button> for actions
<button onClick={handleSave}>Save Patient</button>

// Use <a> for navigation
<a href="/patients/123">View Patient</a>

// Div as button (avoid when possible)
import { createAccessibleButtonProps } from '@/lib/accessibility';

<div {...createAccessibleButtonProps(handleClick, { label: 'Delete' })}>
  <TrashIcon />
</div>
```

### Form Labels

```tsx
// Always associate labels with inputs
<label htmlFor="patient-name">Patient Name</label>
<input id="patient-name" type="text" />

// Or use aria-label when visible label isn't needed
<input type="search" aria-label="Search patients" />

// For grouped inputs
<fieldset>
  <legend>Vital Signs</legend>
  <label>Temperature: <input type="number" /></label>
  <label>Heart Rate: <input type="number" /></label>
</fieldset>
```

### Error Messages

```tsx
<input
  aria-invalid={hasError}
  aria-describedby={hasError ? 'name-error' : undefined}
/>
{hasError && (
  <span id="name-error" role="alert">
    Patient name is required
  </span>
)}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [MDN ARIA Documentation](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [WebAIM Screen Reader Survey](https://webaim.org/projects/screenreadersurvey/)

## Related Documentation

- [Testing Guide](./TESTING.md)
- [API Contracts](./API_CONTRACTS.md)
- [Observability](./OBSERVABILITY.md)
