"use client"

import * as React from "react"
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import {
  loadDashboardPrefs,
  saveDashboardPrefs,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardPrefs,
  type DashboardFocusTarget,
} from "@/lib/dashboardPrefs"
import {
  toLayoutMode,
  toPrefsMode,
  type SystemsLayoutMode,
} from "@/lib/dashboardLayoutModes"

interface DashboardLayoutState {
  // Panel state
  panelLeftCollapsed: boolean
  panelRightCollapsed: boolean
  // Focus mode
  focusModeActive: boolean
  focusModeEditorId: DashboardFocusTarget | null
  // Systems layout
  systemsLayoutMode: SystemsLayoutMode
  customSystemsGroupIds: string[]
  // Patient roster layout
  patientRosterLayoutMode: DashboardPrefs["patientRosterLayoutMode"]
}

interface DashboardLayoutActions {
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  setLeftPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  enterFocusMode: (editorId: DashboardFocusTarget) => void
  exitFocusMode: () => void
  setSystemsLayoutMode: (mode: SystemsLayoutMode) => void
  setCustomSystemsGroup: (ids: string[]) => void
  setPatientRosterLayoutMode: (mode: DashboardPrefs["patientRosterLayoutMode"]) => void
}

type DashboardLayoutContextValue = DashboardLayoutState & DashboardLayoutActions

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null)

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_DASHBOARD_PREFS)
  const [focusModeActive, setFocusModeActive] = useState(false)
  const [focusModeEditorId, setFocusModeEditorId] = useState<DashboardFocusTarget | null>(null)
  const [systemsLayoutMode, setSystemsLayoutModeState] = useState<SystemsLayoutMode>("split")
  const [customSystemsGroupIds, setCustomSystemsGroupIdsState] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const preFocusLayoutRef = useRef<{ leftPatientListOpen: boolean; rightTasksPanelOpen: boolean } | null>(null)

  // Load prefs on mount
  useEffect(() => {
    const loaded = loadDashboardPrefs()
    setPrefs(loaded)
    setFocusModeActive(loaded.focusModeEnabled)
    setSystemsLayoutModeState(toLayoutMode(loaded.systemsReviewMode))
    setCustomSystemsGroupIdsState(loaded.systemsCustomCombineKeys)
    setIsInitialized(true)
  }, [])

  // Persist when state changes
  useEffect(() => {
    if (!isInitialized) return
    const newPrefs: DashboardPrefs = {
      ...prefs,
      focusModeEnabled: focusModeActive,
      systemsReviewMode: toPrefsMode(systemsLayoutMode),
      systemsCustomCombineKeys: customSystemsGroupIds,
    }
    saveDashboardPrefs(newPrefs)
  }, [isInitialized, prefs, focusModeActive, systemsLayoutMode, customSystemsGroupIds])

  const toggleLeftPanel = useCallback(() => {
    setPrefs((p) => {
      // In focus mode, keep the writing surface uncluttered.
      if (p.focusModeEnabled) return p
      return { ...p, leftPatientListOpen: !p.leftPatientListOpen }
    })
  }, [])

  const toggleRightPanel = useCallback(() => {
    setPrefs((p) => {
      // In focus mode, keep the writing surface uncluttered.
      if (p.focusModeEnabled) return p
      return { ...p, rightTasksPanelOpen: !p.rightTasksPanelOpen }
    })
  }, [])

  const setLeftPanelCollapsed = useCallback((collapsed: boolean) => {
    setPrefs((p) => {
      if (p.focusModeEnabled) return p
      return { ...p, leftPatientListOpen: !collapsed }
    })
  }, [])

  const setRightPanelCollapsed = useCallback((collapsed: boolean) => {
    setPrefs((p) => {
      if (p.focusModeEnabled) return p
      return { ...p, rightTasksPanelOpen: !collapsed }
    })
  }, [])

  const enterFocusMode = useCallback((editorId: DashboardFocusTarget) => {
    setFocusModeActive(true)
    setFocusModeEditorId(editorId)
    setPrefs((prev) => {
      if (prev.focusModeEnabled) return prev
      preFocusLayoutRef.current = {
        leftPatientListOpen: prev.leftPatientListOpen,
        rightTasksPanelOpen: prev.rightTasksPanelOpen,
      }
      return {
        ...prev,
        focusModeEnabled: true,
        leftPatientListOpen: false,
        rightTasksPanelOpen: false,
      }
    })
  }, [])

  const exitFocusMode = useCallback(() => {
    setFocusModeActive(false)
    setFocusModeEditorId(null)
    setPrefs((prev) => {
      if (!prev.focusModeEnabled) return prev
      const restore = preFocusLayoutRef.current
      preFocusLayoutRef.current = null
      return {
        ...prev,
        focusModeEnabled: false,
        leftPatientListOpen: restore?.leftPatientListOpen ?? true,
        rightTasksPanelOpen: restore?.rightTasksPanelOpen ?? true,
      }
    })
  }, [])

  const setSystemsLayoutMode = useCallback((mode: SystemsLayoutMode) => {
    setSystemsLayoutModeState(mode)
  }, [])

  const setCustomSystemsGroup = useCallback((ids: string[]) => {
    setCustomSystemsGroupIdsState(ids)
    setSystemsLayoutModeState(ids.length > 0 ? "custom" : "split")
  }, [])

  const setPatientRosterLayoutMode = useCallback(
    (mode: DashboardPrefs["patientRosterLayoutMode"]) => {
      setPrefs((p) => ({ ...p, patientRosterLayoutMode: mode }))
    },
    [],
  )

   // Keyboard handler for Esc to exit focus mode
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === "Escape" && focusModeActive) {
         exitFocusMode()
       }
     }
     
     if (focusModeActive) {
       document.addEventListener("keydown", handleKeyDown)
       return () => document.removeEventListener("keydown", handleKeyDown)
     }
   }, [focusModeActive, exitFocusMode])

  const value: DashboardLayoutContextValue = useMemo(() => ({
    panelLeftCollapsed: !prefs.leftPatientListOpen,
    panelRightCollapsed: !prefs.rightTasksPanelOpen,
    focusModeActive,
    focusModeEditorId,
    systemsLayoutMode,
    customSystemsGroupIds,
    patientRosterLayoutMode: prefs.patientRosterLayoutMode,
    toggleLeftPanel,
    toggleRightPanel,
    setLeftPanelCollapsed,
    setRightPanelCollapsed,
    enterFocusMode,
    exitFocusMode,
    setSystemsLayoutMode,
    setCustomSystemsGroup,
    setPatientRosterLayoutMode,
  }), [
    prefs.leftPatientListOpen,
    prefs.rightTasksPanelOpen,
    prefs.patientRosterLayoutMode,
    focusModeActive,
    focusModeEditorId,
    systemsLayoutMode,
    customSystemsGroupIds,
    toggleLeftPanel,
    toggleRightPanel,
    setLeftPanelCollapsed,
    setRightPanelCollapsed,
    enterFocusMode,
    exitFocusMode,
    setSystemsLayoutMode,
    setCustomSystemsGroup,
    setPatientRosterLayoutMode,
  ])

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  )
}

export function useDashboardLayout() {
  const context = useContext(DashboardLayoutContext)
  if (!context) {
    throw new Error("useDashboardLayout must be used within DashboardLayoutProvider")
  }
  return context
}
