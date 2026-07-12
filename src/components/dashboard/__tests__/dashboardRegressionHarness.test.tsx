import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { ChangeTrackingProvider } from "@/contexts/ChangeTrackingContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardTodosProvider } from "@/contexts/DashboardTodosContext";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { ClinicalGuidelinesProvider } from "@/contexts/ClinicalGuidelinesContext";
import { DashboardLayoutProvider } from "@/context/DashboardLayoutContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopDashboard } from "@/components/dashboard/DesktopDashboard";
import { VirtualizedPatientList } from "@/components/dashboard/VirtualizedPatientList";
import { MobileDashboard } from "@/components/dashboard/MobileDashboard";
import { VirtualizedMobilePatientList } from "@/components/mobile/VirtualizedMobilePatientList";
import {
  dashboardImportPatients,
  dashboardPatients3,
  dashboardPatients8,
  dashboardPatients20,
  makeDashboardTodosMap,
} from "@/test/dashboardRegressionFixtures";
import { PatientFilterType } from "@/constants/config";
import type { Patient } from "@/types/patient";
import type { MobileTab } from "@/components/layout";

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

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  window.dispatchEvent(new window.Event("resize"));
}

function isUserVisible(element: HTMLElement) {
  return (
    !element.hidden &&
    element.getAttribute("aria-hidden") !== "true" &&
    element.style.display !== "none" &&
    element.style.visibility !== "hidden"
  );
}

function buildDashboardValue({
  patients,
  filteredPatients = patients,
  mobileTab = "patients",
  selectedPatient = null,
  desktopSelectedPatientId = patients[0]?.id ?? null,
  setDesktopSelectedPatientId = () => {},
  searchQuery = "",
  setSearchQuery = () => {},
  filter = PatientFilterType.All,
  setFilter = () => {},
  onAddPatient = () => {},
  onRefetchPatients = () => {},
  patientListViewMode = "compact",
  setPatientListViewMode = () => {},
}: {
  patients: Patient[];
  filteredPatients?: Patient[];
  mobileTab?: MobileTab;
  selectedPatient?: Patient | null;
  desktopSelectedPatientId?: string | null;
  setDesktopSelectedPatientId?: (patientId: string | null) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  filter?: PatientFilterType;
  setFilter?: (filter: PatientFilterType) => void;
  onAddPatient?: () => void;
  onRefetchPatients?: () => void | Promise<void>;
  patientListViewMode?: "rich" | "compact";
  setPatientListViewMode?: (mode: "rich" | "compact") => void;
}) {
  return {
    user: { email: "clinician@example.test" },
    patients,
    filteredPatients,
    autotexts: [],
    templates: [],
    customDictionary: {},
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    selectedPatient,
    mobileTab,
    setMobileTab: () => {},
    lastSaved: new Date("2026-05-27T12:00:00.000Z"),
    patientListViewMode,
    setPatientListViewMode,
    onAddPatient,
    onAddPatientWithData: async () => {},
    onUpdatePatient: async () => {},
    onRemovePatient: async () => {},
    onDuplicatePatient: async () => {},
    onToggleCollapse: async () => {},
    onCollapseAll: async () => {},
    onClearAll: async () => {},
    onImportPatients: async () => {},
    onRefetchPatients,
    onAddAutotext: async () => true,
    onRemoveAutotext: async () => {},
    onAddTemplate: async () => true,
    onRemoveTemplate: async () => {},
    onImportDictionary: async () => true,
    onSignOut: () => {},
    onPatientSelect: () => {},
    desktopSelectedPatientId,
    setDesktopSelectedPatientId,
  };
}

