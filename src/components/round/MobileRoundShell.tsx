import * as React from "react"
import { RoundChrome } from "./RoundChrome"
import { RosterOverlay } from "./RosterOverlay"
import { PatientFocus } from "./PatientFocus"
import { RoundHome } from "./RoundHome"
import { RoundEnd } from "./RoundEnd"
import { ToolsSheet } from "./ToolsSheet"
import { useDashboard } from "@/contexts/DashboardContext"
import { useRoundNavigation } from "./useRoundNavigation"
import type { Patient } from "@/types/patient"
import { exportRoundRecovery } from "@/lib/exportRoundRecovery"
import type { ComposedDraft } from "@/lib/decision-scribe/draftComposer"
import type { CaptureBinding, DecisionCandidate } from "@/types/decisionScribe"
import type { CaptureState } from "@/lib/decision-scribe/captureController"

export interface MobileRoundShellProps {
  /**
   * Limited secondary escape to classic MobileDashboard.
   * Prefer ToolsSheet panels; this is clearly labeled legacy.
   */
  onOpenWorkbench?: () => void
  decisionDraft?: ComposedDraft | null
  onDecisionDraftChange?: (candidates: DecisionCandidate[]) => void
  onDecisionAttest?: (candidates: DecisionCandidate[]) => void
  onCaptureStopped?: (state: CaptureState) => void
  onCaptureAudio?: (state: CaptureState, audio: Blob | undefined, mimeType: string | undefined, binding: CaptureBinding, patient: Patient) => void
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
export const MobileRoundShell = ({ onOpenWorkbench, decisionDraft, onDecisionDraftChange, onDecisionAttest, onCaptureStopped, onCaptureAudio }: MobileRoundShellProps) => {
  const { patients, onPatientSelect } = useDashboard()
  const {
    currentPatientId, round, isHydrated, nextPatient, prevPatient, markDoneAndNext,
    patient, captureBinding, surface, hasStartedRound, decisionReviewOpen,
    setDecisionReviewOpen, goHome: handleGoHome, startRound: handleStartRound,
    endRound: handleEndRound,
  } = useRoundNavigation(patients, Boolean(decisionDraft))
  const [rosterOpen, setRosterOpen] = React.useState(false)
  const [toolsOpen, setToolsOpen] = React.useState(false)

  // Keep classic mobile selection in sync so workbench hops resume the same chart.
  React.useEffect(() => {
    if (!isHydrated) return
    if (!patient) {
      onPatientSelect(null)
      return
    }
    onPatientSelect(patient)
  }, [isHydrated, patient, onPatientSelect])

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

  if (!isHydrated) {
    return (
      <div
        className="flex h-[100dvh] min-h-screen items-center justify-center bg-background px-6 text-foreground"
        data-testid="mobile-round-shell"
        data-round-surface={surface}
        data-round-ready="false"
      >
        <p role="status" className="text-sm font-medium text-muted-foreground" data-testid="round-session-loading">
          Restoring today&apos;s Round…
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex h-[100dvh] min-h-screen flex-col bg-background text-foreground"
      data-testid="mobile-round-shell"
      data-round-surface={surface}
      data-round-ready="true"
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
          decisionReviewCount={decisionDraft && !decisionReviewOpen ? decisionDraft.candidates.length : 0}
          onOpenDecisionReview={decisionDraft ? () => setDecisionReviewOpen(true) : undefined}
          captureBinding={captureBinding}
          onCaptureStopped={onCaptureStopped}
          onCaptureAudio={(state, audio, mime) => { if (captureBinding && patient) onCaptureAudio?.(state, audio, mime, captureBinding, patient); }}
        >
          <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-hidden">
            <PatientFocus
              key={patient?.id ?? "empty"}
              patient={patient}
              touchFriendly
              onGoHome={handleGoHome}
              decisionDraft={decisionReviewOpen ? decisionDraft : null}
              onDecisionDraftChange={onDecisionDraftChange}
              onDecisionReviewClose={() => setDecisionReviewOpen(false)}
              onDecisionAttest={onDecisionAttest}
            />
          </main>
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
          <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-hidden">
            {surface === "home" && (
              <RoundHome
                isResume={hasStartedRound}
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
