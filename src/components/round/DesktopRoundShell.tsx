import * as React from "react"
import { RoundChrome } from "./RoundChrome"
import { RosterOverlay } from "./RosterOverlay"
import { PatientFocus } from "./PatientFocus"
import { RoundHome } from "./RoundHome"
import { RoundEnd } from "./RoundEnd"
import { ToolsSheet } from "./ToolsSheet"
import { useDashboard } from "@/contexts/DashboardContext"
import { useRoundSession } from "@/contexts/RoundSessionContext"
import type { Patient } from "@/types/patient"
import type { RoundShellSurface } from "./roundShellSurface"

export type { RoundShellSurface }

export interface DesktopRoundShellProps {
  /**
   * Limited secondary escape to classic DesktopDashboard.
   * Prefer ToolsSheet panels; this is clearly labeled legacy.
   */
  onOpenWorkbench?: () => void
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return Boolean(target.closest("[contenteditable='true']"))
}

/**
 * Desktop Focus-first Round shell: chrome + lifecycle surfaces + Tools sheet.
 * Patient Focus stays mounted while the roster opens so drafts remain in memory.
 */
export const DesktopRoundShell = ({ onOpenWorkbench }: DesktopRoundShellProps) => {
  const { patients, setDesktopSelectedPatientId } = useDashboard()
  const {
    currentPatientId,
    nextPatient,
    prevPatient,
    markDoneAndNext,
  } = useRoundSession()

  const [rosterOpen, setRosterOpen] = React.useState(false)
  const [toolsOpen, setToolsOpen] = React.useState(false)
  const [surface, setSurface] = React.useState<RoundShellSurface>(() =>
    patients.length === 0 ? "home" : "focus",
  )

  const patient = React.useMemo((): Patient | null => {
    if (!currentPatientId) return null
    return patients.find((entry) => entry.id === currentPatientId) ?? null
  }, [patients, currentPatientId])

  React.useEffect(() => {
    if (patients.length === 0) {
      setSurface("home")
    }
  }, [patients.length])

  React.useEffect(() => {
    if (!currentPatientId) return
    setDesktopSelectedPatientId(currentPatientId)
  }, [currentPatientId, setDesktopSelectedPatientId])

  const handleOpenRoster = React.useCallback(() => {
    setRosterOpen(true)
  }, [])

  const handleOpenTools = React.useCallback(() => {
    setToolsOpen(true)
  }, [])

  const handleGoHome = React.useCallback(() => {
    setSurface("home")
  }, [])

  const handleStartRound = React.useCallback(() => {
    setSurface("focus")
  }, [])

  const handleEndRound = React.useCallback(() => {
    setSurface("end")
  }, [])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      const key = event.key
      const lower = key.length === 1 ? key.toLowerCase() : key

      if (key === "/" && !rosterOpen) {
        event.preventDefault()
        setRosterOpen(true)
        return
      }

      if (lower === "r" && !rosterOpen) {
        event.preventDefault()
        setRosterOpen(true)
        return
      }

      if (rosterOpen || surface !== "focus") return

      if (lower === "j" || key === "]") {
        event.preventDefault()
        nextPatient()
        return
      }
      if (lower === "k" || key === "[") {
        event.preventDefault()
        prevPatient()
        return
      }
      if (lower === "d") {
        event.preventDefault()
        markDoneAndNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [rosterOpen, surface, nextPatient, prevPatient, markDoneAndNext])

  return (
    <div
      className="flex h-[100dvh] min-h-screen flex-col bg-background"
      data-testid="desktop-round-shell"
      data-round-surface={surface}
    >
      <RoundChrome
        onOpenRoster={handleOpenRoster}
        onOpenTools={handleOpenTools}
        onGoHome={handleGoHome}
        onEndRound={handleEndRound}
        showLifecycleActions={surface === "focus"}
      />
      <main className="min-h-0 flex-1">
        {surface === "home" && (
          <RoundHome onStartRound={handleStartRound} onEndRound={handleEndRound} />
        )}
        {surface === "focus" && (
          <PatientFocus patient={patient} onGoHome={handleGoHome} />
        )}
        {surface === "end" && (
          <RoundEnd
            onBackToFocus={handleStartRound}
            onBackToHome={handleGoHome}
          />
        )}
      </main>
      <RosterOverlay
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        onEndRound={handleEndRound}
        onGoHome={handleGoHome}
      />
      <ToolsSheet
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        onOpenClassicWorkbench={onOpenWorkbench}
      />
    </div>
  )
}