function AppProviders({
  patients,
  filteredPatients = patients,
  mobileTab = "patients",
  selectedPatient = null,
  desktopSelectedPatientId = patients[0]?.id ?? null,
  setDesktopSelectedPatientId = () => {},
  searchQuery = "",
  setSearchQuery = () => {},
  filter = PatientFilterType.All,
  setFilter = () => {},
  onAddPatient = () => {},
  onRefetchPatients = () => {},
  patientListViewMode = "compact",
  setPatientListViewMode = () => {},
  children,
}: {
  patients: Patient[];
  filteredPatients?: Patient[];
  mobileTab?: MobileTab;
  selectedPatient?: Patient | null;
  desktopSelectedPatientId?: string | null;
  setDesktopSelectedPatientId?: (patientId: string | null) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  filter?: PatientFilterType;
  setFilter?: (filter: PatientFilterType) => void;
  onAddPatient?: () => void;
  onRefetchPatients?: () => void | Promise<void>;
  patientListViewMode?: "rich" | "compact";
  setPatientListViewMode?: (mode: "rich" | "compact") => void;
  children: React.ReactNode;
}) {
  const queryClient = React.useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }), []);

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
                      <DashboardProvider
                        {...buildDashboardValue({
                          patients,
                          filteredPatients,
                          mobileTab,
                          selectedPatient,
                          desktopSelectedPatientId,
                          setDesktopSelectedPatientId,
                          searchQuery,
                          setSearchQuery,
                          filter,
                          setFilter,
                          onAddPatient,
                          onRefetchPatients,
                          patientListViewMode,
                          setPatientListViewMode,
                        })}
                      >
                        <DashboardTodosProvider todosMap={makeDashboardTodosMap(patients)}>
                          {children}
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

