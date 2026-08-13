import * as React from "react"
import { ArrowLeft, CheckCircle2, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useDashboard } from "@/contexts/DashboardContext"
import { useDashboardTodos } from "@/contexts/DashboardTodosContext"
import { useRoundSession } from "@/contexts/RoundSessionContext"
import { cn } from "@/lib/utils"

const PrintExportModal = React.lazy(() =>
  import("@/components/PrintExportModal").then((m) => ({ default: m.PrintExportModal })),
)

export interface RoundEndProps {
  onBackToFocus: () => void
  onBackToHome: () => void
  touchFriendly?: boolean
  className?: string
}

/**
 * End-of-Round surface: Print / Export first-class, then mark Round complete.
 */
export const RoundEnd = ({
  onBackToFocus,
  onBackToHome,
  touchFriendly = false,
  className,
}: RoundEndProps) => {
  const { patients, filteredPatients, onUpdatePatient } = useDashboard()
  const todosMap = useDashboardTodos()
  const {
    position,
    round,
    completeRound,
    canCompleteRound,
    pendingCount,
    failedCount,
    conflicts,
  } = useRoundSession()
  const [printOpen, setPrintOpen] = React.useState(false)

  const doneCount = round.patients.filter((ref) => ref.status === "done").length
  const incompleteTodoCount = Object.values(todosMap)
    .flat()
    .filter((todo) => !todo.completed).length
  const isComplete = round.status === "completed"

  const handleOpenPrint = () => {
    setPrintOpen(true)
  }

  const handleMarkComplete = () => {
    completeRound()
    toast.success("Round marked complete", {
      description: "Print or export anytime from this screen.",
    })
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto px-4 py-8 md:px-8",
        className,
      )}
      data-testid="round-end"
    >
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
        <header className="space-y-2 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Printer className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1
            className={cn(
              "font-bold tracking-tight text-foreground",
              touchFriendly ? "text-2xl" : "text-xl",
            )}
          >
            End Round
          </h1>
          <p
            className={cn(
              touchFriendly ? "text-sm text-foreground/75" : "text-sm text-muted-foreground",
            )}
          >
            {patients.length === 0
              ? "No patients to export yet."
              : `${doneCount}/${position.total} marked done · print or export handoff summaries.`}
          </p>
          {isComplete && (
            <p
              className={cn(
                "flex items-center justify-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400",
                touchFriendly ? "text-sm" : "text-xs",
              )}
              data-testid="round-end-completed"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Round marked complete
            </p>
          )}
          {patients.length > 0 && (
            <div className="mt-2 rounded-xl border border-border/40 bg-muted/30 p-3 text-left text-xs text-foreground/85 space-y-1">
              <p className="flex justify-between">
                <span>Patients remaining:</span>
                <span className="font-semibold">{position.total - doneCount}</span>
              </p>
              <p className="flex justify-between">
                <span>Incomplete todos:</span>
                <span className="font-semibold">{incompleteTodoCount}</span>
              </p>
              <p className="flex justify-between border-t border-border/20 pt-1 text-muted-foreground">
                <span>Sync status:</span>
                <span>
                  {canCompleteRound
                    ? "All changes saved"
                    : `${pendingCount} pending · ${failedCount} failed · ${conflicts.length} conflicts`}
                </span>
              </p>
            </div>
          )}
        </header>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size={touchFriendly ? "lg" : "default"}
            className={cn(
              "w-full justify-center gap-2",
              touchFriendly && "min-h-11 text-base",
            )}
            onClick={handleOpenPrint}
            disabled={patients.length === 0}
            aria-label="Print or export patient summaries"
            data-testid="round-end-print"
          >
            <Printer className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
            Print / Export
          </Button>

          {!isComplete && (
            <Button
              type="button"
              variant="outline"
              size={touchFriendly ? "lg" : "default"}
              className={cn(
                "w-full justify-center gap-2",
                touchFriendly && "min-h-11 text-base",
              )}
              disabled={!canCompleteRound || patients.length === 0}
              onClick={handleMarkComplete}
              aria-label="Mark Round complete"
              data-testid="round-end-complete"
            >
              <CheckCircle2 className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
              Mark Round complete
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/30 pt-4 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            className={cn("gap-2", touchFriendly && "min-h-11")}
            onClick={onBackToFocus}
            disabled={patients.length === 0}
            aria-label="Back to patient Focus"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Focus
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(touchFriendly && "min-h-11")}
            onClick={onBackToHome}
            aria-label="Back to Round Home"
          >
            Round Home
          </Button>
        </div>
      </div>

      <React.Suspense fallback={null}>
        <PrintExportModal
          open={printOpen}
          onOpenChange={setPrintOpen}
          patients={filteredPatients.length > 0 ? filteredPatients : patients}
          patientTodos={todosMap}
          onUpdatePatient={onUpdatePatient}
        />
      </React.Suspense>
    </div>
  )
}
