import * as React from "react";
import { CaptureControl } from "@/components/decision-scribe/CaptureControl";
import { DecisionReview } from "@/components/decision-scribe/DecisionReview";
import { CaptureController } from "@/lib/decision-scribe/captureController";
import { attest } from "@/lib/decision-scribe/attestationController";
import { extractDecisionCandidates } from "@/lib/decision-scribe/decisionEngine";
import { composeDecisionDraft, type ComposedDraft } from "@/lib/decision-scribe/draftComposer";
import { asCaptureSessionId, type CaptureBinding, type DecisionCandidate } from "@/types/decisionScribe";

const binding: CaptureBinding = { sessionId: asCaptureSessionId("harness-session"), roundId: "harness-round", patientId: "SYNTH-A", physicianId: "harness-physician", deviceId: "harness-device", patientSnapshotId: "harness-snapshot", patientSnapshotCapturedAt: new Date(Date.now() - 1000).toISOString(), startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString(), source: "rounds-audio" };

export default function DecisionScribeHarness() {
  const controller = React.useMemo(() => new CaptureController({ timeoutMs: 120000 }), []);
  const [draft, setDraft] = React.useState<ComposedDraft>();
  const [message, setMessage] = React.useState("Ready");
  React.useEffect(() => {
    const media = navigator.mediaDevices ?? ({} as MediaDevices);
    const originalGetUserMedia = media.getUserMedia;
    media.getUserMedia = async () => ({ getTracks: () => [{ stop: () => undefined }] } as unknown as MediaStream);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: media });
    class HarnessRecorder { state = "inactive"; mimeType = "audio/webm"; ondataavailable?: (event: { data: Blob }) => void; onstop?: () => void; start() { this.state = "recording"; this.ondataavailable?.({ data: new Blob(["synthetic-audio"], { type: this.mimeType }) }); } stop() { this.state = "inactive"; this.onstop?.(); } }
    const originalRecorder = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = HarnessRecorder;
    return () => { media.getUserMedia = originalGetUserMedia; (globalThis as { MediaRecorder?: unknown }).MediaRecorder = originalRecorder; };
  }, []);
  const onStopped = React.useCallback((state: { lifecycle: string }) => {
    if (state.lifecycle !== "review") return;
    const segments = [{ id: "harness-segment" as never, binding, speaker: "physician" as const, text: "We will continue the medication and call radiology within ten minutes.", startMs: 0, endMs: 1500, expiresAt: binding.expiresAt }];
    const result = extractDecisionCandidates(segments, { patientId: binding.patientId, snapshotId: binding.patientSnapshotId, systems: {} }, binding);
    setDraft(composeDecisionDraft(result.candidates, binding)); setMessage("Review ready; nothing saved");
  }, []);
  const onAttest = React.useCallback(async (candidates: DecisionCandidate[]) => {
    if (!draft) return;
    try {
      const result = await attest({ ownerId: binding.physicianId, physicianId: binding.physicianId, draft, binding, patientSnapshotId: binding.patientSnapshotId, approvedCandidateIds: candidates.map((candidate) => candidate.id), approvedCandidates: candidates }, { commit: async () => "committed" });
      controller.attest(); setDraft(undefined); setMessage(`Attested ${result.candidateIds.length} synthetic changes`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attestation refused");
    }
  }, [controller, draft]);
  return <main className="mx-auto max-w-3xl space-y-4 p-6" data-testid="decision-scribe-harness"><h1 className="text-xl font-semibold">Decision Scribe synthetic harness</h1><p role="status">{message}</p><CaptureControl className={draft ? "hidden" : undefined} binding={binding} controller={controller} requireConsent rolloutGates={{ consent: true, recordingDisclosure: true, institutionalPolicy: true, encryption: true, retention: true, modelVersion: "harness", expectedModelVersion: "harness", contextVersion: "harness", expectedContextVersion: "harness" }} securityPosture={{ encryption: true, retention: true, modelVersion: "harness", expectedModelVersion: "harness", contextVersion: "harness", expectedContextVersion: "harness" }} onStopped={onStopped} />{draft && <DecisionReview draft={draft} patientId={binding.patientId} onAttest={onAttest} onClose={() => { setDraft(undefined); setMessage("Review discarded"); }} />}</main>;
}
