# Adaptive Decision Scribe Design

**Status:** Validated design
**Date:** 2026-09-04
**Product surface:** Today's Round / Patient Focus

## Summary

Add a patient-scoped ambient assistant that listens during bedside discussion, extracts only decisions and actionable plan content, and presents an exception-first draft for physician attestation. The assistant learns one primary physician's full workflow over time, including language, structure, assignments, and repeated clinical actions.

Autonomy is progressive rather than category-limited. Any learned pattern may eventually be precomposed when its evidence is strong enough, but no generated content becomes durable clinical data until the physician attests the complete patient plan. After adaptation, the median attestation target is under 30 seconds per patient.

## Goals

- Reduce time spent converting bedside discussion into an organized plan.
- Keep the physician engaged with the rounding team instead of the screen.
- Capture decisions, changes, tasks, ownership, timing, contingencies, and unresolved questions.
- Preserve the existing Focus-first, bed-by-bed workflow across phone and workstation.
- Improve with repeated physician approvals and corrections.
- Maintain strict patient isolation, transparent provenance, undo, and auditability.
- Retain only physician-approved structured clinical content.

## Non-Goals

- A general-purpose encounter transcription archive.
- Continuous background recording across multiple patients.
- Direct EHR order placement or autonomous clinical execution.
- Separate learned profiles for every team member in the first version.
- Replacement of the existing patient, todo, round-state, or offline-sync models.

## Product Model

The feature combines three behaviors:

1. **Patient-scoped Plan Composer:** explicit start and stop controls bind capture to the active round, patient, physician, and device.
2. **Decision-only listener:** ordinary discussion is discarded; the draft contains settled decisions, proposed changes, tasks, contingencies, and unresolved questions.
3. **Adaptive physician model:** approvals, edits, reversals, and repeated actions teach the assistant how the primary physician works.

Other speakers provide conversational context. Candidate content may come from anyone, but it retains speaker attribution and distinguishes proposals from decisions affirmed by the primary physician.

## Bedside Interaction

Patient Focus contains a microphone control for starting ambient capture. While active, the header shows an unmistakable `Listening · <patient location>` state with pause and stop controls. The current patient remains locked until capture is stopped and the resulting draft is attested or discarded.

The app does not show a scrolling transcript during discussion. Stopping capture opens an exception-first review with a compact summary such as `6 plan updates · 3 tasks · 1 unresolved question`.

Review content is grouped by clinical problem or system. Each row contains:

- Proposed final wording and destination.
- Change type: add, modify, remove, assign, or contingency.
- Task owner and timing when applicable.
- Speaker and supporting transcript span when ambiguity exists.
- Confidence and any contradiction with current patient data.

Initially, all rows are expanded. As patterns graduate, reliable items collapse and exceptions remain prominent. The physician may edit, reject, expand evidence, or undo changes, then attests the entire patient plan with one action before advancing.

The intended steady-state interaction is: **start, stop, attest**.

## Architecture

### Capture Controller

Lives inside Patient Focus and owns recording state, patient binding, visible status, interruption handling, and patient-switch protection. Audio is streamed through an encrypted ephemeral session and is never written to browser storage or the application database.

### Speaker and Transcript Processor

Produces temporary attributed speech segments. Audio and transcript segments exist only for the active processing and review session.

### Decision Engine

Combines temporary speech segments with a read-only snapshot of the current patient's app data. It emits a strict structured result containing patient and session identifiers, speaker, statement type, destination, proposed content, task metadata, confidence, and supporting transcript span.

### Draft Composer

Merges compatible statements, preserves disagreements, detects changes from current patient data, and prepares the review model. It must preserve distinctions such as proposed versus affirmed, start versus stop, continue versus discontinue, and unconditional versus contingent.

### Attestation Controller

Owns the only durable write boundary. Attestation commits approved changes through the existing patient, todo, round-state, and offline-sync pathways. Rejected proposals, raw audio, and temporary transcripts are deleted.

### Physician Adaptation Profile

Stores patterns derived from the primary physician's approvals, edits, reversals, wording, assignments, sequencing, and repeated actions. Learned behaviors are inspectable, individually revocable, and resettable.

### Autonomy Policy Engine

Determines when patterns graduate based on evidence such as observation count, approval rate, edit rate, reversal rate, recency, context similarity, contradiction frequency, and model version. Graduation controls draft precomposition and review prominence; it never bypasses final patient attestation.

## Data Lifecycle

