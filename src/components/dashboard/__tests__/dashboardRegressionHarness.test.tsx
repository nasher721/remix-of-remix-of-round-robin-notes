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
  dashboardPatients8,
  dashboardPatients20,
  makeDashboardTodosMap,
} from "@/test/dashboardRegressionFixtures";
import { PatientFilterType } from "@/constants/config";
import type { Patient } from "@/types/patient";
import type { MobileTab } from "@/components/layout";

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
}: {
  patients: Patient[];
  filteredPatients?: Patient[];
  mobileTab?: MobileTab;
  selectedPatient?: Patient | null;
  desktopSelectedPatientId?: string | null;
  setDesktopSelectedPatientId?: (patientId: string | null) => void;
}) {
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
    selectedPatient,
    mobileTab,
    setMobileTab: () => {},
    lastSaved: new Date("2026-05-27T12:00:00.000Z"),
    patientListViewMode: "compact" as const,
    setPatientListViewMode: () => {},
    onAddPatient: () => {},
    onAddPatientWithData: async () => {},
    onUpdatePatient: () => {},
    onRemovePatient: () => {},
    onDuplicatePatient: () => {},
    onToggleCollapse: () => {},
    onCollapseAll: () => {},
    onClearAll: () => {},
    onImportPatients: async () => {},
    onRefetchPatients: () => {},
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
  children,
}: {
  patients: Patient[];
  filteredPatients?: Patient[];
  mobileTab?: MobileTab;
  selectedPatient?: Patient | null;
  desktopSelectedPatientId?: string | null;
  setDesktopSelectedPatientId?: (patientId: string | null) => void;
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
