# Feature Suggestions: Taking Round Robin Notes to the Next Level

After a thorough code review of the entire codebase — types, hooks, services, edge functions, contexts, and component architecture — here are 5 features that would have the highest impact on clinical workflows and differentiate this application from existing rounding tools.

These suggestions are grounded in what the code already has, what's partially built, and where the biggest gaps exist.

---

## 1. Real-Time Collaborative Editing (Complete the CRDT Integration)

### The Opportunity

The infrastructure is already partially built: `usePresence.ts` tracks who's online and which patient/field they're viewing, cursor position types exist in `src/types/collaboration.ts`, and Yjs + y-indexeddb dependencies are already installed. But the actual CRDT-based concurrent editing isn't wired into patient fields. Right now, the last write wins — which means two attendings updating the same patient's respiratory assessment during rounds will silently overwrite each other.

### What to Build

- **Yjs document binding** for each patient record, with per-field `Y.Text` instances for the 10 system fields, clinical summary, interval events, imaging, and labs
- **Awareness protocol** showing colored cursors and selections in real-time (the `UserPresence.color` and `CursorPosition` types already exist)
- **Supabase Realtime** as the sync transport (already configured in the project) with y-indexeddb for local persistence
- **Conflict-free merge** — CRDT eliminates the need for the current server-wins conflict resolution in `syncService.ts`, which today silently drops edits

### Why This Matters

ICU rounding is inherently a team activity. The attending, fellow, pharmacist, and nurse often need to update the same patient simultaneously. Without real-time sync, teams fall back to verbal corrections ("I already changed that") or discover lost updates hours later. This is the single feature that would most fundamentally change how teams interact with the app.

### Key Files to Modify

- `src/hooks/patients/usePatientMutations.ts` — replace direct Supabase writes with Yjs document updates
- `src/hooks/usePresence.ts` — integrate Yjs awareness protocol
- `src/lib/offline/syncEngine.ts` — CRDT subsumes the conflict detection logic
- New: `src/lib/crdt/` module wrapping Yjs document management and Supabase transport

---

## 2. Clinical Deterioration Early Warning System

### The Opportunity

The app already has risk scoring (SOFA, qSOFA, NEWS2, CURB-65, Wells), lab trending with delta tracking, critical lab thresholds in `src/types/alerts.ts`, and an acuity classification system. But these are all **point-in-time snapshots**. There's no system that watches trends over time and proactively alerts the team when a patient's trajectory is heading toward deterioration.

### What to Build

- **Trend analysis engine** that tracks lab values, risk scores, and clinical text changes across rounding sessions — flag when Na is dropping 3 mEq/day, when creatinine has doubled in 48 hours, or when the respiratory section text changed from "weaning" to "escalating support"
- **AI-powered clinical text analysis** using the existing `ai-clinical-assistant` edge function to parse free-text system assessments for deterioration signals (new vasopressor mentions, escalating FiO2, worsening mental status language)
- **Configurable alert rules** extending the existing `CriticalLabThreshold` and `VitalThreshold` types to support rate-of-change triggers, not just absolute thresholds
- **Deterioration dashboard widget** showing a unit-wide heatmap of patient trajectories — green (improving), yellow (stable), red (deteriorating) — alongside the existing `UnitMetrics` census view
- **Push notifications** via the existing `Notification` type infrastructure for critical trajectory changes, even when the app is backgrounded (service worker already registered)

### Why This Matters

Failure to rescue — the inability to recognize and respond to clinical deterioration — is a leading cause of preventable ICU deaths. Most EHR early warning systems only look at vitals. This app has a unique advantage: it contains the clinical team's own assessment language, which captures nuance ("patient looks worse despite stable vitals") that structured data misses. An early warning system that combines quantitative trends with NLP on clinical narratives would be genuinely novel.

### Key Files to Modify

- `src/types/alerts.ts` — add trend-based alert rules and trajectory types
- `src/hooks/usePatients.ts` — persist historical snapshots for trend analysis
- New: `src/services/deteriorationEngine.ts` — trend calculation and alert generation
- New: `supabase/functions/analyze-deterioration/` — edge function for NLP on clinical text trends
- `src/components/dashboard/` — deterioration heatmap widget

