import * as React from "react"
import { FileUp, Play, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { EpicHandoffImport } from "@/components/EpicHandoffImport"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useDashboard } from "@/contexts/DashboardContext"
import { useRoundSession } from "@/contexts/RoundSessionContext"
import { cn } from "@/lib/utils"

export interface RoundHomeProps {
  onStartRound: () => void
  onEndRound: () => void
  touchFriendly?: boolean
  className?: string
}

/**
 * Round lifecycle start surface: Import Patient List first-class,
 * Start/Resume when the list has patients, quiet account basics.
 */
export const RoundHome = ({
  onStartRound,
  onEndRound,
  touchFriendly = false,
  className,
}: RoundHomeProps) => {
  const { patients, onImportPatients, onSignOut, user } = useDashboard()
  const { position, round } = useRoundSession()
  const [importOpen, setImportOpen] = React.useState(false)

  const hasPatients = patients.length > 0
  const isResume = hasPatients && position.current > 0
  const doneCount = round.patients.filter((ref) => ref.status === "done").length

  const handleOpenImport = () => {
    setImportOpen(true)
  }

  const handleImportPatients = async (
    imported: Parameters<typeof onImportPatients>[0],
  ) => {
    await onImportPatients(imported)
    setImportOpen(false)
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-y-auto px-4 py-6 md:px-8",
        className,
      )}
      data-testid="round-home"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="space-y-1">
          <h1
            className={cn(
              "font-semibold tracking-tight text-foreground",
              touchFriendly ? "text-2xl" : "text-xl",
            )}
          >
            Today&apos;s Round
          </h1>
          <p
            className={cn(
              touchFriendly ? "text-sm text-foreground/75" : "text-sm text-muted-foreground",
            )}
          >
            {hasPatients
              ? `${patients.length} patient${patients.length === 1 ? "" : "s"} · ${doneCount} done · position ${position.current}/${position.total}`
              : "Import a list or add patients to start bed-by-bed Focus."}
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size={touchFriendly ? "lg" : "default"}
            className={cn(
              "w-full justify-center gap-2",
              touchFriendly && "min-h-11 text-base",
            )}
            onClick={handleOpenImport}
            aria-label="Import Patient List"
            data-testid="round-home-import"
          >
            <FileUp className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
            Import Patient List
          </Button>

          {hasPatients ? (
            <Button
              type="button"
              variant="default"
              size={touchFriendly ? "lg" : "default"}
              className={cn(
                "w-full justify-center gap-2",
                touchFriendly && "min-h-11 text-base",
              )}
              onClick={onStartRound}
              aria-label={isResume ? "Resume Round" : "Start Round"}
              data-testid="round-home-start"
            >
              <Play className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
              {isResume ? "Resume Round" : "Start Round"}
            </Button>
          ) : (
            <p
              className={cn(
                "text-center",
                touchFriendly ? "text-sm text-foreground/70" : "text-xs text-muted-foreground",
              )}
            >
              No blank anonymous insert — import a list to build today&apos;s Round.
            </p>
          )}

          {hasPatients && (
            <Button
              type="button"
              variant="outline"
              size={touchFriendly ? "lg" : "default"}
              className={cn(
                "w-full justify-center gap-2",
                touchFriendly && "min-h-11 text-base",
              )}
              onClick={onEndRound}
              aria-label="End Round and print or export"
              data-testid="round-home-end"
            >
              <Printer className={cn(touchFriendly ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
              End Round
            </Button>
          )}
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-3 border-t border-border/30 pt-4",
            touchFriendly ? "justify-between" : "justify-between",
          )}
        >
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span
              className={cn(
                "truncate",
                touchFriendly ? "text-sm text-foreground/70" : "text-xs text-muted-foreground",
              )}
            >
              {user?.email ?? "Signed in"}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(touchFriendly && "min-h-11")}
            onClick={onSignOut}
            aria-label="Sign out"
          >
            Sign out
          </Button>
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <EpicHandoffImport
            existingBeds={patients.map((p) => p.bed)}
            onImportPatients={handleImportPatients}
            noDialog
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
