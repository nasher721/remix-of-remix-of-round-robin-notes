import React from 'react';
import type { CaptureState } from '@/lib/decision-scribe/captureController';

const labels: Record<CaptureState['lifecycle'], string> = { idle: 'Ready', starting: 'Starting capture', capturing: 'Capturing rounds audio', paused: 'Capture paused', processing: 'Preparing review', review: 'Review ready', attested: 'Capture attested', discarded: 'Capture discarded', expired: 'Capture expired', invalidated: 'Capture stopped safely', failed: 'Capture failed' };
export function CaptureStatus({ state }: { state: CaptureState }) {
  return <div role="status" aria-live="polite" aria-label={`Decision Scribe status: ${labels[state.lifecycle]}`} className="text-xs text-muted-foreground">{labels[state.lifecycle]}{state.reason ? ` — ${state.reason}` : ''}</div>;
}
