# Attending rounding note composer implementation

The user authorized implementation of the September 13 design. Work follows test-first red/green cycles.

1. Package the complete non-patient preference list from the hash-verified archive. Translate its precedence into shared profile rules and deterministic structure tests. Do not package examples, executables, or host-agent instructions.
2. Implement shared typed source, claim, block, request, reconciliation, validation, scoped three-way merge, and serialization contracts. Test synthetic chronology, state, patient boundaries, deletions, and evidence failures.
3. Add an authenticated, rate-limited, bounded composition endpoint. Restrict failover to explicitly retention-verified providers. Reconcile, compose, and check semantic support separately. No clinical memory, logs, durable drafts, or source persistence.
4. Add revision-checked idempotent atomic chart application and accepted format metadata. Preserve unrelated fields, structured medications, attachments, custom sections, and coded status. Test round trips and stale revisions.
5. Add a temporary patient-bound session hook and accessible composer in desktop, mobile, and rounds. Test intake review, edits, scoped proposals, cancellation, retry, source inspection, exact copy, apply, undo, and lifecycle cleanup.
6. Run focused and repository checks plus desktop/phone browser scenarios. Document deployment prerequisites and a synthetic attending evaluation protocol. Hosted credentials, retention attestation, and attending pilot results are separate release gates.

## Testable profile requirements

The full versioned preference input is packaged with the server profile. Rules are applied subject to source fidelity and management relevance:

- Standard default, explicit Concise choice. Compact documented age/sex summary; no manufactured demographics.
- Optional relevant overnight updates; ordered pertinent systems only; supported consecutive closing lines only.
- Complex primary problems have bare headings and short separate lines. Adjacent simple secondary problems have no blank separation. Neuro monitoring precedes optional relevant exam and a blank line before problems.
- ASCII, `->`, no semicolons, fences, list markers, empty headings, or absence-of-documentation filler.
- Preserve important doses, flows, titration/wean increments, dates, cadence, refusal/rationale, uncertainty, consultant decision ownership, active barriers, and medication/device/procedure states.
- Compress routine feeding, prophylaxis, antibiotics, stable imaging, and repetitive exams only when management-relevant information is retained. Use preferred unambiguous shorthand; questionable glossary entries are not automatic substitutions.
- Clinical time outranks import time. Corrections supersede their explicitly identified claim, not unrelated objective evidence. No invented calculations, plans, administered doses, normal findings, or causal links.

Semantic compression requirements require source-to-draft checking and clinician review; format checks alone do not establish clinical accuracy.
