# Learnings - VitalsSection Component

## Task Completed
Created `src/components/patient/VitalsSection.tsx` - a structured vitals input section component.

## Key Patterns Used
- Used `Collapsible` from Radix UI for collapsed-by-default behavior
- Used `Input` component with proper inputMode attributes for numeric inputs
- Used `Label` component from shadcn/ui for field labels
- Used 2-column grid layout for compact vital signs display
- Used `Activity` icon for the section header (consistent with clinical theme)
- Temperature unit toggle with actual F/C conversion

## Component Features
1. Collapsible header (collapsed by default per requirements)
2. All vital sign fields: Temp, HR, BP, RR, SpO2
3. Temperature unit toggle (°F/°C) with actual conversion
4. Last recorded timestamp with "Update to now" button
5. Compact 2-column grid layout
6. Proper accessibility labels

## Vitals Interface Used
```typescript
interface Vitals {
  lastRecorded?: string;
  temp?: string;      // e.g., "98.6°F" or "37.0°C"
  hr?: string;        // bpm
  bp?: string;        // e.g., "120/80"
  rr?: string;        // breaths/min
  spo2?: string;      // percentage
}
```

## Integration Notes
- Component accepts `vitals` prop and `onVitalChange` callback
- Does not handle persistence directly - parent handles via `onVitalChange`
- Can be integrated into PatientCard or other patient sections
