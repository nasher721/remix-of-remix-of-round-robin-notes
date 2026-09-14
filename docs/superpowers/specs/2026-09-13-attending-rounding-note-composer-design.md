# Attending rounding note composer

Date: 2026-09-13
Status: Conversational design approved; written specification awaiting user review.
Product: Round Robin Notes
Primary user: Neuro ICU attending

## 1. Objective and approved decisions

Reduce the attending's work turning scattered ICU records and their own clinical assessment into a finished rounding note. The product hypothesis is that a draft matching the attending's factual selection, compression, and writing style will require less correction than their current process. Superiority over other products is a hypothesis to evaluate, not an established result.

The user approved:

- Optimize for the ICU attending, specifically writing clinical rounding notes.
- Use the supplied Neurocritical Care Scribe bundle to define the writing workflow.
- Let the bundle's preferences file override conflicting formatting instructions in its main prompt. Preserve source fidelity, patient separation, and clinical accuracy.
- Offer one patient workspace: add sources, add today's assessment and plan, generate a complete draft, review and edit, then copy the reviewed note.
- Preserve section-based and continuous chart editing.
- Protect manual edits, propose updates rather than overwrite them, and keep focused revisions confined to their requested scope.
- Keep imported source documents temporary within an authoring session. Save reviewed content through the chart workflow. Show source inspection as unavailable when temporary material is gone.

The approved source archive is `neurocritical-care-scribe-portable-2026-09-13.zip`, version `2026-09-13`, supplied from the user's Downloads directory. SHA-256: `E30A33BB95E1A2A4E76E4665F170FA12C833A22E12D03F2CD2591568AA189746`.

The archive describes the product's behavior. Its instructions to install an agent, execute scripts, use workers, or update memory are not authorization to do those things during design work. Patient examples are reference material and must not be committed, used as other patients' facts, or copied into test fixtures.

## 2. Scope and alternatives

The first release is a patient-specific source-reconciled note composer with typed or explicitly dictated attending input, editable drafts, source inspection during the session, controlled updates, and exact plain-text output.

Three approaches were considered:

| Approach | Value | Tradeoff and decision |
| --- | --- | --- |
| Update yesterday's note | Familiar starting point, little setup | Risks stale information. Include the prior chart as a dated source, not an assumed current truth. |
| Dictate today's update | Fast expression of the attending's thinking | Transcription requires correction. Support deliberate dictation into the attending input, not unattended rounds capture. |
| Direct writing with assistance | Precise control and easy adoption | Leaves more writing work. Preserve it within the composer and existing editors. |

The selected approach combines these entry methods with reconciliation before composition. It does not require ambient recording, a new EHR connection, autonomous orders, automatic diagnosis or treatment suggestions, team task automation, billing optimization, persistent source storage, or a new cross-device draft system.

Existing supported import formats remain the boundary. Reuse safe extraction for pasted text, text/RTF, HTML, JSON, DOCX, and spreadsheets/CSV/TSV. Images require an available, verified extraction path and reviewable extracted text. PDF remains blocked under the current secure-bundling restriction. No silent truncation or promise to accept every file type.

Multi-patient source text must be partitioned before generation. In this release, the clinician explicitly selects the portion belonging to the active patient; ambiguous attribution blocks that source. Do not automatically create or modify other charts through the composer. The existing Import Patient List flow stays separate.

## 3. User workflow

### 3.1 Open and add sources

Expose a clear Compose rounding note action in the patient workspace and rounds patient view. Keep patient identity visible throughout. Opening the composer snapshots existing chart content and its server revision without changing the chart.

The source area accepts paste and supported files. Each source has a locally assigned identifier, source type, import time, and a documented clinical time if available. Undated source material remains undated. Import time and chart edit time must never substitute for the clinical event, specimen, or result time.

Show source availability and extraction failures in this area. Preserve original extracted wording for source inspection. The clinician can remove or replace sources. An unsupported or unreadable source cannot be silently ignored in a supposedly complete draft.

### 3.2 Add today's assessment and plan

