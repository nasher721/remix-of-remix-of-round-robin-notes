import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DASHBOARD_PREFS, sanitizeDashboardPrefs } from "@/lib/dashboardPrefs";

describe("sanitizeDashboardPrefs", () => {
  it("returns defaults for non-object input", () => {
    const prefs = sanitizeDashboardPrefs(null);
    assert.deepEqual(prefs, DEFAULT_DASHBOARD_PREFS);
  });

  it("sanitizes mode and de-duplicates custom keys", () => {
    const prefs = sanitizeDashboardPrefs({
      leftPatientListOpen: false,
      rightTasksPanelOpen: true,
      focusModeEnabled: true,
      systemsReviewMode: "combine_custom",
      systemsCustomCombineKeys: ["neuro", "cv", "neuro", "", "  ", 1],
      patientRosterLayoutMode: "topbar",
    });

    assert.equal(prefs.leftPatientListOpen, false);
    assert.equal(prefs.rightTasksPanelOpen, true);
    assert.equal(prefs.focusModeEnabled, true);
    assert.equal(prefs.systemsReviewMode, "combine_custom");
    assert.deepEqual(prefs.systemsCustomCombineKeys, ["neuro", "cv"]);
    assert.equal(prefs.patientRosterLayoutMode, "topbar");
  });

  it("migrates legacy tasksRailOpen key", () => {
    const prefs = sanitizeDashboardPrefs({ tasksRailOpen: false });
    assert.equal(prefs.rightTasksPanelOpen, false);
  });

  it("falls back to split mode for invalid values", () => {
    const prefs = sanitizeDashboardPrefs({ systemsReviewMode: "unknown_mode" });
    assert.equal(prefs.systemsReviewMode, "split");
  });

  it("falls back to sidebar for invalid roster layout mode", () => {
    const prefs = sanitizeDashboardPrefs({ patientRosterLayoutMode: "unknown_mode" });
    assert.equal(prefs.patientRosterLayoutMode, "sidebar");
  });
});
