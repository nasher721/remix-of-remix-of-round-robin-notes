import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { renderHook, act, waitFor } from "@testing-library/react";
import { DashboardLayoutProvider, useDashboardLayout } from "@/context/DashboardLayoutContext";
import { DASHBOARD_PREFS_STORAGE_KEY, DEFAULT_DASHBOARD_PREFS } from "@/lib/dashboardPrefs";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("DashboardLayoutContext", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("panel state", () => {
    it("provides default panel collapsed states", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      assert.equal(result.current.panelLeftCollapsed, false);
      assert.equal(result.current.panelRightCollapsed, false);
    });

    it("toggles left panel state", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.toggleLeftPanel();
      });
      
      assert.equal(result.current.panelLeftCollapsed, true);
    });

    it("toggles right panel state", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.toggleRightPanel();
      });
      
      assert.equal(result.current.panelRightCollapsed, true);
    });

    it("hydrates panel and roster preferences from localStorage", async () => {
      localStorageMock.setItem(
        DASHBOARD_PREFS_STORAGE_KEY,
        JSON.stringify({
          ...DEFAULT_DASHBOARD_PREFS,
          leftPatientListOpen: false,
          rightTasksPanelOpen: false,
          patientRosterLayoutMode: "topbar",
          systemsReviewMode: "combine_all",
        }),
      );

      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      await waitFor(() => {
        assert.equal(result.current.panelLeftCollapsed, true);
        assert.equal(result.current.panelRightCollapsed, true);
        assert.equal(result.current.patientRosterLayoutMode, "topbar");
        assert.equal(result.current.systemsLayoutMode, "combine_all");
      });
    });

    it("persists panel and roster preference changes", async () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      await waitFor(() => {
        const stored = localStorageMock.getItem(DASHBOARD_PREFS_STORAGE_KEY);
        assert.ok(stored);
      });

      act(() => {
        result.current.toggleLeftPanel();
        result.current.setPatientRosterLayoutMode("topbar");
      });

      await waitFor(() => {
        const stored = JSON.parse(localStorageMock.getItem(DASHBOARD_PREFS_STORAGE_KEY) ?? "{}");
        assert.equal(stored.leftPatientListOpen, false);
        assert.equal(stored.patientRosterLayoutMode, "topbar");
      });
    });
  });

  describe("focus mode", () => {
    it("enters focus mode with editor id", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.enterFocusMode("clinical-summary");
      });
      
      assert.equal(result.current.focusModeActive, true);
      assert.equal(result.current.focusModeEditorId, "clinical-summary");
    });

    it("exits focus mode", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.enterFocusMode("clinical-summary");
      });
      
      act(() => {
        result.current.exitFocusMode();
      });
      
      assert.equal(result.current.focusModeActive, false);
      assert.equal(result.current.focusModeEditorId, null);
    });

    it("collapses panels during focus mode and restores the previous panel state on exit", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.setRightPanelCollapsed(true);
      });

      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });

      assert.equal(result.current.focusModeActive, true);
      assert.equal(result.current.panelLeftCollapsed, true);
      assert.equal(result.current.panelRightCollapsed, true);

      act(() => {
        result.current.exitFocusMode();
      });

      assert.equal(result.current.focusModeActive, false);
      assert.equal(result.current.panelLeftCollapsed, false);
      assert.equal(result.current.panelRightCollapsed, true);
    });

    it("ignores panel toggles while focus mode is active", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });

      act(() => {
        result.current.toggleLeftPanel();
        result.current.toggleRightPanel();
      });

      assert.equal(result.current.panelLeftCollapsed, true);
      assert.equal(result.current.panelRightCollapsed, true);
    });

    it("Escape exits focus mode", async () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.enterFocusMode("clinicalSummary");
      });

      await waitFor(() => {
        assert.equal(result.current.focusModeActive, true);
      });

      act(() => {
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
      });

      await waitFor(() => {
        assert.equal(result.current.focusModeActive, false);
      });
    });
  });

  describe("systems layout mode", () => {
    it("defaults to split mode", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      assert.equal(result.current.systemsLayoutMode, "split");
    });

    it("changes systems layout mode", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.setSystemsLayoutMode("combine_all");
      });
      
      assert.equal(result.current.systemsLayoutMode, "combine_all");
    });

    it("sets custom systems group", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });
      
      act(() => {
        result.current.setCustomSystemsGroup(["neuro", "cv"]);
      });
      
      assert.deepEqual(result.current.customSystemsGroupIds, ["neuro", "cv"]);
      assert.equal(result.current.systemsLayoutMode, "custom");
    });
  });

  describe("patient roster layout mode", () => {
    it("sets patient roster layout mode", () => {
      const { result } = renderHook(() => useDashboardLayout(), {
        wrapper: DashboardLayoutProvider,
      });

      act(() => {
        result.current.setPatientRosterLayoutMode("topbar");
      });

      assert.equal(result.current.patientRosterLayoutMode, "topbar");
    });
  });
});