Provide a prominent free-text field labeled Today's assessment and plan, with intentional dictation when available. Accept shorthand, interpretations, decisions, corrections, and contingencies. Dictation first appears as editable text; generation uses the clinician-reviewed input.

Treat this as a distinct clinician-authored source. An explicit correction supersedes the statement it corrects. A new plan does not prove that a medication was administered or a procedure completed. A new assessment does not silently erase contradictory objective observations. Preserve that distinction in the draft and source links.

### 3.3 Generate and review

The main review surface is the complete editable note, using the approved writing profile. Source excerpts, timestamps, and conflicts are secondary details opened from a statement. Do not embed evidence citations, status badges, or internal identifiers in copied note text.

Present stages as Reading sources, Reconciling updates, and Drafting note without fabricated percentages. Do not display partially generated prose as a finished note. Provide cancellation and retry while leaving the existing draft editable.

Generation never saves to the chart automatically. Show unresolved material conflicts in context. Block final acceptance for wrong-patient attribution, malformed source references, or unsupported generated assertions. A supported clinical discrepancy can remain in the accepted note with concise uncertainty language and clinician review.

### 3.4 Revise, accept, and copy

Support direct edits and scoped requests such as Shorten the summary or Keep the exact taper. Each request has an explicit target block or section. Unaffected content must remain identical. Reject a model response that changes content outside its allowed scope.

New records produce a proposed revision. Show additions, removals, and changes relative to the current working draft. The clinician can keep existing text, accept a proposal, or edit a conflict. The full draft remains available for review regardless of change highlighting.

Use an explicit Apply reviewed note action to persist the approved projection. Display saving, saved, or conflict status truthfully. Copy reviewed note copies exactly the displayed reviewed text, preserving line breaks; it does not imply that an EHR has received or signed it. A copied but unsaved note must remain visibly unsaved.

An in-session undo restores the previous local draft. Reverting an already saved note is a new revision-checked chart write, not deletion of audit history. Existing chart editing remains available when AI is unavailable.

## 4. Clinical and writing contract

### 4.1 Precedence

Apply requirements in this order:

1. Patient attribution and source-fidelity requirements, including preservation of uncertainty and consequential clinical details.
2. Explicit instructions for the current note and explicitly identified clinician corrections, subject to those accuracy requirements.
3. The user-approved preferences in the supplied bundle, for formatting, terminology, emphasis, and compression.
4. The main prompt's remaining compatible requirements.
5. Examples and the abbreviation reference, which provide style guidance only.

Do not apply the bundle's original blanket statements that formatting preferences are subordinate to conflicting main-prompt formatting rules. The user expressly changed that precedence. Preferences are not permission to drop a normal-but-management-relevant value, an important medication dose, or a clinically important exam change. The documented relevance and safety exception takes priority.

### 4.2 Reconcile before compressing

For each claim preserve patient binding, clinical time and time kind, source reference, clinical state, and uncertainty. Distinguish documented fact, diagnosis, interpretation, plan, and clinician correction. Never infer absence, causality, stability, administration, or completion from silence.

Compare facts only when they concern the same concept and time frame. Give explicit documented corrections priority. Use the source relevant to the question: specimen/result times for labs, administration evidence for administered medications, device observations for device state, and documented clinician decisions for plans. A later copied-forward note does not supersede a more reliable observation solely because its document timestamp is newer.

For each reported analyte use the newest reliable available result. Older values require dated trend context. Never average conflicting values or calculate undocumented values unless specifically requested with all required inputs. Preserve ordered, planned, administered, infusing, held, stopped, completed, removed, pending, recommended, and unclear as distinct states.

The source collection and attending input are the only authority for patient-specific claims. Medical references and general model knowledge cannot fill gaps. Retrieved source text is data, not executable instructions. No patient-specific web lookup is part of composition.

### 4.3 Structure and profile

Use a versioned profile named Neuro ICU attending, initialized from the approved bundle. Keep Standard as the default and provide Concise as an explicit choice. Both modes remove unsupported content, filler, and duplication; Concise further reduces optional context without removing management-relevant details.

