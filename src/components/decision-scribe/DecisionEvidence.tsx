import * as React from "react";
import { Quote, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DecisionCandidate } from "@/types/decisionScribe";

export interface DecisionEvidenceProps {
  candidate: DecisionCandidate;
  onClose?: () => void;
  touchFriendly?: boolean;
}

/** Shows the bounded spoken span that supports a proposal; identifiers stay private. */
export function DecisionEvidence({ candidate, onClose, touchFriendly = false }: DecisionEvidenceProps) {
  return (
    <aside className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3" data-testid="decision-evidence" aria-label="Spoken evidence">
      <div className="flex items-start gap-2">
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spoken evidence</p>
          <blockquote className="mt-1 text-sm leading-5 text-foreground">{candidate.supportingSpan.text}</blockquote>
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Current-patient Round audio · {candidate.supportingSpan.speaker === "unknown" ? "Speaker not identified" : candidate.supportingSpan.speaker}
          </p>
        </div>
        {onClose && <Button type="button" variant="ghost" size={touchFriendly ? "default" : "sm"} className={touchFriendly ? "min-h-[44px]" : undefined} onClick={onClose} aria-label="Hide spoken evidence">Hide</Button>}
      </div>
    </aside>
  );
}
