import * as React from "react";
import { Button } from "@/components/ui/button";
import type { FieldConflictChoice } from "@/lib/round/sync/types";
import type { ConflictSide } from "@/lib/decision-scribe/decisionScribeOutbox";

type Props = { mine: string | ConflictSide; theirs: string | ConflictSide; mergeDraft?: string; onResolve: (choice: FieldConflictChoice, merged?: string) => void };
export function ConflictReview({ mine, theirs, mergeDraft = "", onResolve }: Props) {
  const [merge, setMerge] = React.useState(mergeDraft);
  const mineValue = typeof mine === "string" ? mine : mine.value;
  const theirsValue = typeof theirs === "string" ? theirs : theirs.value;
  return <section role="alert" aria-label="Unresolved decision conflict" className="space-y-3 rounded-lg border border-amber-500/60 bg-amber-500/10 p-3">
    <h2 className="font-semibold">This approved change conflicts with another edit</h2>
    <div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>Mine:</strong> {mineValue}</p><p><strong>Theirs:</strong> {theirsValue}</p></div>
    <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => onResolve("mine")}>Keep mine</Button><Button type="button" variant="outline" onClick={() => onResolve("theirs")}>Keep theirs</Button><label className="flex items-center gap-2"><span className="sr-only">Merged value</span><input className="rounded border bg-background px-2 py-1" value={merge} onChange={(event) => setMerge(event.target.value)} aria-label="Merged value" /><Button type="button" variant="secondary" onClick={() => onResolve("merge", merge)}>Use merge</Button></label></div>
    <p className="text-xs text-muted-foreground">Resolve this conflict before End Round.</p>
  </section>;
}