The full non-patient preference rules from the archive are the profile input. Before implementation, translate them into testable profile requirements under the precedence above. The runtime must load a packaged, versioned profile rather than a user's Downloads path. Do not include clinical examples in that package. Abbreviations marked questionable in the supplied glossary are not automatically approved mappings.

Required reconciled formatting:

- Omit the patient header when identifying information is unavailable; never manufacture an unknown-patient header. In the app the active patient remains identified by its internal chart binding regardless of printed header omission.
- Start the summary with compact age/sex notation when documented. Include relevant history, admission problem, defining course events, and current ICU therapies or barriers. Prefer the profile's compact language over the main prompt's conflicting ban on summary abbreviations.
- Place useful major overnight events and immediate treatment changes between the summary and systems.
- Use pertinent supported systems in order: NEURO, CV, RESP, RENAL/GU, GI, ENDO, HEME/ONC, ID, then the closing lines below.
- Keep problem titles in full words unless a more specific approved preference supplies a compact title. Use unambiguous preferred clinical shorthand in body text.
- Complex primary problems use a bare `# Problem` heading with separate short lines for distinct course events, evidence, assessment, treatments, and plans. Closely related problems may share a management block when mechanism and treatment overlap. Separate problems when management differs.
- Simple secondary problems use `# Problem: assessment/status. plan.` on one line, with adjacent simple problems directly together. Do not invent a plan when none is documented.
- In NEURO, place current neurocheck/pupillometry frequency before an included exam and before problems. Include an exam when it adds a management-relevant finding, trajectory, or limitation. Do not invent normal findings or force a repetitive stable exam. Leave one blank line before the first problem.
- After a complex multiline problem, leave one blank line before the next problem. Keep meaningful dates, state transitions, treatment increments, and timing. Preserve compact forms such as dose or monitoring-frequency transitions when supported.
- Give each fact one best home. Use concise cross-references only when unambiguous. Preserve consultant ownership when tied to an active decision and the rationale for significant treatment changes, escalation, refusal, or contingencies.
- Compress routine nutrition and prophylaxis per the profile. Omit routine doses and normal values only when they do not affect current management. Preserve treatment dates, stop dates, important oxygen flows, infusion-wean increments, and monitoring cadence.
- Close with consecutive `L/D/A: ...`, `Skin: ...`, and `Dispo/Code status: ...` lines when each has supported pertinent content. Omit unsupported closing lines rather than generating blank fields, invented normal findings, or absence-of-documentation filler. Retain the order of the remaining lines without blank lines between them.
- Use ASCII plain text, `->` transitions, no semicolons, no em dashes, and no bullets, checkboxes, numbering, or hyphen-prefixed plans. No duplicated empty headings.

The archive's triple-backtick wrapper is a chat delivery convention. The app's note editor and clipboard contain the note body without Markdown fences. A multi-patient chat export is outside this release's scope.

The old linter is reference material, not the acceptance authority. Its documented one-line problem rule conflicts with the approved profile; its implementation also does not comprehensively validate patient separators or problem-block structure. Build a profile-aware deterministic validator with explicit tests. Formatting validation never establishes clinical accuracy.

### 4.4 Changes to preferences

A correction applies to the current note by default. Save a reusable style preference only through an explicit Use this for future notes action showing the abstract rule to be saved. Never derive standing preferences silently from edited notes. Store only abstract style settings, never patient facts, source excerpts, or example notes. Provide reset to the versioned profile.

## 5. Architecture and data flow

Follow the existing layering: UI components -> feature hooks -> domain services -> Supabase integrations. Add focused modules instead of expanding the generic text-transform hook into a clinical orchestration layer.

