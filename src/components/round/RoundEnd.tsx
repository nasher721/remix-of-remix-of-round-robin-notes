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
  const { position, round, completeRound } = useRoundSession()
  const [printOpen, setPrintOpen] = React.useState(false)

  const doneCount = round.patients.filter((ref) => ref.status === "done").length
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
        "flex h-full min-h-0 flex-col overflow-y-auto px-4 py-6 md:px-8",
        className,
      )}
      data-testid="round-end"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="space-y-1">
          <h1
            className={cn(
              "font-semibold tracking-tight text-foreground",
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
                "flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400",
                touchFriendly ? "text-sm" : "text-xs",
              )}
              data-testid="round-end-completed"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Round marked complete
            </p>
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