---

## 3. Automated Shift Handoff Generation

### The Opportunity

The handoff types are comprehensive (`HandoffData`, `SBARNote`, `IfThenPlan` in `src/types/handoff.ts`), handoff templates exist, and the `parse-handoff` edge function can parse incoming handoff text. But handoff **generation** from existing patient data is manual. The clinician has to re-synthesize information that already exists across the patient's clinical summary, interval events, system assessments, pending todos, and medication changes.

### What to Build

- **One-click handoff generation** that pulls from all existing patient data:
  - **Situation**: Auto-populated from clinical summary + bed + age + active problems
  - **Background**: Synthesized from interval events and clinical course (using the existing `generate-patient-course` edge function)
  - **Assessment**: Derived from the most recent system reviews, risk scores, and acuity level
  - **Recommendation**: Generated from pending todos, pending labs/imaging, active protocols, and if-then plans
- **Change-aware handoff**: Use the `ChangeTrackingContext` and `patient_field_history` to highlight what changed during the current shift — these are the items most critical for the receiving team
- **Handoff session workflow**: Track who handed off to whom, with sign-off confirmation, using the existing `HandoffSession` types
- **Structured if-then plans**: AI-suggested anticipatory guidance based on clinical context ("If K > 6.0, then give kayexalate and recheck in 2h; call renal if >6.5")
- **Handoff quality scoring**: Compare generated handoffs against SBAR completeness criteria and flag missing elements

### Why This Matters

Handoff failures cause an estimated 80% of serious medical errors during care transitions (Joint Commission). Clinicians spend 15-30 minutes per shift manually creating handoff documents by re-reading and summarizing data that's already in the app. Auto-generating a complete, structured handoff from existing data would save significant time and reduce the risk of omitting critical information. The change-tracking integration is the key differentiator — surfacing what's new since the last handoff is exactly what the receiving clinician needs.

### Key Files to Modify

- New: `supabase/functions/generate-handoff/` — AI-powered handoff synthesis edge function
- `src/hooks/` — new `useHandoffGenerator.ts` hook
- `src/components/` — handoff review/edit UI before finalizing
- `src/types/handoff.ts` — add quality scoring and session tracking types (some already exist)

---

## 4. Voice-Powered Bedside Rounding Mode

### The Opportunity

Voice command types are fully defined in `src/types/voiceCommands.ts` with 20+ commands across 6 categories (navigation, patient, editing, reference, action, system), complete with wake word support ("hey rounds"), confidence thresholds, and voice feedback. The `transcribe-audio` edge function already handles speech-to-text. But none of this is wired into the UI — it's all type definitions with no implementation.

### What to Build

- **Rounding mode**: A dedicated full-screen mode optimized for bedside use — large fonts, high contrast, simplified layout showing one patient at a time with the most critical information (clinical summary, active meds, recent labs, pending todos)
- **Voice navigation**: "Next patient", "Go to bed 12", "Show labs" — hands-free navigation through the patient list using the Web Speech Recognition API
- **Voice-to-field dictation**: "Update respiratory" activates dictation for the respiratory system field, with the existing `transcribe-audio` edge function handling transcription and `transform-text` for medical text enhancement
- **Voice-triggered AI**: "Summarize this patient", "Generate handoff", "What are the pending tasks" — invoke existing AI features by voice
- **Ambient clinical listening** (stretch goal): Continuous low-power listening during rounds that auto-captures key phrases and maps them to the correct patient fields — "let's increase the norepinephrine to 0.15 mics per kilo per minute" gets parsed and offered as a suggested medication update

### Why This Matters

During bedside rounds, clinicians are wearing gloves, examining patients, and managing lines and equipment. They can't easily type on a laptop or phone. Voice interaction removes the barrier between clinical decision-making at the bedside and documentation. The app already has dictation infrastructure — extending it to full voice control of the rounding workflow would make it the first rounding app truly designed for bedside use rather than desk use.

### Key Files to Modify