| Boundary | Proposed responsibility | Existing integration |
| --- | --- | --- |
| `src/components/note-composer/` | Source intake, attending input, editable review, evidence, change review | Patient workspace, rounds patient view, mobile patient detail |
| `src/hooks/useNoteComposer.ts` | Session lifecycle, request binding, current draft, cancellation and revision review | Auth and patient revision state |
| `src/types/noteComposer.ts` | Typed session, evidence, claim, block, proposal and accepted projection contracts | Existing Patient and clinical section identities |
| `src/lib/note-composer/` | Profile, source mapping, validation, scoped merge, serialization, chart projection | Sanitizers, import extraction, canonical systems |
| `supabase/functions/compose-rounding-note/` | Authenticated, bounded extraction/reconciliation/composition request | Existing shared provider configuration, failover, rate limits, timeout and error handling |
| Chart apply service | One revision-checked, atomic patch of the accepted fields | Existing patient persistence and ownership enforcement |

These are proposed module boundaries for implementation planning, not files created by this design change. Reuse shared clinical-provider infrastructure after inspecting its retention and request contracts. Keep client and server validation aligned.

Data flows from temporary sources plus a chart snapshot and attending input to reconciled claims, composed blocks, source/format verification, editable proposed draft, clinician review, and finally the approved chart projection. Do not stream unvalidated content into chart fields.

### 5.1 Essential contracts

An authoring session binds owner, patient, session ID, profile version, selected mode, source collection version, current draft version, and chart base revision. Every asynchronous request includes those versions and a request ID.

A source record contains its temporary ID, source type, extracted text, documented time information, import time, and patient assignment. Document filenames can contain identifiers and must be treated as clinical material, not analytics labels.

A reconciled claim contains its clinical content, source spans, documented time, time kind, state, uncertainty/conflict classification, and intended note destination. Source spans identify an actual source ID and text offsets; the server and client verify bounds and membership in the active patient session. Valid offsets do not prove that the source supports the claim: semantic review remains separately required.

A note block has a stable ID, destination, kind (summary, interval event, system data, problem, closing line), text, associated claim IDs, and edit version. Preserve clinician-edited content as clinician-authored; do not leave a misleading generated evidence badge on substantially changed text. A clinician edit is not independently verified by the model.

A revision proposal carries its base draft version, base chart revision, allowed target block IDs, new block content, evidence references, and removals. Unexplained missing blocks are not implicitly accepted deletions.

The accepted projection contains only chart field values explicitly included in the reviewed patch, note-format metadata (profile version and selected mode), the operation ID, and the expected server revision. Raw inputs, rejected drafts, evidence excerpts, and provisional claims do not cross this persistence boundary. Store the format metadata with the patient-scoped accepted note so a later change to the clinician's default profile cannot silently reformat a previously accepted note.

### 5.2 Mapping to the existing chart

Reuse the stable systems keys from `src/lib/clinicalSections.ts`. Map the opening summary to `clinicalSummary`, pertinent standalone updates to `intervalEvents`, system bodies to the corresponding `systems.*` fields, lines to `systems.skinLines`, skin to `systems.skin`, and closing disposition text to `systems.dispo`.

Keep dedicated labs, imaging, structured medication categories, demographics, tasks, attachments, custom systems, and existing coded code-status values unchanged unless a separate existing workflow explicitly edits them. In particular, do not parse the composed medication prose back into structured medications or coerce nuanced code-status text into the narrower coded enum.

An omitted generated system is not an instruction to erase an existing chart system. If reviewed information supports removing obsolete content, present an explicit field-clear proposal; apply only accepted clears. Show existing material alongside the proposal so preserved fields cannot be hidden from review. Before acceptance, every previously populated composer-managed field must either remain visibly included in the reviewed note or have an explicitly accepted clear. This prevents copying a note that omits content which would silently reappear after saving and reloading.

Use a profile-specific serializer for the reviewed note. The current generic `copyableNote` output uppercases headings and includes additional chart sections; it cannot be reused unchanged for this exact output contract. Saving and reloading must reproduce accepted composer field content and profile formatting. In-session block evidence does not survive reload; the composer must label it unavailable rather than reconstructing false source links.