describe("production dashboard roster regression harness", () => {
  it("renders sober zero-patient dashboard recovery actions", async () => {
    setViewport(1440, 900);
    let addPatientCalls = 0;

    render(
      <MemoryRouter>
        <AppProviders patients={[]} onAddPatient={() => addPatientCalls += 1}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    assert.ok(await screen.findByRole("heading", { name: "Ready to Start Rounds" }));
    assert.ok(screen.getByText("No patients on your roster yet"));
    assert.ok(screen.getByText("Add your first patient to begin documenting rounds with your team."));
    fireEvent.click(screen.getByRole("button", { name: "Add First Patient" }));
    assert.equal(addPatientCalls, 1);
    assert.ok(screen.getByRole("button", { name: "Import from CSV/EHR" }));
    assert.ok(screen.getByRole("button", { name: "Preview example structure" }));
  });

  it("renders filtered-empty dashboard recovery actions without losing the source roster", async () => {
    setViewport(1440, 900);
    let clearedSearch = "";
    let clearedFilter: PatientFilterType | null = null;

    render(
      <MemoryRouter>
        <AppProviders
          patients={dashboardPatients3}
          filteredPatients={[]}
          searchQuery="zz-no-match"
          setSearchQuery={(query) => {
            clearedSearch = query;
          }}
          filter={PatientFilterType.Filled}
          setFilter={(nextFilter) => {
            clearedFilter = nextFilter;
          }}
        >
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    assert.ok(await screen.findByRole("heading", { name: "No patients match your filter" }));
    assert.ok(screen.getByText("0 of 3 patients"));
    assert.ok(screen.getByText("Try adjusting your search or filter criteria."));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    assert.equal(clearedSearch, "");
    assert.equal(clearedFilter, PatientFilterType.All);
  });

  it("renders real VirtualizedPatientList with at least four user-visible desktop roster rows at 1440x900", async () => {
    setViewport(1440, 900);
    render(
      <AppProviders patients={dashboardPatients8}>
        <VirtualizedPatientList />
      </AppProviders>,
    );

    const rows = await screen.findAllByRole("button", { name: /^Select / });
    assert.equal(rows.filter(isUserVisible).length >= 4, true);
    assert.ok(screen.getByRole("button", { name: /Select Alex Morgan, A01/ }));
    assert.ok(screen.getByRole("button", { name: /Select Devon Rivera, A04/ }));
    assert.equal(screen.getByRole("button", { name: /Select Alex Morgan, A01/ }).getAttribute("aria-current"), "true");
  });

  it("shows documentation progress in roster rows and exposes an accessible section navigator", async () => {
    setViewport(1440, 900);
    render(
      <AppProviders patients={dashboardPatients8}>
        <VirtualizedPatientList />
      </AppProviders>,
    );

    const alexRow = await screen.findByRole("button", { name: /Select Alex Morgan, A01/ });
    assert.match(alexRow.textContent ?? "", /In progress/);
    assert.match(alexRow.textContent ?? "", /3\/5 sections/);

    const sectionNavigator = screen.getByRole("navigation", { name: "Documentation sections" });
    for (const sectionName of ["Summary", "Events", "Systems", "Results", "Medications"]) {
      const sectionButton = screen.getByRole("button", { name: sectionName });
      assert.equal(sectionNavigator.contains(sectionButton), true);
    }
    assert.match(sectionNavigator.textContent ?? "", /60% complete/);
  });

  it("renders real DesktopDashboard controls and production roster rows for a 20-patient desktop census", async () => {
    setViewport(1440, 900);
    render(
      <MemoryRouter>
        <AppProviders patients={dashboardPatients20}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    assert.ok(await screen.findByRole("textbox", { name: "Search patients" }));
    assert.ok(screen.getByRole("button", { name: "Filter and sort patients" }));
    assert.ok(screen.getByRole("button", { name: /Print/i }));

    const rows = screen.getAllByRole("button", { name: /^Select / });
    assert.equal(rows.filter(isUserVisible).length >= 4, true);
    assert.ok(screen.getByRole("button", { name: /Select Alex Morgan, A01/ }));
  });

  it("opens the AI command palette with selected non-first patient context", async () => {
    setViewport(1440, 900);
    render(
      <MemoryRouter>
        <AppProviders
          patients={dashboardPatients20}
          selectedPatient={dashboardPatients20[3]}
          desktopSelectedPatientId={dashboardPatients20[3].id}
        >
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    assert.equal(
      screen.getByRole("button", { name: /Select Devon Rivera, A04/ }).getAttribute("aria-current"),
      "true",
    );

    fireEvent.click(await screen.findByRole("button", { name: "AI" }));

    assert.ok(await screen.findByText("Draft note for Devon Rivera"));
    assert.ok(screen.getByText("Summarize Devon Rivera's overnight events"));
  });

  it("keeps the active roster row and patient workspace on the same patient", async () => {
    setViewport(1440, 900);

    function SelectionConsistencyHarness() {
      const [selectedId, setSelectedId] = React.useState<string | null>(dashboardPatients8[0].id);
      return (
        <AppProviders
          patients={dashboardPatients8}
          desktopSelectedPatientId={selectedId}
          setDesktopSelectedPatientId={setSelectedId}
        >
          <VirtualizedPatientList />
        </AppProviders>
      );
    }

    render(<SelectionConsistencyHarness />);

    const devonRow = await screen.findByRole("button", { name: /Select Devon Rivera, A04/ });
    fireEvent.click(devonRow);

    await waitFor(() => {
      assert.equal(devonRow.getAttribute("aria-current"), "true");
      assert.ok(screen.getByRole("article", { name: "Patient: Devon Rivera" }));
      assert.equal(screen.getByRole("textbox", { name: "Patient name" }).getAttribute("value"), "Devon Rivera");
      assert.equal(screen.getByRole("textbox", { name: "Bed or room number" }).getAttribute("value"), "A04");
    });

    assert.equal(
      screen.getByRole("button", { name: /Select Alex Morgan, A01/ }).hasAttribute("aria-current"),
      false,
    );
  });

  it("applies a desktop patient-list view change and preserves it across dashboard rerenders", async () => {
    setViewport(1440, 900);

    function ViewModeHarness() {
      const [viewMode, setViewMode] = React.useState<"rich" | "compact">("compact");
      const [revision, setRevision] = React.useState(0);
      return (
        <AppProviders
          patients={dashboardPatients8}
          patientListViewMode={viewMode}
          setPatientListViewMode={setViewMode}
        >
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Rerender dashboard {revision}
          </button>
          <DesktopDashboard />
        </AppProviders>
      );
    }

    render(
      <MemoryRouter>
        <ViewModeHarness />
      </MemoryRouter>,
    );

    const viewModeSelect = await screen.findByRole("combobox", { name: "Patient list view" });
    assert.equal(viewModeSelect.textContent?.trim(), "Compact");
    fireEvent.click(viewModeSelect);
    fireEvent.click(await screen.findByRole("option", { name: "Rich" }));
    await waitFor(() => assert.equal(screen.getByRole("combobox", { name: "Patient list view" }).textContent?.trim(), "Rich"));

    fireEvent.click(screen.getByRole("button", { name: /Rerender dashboard/ }));
    assert.equal(screen.getByRole("combobox", { name: "Patient list view" }).textContent?.trim(), "Rich");
  });

  it("keeps desktop roster rows visible and active-row accessibility stable after add/import/selection", async () => {
    setViewport(1440, 768);

    function StatefulRosterHarness() {
      const [patients, setPatients] = React.useState<Patient[]>(dashboardPatients8);
      const [selectedId, setSelectedId] = React.useState<string | null>(dashboardPatients8[0].id);
      const filteredPatients = patients;

      return (
        <AppProviders
          patients={patients}
          filteredPatients={filteredPatients}
          desktopSelectedPatientId={selectedId}
          setDesktopSelectedPatientId={setSelectedId}
        >
          <button type="button" onClick={() => setPatients((prev) => [...prev, dashboardPatients20[8]])}>
            Add fixture patient
          </button>
          <button type="button" onClick={() => setPatients(dashboardPatients20)}>
            Import fixture census
          </button>
          <VirtualizedPatientList />
        </AppProviders>
      );
    }

    render(<StatefulRosterHarness />);

    const visibleRosterRows = () =>
      screen.getAllByRole("button", { name: /^Select / }).filter(isUserVisible);

    assert.equal((await screen.findAllByRole("button", { name: /^Select / })).filter(isUserVisible).length >= 4, true);

    fireEvent.click(screen.getByRole("button", { name: "Add fixture patient" }));
    await waitFor(() => assert.equal(visibleRosterRows().length >= 4, true));

    fireEvent.click(screen.getByRole("button", { name: "Import fixture census" }));
    await waitFor(() => assert.equal(visibleRosterRows().length >= 4, true));

    const devonRow = screen.getByRole("button", { name: /Select Devon Rivera, A04/ });
    devonRow.focus();
    assert.equal(document.activeElement, devonRow);

    fireEvent.click(devonRow);
    await waitFor(() => {
      assert.equal(devonRow.getAttribute("aria-current"), "true");
    });
    assert.match(devonRow.className, /focus-visible:ring-2/);

    const patientListRegion = screen.getByRole("region", { name: /Patients \(\d+\)/ });
    assert.match(patientListRegion.className, /lg:h-full/);
    assert.doesNotMatch(patientListRegion.className, /100vh-14rem/);
    assert.equal(document.querySelectorAll("[data-anime-stagger-item]").length, 0);
  });

  it("names the target patient before confirming a desktop remove action", async () => {
    setViewport(1440, 768);
    render(
      <AppProviders patients={dashboardPatients8} desktopSelectedPatientId={dashboardPatients8[0].id}>
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Alex Morgan, A01/ }));

    const removeButton = screen.getAllByRole("button", { name: /remove/i }).find(isUserVisible);
    assert.ok(removeButton, "expected a visible remove button for the selected patient");
    fireEvent.click(removeButton);

    assert.ok(await screen.findByRole("alertdialog", { name: "Remove Patient" }));
    assert.ok(screen.getByText(/Remove Alex Morgan from rounds\?/));
    assert.ok(screen.getByRole("button", { name: "Cancel" }));
  });

  it("returns focus to the remove trigger after closing a representative confirmation dialog", async () => {
    setViewport(1440, 768);
    render(
      <AppProviders patients={dashboardPatients8} desktopSelectedPatientId={dashboardPatients8[0].id}>
        <VirtualizedPatientList />
      </AppProviders>,
    );

    assert.ok(await screen.findByRole("button", { name: /Select Alex Morgan, A01/ }));

    const removeButton = screen.getAllByRole("button", { name: /remove/i }).find(isUserVisible);
    assert.ok(removeButton, "expected a visible remove button for the selected patient");
    removeButton.focus();
    assert.equal(document.activeElement, removeButton);

    fireEvent.click(removeButton);
    assert.ok(await screen.findByRole("alertdialog", { name: "Remove Patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Radix restores focus from a zero-delay task after the portal unmounts.
    // Yield before asserting so Testing Library does not install a document-wide
    // MutationObserver while the focus scope is still tearing down.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(screen.queryByRole("alertdialog", { name: "Remove Patient" }), null);
    assert.equal(document.activeElement, removeButton);
  });

  it("exposes sync loading status while desktop patient refresh is in flight", async () => {
    setViewport(1440, 900);
    let resolveRefetch: (() => void) | undefined;
    const refetchPromise = new Promise<void>((resolve) => {
      resolveRefetch = resolve;
    });

    render(
      <MemoryRouter>
        <AppProviders patients={dashboardPatients3} onRefetchPatients={() => refetchPromise}>
          <DesktopDashboard />
        </AppProviders>
      </MemoryRouter>,
    );

    const retrySyncButton = await screen.findByRole("button", { name: "Retry sync and refresh patient list" });
    fireEvent.click(retrySyncButton);

    await waitFor(() => {
      assert.equal(retrySyncButton.getAttribute("aria-busy"), "true");
      assert.equal(retrySyncButton.hasAttribute("disabled"), true);
    });

    resolveRefetch?.();

    await waitFor(() => {
      assert.equal(retrySyncButton.getAttribute("aria-busy"), "false");
      assert.equal(retrySyncButton.hasAttribute("disabled"), false);
    });
  });

  it("renders real VirtualizedMobilePatientList with visible 20-patient rows at 375px width", async () => {
    setViewport(375, 812);
    const selected: Patient[] = [];
    render(
      <VirtualizedMobilePatientList
        patients={dashboardPatients20}
        onPatientSelect={(patient) => selected.push(patient)}
        onPatientDelete={() => {}}
        onPatientDuplicate={() => {}}
        searchQuery=""
        onAddPatient={() => {}}
        onOpenImport={() => {}}
        viewMode="compact"
      />,
    );

    assert.ok(await screen.findByText("Alex Morgan"));
    assert.ok(screen.getByText("A01"));
    const mobileList = screen.getByTestId("virtualized-mobile-patient-list");
    assert.equal(mobileList.style.height, "576px");
    assert.equal(mobileList.style.width, "100%");
    fireEvent.click(screen.getByText("Alex Morgan"));
    assert.equal(selected[0]?.id, "patient-01");
  });

  it("renders real MobileDashboard patient and add/import controls at 375px width", async () => {
    setViewport(375, 812);
    function StatefulMobileHarness() {
      const [mobileTab, setMobileTab] = React.useState<MobileTab>("patients");
      const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);
      const value = {
        ...buildDashboardValue({
          patients: dashboardPatients20,
          filteredPatients: dashboardPatients20,
          mobileTab,
          selectedPatient,
        }),
        setMobileTab,
        onPatientSelect: setSelectedPatient,
        onImportPatients: async (patients: unknown) => {
          assert.deepEqual(patients, dashboardImportPatients);
        },
      };
      const queryClient = React.useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }), []);

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
                          <DashboardProvider {...value}>
                            <DashboardTodosProvider todosMap={makeDashboardTodosMap(dashboardPatients20)}>
                              <MobileDashboard />
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

    render(<StatefulMobileHarness />);

    assert.ok(await screen.findByRole("button", { name: "Open patient search" }));
    assert.ok(screen.getByRole("button", { name: "Add patient" }));
    assert.ok(screen.getByRole("button", { name: "Patients, 20 total" }));
    assert.ok(screen.getByRole("combobox", { name: "Patient list view" }));
    assert.ok(screen.getByRole("combobox", { name: "Sort patients" }));
    assert.ok(screen.getByRole("button", { name: "Filled" }));
    assert.ok(screen.getByRole("button", { name: "Empty" }));
    const controls = screen.getByTestId("mobile-patient-controls");
    assert.ok(controls.className.includes("flex-wrap"));
    assert.ok(controls.className.includes("overflow-x-hidden"));
    assert.equal(controls.className.includes("overflow-x-auto"), false);
    assert.ok(screen.getByText("A01"));
    assert.ok(screen.getByText("Alex Morgan"));

    fireEvent.click(screen.getByText("Blair Patel"));
    assert.ok(await screen.findByRole("button", { name: /Back/i }));

    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      assert.ok(screen.getByRole("button", { name: "Import Epic Handoff - Upload PDF or paste handoff text" }));
    });
  });
});
