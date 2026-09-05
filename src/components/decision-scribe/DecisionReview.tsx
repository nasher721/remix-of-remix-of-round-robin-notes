import * as React from "react";
import { AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DecisionCandidate } from "@/types/decisionScribe";
import type { ComposedDraft } from "@/lib/decision-scribe/draftComposer";
import { DecisionDraftRow } from "./DecisionDraftRow";
import { AttestationControl } from "./AttestationControl";

export interface DecisionReviewProps {
  draft: ComposedDraft;
  patientId?: string;
  touchFriendly?: boolean;
  onChange?: (candidates: DecisionCandidate[]) => void;
  onClose?: () => void;
  onAttest?: (candidates: DecisionCandidate[]) => void;
}

export function DecisionReview({ draft, patientId, touchFriendly = false, onChange, onClose, onAttest }: DecisionReviewProps) {
  const [candidates, setCandidates] = React.useState(draft.candidates);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    return () => { previousFocusRef.current?.focus(); };
  }, []);
  React.useEffect(() => setCandidates(draft.candidates), [draft]);
  const patientLocked = Boolean(patientId?.trim()) && draft.binding.patientId === patientId;
  const expired = Date.parse(draft.expiresAt) <= Date.now();
  const candidateSafe = (candidate: DecisionCandidate) => {
    const binding = candidate.binding;
    const sameBinding = binding.patientId === draft.binding.patientId && binding.sessionId === draft.binding.sessionId && binding.roundId === draft.binding.roundId && binding.physicianId === draft.binding.physicianId && binding.deviceId === draft.binding.deviceId && binding.patientSnapshotId === draft.binding.patientSnapshotId && binding.source === "rounds-audio";
    const timestamps = [binding.startedAt, binding.expiresAt, candidate.supportingSpan.startMs, candidate.supportingSpan.endMs].every((value) => typeof value === "number" ? Number.isFinite(value) : Number.isFinite(Date.parse(value)));
    return sameBinding && candidate.source === "rounds-audio" && candidate.provenance === "spoken-span" && candidate.material === "provisional-structured" && candidate.supportingSpan.patientId === draft.binding.patientId && candidate.supportingSpan.sessionId === draft.binding.sessionId && candidate.supportingSpan.endMs > candidate.supportingSpan.startMs && timestamps && Date.parse(binding.expiresAt) > Date.now() && candidate.confidence >= 0 && candidate.confidence <= 1 && Boolean(candidate.proposedContent.trim());
  };
  const draftValid = draft.status === "review" && Boolean(draft.binding.patientId?.trim()) && Boolean(draft.candidates.length) && Number.isFinite(Date.parse(draft.expiresAt)) && Date.parse(draft.expiresAt) > Date.now() && candidates.every(candidateSafe);
  const update = (id: DecisionCandidate["id"], change: Partial<DecisionCandidate>) => { const next = candidates.map((candidate) => candidate.id === id ? { ...candidate, ...change } : candidate); setCandidates(next); onChange?.(next); };
  const approved = candidates.filter((candidate) => candidate.disposition !== "rejected");
  const groups = draft.groups.map((group) => ({ ...group, candidates: group.candidates.map((candidate) => candidates.find((item) => item.id === candidate.id) ?? candidate) }));
  const approvalBlocked = !patientLocked || expired || !draftValid || approved.length === 0;
  const lockLabel = expired || !draftValid ? "Review invalid or expired" : !patientId?.trim() ? "Patient missing" : !patientLocked ? "Patient mismatch" : "Patient locked";
  return (
    <section className={cn("flex min-h-0 flex-col rounded-xl border border-border/70 bg-background shadow-sm", touchFriendly ? "max-h-[min(70dvh,42rem)] overflow-hidden p-3" : "p-4")} data-testid="decision-review" aria-label="Decision Scribe review">
      <div className="flex items-start gap-3 border-b border-border/50 pb-3">
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision Scribe · Stop and review</p><h2 ref={headingRef} tabIndex={-1} className="mt-1 text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">{draft.summary.exceptions ? "Exceptions first" : "Review proposed changes"}</h2><p className="mt-1 text-xs text-muted-foreground">{draft.summary.planUpdates} plan updates · {draft.summary.tasks} tasks · {draft.summary.unresolvedQuestions} questions · {draft.summary.exceptions} exceptions</p></div>
        <div className={cn("flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold", patientLocked && !expired ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "border-destructive/50 bg-destructive/10 text-destructive")}><Lock className="h-3.5 w-3.5" aria-hidden="true" /> {lockLabel}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
        <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200">Provisional · nothing saved</span>
        {expired && <span className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">Review expired</span>}
      </div>
      {!patientLocked && <div className="mt-3 flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert"><ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />This review belongs to another patient. Approval is blocked.</div>}
      {expired && <div className="mt-3 flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100" role="alert"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />This provisional review has expired. No changes can be approved.</div>}
      {!expired && !draftValid && <div className="mt-3 flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert"><ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />One or more proposals failed safety validation. Approval is blocked.</div>}
      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto" data-testid="decision-review-groups">
        {groups.map((group) => <section key={group.key} aria-label={`${group.exception ? "Exception · " : ""}${group.key}`}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.exception ? "Exception · " : ""}{group.key.split(":")[0]}</h3><div className="space-y-2">{group.candidates.map((candidate) => <DecisionDraftRow key={candidate.id} candidate={candidate} rowLabel={`Decision proposal: ${candidate.proposedContent}`} touchFriendly={touchFriendly} onEdit={(content) => update(candidate.id, { proposedContent: content })} onReject={() => update(candidate.id, { disposition: "rejected" })} onUndo={() => update(candidate.id, { disposition: "pending" })} />)}</div></section>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3"><Button type="button" variant="ghost" onClick={onClose}>Close review</Button><AttestationControl disabled={approvalBlocked || !onAttest} onAttest={() => onAttest?.(approved.map((candidate) => ({ ...candidate, disposition: "approved" })))} /></div>
    </section>
  );
}
