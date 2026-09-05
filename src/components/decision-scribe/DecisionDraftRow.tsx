import * as React from "react";
import { AlertTriangle, Check, Edit3, Eye, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DecisionCandidate, ReviewDisposition } from "@/types/decisionScribe";
import { DecisionEvidence } from "./DecisionEvidence";

export interface DecisionDraftRowProps {
  candidate: DecisionCandidate;
  touchFriendly?: boolean;
  onEdit?: (content: string) => void;
  onReject?: () => void;
  onUndo?: () => void;
  onEvidence?: () => void;
  rowLabel?: string;
}

const destinationLabels: Record<DecisionCandidate["destination"], string> = { clinicalSummary: "Clinical summary", intervalEvents: "Interval events", imaging: "Imaging", labs: "Labs", medications: "Medications", systems: "Systems", todo: "Todo" };
const dispositionLabel: Record<ReviewDisposition, string> = { pending: "Provisional", approved: "Approved", rejected: "Rejected" };

export function DecisionDraftRow({ candidate, touchFriendly = false, onEdit, onReject, onUndo, onEvidence, rowLabel }: DecisionDraftRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [content, setContent] = React.useState(candidate.proposedContent);
  const [evidenceOpen, setEvidenceOpen] = React.useState(false);
  const evidenceButtonRef = React.useRef<HTMLButtonElement>(null);
  const exceptional = candidate.polarity !== "affirmed" || Boolean(candidate.contradiction || candidate.conditionality) || candidate.confidence < 0.75 || candidate.statementType === "question";
  const rejected = candidate.disposition === "rejected";
  const saveEdit = () => { const next = content.trim(); if (!next) return; onEdit?.(next); setEditing(false); };
  return (
    <article className={cn("rounded-lg border p-3", exceptional ? "border-amber-500/60 bg-amber-500/5" : "border-border/60 bg-card", rejected && "opacity-70")} data-testid="decision-draft-row" data-disposition={candidate.disposition} aria-label={rowLabel}>
      <div className="flex items-start gap-2">
        {exceptional && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-label="Needs clinician review" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant={exceptional ? "outline" : "secondary"}>{exceptional ? "Review exception" : dispositionLabel[candidate.disposition]}</Badge>
            <span className="font-medium text-foreground">{destinationLabels[candidate.destination]}</span>
            {candidate.changeType && <span className="text-muted-foreground">· {candidate.changeType}</span>}
            <span className="text-muted-foreground">· {Math.round(candidate.confidence * 100)}% confidence</span>
          </div>
          {editing ? <div className="mt-2 space-y-2"><Textarea value={content} onChange={(event) => setContent(event.target.value)} aria-label="Edit proposed decision" autoFocus /><div className="flex gap-2"><Button type="button" size="sm" onClick={saveEdit}><Check aria-hidden="true" /> Save edit</Button><Button type="button" size="sm" variant="ghost" onClick={() => { setContent(candidate.proposedContent); setEditing(false); }}>Cancel</Button></div></div> : <p className="mt-2 text-sm leading-5 text-foreground">{content}</p>}
          {candidate.contradiction && <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200" role="alert">Contradiction: {candidate.contradiction.startsWith("Conflicts") ? "another proposal conflicts with this one" : "supporting statements differ"}</p>}
          {candidate.conditionality && <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Conditional: {candidate.conditionality}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Decision review actions">
        {!rejected && <Button type="button" variant="outline" size={touchFriendly ? "default" : "sm"} className={touchFriendly ? "min-h-[44px]" : undefined} onClick={() => { setEditing(true); }}><Edit3 aria-hidden="true" /> Edit</Button>}
        {!rejected && <Button type="button" variant="ghost" size={touchFriendly ? "default" : "sm"} className={touchFriendly ? "min-h-[44px]" : undefined} onClick={() => { onReject?.(); }}><X aria-hidden="true" /> Reject</Button>}
        {rejected && <Button type="button" variant="outline" size={touchFriendly ? "default" : "sm"} className={touchFriendly ? "min-h-[44px]" : undefined} onClick={onUndo}><RotateCcw aria-hidden="true" /> Undo reject</Button>}
        <Button ref={evidenceButtonRef} type="button" variant="ghost" size={touchFriendly ? "default" : "sm"} className={touchFriendly ? "min-h-[44px]" : undefined} onClick={() => { setEvidenceOpen((value) => !value); onEvidence?.(); }} aria-expanded={evidenceOpen} aria-controls={`decision-evidence-${candidate.id}`}><Eye aria-hidden="true" /> Evidence</Button>
      </div>
      {evidenceOpen && <div id={`decision-evidence-${candidate.id}`}><DecisionEvidence candidate={candidate} touchFriendly={touchFriendly} onClose={() => { setEvidenceOpen(false); window.requestAnimationFrame(() => evidenceButtonRef.current?.focus()); }} /></div>}
    </article>
  );
}
