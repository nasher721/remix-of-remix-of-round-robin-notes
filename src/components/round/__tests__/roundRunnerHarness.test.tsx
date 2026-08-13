/**
 * Focus-first Round runner regression harness (no credentials).
 * Covers: chrome demotion, roster overlay, next/prev/done walk, Home/End/print path.
 */
import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { ChangeTrackingProvider } from "@/contexts/ChangeTrackingContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardTodosProvider } from "@/contexts/DashboardTodosContext";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { ClinicalGuidelinesProvider } from "@/contexts/ClinicalGuidelinesContext";
import { DashboardLayoutProvider } from "@/context/DashboardLayoutContext";
import { RoundSessionProvider } from "@/contexts/RoundSessionContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopRoundShell } from "@/components/round/DesktopRoundShell";
import { MobileRoundShell } from "@/components/round/MobileRoundShell";
import { dashboardPatients3, makeDashboardTodosMap } from "@/test/dashboardRegressionFixtures";
import { PatientFilterType } from "@/constants/config";
import type { Patient } from "@/types/patient";
import type { PatientSaveState } from "@/hooks/patients/usePatientMutations";
import type { PatientRosterVerification } from "@/hooks/patients/usePatientFetch";

globalThis.MutationObserver = window.MutationObserver;
globalThis.NodeFilter = window.NodeFilter;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.ResizeObserver =
  window.ResizeObserver ??
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? function scrollIntoView() {};
Element.prototype.hasPointerCapture =
  Element.prototype.hasPointerCapture ?? function hasPointerCapture() {
    return false;
  };
Element.prototype.setPointerCapture =
  Element.prototype.setPointerCapture ?? function setPointerCapture() {};
Element.prototype.releasePointerCapture =
  Element.prototype.releasePointerCapture ?? function releasePointerCapture() {};

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
window.scrollTo = window.scrollTo ?? (() => {});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const DEMOTED_PRIMARY_CHROME_TERMS = [
  /ibcc/i,
  /compare patients/i,
  /guidelines/i,
  /risk calculator/i,
  /ai command/i,
] as const;

function buildDashboardValue(
  patients: Patient[],
  patientVerification: PatientRosterVerification = "verified",
  filteredPatients: Patient[] = patients,
) {
  return {
    user: { email: "clinician@example.test" },
    patients,
    filteredPatients,
    autotexts: [],
    templates: [],
    customDictionary: {},
    searchQuery: "",
    setSearchQuery: () => {},
    filter: PatientFilterType.All,
    setFilter: () => {},
    selectedPatient: patients[0] ?? null,
    mobileTab: "patients" as const,
    setMobileTab: () => {},
    lastSaved: new Date("2026-08-11T12:00:00.000Z"),
    patientListViewMode: "compact" as const,
    setPatientListViewMode: () => {},
    patientVerification,
    onAddPatient: () => {},
    onAddPatientWithData: async () => {},
    onUpdatePatient: async () => {},
    onRemovePatient: async () => {},
    onDuplicatePatient: async () => {},
    onToggleCollapse: async () => {},
    onCollapseAll: async () => {},
    onClearAll: async () => {},
    onImportPatients: async () => {},
    onRefetchPatients: () => {},
    onAddAutotext: async () => true,
    onRemoveAutotext: async () => {},
    onAddTemplate: async () => true,
    onRemoveTemplate: async () => {},
    onImportDictionary: async () => true,
    onSignOut: () => {},
    onPatientSelect: () => {},
    desktopSelectedPatientId: patients[0]?.id ?? null,
    setDesktopSelectedPatientId: () => {},
  };
}

