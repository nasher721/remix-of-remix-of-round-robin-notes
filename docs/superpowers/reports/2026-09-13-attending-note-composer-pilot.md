# Synthetic attending evaluation cases

These cases were authored for software evaluation. They are fictional source records, not treatment recommendations or archived patient examples. Enter one case at a time. Do not use real patient information for this pilot.

## A: Chronology and consequential compression

Active chart binding: Synthetic A, TEST 01.

Source 1, documented September 13 at 08:00:

```text
68F admitted 9/11 for intracerebral hemorrhage. EVD placed 9/11.
9/13 06:00 specimen: Na 141. CTH 9/13 stable compared with 9/12.
NC changed q1h to q2h on 9/13. Awake and following commands, unchanged from yesterday.
Levetiracetam increased from 750 to 1000 mg BID on 9/13.
Angiography planned for 9/14, not yet performed.
TF at goal. PICC and EVD remain in place. ICU for EVD management.
```

Source 2, imported later but documenting September 12:

```text
9/12 05:00 specimen: Na 149. NC q1h.
```

Attending input:

```text
Keep the exact levetiracetam dose change. Angiography remains planned for tomorrow.
Stable exam adds no new management information today.
```

Expected: current Na 141; older Na 149 only as an explicitly dated meaningful trend if retained. Preserve 750->1000 mg BID, NC q1h->q2h, EVD date/current state, planned angiography and ICU barrier. No claim that angiography occurred. No invented skin or code-status line. Omit a repetitive exam if it adds no management value.

## B: Attribution, medication state and refusal

Active chart binding: Synthetic B, TEST 02. The following deliberately mixed source requires selecting only the Synthetic B portion.

```text
Synthetic B, TEST 02:
72M with a documented ischemic stroke. Heparin ordered today; administration has not been confirmed.
On nasal cannula 2 L. Foley removed at 09:00. Intermittent straight catheterization remains the documented bladder plan.
Family declined the proposed feeding-tube procedure today because of a prior procedural complication.
Repeat cultures pending. Antibiotic stop date in the current plan is 9/16.

Synthetic C, TEST 03:
Na 152. On nasal cannula 6 L. Foley remains in place. Feeding-tube procedure completed today.
```

Attending input:

```text
Do not describe heparin as administered. Keep the refusal and its reason.
```

Expected: no Synthetic C values, devices or completed procedures in B's note. Preserve ordered/unconfirmed heparin state, NC 2 L, pending cultures, treatment stop date and refusal rationale. Do not list the removed Foley as a current line. No inferred replacement procedure or treatment plan.

## C: Discrepancy and edit protection

Active chart binding: Synthetic D, TEST 04.

```text
Current source A: MAP target >65.
Current source B: MAP target >75. The records do not resolve this discrepancy.
Infusion plan: decrease by 2 units q8h, with reassessment before each increment.
Clinician assessment: reduced responsiveness may be medication-related.
Nursing observation: less responsive during the 10:00 examination.
```

Attending input:

```text
Keep the uncertainty in the MAP target. My medication-related assessment is an interpretation, not a correction of the nursing examination.
Keep the exact infusion-wean increment and timing.
```

Expected: concise supported discrepancy without averaging or inventing a selected target. Retain 2 units q8h and the reassessment contingency. Preserve interpretation versus observation.

After generating, manually edit a sentence and request a summary-only shortening. Confirm every other block is unchanged. Generate again while editing the same section: require overlap review. Simulate a server revision conflict: preserve local text and resolve overlapping fields before applying. Copy the reviewed note, reload after applying, and compare exact text and line breaks.
