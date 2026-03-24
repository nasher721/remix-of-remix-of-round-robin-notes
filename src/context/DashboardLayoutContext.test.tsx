import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { renderHook, act } from "@testing-library/react";
import { DashboardLayoutProvider, useDashboardLayout, type SystemsLayoutMode } from "@/context/DashboardLayoutContext";

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
});