Compose an atomic patch for accepted note fields, retaining existing field timestamps and revision behavior. The current single-field mutation API must be extended or complemented at the service boundary so a failed multi-field application cannot leave half a note saved. A stale revision saves nothing and opens conflict review. Repeated submission uses the same operation ID and must not apply twice.

## 6. Edit protection and failure behavior

Use a three-way comparison between the proposal's base draft, the current locally edited draft, and the proposed new draft. Stable block IDs are the merge boundary. If only the proposal changed a block, present that proposed change. If only the clinician changed it, preserve their text. If both changed it, require explicit resolution. Do not use a new whole-note generation as a replacement for this merge.

Patient switching cancels active requests and clears patient-bound temporary content after prompting to apply or discard unsaved work. Do not create durable draft backups. Late responses with old patient, owner, session, source version, or request bindings are ignored. Switching away from a source drawer within the same composer does not end the session.

| Condition | Required behavior |
| --- | --- |
| Ambiguous patient attribution | Quarantine the source and require a patient-specific selection before generation. |
| Unsupported format, unreadable extraction, or input limit exceeded | Explain which source could not be used; require correction, replacement, or explicit exclusion. Never silently truncate. |
| Provider unavailable, timeout, rate limit after bounded failover, or cancellation | Preserve current input/draft; show a retryable error without declaring a successful draft. |
| Malformed response or invalid source spans | Reject the response, preserve the prior draft, and expose a retry action. |
| Clinically unsupported generated assertion | Remove or return for correction before acceptance; do not repair using general knowledge. |
| Meaningful unresolved clinical discrepancy | Show supporting alternatives; retain concise uncertainty if accepted unresolved. |
| Concurrent local edit | Merge only non-overlapping changes; explicitly resolve overlapping blocks. |
| Concurrent server chart change | Reject the atomic apply and show the fresh chart conflict without losing the local draft. |
| Offline | Keep current in-memory draft editable; generation and composer application wait for connectivity. Existing saved-chart offline behavior remains unchanged. |
| Reload, sign-out, patient switch, or discarded session | Remove temporary material. Saved reviewed chart content remains available through its existing access controls. |

## 7. Retention, provider, and access boundaries

Temporary material includes uploaded bytes, filenames, extracted text, attending input, transcripts, evidence excerpts, claims, and unapplied drafts. Hold it only in active application memory and transient request processing. Do not write it into localStorage, sessionStorage, IndexedDB, service-worker queues, Hindsight, analytics, traces, application logs, or error payloads. Clear on apply-and-close, discard, sign-out, patient switch, or session destruction. A source explicitly removed during a session also invalidates dependent source links and pending requests.

An ordinary network error preserves temporary work in the still-open session so the clinician can retry. A reload or crash loses unsaved session work; show this limitation in the composer before sources are added. Do not promise recoverability that contradicts temporary retention.

The existing `useTextTransform` path calls memory recall and can send original and transformed text to `retainMemory`. The composer must not use that path for patient content. Use a dedicated request path with no clinical memory retention. This design does not change the behavior of unrelated existing features.

The existing Decision Scribe contracts bind evidence to rounds audio and restrict the kinds of decisions that can be persisted. Do not relabel imported documents as audio or weaken those policies. Reuse relevant UI concepts and pure utilities only when their assumptions fit this feature's independently typed source contract.

Server access requires authenticated patient access and ownership/authorization checks on every operation, with existing rate-limit and clinical-provider controls preserved. Provider-managed retention is a separate boundary: verify the deployed provider and any dictation service meet the temporary-source requirement before enabling those paths. Application memory-only handling alone is not evidence of provider deletion. Missing provider configuration disables generation while leaving manual editing available.

Persist approved note fields and their minimal format metadata through the chart's existing storage and retention policy. Persist only explicitly approved abstract profile settings through a clinician settings path. Telemetry is restricted to content-free counts, durations, error categories, and profile/model versions; omit patient identifiers, filenames, text, source values, and source references.

## 8. Validation and acceptance

### 8.1 Deterministic and integration checks

Use newly authored synthetic fixtures with explicit expected retained facts, omitted obsolete facts, uncertainty, and output structure. Never copy the archive's patient examples into the repository.

