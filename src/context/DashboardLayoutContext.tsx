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
  getDashboardPrefs,
  saveDashboardPrefs,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardPrefs,
} from "~/lib/dashboardPrefs"

export type SystemsLayoutMode = "split" | "combine_all" | "custom"

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
    const loaded = getDashboardPrefs()
    setPrefs(loaded)
    setSystemsLayoutModeState(loaded.systemsLayoutMode || "split")
    setCustomSystemsGroupIdsState(loaded.customSystemsGroupIds || [])
    setIsInitialized(true)
  }, [])

  // Persist when state changes
  useEffect(() => {
    if (!isInitialized) return
    const newPrefs: DashboardPrefs = {
      ...prefs,
      systemsLayoutMode,
      customSystemsGroupIds,
    }
    saveDashboardPrefs(newPrefs)
  }, [isInitialized, prefs.panelLeftCollapsed, prefs.panelRightCollapsed, systemsLayoutMode, customSystemsGroupIds])

  const toggleLeftPanel = useCallback(() => {
    setPrefs((p) => ({ ...p, panelLeftCollapsed: !p.panelLeftCollapsed }))
  }, [])

  const toggleRightPanel = useCallback(() => {
    setPrefs((p) => ({ ...p, panelRightCollapsed: !p.panelRightCollapsed }))
  }, [])

  const setLeftPanelCollapsed = useCallback((collapsed: boolean) => {
    setPrefs((p) => ({ ...p, panelLeftCollapsed: collapsed }))
  }, [])

  const setRightPanelCollapsed = useCallback((collapsed: boolean) => {
    setPrefs((p) => ({ ...p, panelRightCollapsed: collapsed }))
  }, [])

  const enterFocusMode = useCallback((editorId: string) => {
    setFocusModeActive(true)
    setFocusModeEditorId(editorId)
  }, [])

  const exitFocusMode = useCallback(() => {
    setFocusModeActive(false)
    setFocusModeEditorId(null)
  }, [])

  const setSystemsLayoutMode = useCallback((mode: SystemsLayoutMode) => {
    setSystemsLayoutModeState(mode)
  }, [])

  const setCustomSystemsGroup = useCallback((ids: string[]) => {
    setCustomSystemsGroupIds(ids)
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
    panelLeftCollapsed: prefs.panelLeftCollapsed,
    panelRightCollapsed: prefs.panelRightCollapsed,
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
    prefs.panelLeftCollapsed,
    prefs.panelRightCollapsed,
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