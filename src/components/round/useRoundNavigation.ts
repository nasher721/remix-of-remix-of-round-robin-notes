import * as React from "react"
import { toast } from "sonner"
import { useRoundSession } from "@/contexts/RoundSessionContext"
import type { Patient } from "@/types/patient"
import type { CaptureBinding } from "@/types/decisionScribe"
import type { RoundShellSurface } from "./roundShellSurface"
import { preloadRoundPrintExport } from "./roundPrintExportLoader"

/**
 * Shared Round navigation for the desktop and mobile shells. Session persistence
 * remains in RoundSessionContext; device input and presentation stay in the shells.
 */
export function useRoundNavigation(patients: Patient[], hasDecisionDraft: boolean) {
  const {
    currentPatientId, round, isHydrated, nextPatient, prevPatient,
    markDoneAndNext, startNewRound, decisionScribeBlocked, decisionScribeBlockReason,
  } = useRoundSession()
  const [surface, setSurface] = React.useState<RoundShellSurface>(() =>
    patients.length === 0 ? "home" : "focus",
  )
  const [hasStartedRound, setHasStartedRound] = React.useState(() => patients.length > 0)
  const [decisionReviewOpen, setDecisionReviewOpen] = React.useState(false)
  const hydratedSurfaceInitializedRef = React.useRef(false)
  const patient = React.useMemo(() => {
    if (!currentPatientId) return null
    return patients.find((entry) => entry.id === currentPatientId) ?? null
  }, [patients, currentPatientId])
  const captureBinding = React.useMemo<CaptureBinding | null>(() => {
    if (!patient?.id || !round.userId || !round.id) return null
    const startedAt = new Date().toISOString()
    return {
      sessionId: `capture-${round.id}-${patient.id}` as CaptureBinding["sessionId"],
      roundId: round.id,
      patientId: patient.id,
      physicianId: round.userId,
      deviceId: `round-device-${round.userId}`,
      startedAt,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      source: "rounds-audio",
      patientSnapshotId: `${patient.id}:${patient.lastModified}`,
      patientSnapshotCapturedAt: patient.lastModified,
    }
  }, [patient, round.id, round.userId])

  React.useEffect(() => {
    if (patients.length === 0) {
      setSurface("home")
      setHasStartedRound(false)
    }
  }, [patients.length])

  React.useEffect(() => {
    if (!hasDecisionDraft) setDecisionReviewOpen(false)
  }, [hasDecisionDraft])

  React.useEffect(() => {
    if (!isHydrated || hydratedSurfaceInitializedRef.current) return
    hydratedSurfaceInitializedRef.current = true
    if (round.status === "completed") {
      setSurface("home")
      setHasStartedRound(true)
    }
  }, [isHydrated, round.status])

  React.useEffect(() => {
    if (!navigator.onLine) return
    void preloadRoundPrintExport().catch(() => undefined)
  }, [])

  const goHome = React.useCallback(() => setSurface("home"), [])
  const startRound = React.useCallback(() => {
    if (round.status === "completed") startNewRound()
    setHasStartedRound(true)
    setSurface("focus")
  }, [round.status, startNewRound])
  const endRound = React.useCallback(() => {
    if (decisionScribeBlocked) {
      toast.warning("Review Decision Scribe changes before End Round", {
        description: decisionScribeBlockReason ?? "An approved Decision Scribe change still needs server acknowledgement.",
      })
      return
    }
    setSurface("end")
  }, [decisionScribeBlocked, decisionScribeBlockReason])

  return {
    currentPatientId, round, isHydrated, patient, captureBinding,
    surface, hasStartedRound, decisionReviewOpen, setDecisionReviewOpen,
    goHome, startRound, endRound, nextPatient, prevPatient, markDoneAndNext,
  }
}