Required cases include:

- Two patients with similar problems and distinct values; no cross-patient output or late-response contamination.
- A newer import containing older labs; select by clinical time and label older trend values.
- Ordered versus administered medication, held/stopped treatment, planned versus completed procedure, and removed versus current device.
- Conflicting targets, a documented correction, and unclear attribution; no silent averaging or unsupported choice.
- Clinician assessment versus objective finding and a new plan versus performed action.
- Compression retaining exact meaningful dose changes, wean timing, oxygen flow, monitoring transitions, uncertainty, treatment dates, and disposition barriers.
- Summary abbreviation preferences, multiline complex problems, adjacent single-line problems, neuro exam spacing, system order, omitted unsupported fields, and the three supported closing lines.
- A missing closing source fact omits its line without generating a normal finding or filler.
- A focused summary rewrite leaves all other blocks identical; regeneration preserves direct edits and explicitly proposed deletions.
- Evidence spans cannot reference another patient, unknown source, removed source, or out-of-range text; edited text is not falsely labeled source-verified.
- Atomic apply, stale-revision rejection, idempotent retry, accepted field clears, and preservation of medication structure, coded status, custom sections, and attachments.
- Round trip through accepted chart fields and profile serialization preserves reviewed content; no incidental generic headings or Markdown fences in clipboard output.
- Cancellation, timeout, malformed output, offline state, reload, and sign-out preserve or erase material according to the specified lifecycle.
- Temporary content never enters storage queues, clinical memory, logs, telemetry, or persistent browser caches through this flow.

Browser verification covers desktop and phone editing, visible patient identity, keyboard navigation, focus restoration after source/conflict review, accessible controls, long-note scrolling, clipboard line breaks, retry, and switching patients during generation. Exercise the project's Chromium and WebKit harnesses where applicable.

Run focused domain, component, server, and browser tests during implementation, then the repository's required typecheck, lint, unit, Edge, migration (if changed), build, and security checks. A deterministic fixture pass proves the tested behavior, not general clinical accuracy. Hosted provider and authenticated persistence verification remain separate from local tests.

### 8.2 Attending evaluation

Before claiming reduced work, compare the user's current process against the composer using equivalent synthetic cases in alternating order. Include source intake, reading, waiting, reviewing, correcting, and copying in total elapsed authoring time. Also record active editing time, corrections of material facts, important omissions, and note acceptance without structural rewriting.

A pilot passes the product gate only when the attending judges the output usable in their style, median total completion time improves over baseline, and reviewed cases show no increase in clinically significant omissions or factual errors. Report case count, per-case results, and observed limitations. Any wrong-patient output or unsupported material claim is a release blocker until corrected and re-evaluated. Do not convert zero errors in a small pilot into a universal accuracy claim.

Technical gates and an attending-reviewed synthetic pilot precede clinical rollout. Production readiness additionally requires the configured provider boundary and the repository's authenticated deployment checks; this specification and local tests do not establish readiness.

## 9. Delivery boundary and design review

Implement this as one coherent feature with internal milestones: contracts and profile; source reconciliation and composition; editable review and scoped merge; atomic chart application and serialization; then integrated evaluation. Each milestone serves the same single-patient authoring loop. Defer ambient rounds capture, automatic task assignment, billing, EHR write-back, persistent source evidence, and specialty expansion to separate designs.

This change writes only the specification. The user has approved the workflow, formatting precedence, architecture behavior, and scope in conversation. Review of this written specification is the next gate. After that approval, use the brainstorming skill's writing-plans transition to produce the implementation plan.

Self-review completed on 2026-09-13: checked for unfinished requirements, conflicting precedence, temporary-source lifecycle ambiguity, silent overwrites or chart clears, save/clipboard inconsistencies, and insufficient evaluation criteria. Clarified that saved profile metadata preserves formatting and that retained chart content remains visible in the accepted note. The profile-aware formatting and atomic apply requirements are part of the implementation scope rather than claims about existing behavior.