1. Start capture and bind an ephemeral session to the active patient.
2. Stream audio for temporary speaker attribution and transcription.
3. Compare extracted decisions with a read-only patient snapshot.
4. Compose a structured, exception-first draft.
5. Let the physician edit, reject, or attest the complete patient plan.
6. Persist only approved structured content and permitted nonclinical audit metadata.
7. Feed approval and correction signals into the physician adaptation profile.
8. Delete audio, temporary transcripts, and rejected proposals.

Durable history may contain revisions of physician-approved structured content and nonclinical event metadata. It must not retain rejected conversation or raw speech.

## Progressive Autonomy

The initial mode requires full review. Repeated consistent approvals allow individual patterns to graduate into precomposed content. No content category is permanently prohibited from graduation, including recurring clinical actions, but all generated content remains provisional until patient-level attestation.

A graduated pattern returns to full review when:

- The physician edits or reverses it.
- Its error or contradiction rate rises.
- The clinical context differs materially from learned examples.
- The extraction model changes materially.
- Confidence calibration drifts.
- The pattern becomes stale.

The physician can view why a pattern graduated, reduce its autonomy, revoke it, or reset the profile.

## Failure Handling

- **Connectivity loss during capture:** pause visibly and attempt only a short encrypted in-memory bridge. Never write audio to disk. If capture cannot resume, discard the buffer and offer manual entry.
- **Extraction failure:** write nothing. Retry only while permitted temporary inputs still exist; otherwise fall back to manual capture.
- **Unsupported content:** reject candidates without a supporting transcript span before review.
- **Ambiguous or conflicting speech:** preserve speaker attribution and alternatives for physician resolution.
- **Patient switch attempt:** block navigation until the active session is stopped and the draft is attested or discarded.
- **Save failure after attestation:** place the approved structured draft in the existing offline outbox, show it as pending, and never represent it as remotely saved before acknowledgement.
- **Concurrent edits:** use the existing explicit Mine/Theirs/merge conflict flow.
- **Crash before attestation:** retain no generated clinical content.
- **Unresolved writes or conflicts:** keep End Round blocked under the existing completion-safety rules.

## Testing Strategy

Create a physician-curated corpus of synthetic or properly de-identified ICU discussions covering interruptions, overlapping speakers, abbreviations, negation, medication changes, competing recommendations, conditional plans, deferred decisions, and patient transitions.

Automated coverage must include:

- Capture state transitions and patient locking.
- Audio and transcript expiration after attest, discard, timeout, and crash.
- Structured-result schema and patient/session binding.
- Proposed versus affirmed actions and critical action polarity.
- Ambiguous speaker and contradiction handling.
- Attestation, offline queueing, sync acknowledgement, conflict resolution, and undo.
- Pattern graduation, regression, revocation, and profile reset.
- Model-version and context-drift behavior.
- Wrong-patient and cross-session contamination attempts.

Privacy verification must independently prove that raw audio, temporary transcripts, and rejected proposals are absent after every terminal path.

## Rollout

1. **Shadow mode:** generate results without writing; compare them with the physician's completed plan.
2. **Full-review mode:** produce drafts with all content expanded and requiring patient attestation.
3. **Adaptive composition:** precompose patterns supported by repeated approvals while preserving complete review.
4. **Exception-first mode:** collapse reliable patterns and foreground novel, conflicting, or uncertain content.

Progression is evidence-gated per learned pattern, not unlocked solely by elapsed time or encounter count.

## Success Criteria

- Median patient attestation time is under 30 seconds after adaptation.
- Explicitly affirmed decisions and tasks are reliably captured in the structured draft.
- Unsupported-item, edit, reversal, abandonment, and task-omission rates remain within pilot thresholds established before release.
- No wrong-patient durable writes occur; any such event is release-stopping.
- Every durable generated change has physician attestation and recoverable revision history.
- Audio, temporary transcripts, and rejected proposals are not durable.
- Physicians can inspect, revoke, or reset all learned behaviors.

## Open Implementation Decisions

- Approved transcription and extraction provider or on-device runtime.
- Maximum duration of the transient in-memory reconnect buffer.
- Exact graduation and regression thresholds.
- Consent, disclosure, and institutional policy presentation.
- Encryption and retention requirements for approved structured drafts in the offline outbox.
- Pilot corpus size and quantitative release thresholds.

These decisions must be resolved before implementation planning; they do not change the validated interaction or data-boundary design.
