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
import { exportRoundRecovery } from "@/lib/exportRoundRecovery"

export interface MobileRoundShellProps {
  /**
   * Limited secondary escape to classic MobileDashboard.
   * Prefer ToolsSheet panels; this is clearly labeled legacy.
   */
  onOpenWorkbench?: () => void
}

const resetWindowScroll = () => {
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

/**
 * Mobile Focus-first Round shell: same Round store + lifecycle surfaces as desktop,
 * with scroll-reset on patient open and touch-sized primary actions.
 */
export const MobileRoundShell = ({ onOpenWorkbench }: MobileRoundShellProps) => {
  const { patients, onPatientSelect } = useDashboard()
  const {
    currentPatientId,
    round,
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

  // Keep classic mobile selection in sync so workbench hops resume the same chart.
  React.useEffect(() => {
    if (!patient) {
      onPatientSelect(null)
      return
    }
    onPatientSelect(patient)
  }, [patient, onPatientSelect])

  // Scroll reset when opening / advancing patients (mobile preference).
  React.useEffect(() => {
    resetWindowScroll()
    const timer = window.setTimeout(() => {
      resetWindowScroll()
    }, 50)
    return () => window.clearTimeout(timer)
  }, [currentPatientId, surface])

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

  return (
    <div
      className="flex h-[100dvh] min-h-screen flex-col bg-background text-foreground"
      data-testid="mobile-round-shell"
      data-round-surface={surface}
    >
      {surface === "focus" ? (
        <RoundChrome
          touchFriendly
          onOpenRoster={handleOpenRoster}
          onOpenTools={handleOpenTools}
          onGoHome={handleGoHome}
          onEndRound={handleEndRound}
          showLifecycleActions
          onPrev={prevPatient}
          onNext={nextPatient}
          onDoneAndNext={markDoneAndNext}
          onExportRecovery={() => exportRoundRecovery(round, patients)}
        >
          <PatientFocus
            key={patient?.id ?? "empty"}
            patient={patient}
            touchFriendly
            onGoHome={handleGoHome}
          />
        </RoundChrome>
      ) : (
        <>
          <RoundChrome
            touchFriendly
            onOpenRoster={handleOpenRoster}
            onOpenTools={handleOpenTools}
            onGoHome={handleGoHome}
            onEndRound={handleEndRound}
            showLifecycleActions={false}
            onExportRecovery={() => exportRoundRecovery(round, patients)}
          />
          <main className="min-h-0 flex-1 overflow-hidden">
            {surface === "home" && (
              <RoundHome
                touchFriendly
                onStartRound={handleStartRound}
                onEndRound={handleEndRound}
              />
            )}
            {surface === "end" && (
              <RoundEnd
                touchFriendly
                onBackToFocus={handleStartRound}
                onBackToHome={handleGoHome}
              />
            )}
          </main>
        </>
      )}
      <RosterOverlay
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        touchFriendly
        onEndRound={handleEndRound}
        onGoHome={handleGoHome}
      />
      <ToolsSheet
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        touchFriendly
        onOpenClassicWorkbench={onOpenWorkbench}
      />
    </div>
  )
}
