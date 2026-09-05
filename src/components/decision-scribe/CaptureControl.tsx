import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CaptureController, type CaptureBinding, type CaptureState } from '@/lib/decision-scribe/captureController';
import { CaptureStatus } from './CaptureStatus';
import { ConsentDisclosure } from './ConsentDisclosure';
import { evaluateRollout, type DecisionScribeRolloutMode, type RolloutGates } from '@/lib/decision-scribe/rolloutPolicy';
import { recordDecisionScribeTelemetry } from '@/lib/decision-scribe/telemetry';

export interface CaptureControlProps { binding: CaptureBinding; controller?: CaptureController; onStopped?: (state: CaptureState, audio?: Blob, mimeType?: string) => void; className?: string; requireConsent?: boolean; rolloutGates?: RolloutGates; requestedMode?: DecisionScribeRolloutMode; securityPosture?: Pick<RolloutGates, 'encryption'|'retention'|'modelVersion'|'expectedModelVersion'|'contextVersion'|'expectedContextVersion'>; }
export function CaptureControl({ binding, controller: supplied, onStopped, className, requireConsent = false, rolloutGates, requestedMode = 'full-review', securityPosture }: CaptureControlProps) {
  const [controller] = useState(() => supplied ?? new CaptureController());
  const [state, setState] = useState<CaptureState>(controller.getState());
  useEffect(() => { const unsubscribe = controller.subscribe(setState); return () => { unsubscribe(); if (!controller.isTerminal() && controller.getState().lifecycle !== 'idle') controller.invalidate('Capture control unmounted'); }; }, [controller]);
  const [startError, setStartError] = useState<string>();
  const [consented, setConsented] = useState(false);
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [recordingDisclosureAcknowledged, setRecordingDisclosureAcknowledged] = useState(false);
  const generationRef = useRef(0);
  const gates = { ...rolloutGates, consent: consented, recordingDisclosure: recordingDisclosureAcknowledged, institutionalPolicy: policyAcknowledged, encryption: securityPosture?.encryption === true, retention: securityPosture?.retention === true, modelVersion: securityPosture?.modelVersion, expectedModelVersion: securityPosture?.expectedModelVersion, contextVersion: securityPosture?.contextVersion, expectedContextVersion: securityPosture?.expectedContextVersion };
  const decision = evaluateRollout(requestedMode, gates);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const start = useCallback(async () => { setStartError(undefined); try {
    if (requireConsent && !decision.allowed) throw new Error(`Capture unavailable: ${decision.reasons.join(', ') || 'rollout is off'}`);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone capture is unavailable in this browser');
    const generation = ++generationRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (generation !== generationRef.current || (requireConsent && (!consented || !recordingDisclosureAcknowledged || !policyAcknowledged))) { stream.getTracks().forEach((track) => track.stop()); throw new Error('Capture consent was revoked before microphone access completed'); }
    streamRef.current = stream; chunksRef.current = [];
    const recorder = new MediaRecorder(stream); recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    await controller.start(binding); if (generation !== generationRef.current) { recorder.stop(); throw new Error('Capture start was cancelled'); } recorder.start(); recordDecisionScribeTelemetry({ event: 'capture_started', mode: decision.mode });
  } catch (error) { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; recorderRef.current = null; setStartError(error instanceof Error ? error.message : 'Unable to start capture'); }
  }, [binding, controller, consented, decision.allowed, decision.mode, decision.reasons, policyAcknowledged, recordingDisclosureAcknowledged, requireConsent]);
  const stop = useCallback(() => { const recorder = recorderRef.current; const stream = streamRef.current; const finish = () => { const audio = chunksRef.current.length ? new Blob(chunksRef.current, { type: recorder?.mimeType || 'audio/webm' }) : undefined; chunksRef.current = []; recorderRef.current = null; streamRef.current = null; stream?.getTracks().forEach((track) => track.stop()); const next = controller.stop(); onStopped?.(next, audio, audio?.type); }; if (recorder && recorder.state !== 'inactive') { recorder.onstop = finish; recorder.stop(); } else finish(); }, [controller, onStopped]);
  useEffect(() => () => { generationRef.current++; recorderRef.current?.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => { if (requireConsent && (!consented || !recordingDisclosureAcknowledged || !policyAcknowledged) && !controller.isTerminal() && controller.getState().lifecycle !== 'idle') { generationRef.current++; recorderRef.current?.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); recorderRef.current = null; streamRef.current = null; chunksRef.current = []; controller.discard('Consent revoked; capture erased'); recordDecisionScribeTelemetry({ event: 'capture_discarded', reason: 'user-action' }); } }, [consented, controller, policyAcknowledged, recordingDisclosureAcknowledged, requireConsent]);
  const terminal = controller.isTerminal();
  return <section aria-label="Decision Scribe capture controls" className={className}>
    {requireConsent && <ConsentDisclosure consented={consented} policyAcknowledged={policyAcknowledged} recordingDisclosureAcknowledged={recordingDisclosureAcknowledged} onConsentChange={setConsented} onPolicyAcknowledgedChange={setPolicyAcknowledged} onRecordingDisclosureAcknowledgedChange={setRecordingDisclosureAcknowledged} onDisable={() => { generationRef.current++; setConsented(false); setRecordingDisclosureAcknowledged(false); setPolicyAcknowledged(false); }} mode={decision.mode} />}
    {requireConsent && decision.reasons.length > 0 && <p role="status" className="text-xs text-muted-foreground">Capture gate: {decision.reasons.join(', ')}. Capture remains unavailable until verified.</p>}
    <CaptureStatus state={state} />
    {startError && <p role="alert" className="text-xs text-destructive">{startError}</p>}
    <div className="flex gap-2" role="group" aria-label="Capture actions">
      {state.lifecycle === 'idle' && <Button type="button" onClick={() => void start()}>Start capture</Button>}
      {(state.lifecycle === 'capturing' || state.lifecycle === 'paused') && <Button type="button" onClick={stop}>Stop and review</Button>}
      {state.lifecycle === 'capturing' && <Button type="button" variant="outline" onClick={() => controller.pause()}>Pause</Button>}
      {state.lifecycle === 'paused' && <Button type="button" variant="outline" onClick={() => controller.resume()}>Resume</Button>}
      {!terminal && state.lifecycle !== 'idle' && <Button type="button" variant="ghost" onClick={() => { recorderRef.current?.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); recorderRef.current = null; streamRef.current = null; chunksRef.current = []; controller.discard(); }}>Discard</Button>}
    </div>
  </section>;
}