- New: `src/hooks/useVoiceCommands.ts` — implement the command recognition engine (types already defined)
- New: `src/hooks/useVoiceRounding.ts` — rounding mode state machine
- New: `src/components/rounding/RoundingMode.tsx` — bedside-optimized UI
- `src/hooks/useAIClinicalAssistant.ts` — add voice-triggered entry points
- `src/types/voiceCommands.ts` — already complete, just needs implementation

---

## 5. Cross-Patient Intelligence and Unit-Wide Pattern Detection

### The Opportunity

The app manages patients individually. Each patient has their own system reviews, labs, medications, and assessments. But ICU teams think at two levels: the individual patient and the unit as a whole. The existing `UnitMetrics` type tracks census-level numbers (total patients, ventilated, on vasopressors), but there's no intelligence layer that looks across patients to find patterns, risks, and optimization opportunities.

### What to Build

- **Infection cluster detection**: When multiple patients on the same unit develop new fevers, rising WBC counts, or new antibiotic starts within a short window, flag a potential outbreak. Cross-reference the infectious disease system notes across patients using NLP to identify shared organisms or resistance patterns.
- **Medication interaction matrix**: The `check-drug-interactions` edge function works per-patient. Extend it to flag unit-wide antibiotic stewardship concerns — are there redundant broad-spectrum antibiotics across the unit? Is there a pattern of missed de-escalation opportunities?
- **Resource forecasting**: Based on current patient acuity trends and historical patterns, predict likely resource needs for the next shift — "3 patients trending toward intubation, 1 likely discharge, current vent capacity is X"
- **Quality metric correlation**: Connect the existing quality metrics (VAP rate, CAUTI rate, CLABSI rate, falls) to specific protocol compliance data — "VAP bundle compliance dropped to 70% this week; 2 new VAP cases correlate with missed oral care documentation"
- **Rounding efficiency analytics**: Track how long the team spends per patient, which systems generate the most discussion (measured by text volume changes), and where documentation is consistently incomplete — help teams optimize their rounding process

### Why This Matters

Individual patient care is necessary but not sufficient for ICU quality. The highest-performing ICUs actively monitor unit-wide patterns — infection trends, antibiotic stewardship, protocol compliance, and resource utilization. Today, these analyses happen in retrospective quality meetings weeks after the fact. Surfacing them in real-time during daily operations would shift quality improvement from reactive to proactive. No existing rounding tool does this because no other tool has the structured clinical data at the granularity this app captures.

### Key Files to Modify

- New: `src/services/unitIntelligence.ts` — cross-patient analysis engine
- New: `supabase/functions/analyze-unit-patterns/` — server-side pattern detection
- `src/types/dashboard.ts` — extend `UnitMetrics` with intelligence outputs
- `src/components/dashboard/` — unit intelligence dashboard panel
- `src/hooks/` — new `useUnitIntelligence.ts` hook

---

## Priority Ranking

| # | Feature | Clinical Impact | Build Effort | Risk | Existing Infrastructure |
|---|---------|----------------|--------------|------|------------------------|
| 1 | Real-Time Collaborative Editing | Very High | Medium | Medium | Yjs installed, presence types built, cursor tracking typed |
| 2 | Clinical Deterioration Early Warning | Very High | High | Low | Risk scores, lab deltas, alert thresholds, notification types exist |
| 3 | Automated Shift Handoff Generation | High | Medium | Low | Handoff types complete, AI edge functions exist, change tracking works |
| 4 | Voice-Powered Bedside Rounding | High | High | Medium | Voice command types fully defined, transcription edge function exists |
| 5 | Cross-Patient Unit Intelligence | High | High | Medium | Unit metrics types exist, per-patient AI analysis works |

Features 1 and 3 have the fastest path to value because the underlying infrastructure (Yjs, presence tracking, handoff types, AI edge functions) already exists. Features 2 and 5 deliver the most clinical differentiation. Feature 4 creates the most visceral demo moment but has the highest dependency on browser API maturity.

---

*Generated: 2026-02-22*
*Based on: Full codebase review of Round Robin Notes (625+ components, 35+ hooks, 12 edge functions, 21 type files)*
