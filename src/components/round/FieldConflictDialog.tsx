import * as React from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { FieldConflict, FieldConflictChoice } from "@/lib/round/sync"
import { computeWordDiff, type DiffSegment } from "@/lib/round/wordDiff"

export interface FieldConflictDialogProps {
  conflict: FieldConflict | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolve: (choice: FieldConflictChoice, mergedValue?: string) => void
  className?: string
  touchFriendly?: boolean
}

const formatTimeCue = (isoString?: string): string => {
  if (!isoString) return ""
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/**
 * Explicit This Device (Mine) / Other Device (Theirs) / manual merge for same-field divergence.
 * Displays inline word diffing to highlight exact changes without silent drops.
 */
export const FieldConflictDialog = ({
  conflict,
  open,
  onOpenChange,
  onResolve,
  className,
  touchFriendly = false,
}: FieldConflictDialogProps) => {
  const [mergeText, setMergeText] = React.useState("")
  const [showMergeEditor, setShowMergeEditor] = React.useState(false)

  React.useEffect(() => {
    if (!conflict) return
    setMergeText(`${conflict.mine.value}\n\n${conflict.theirs.value}`.trim())
    setShowMergeEditor(false)
  }, [conflict])

  const wordDiff = React.useMemo(() => {
    if (!conflict) return []
    return computeWordDiff(conflict.theirs.value, conflict.mine.value)
  }, [conflict])

  if (!conflict) return null

  const handleMine = () => {
    onResolve("mine")
  }

  const handleTheirs = () => {
    onResolve("theirs")
  }

  const handleStartMerge = () => {
    setShowMergeEditor(true)
  }

  const handleConfirmMerge = () => {
    onResolve("merge", mergeText)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleMergeChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMergeText(event.target.value)
  }

  const mineTime = formatTimeCue(conflict.mine.updatedAt)
  const theirsTime = formatTimeCue(conflict.theirs.updatedAt)

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className={cn("max-w-xl", className)}
        data-testid="field-conflict-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Field conflict detected</AlertDialogTitle>
          <AlertDialogDescription>
            This field changed on two devices concurrently. Review the highlighted differences and choose which note to keep, or edit a manual merge.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono text-muted-foreground" data-testid="field-conflict-key">
              {conflict.fieldKey}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                This device additions
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
                Other device differences
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/50 bg-muted/30 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  This Device <span className="font-normal text-muted-foreground">(Mine)</span>
                </p>
                {mineTime && (
                  <span className="text-[11px] text-muted-foreground">{mineTime}</span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-foreground/90 text-xs sm:text-sm leading-relaxed" data-testid="field-conflict-mine">
                {wordDiff.length > 0 ? (
                  wordDiff.map((seg, i) => {
                    if (seg.type === "added") {
                      return (
                        <mark
                          key={i}
                          className="bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 rounded-xs px-0.5"
                        >
                          {seg.value}
                        </mark>
                      )
                    }
                    if (seg.type === "same") {
                      return <span key={i}>{seg.value}</span>
                    }
                    return null
                  })
                ) : (
                  conflict.mine.value || "(empty)"
                )}
              </p>
            </div>

            <div className="rounded-md border border-border/50 bg-muted/30 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  Other Device <span className="font-normal text-muted-foreground">(Theirs)</span>
                </p>
                {theirsTime && (
                  <span className="text-[11px] text-muted-foreground">{theirsTime}</span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-foreground/90 text-xs sm:text-sm leading-relaxed" data-testid="field-conflict-theirs">
                {wordDiff.length > 0 ? (
                  wordDiff.map((seg, i) => {
                    if (seg.type === "removed") {
                      return (
                        <mark
                          key={i}
                          className="bg-red-500/20 text-red-950 dark:text-red-200 line-through rounded-xs px-0.5"
                        >
                          {seg.value}
                        </mark>
                      )
                    }
                    if (seg.type === "same") {
                      return <span key={i}>{seg.value}</span>
                    }
                    return null
                  })
                ) : (
                  conflict.theirs.value || "(empty)"
                )}
              </p>
            </div>
          </div>

          {showMergeEditor && (
            <div className="space-y-2">
              <label htmlFor="field-conflict-merge" className="text-xs font-medium text-foreground">
                Edit merged text
              </label>
              <Textarea
                id="field-conflict-merge"
                value={mergeText}
                onChange={handleMergeChange}
                className="min-h-28 text-sm"
                data-testid="field-conflict-merge"
                aria-label="Merged field value"
              />
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel className={cn("mt-0", touchFriendly && "min-h-[44px]")}>
            Keep unresolved
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            className={cn(touchFriendly && "min-h-[44px]")}
            onClick={handleMine}
            data-testid="field-conflict-choose-mine"
          >
            Keep This Device (Mine)
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(touchFriendly && "min-h-[44px]")}
            onClick={handleTheirs}
            data-testid="field-conflict-choose-theirs"
          >
            Keep Other Device (Theirs)
          </Button>
          {showMergeEditor ? (
            <Button
              type="button"
              className={cn(touchFriendly && "min-h-[44px]")}
              onClick={handleConfirmMerge}
              data-testid="field-conflict-confirm-merge"
            >
              Save merge
            </Button>
          ) : (
            <Button
              type="button"
              className={cn(touchFriendly && "min-h-[44px]")}
              onClick={handleStartMerge}
              data-testid="field-conflict-start-merge"
            >
              Edit merge
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