function RoundProviders({
  patients,
  filteredPatients = patients,
  patientSaveStates = {},
  patientVerification = "verified",
  todosVerification = "verified",
  dataVerificationBlocked = false,
  children,
}: {
  patients: Patient[];
  filteredPatients?: Patient[];
  patientSaveStates?: Record<string, PatientSaveState>;
  patientVerification?: PatientRosterVerification;
  todosVerification?: "loading" | "verified" | "local" | "stale";
  dataVerificationBlocked?: boolean;
  children: React.ReactNode;
}) {
  const queryClient = React.useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }),
    [],
  );
  const patientIds = React.useMemo(() => patients.map((patient) => patient.id), [patients]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TeamProvider>
          <SettingsProvider>
            <DashboardLayoutProvider>
              <IBCCProvider>
                <ClinicalGuidelinesProvider>
                  <TooltipProvider>
                    <ChangeTrackingProvider>
                      <DashboardProvider {...buildDashboardValue(patients, patientVerification, filteredPatients)}>
                        <DashboardTodosProvider
                          todosMap={makeDashboardTodosMap(patients)}
                          verification={todosVerification}
                        >
                          <RoundSessionProvider
                            userId="test-user"
                            patientIds={patientIds}
                            patientSaveStates={patientSaveStates}
                            dataVerificationBlocked={dataVerificationBlocked}
                            disablePersistence
                          >
                            {children}
                          </RoundSessionProvider>
                        </DashboardTodosProvider>
                      </DashboardProvider>
                    </ChangeTrackingProvider>
                  </TooltipProvider>
                </ClinicalGuidelinesProvider>
              </IBCCProvider>
            </DashboardLayoutProvider>
          </SettingsProvider>
        </TeamProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function assertPrimaryChromeHasNoDemotedTools(chrome: HTMLElement) {
  for (const term of DEMOTED_PRIMARY_CHROME_TERMS) {
    assert.equal(
      within(chrome).queryByText(term),
      null,
      `Primary chrome must not show demoted tool matching ${term}`,
    );
  }
  assert.ok(within(chrome).getByTestId("round-tools-entry"), "Tools entry must remain in chrome");
  assert.ok(within(chrome).getByTestId("round-roster-entry"), "Roster entry must remain in chrome");
}

describe("Focus-first Round runner harness", () => {
  it("keeps demoted tools out of primary chrome and hosts them in Tools sheet", async () => {
    render(
      <RoundProviders patients={dashboardPatients3}>
        <DesktopRoundShell />
      </RoundProviders>,
    );

    const shell = screen.getByTestId("desktop-round-shell");
    assert.equal(shell.getAttribute("data-round-surface"), "focus");
    assert.ok(screen.getByTestId("patient-focus"));

    const chrome = screen.getByTestId("round-chrome");
    assertPrimaryChromeHasNoDemotedTools(chrome);

    fireEvent.click(screen.getByTestId("round-tools-entry"));
    const tools = await screen.findByTestId("tools-sheet");
    assert.ok(tools.contains(document.activeElement), "Tools must trap focus while open");
    assert.ok(within(tools).getByTestId("tools-ai"));
    assert.ok(within(tools).getByTestId("tools-ibcc"));
    assert.ok(within(tools).getByTestId("tools-guidelines"));
    assert.ok(within(tools).getByTestId("tools-compare"));
    assert.ok(within(tools).getByTestId("tools-risk"));
  });

  it("opens roster overlay without leaving Patient Focus mounted", async () => {
    render(
      <RoundProviders patients={dashboardPatients3}>
        <DesktopRoundShell />
      </RoundProviders>,
    );

    assert.ok(screen.getByTestId("patient-focus"));
    fireEvent.click(screen.getByTestId("round-roster-entry"));

    const roster = await screen.findByTestId("roster-overlay");
    assert.ok(within(roster).getByTestId("roster-search"));
    assert.ok(within(roster).getByTestId(`roster-row-${dashboardPatients3[0]!.id}`));
    assert.ok(within(roster).getByTestId(`roster-row-${dashboardPatients3[1]!.id}`));
    assert.ok(within(roster).getByTestId(`roster-row-${dashboardPatients3[2]!.id}`));

    // Focus stays mounted while roster is open (draft-preserving overlay).
    assert.ok(screen.getByTestId("patient-focus"));
    assert.equal(screen.getByTestId("desktop-round-shell").getAttribute("data-round-surface"), "focus");
  });

  it("walks ≥3 patients with next/prev/done then reaches End print path", async () => {
    render(
      <RoundProviders patients={dashboardPatients3}>
        <DesktopRoundShell />
      </RoundProviders>,
    );

    assert.match(screen.getByTestId("round-position").textContent ?? "", /Round · 1\/3/);

    fireEvent.click(screen.getByTestId("round-next"));
    assert.match(screen.getByTestId("round-position").textContent ?? "", /Round · 2\/3/);

    fireEvent.click(screen.getByTestId("round-prev"));
    assert.match(screen.getByTestId("round-position").textContent ?? "", /Round · 1\/3/);

    fireEvent.click(screen.getByTestId("round-done"));
    assert.match(screen.getByTestId("round-position").textContent ?? "", /Round · 2\/3/);

    fireEvent.click(screen.getByTestId("round-done"));
    assert.match(screen.getByTestId("round-position").textContent ?? "", /Round · 3\/3/);

    fireEvent.click(screen.getByTestId("round-done"));
    assert.match(screen.getByTestId("round-position").textContent ?? "", /Round · 3\/3/);

    fireEvent.click(screen.getByTestId("round-end-entry"));
    assert.equal(screen.getByTestId("desktop-round-shell").getAttribute("data-round-surface"), "end");
    assert.ok(screen.getByTestId("round-end"));
    assert.ok(screen.getByTestId("round-end-print"));
  });

  it("exports the full Round roster even when the dashboard has an unrelated filter", async () => {
    render(
      <RoundProviders
        patients={dashboardPatients3}
        filteredPatients={[dashboardPatients3[0]!]}
      >
        <DesktopRoundShell />
      </RoundProviders>,
    );

    fireEvent.click(screen.getByTestId("round-end-entry"));
    fireEvent.click(screen.getByTestId("round-end-print"));

    const dialog = await screen.findByRole("dialog");
    for (const patient of dashboardPatients3) {
      assert.ok(
        within(dialog).getAllByText(patient.name).length > 0,
        `End Round export must include ${patient.name}`,
      );
    }
  });

  it("blocks completion for an unresolved patient save without hiding review and export", async () => {
    render(
      <RoundProviders
        patients={dashboardPatients3}
        patientSaveStates={{ [dashboardPatients3[0]!.id]: "saving" }}
      >
        <DesktopRoundShell />
      </RoundProviders>,
    );

    const done = screen.getByTestId("round-done") as HTMLButtonElement;
    assert.equal(done.disabled, true, "Done must wait for the active patient save");

    const endEntry = screen.getByTestId("round-end-entry") as HTMLButtonElement;
    assert.equal(endEntry.disabled, false, "End must remain available for review and recovery export");
    fireEvent.click(endEntry);

    assert.ok(screen.getByTestId("round-completion-guard"));
    assert.match(
      screen.getByTestId("round-completion-guard").textContent ?? "",
      /finish syncing before marking complete/i,
    );
    assert.equal(
      (screen.getByTestId("round-end-complete") as HTMLButtonElement).disabled,
      true,
    );
    assert.equal(
      (screen.getByTestId("round-end-print") as HTMLButtonElement).disabled,
      false,
      "Print/export remains a recovery path while completion is blocked",
    );
  });

  it("keeps stale local Todos visible for recovery export while blocking completion", async () => {
    render(
      <RoundProviders
        patients={dashboardPatients3}
        todosVerification="stale"
        dataVerificationBlocked
      >
        <DesktopRoundShell />
      </RoundProviders>,
    );

    assert.equal((screen.getByTestId("round-done") as HTMLButtonElement).disabled, true);
    fireEvent.click(screen.getByTestId("round-end-entry"));
    assert.match(
      screen.getByTestId("round-end-todos-unverified").textContent ?? "",
      /last Todo snapshot saved on this device/i,
    );
    assert.equal((screen.getByTestId("round-end-complete") as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByTestId("round-end-print") as HTMLButtonElement).disabled, false);
  });

  it("keeps a stale local patient roster visible for recovery export while blocking completion", async () => {
    render(
      <RoundProviders
        patients={dashboardPatients3}
        patientVerification="stale"
        dataVerificationBlocked
      >
        <DesktopRoundShell />
      </RoundProviders>,
    );

    assert.match(screen.getByTestId("round-sync-cue").textContent ?? "", /clinical data needs verification/i);
    assert.equal((screen.getByTestId("round-done") as HTMLButtonElement).disabled, true);
    fireEvent.click(screen.getByTestId("round-end-entry"));
    assert.match(
      screen.getByTestId("round-end-patients-unverified").textContent ?? "",
      /roster data available on this device/i,
    );
    assert.equal((screen.getByTestId("round-end-complete") as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByTestId("round-end-print") as HTMLButtonElement).disabled, false);
  });

  it("exposes first-class Import on Round Home", async () => {
    render(
      <RoundProviders patients={dashboardPatients3}>
        <DesktopRoundShell />
      </RoundProviders>,
    );

    fireEvent.click(screen.getByTestId("round-go-home"));
    assert.equal(screen.getByTestId("desktop-round-shell").getAttribute("data-round-surface"), "home");
    assert.ok(screen.getByTestId("round-home"));
    assert.ok(screen.getByTestId("round-home-import"));
    assert.ok(screen.getByTestId("round-home-start"));
  });

  it("expands only one systems row at a time in Patient Focus", async () => {
    render(
      <RoundProviders patients={dashboardPatients3}>
        <DesktopRoundShell />
      </RoundProviders>,
    );

    const stack = screen.getByTestId("systems-compact-stack");
    const neuroBtn = within(stack).getByRole("button", { name: /^Neuro/i });
    const respBtn = within(stack).getByRole("button", { name: /^Respiratory/i });

    fireEvent.click(neuroBtn);
    const neuroRow = stack.querySelector('[data-systems-row="neuro"]');
    assert.equal(neuroRow?.getAttribute("data-expanded"), "true");

    fireEvent.click(respBtn);
    const respRow = stack.querySelector('[data-systems-row="resp"]');
    assert.equal(respRow?.getAttribute("data-expanded"), "true");
    assert.equal(neuroRow?.getAttribute("data-expanded"), "false");
  });

  it("mobile shell shares Focus-first chrome and Tools demotion", async () => {
    render(
      <RoundProviders patients={dashboardPatients3}>
        <MobileRoundShell />
      </RoundProviders>,
    );

    assert.ok(screen.getByTestId("mobile-round-shell"));
    const chrome = screen.getByTestId("round-chrome");
    assertPrimaryChromeHasNoDemotedTools(chrome);
    assert.ok(screen.getByTestId("round-chrome-sticky-actions"));
    assert.ok(screen.getByTestId("patient-focus"));
  });

  it("uses roving focus and associated panels for mobile section tabs", async () => {
    render(
      <RoundProviders patients={dashboardPatients3}>
        <MobileRoundShell />
      </RoundProviders>,
    );

    const summaryTab = screen.getByRole("tab", { name: "Summary" });
    const systemsTab = screen.getByRole("tab", { name: "Systems" });
    const todosTab = screen.getByRole("tab", { name: "Todos" });
    assert.equal(summaryTab.tabIndex, 0);
    assert.equal(systemsTab.tabIndex, -1);
    assert.equal(summaryTab.getAttribute("aria-controls"), "focus-summary-panel");
    assert.ok(document.getElementById("main-content"));
    assert.ok(document.getElementById("focus-summary-panel"));
    assert.ok(document.getElementById("focus-system-panel"));
    assert.ok(document.getElementById("focus-todos-panel"));
    const initialPanel = screen.getByRole("tabpanel");
    assert.equal(initialPanel.id, "focus-summary-panel");
    assert.equal(initialPanel.getAttribute("aria-labelledby"), "focus-mobile-tab-clinicalSummary");

    summaryTab.focus();
    fireEvent.keyDown(summaryTab, { key: "ArrowRight" });
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    assert.equal(document.activeElement, systemsTab);
    assert.equal(systemsTab.getAttribute("aria-selected"), "true");
    assert.equal(systemsTab.getAttribute("aria-controls"), "focus-system-panel");
    const systemsPanel = screen.getByRole("tabpanel");
    assert.equal(systemsPanel.id, "focus-system-panel");
    assert.equal(systemsPanel.getAttribute("aria-labelledby"), "focus-mobile-tab-systems");

    fireEvent.keyDown(systemsTab, { key: "End" });
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    assert.equal(document.activeElement, todosTab);
    assert.equal(todosTab.tabIndex, 0);
    assert.ok(document.getElementById("focus-todos-panel"));
    const todosPanel = screen.getByRole("tabpanel");
    assert.equal(todosPanel.id, "focus-todos-panel");
    assert.equal(todosPanel.getAttribute("aria-labelledby"), "focus-mobile-tab-todos");
  });
});
