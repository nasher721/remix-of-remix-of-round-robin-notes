import * as React from "react";
import { Button } from "@/components/ui/button";

export interface ConsentDisclosureProps {
  consented?: boolean;
  policyAcknowledged?: boolean;
  recordingDisclosureAcknowledged?: boolean;
  onConsentChange?: (consented: boolean) => void;
  onPolicyAcknowledgedChange?: (acknowledged: boolean) => void;
  onRecordingDisclosureAcknowledgedChange?: (acknowledged: boolean) => void;
  onDisable?: () => void;
  mode?: string;
  disabled?: boolean;
}

/** Plain-language, reversible gate shown before microphone capture. */
export function ConsentDisclosure({ consented = false, policyAcknowledged = false, recordingDisclosureAcknowledged = false, onConsentChange, onPolicyAcknowledgedChange, onRecordingDisclosureAcknowledgedChange, onDisable, mode = "off", disabled = false }: ConsentDisclosureProps) {
  return <section aria-labelledby="decision-scribe-consent-title" className="space-y-3 rounded-lg border border-border bg-card p-4">
    <div>
      <h2 id="decision-scribe-consent-title" className="font-semibold">Decision Scribe consent</h2>
      <p className="text-sm text-muted-foreground">It listens only while you are on this patient and this Round. Audio and temporary transcript data are discarded after review or when capture stops. Nothing is written to the chart until you explicitly attest.</p>
    </div>
    <label className="flex min-h-11 items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={consented} disabled={disabled} onChange={(e) => onConsentChange?.(e.target.checked)} aria-describedby="decision-scribe-consent-help" />
      <span>I consent to microphone capture for this Round and patient.</span>
    </label>
    <label className="flex min-h-11 items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={recordingDisclosureAcknowledged} disabled={disabled} onChange={(e) => onRecordingDisclosureAcknowledgedChange?.(e.target.checked)} />
      <span>I acknowledge that this recording is limited to rounds audio and is not a general recording.</span>
    </label>
    <label className="flex min-h-11 items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={policyAcknowledged} disabled={disabled} onChange={(e) => onPolicyAcknowledgedChange?.(e.target.checked)} aria-describedby="decision-scribe-consent-help" />
      <span>I acknowledge my institution&apos;s Decision Scribe and recording policy.</span>
    </label>
    <p id="decision-scribe-consent-help" className="text-xs text-muted-foreground">Status: <strong>{mode}</strong>. You can disable consent at any time; disabling prevents new capture.</p>
    {(consented || policyAcknowledged) && <Button type="button" variant="outline" onClick={onDisable} disabled={disabled}>Disable Decision Scribe</Button>}
  </section>;
}
