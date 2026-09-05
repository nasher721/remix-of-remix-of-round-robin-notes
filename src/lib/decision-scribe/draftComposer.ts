import { asDecisionDraftId, type CaptureBinding, type DecisionCandidate, type DecisionDraft } from "../../types/decisionScribe.ts";
export interface ComposedDraft extends DecisionDraft { groups: Array<{ key: string; candidates: DecisionCandidate[]; exception: boolean }>; summary: { planUpdates: number; tasks: number; unresolvedQuestions: number; exceptions: number }; }
const valid = (c: DecisionCandidate, b: CaptureBinding, now: Date) => c.binding.patientId === b.patientId && c.binding.sessionId === b.sessionId && c.binding.roundId === b.roundId && c.source === "rounds-audio" && c.provenance === "spoken-span" && c.material === "provisional-structured" && c.disposition !== "rejected" && !!c.proposedContent.trim() && c.supportingSpan.patientId === b.patientId && c.supportingSpan.sessionId === b.sessionId && c.supportingSpan.endMs > c.supportingSpan.startMs && Date.parse(c.binding.expiresAt) > now.getTime();
export function composeDecisionDraft(candidates: DecisionCandidate[], binding: CaptureBinding, now = new Date()): ComposedDraft {
  const unique = new Map<string, DecisionCandidate>();
  for (const candidate of candidates) {
    if (!valid(candidate, binding, now)) continue;
    // Multiple transcript spans may repeat one spoken decision. Keep one
    // review row while retaining its first supporting span as evidence.
    const key = [candidate.destination, candidate.statementType, candidate.polarity, candidate.changeType ?? "", candidate.proposedContent.trim().toLocaleLowerCase()].join("\u001f");
    if (!unique.has(key)) unique.set(key, candidate);
  }
  const safe = [...unique.values()];
  const groupsMap = new Map<string, DecisionCandidate[]>();
  safe.forEach((c) => { const key = `${c.destination}:${c.statementType}`; groupsMap.set(key, [...(groupsMap.get(key) ?? []), c]); });
  const groups = [...groupsMap.entries()].map(([key, items]) => ({ key, candidates: items, exception: items.some((c) => c.polarity === "uncertain" || !!c.contradiction) }));
  groups.sort((a, b) => Number(b.exception) - Number(a.exception) || a.key.localeCompare(b.key));
  const ordered = groups.flatMap((g) => g.candidates);
  return { id: asDecisionDraftId(`dd-${binding.sessionId}-${binding.patientId}-${ordered.map((c) => c.id).sort().join(",")}`), binding, candidates: ordered, createdAt: now.toISOString(), expiresAt: binding.expiresAt, provenance: "provisional", status: "review", groups, summary: { planUpdates: ordered.filter((c) => c.statementType === "decision").length, tasks: ordered.filter((c) => c.statementType === "task").length, unresolvedQuestions: ordered.filter((c) => c.statementType === "question").length, exceptions: groups.filter((g) => g.exception).length } };
}
