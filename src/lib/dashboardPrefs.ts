export type SystemsReviewMode = "split" | "combine_all" | "combine_custom";

export type DashboardFocusTarget =
  | "clinicalSummary"
  | "intervalEvents"
  | "imaging"
  | "labs"
  | "systemsReview";

export interface DashboardPrefs {
  version: 1;
  leftPatientListOpen: boolean;
  rightTasksPanelOpen: boolean;
  focusModeEnabled: boolean;
  systemsReviewMode: SystemsReviewMode;
  systemsCustomCombineKeys: string[];
}

export const DASHBOARD_PREFS_STORAGE_KEY = "rr-dashboard-prefs";
export const DASHBOARD_PREFS_VERSION = 1 as const;

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  version: DASHBOARD_PREFS_VERSION,
  leftPatientListOpen: true,
  rightTasksPanelOpen: true,
  focusModeEnabled: false,
  systemsReviewMode: "split",
  systemsCustomCombineKeys: [],
};

const SYSTEMS_MODE_SET = new Set<SystemsReviewMode>(["split", "combine_all", "combine_custom"]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const sanitizeCustomCombineKeys = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  value.forEach((item) => {
    if (typeof item !== "string") return;
    const trimmed = item.trim();
    if (!trimmed) return;
    unique.add(trimmed);
  });
  return Array.from(unique);
};

/** Accepts unknown input and returns a valid DashboardPrefs object. */
export const sanitizeDashboardPrefs = (value: unknown): DashboardPrefs => {
  if (!isObjectRecord(value)) {
    return { ...DEFAULT_DASHBOARD_PREFS };
  }

  const mode = value.systemsReviewMode;
  const systemsReviewMode: SystemsReviewMode =
    typeof mode === "string" && SYSTEMS_MODE_SET.has(mode as SystemsReviewMode)
      ? (mode as SystemsReviewMode)
      : DEFAULT_DASHBOARD_PREFS.systemsReviewMode;

  const migrated: DashboardPrefs = {
    version: DASHBOARD_PREFS_VERSION,
    leftPatientListOpen:
      typeof value.leftPatientListOpen === "boolean"
        ? value.leftPatientListOpen
        : DEFAULT_DASHBOARD_PREFS.leftPatientListOpen,
    rightTasksPanelOpen:
      typeof value.rightTasksPanelOpen === "boolean"
        ? value.rightTasksPanelOpen
        : typeof value.tasksRailOpen === "boolean"
          ? value.tasksRailOpen
          : DEFAULT_DASHBOARD_PREFS.rightTasksPanelOpen,
    focusModeEnabled:
      typeof value.focusModeEnabled === "boolean"
        ? value.focusModeEnabled
        : DEFAULT_DASHBOARD_PREFS.focusModeEnabled,
    systemsReviewMode,
    systemsCustomCombineKeys: sanitizeCustomCombineKeys(value.systemsCustomCombineKeys),
  };

  return migrated;
};

export const loadDashboardPrefs = (): DashboardPrefs => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_DASHBOARD_PREFS };
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DASHBOARD_PREFS };
    return sanitizeDashboardPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DASHBOARD_PREFS };
  }
};

export const saveDashboardPrefs = (prefs: DashboardPrefs): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARD_PREFS_STORAGE_KEY, JSON.stringify(sanitizeDashboardPrefs(prefs)));
  } catch {
    // ignore storage quota/private mode errors; app state still works in-memory
  }
};
