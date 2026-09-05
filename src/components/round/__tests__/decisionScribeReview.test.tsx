import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DecisionReview } from "@/components/decision-scribe/DecisionReview";
import { asDecisionCandidateId, asCaptureSessionId, asTranscriptSegmentId, asDecisionDraftId, type DecisionCandidate } from "@/types/decisionScribe";
import type { ComposedDraft } from "@/lib/decision-scribe/draftComposer";

afterEach(() => cleanup());

const candidate = (overrides: Partial<DecisionCandidate> = {}): DecisionCandidate => ({
  id: asDecisionCandidateId("candidate-1"),
  binding: { sessionId: asCaptureSessionId("session"), roundId: "round", patientId: "patient-1", physicianId: "physician", deviceId: "device", startedAt: "2026-09-04T10:00:00Z", expiresAt: "2099-09-04T10:00:00Z", source: "rounds-audio", patientSnapshotId: "snapshot", patientSnapshotCapturedAt: "2026-09-04T10:00:00Z" },
  speaker: "physician", statementType: "decision", polarity: "proposed", changeType: "start", destination: "medications", proposedContent: "Start the medication", confidence: 0.6,
  supportingSpan: { segmentId: asTranscriptSegmentId("segment"), startMs: 1, endMs: 20, text: "We should start the medication", speaker: "physician", sessionId: asCaptureSessionId("session"), patientId: "patient-1" },
  disposition: "pending", source: "rounds-audio", provenance: "spoken-span", material: "provisional-structured", ...overrides,
});

const draft: ComposedDraft = { id: asDecisionDraftId("draft"), binding: candidate().binding, candidates: [candidate()], createdAt: "2026-09-04T10:00:00Z", expiresAt: "2099-09-04T10:00:00Z", provenance: "provisional", status: "review", groups: [{ key: "medications:medication", candidates: [candidate()], exception: true }], summary: { planUpdates: 1, tasks: 0, unresolvedQuestions: 0, exceptions: 1 } };
const variant = (changes: Partial<ComposedDraft> = {}, item = candidate()): ComposedDraft => ({ ...draft, ...changes, candidates: [item], groups: [{ ...draft.groups[0], candidates: [item] }] });

describe("Decision Scribe review in Today's Round", () => {
  it("puts exceptions first and keeps approval explicitly blocked from the wrong patient", () => {
    render(<DecisionReview draft={draft} patientId="patient-2" />);
    assert.ok(screen.getByText("Exceptions first"));
    assert.ok(screen.getByText("This review belongs to another patient. Approval is blocked."));
    assert.equal(screen.getByRole("button", { name: /attest and apply approved changes/i }).hasAttribute("disabled"), true);
  });

  it("supports edit, reject, undo, and bounded evidence disclosure", () => {
    render(<DecisionReview draft={draft} patientId="patient-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit proposed decision" }), { target: { value: "Start a reduced dose" } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
    assert.ok(screen.getByText("Start a reduced dose"));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
    assert.ok(screen.getByText("We should start the medication"));
    assert.equal(screen.queryByText(/session|candidate|segment/i), null);
  });

  it("fails closed for missing or expired patients and explicit approval marks disposition", () => {
    const onAttest = (items: DecisionCandidate[]) => assert.equal(items[0].disposition, "approved");
    const { rerender } = render(<DecisionReview draft={draft} patientId="" />);
    assert.ok(screen.getByText("Patient missing"));
    rerender(<DecisionReview draft={variant({ expiresAt: "2000-01-01T00:00:00Z" })} patientId="patient-1" />);
    assert.ok(screen.getAllByText("Review expired").length >= 1);
    rerender(<DecisionReview draft={variant({}, candidate({ disposition: "rejected" }))} patientId="patient-1" onAttest={onAttest} />);
    assert.equal(screen.getByRole("button", { name: /attest and apply approved changes/i }).hasAttribute("disabled"), true);
    rerender(<DecisionReview draft={draft} patientId="patient-1" onAttest={onAttest} />);
    fireEvent.click(screen.getByRole("button", { name: /attest and apply approved changes/i }));
  });
});
