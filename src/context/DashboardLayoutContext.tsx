"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import {
  loadDashboardPrefs,
  saveDashboardPrefs,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardPrefs,
} from "@/lib/dashboardPrefs"

export type SystemsLayoutMode = "split" | "combine_all" | "custom"

const toLayoutMode = (mode: DashboardPrefs["systemsReviewMode"]): SystemsLayoutMode => {
  if (mode === "combine_custom") return "custom"
  return mode
}

const toPrefsMode = (mode: SystemsLayoutMode): DashboardPrefs["systemsReviewMode"] => {
  if (mode === "custom") return "combine_custom"
  return mode
}

interface DashboardLayoutState {
  // Panel state
  panelLeftCollapsed: boolean
  panelRightCollapsed: boolean
  // Focus mode
  focusModeActive: boolean
  focusModeEditorId: string | null
  // Systems layout
  systemsLayoutMode: SystemsLayoutMode
  customSystemsGroupIds: string[]
}

interface DashboardLayoutActions {
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  setLeftPanelCollapsed: (collapsed: boolean) => void
  setRightPanelCollapsed: (collapsed: boolean) => void
  enterFocusMode: (editorId: string) => void
  exitFocusMode: () => void
  setSystemsLayoutMode: (mode: SystemsLayoutMode) => void
  setCustomSystemsGroup: (ids: string[]) => void
}

type DashboardLayoutContextValue = DashboardLayoutState & DashboardLayoutActions

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null)

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_DASHBOARD_PREFS)
  const [focusModeActive, setFocusModeActive] = useState(false)
  const [focusModeEditorId, setFocusModeEditorId] = useState<string | null>(null)
  const [systemsLayoutMode, setSystemsLayoutModeState] = useState<SystemsLayoutMode>("split")
  const [customSystemsGroupIds, setCustomSystemsGroupIdsState] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

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
    setPrefs((p) => ({ ...p, leftPatientListOpen: !p.leftPatientListOpen }))
  }, [])

  const toggleRightPanel = useCallback(() => {
    setPrefs((p) => ({ ...p, rightTasksPanelOpen: !p.rightTasksPanelOpen }))
  }, [])

  const setLeftPanelCollapsed = useCallback((collapsed: boolean) => {
    setPrefs((p) => ({ ...p, leftPatientListOpen: !collapsed }))
  }, [])

  const setRightPanelCollapsed = useCallback((collapsed: boolean) => {
    setPrefs((p) => ({ ...p, rightTasksPanelOpen: !collapsed }))
  }, [])

  const enterFocusMode = useCallback((editorId: string) => {
    setFocusModeActive(true)
    setFocusModeEditorId(editorId)
    setPrefs((p) => ({ ...p, focusModeEnabled: true }))
  }, [])

  const exitFocusMode = useCallback(() => {
    setFocusModeActive(false)
    setFocusModeEditorId(null)
    setPrefs((p) => ({ ...p, focusModeEnabled: false }))
  }, [])

  const setSystemsLayoutMode = useCallback((mode: SystemsLayoutMode) => {
    setSystemsLayoutModeState(mode)
  }, [])

  const setCustomSystemsGroup = useCallback((ids: string[]) => {
    setCustomSystemsGroupIdsState(ids)
    if (ids.length > 0) {
      setSystemsLayoutModeState("custom")
    }
  }, [])

  // Keyboard handler for Esc to exit focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusModeActive) {
        setFocusModeActive(false)
        setFocusModeEditorId(null)
      }
    }
    
    if (focusModeActive) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [focusModeActive])

  const value: DashboardLayoutContextValue = useMemo(() => ({
    panelLeftCollapsed: !prefs.leftPatientListOpen,
    panelRightCollapsed: !prefs.rightTasksPanelOpen,
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
  }), [
    prefs.leftPatientListOpen,
    prefs.rightTasksPanelOpen,
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
