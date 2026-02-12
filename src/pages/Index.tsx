import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePatients } from "@/hooks/usePatients";
import { useCloudAutotexts } from "@/hooks/useAutotexts";
import { useCloudDictionary } from "@/hooks/useCloudDictionary";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAllPatientTodos } from "@/hooks/useAllPatientTodos";
import { usePatientFilter } from "@/hooks/usePatientFilter";
import { useSettings } from "@/contexts/SettingsContext";
import { useIBCCState } from "@/contexts/IBCCContext";
import { ChangeTrackingProvider } from "@/contexts/ChangeTrackingContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DesktopDashboard, MobileDashboard } from "@/components/dashboard";
import { Loader2 } from "lucide-react";
import { PatientListSkeleton } from "@/components/PatientCardSkeleton";
import type { MobileTab } from "@/components/layout";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type { Patient } from "@/types/patient";
import Landing from "./Landing";

// Inner component that uses all contexts
function IndexContent(): React.ReactElement | null {
  useNetworkStatus();
  const isMobile = useIsMobile();
  const { setCurrentPatient } = useIBCCState();
  const { user, loading: authLoading, signOut } = useAuth();
  const { sortBy } = useSettings();
  const {
    patients,
    loading: patientsLoading,
    addPatient,
    addPatientWithData,
    updatePatient,
    removePatient,
    duplicatePatient,
    toggleCollapse,
    collapseAll,
    clearAll,
    importPatients
  } = usePatients();
  const { autotexts, templates, addAutotext, removeAutotext, addTemplate, removeTemplate } = useCloudAutotexts();
  const { customDictionary, importDictionary } = useCloudDictionary();

  // Fetch todos for all patients for print/export
  const patientIds = React.useMemo(() => patients.map(p => p.id), [patients]);
  const { todosMap } = useAllPatientTodos(patientIds);

  // Patient filtering and sorting
  const { searchQuery, setSearchQuery, filter, setFilter, filteredPatients } = usePatientFilter({
    patients,
    sortBy,
  });

  const [lastSaved, setLastSaved] = React.useState<Date>(new Date());

  // Mobile-specific state
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("patients");
  const [selectedPatient, setSelectedPatient] = React.useState<Patient | null>(null);

  const navigate = useNavigate();

  // Update last saved time when patients change
  React.useEffect(() => {
    if (patients.length > 0) {
      setLastSaved(new Date());
    }
  }, [patients]);

  // Get current patient for IBCC context - use selected patient on mobile or first filtered patient
  const currentPatient = React.useMemo(
    () => (isMobile && selectedPatient ? selectedPatient : (filteredPatients.length > 0 ? filteredPatients[0] : undefined)),
    [filteredPatients, isMobile, selectedPatient]
  );

  // Update IBCC context with current patient for context-aware suggestions
  React.useEffect(() => {
    setCurrentPatient(currentPatient);
  }, [currentPatient, setCurrentPatient]);

  const handleUpdatePatient = React.useCallback((id: string, field: string, value: unknown) => {
    updatePatient(id, field, value);
  }, [updatePatient]);

  const handleRemovePatient = React.useCallback((id: string) => {
    removePatient(id);
  }, [removePatient]);

  const handleDuplicatePatient = React.useCallback((id: string) => {
    duplicatePatient(id);
  }, [duplicatePatient]);

  const handleToggleCollapse = React.useCallback((id: string) => {
    toggleCollapse(id);
  }, [toggleCollapse]);

  const handleAddPatient = React.useCallback(() => {
    addPatient();
  }, [addPatient]);

  const handleSignOut = React.useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
    } finally {
      navigate("/auth");
    }
  }, [navigate, signOut]);

  // Build dashboard context value - must be before any conditional returns to satisfy Rules of Hooks
  const dashboardContextValue = React.useMemo(() => ({
    user,
    patients,
    filteredPatients,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    autotexts,
    templates,
    customDictionary,
    todosMap,
    onAddPatient: handleAddPatient,
    onAddPatientWithData: addPatientWithData,
    onUpdatePatient: handleUpdatePatient,
    onRemovePatient: handleRemovePatient,
    onDuplicatePatient: handleDuplicatePatient,
    onCollapseAll: collapseAll,
    onClearAll: clearAll,
    onImportPatients: importPatients,
    onAddAutotext: addAutotext,
    onRemoveAutotext: removeAutotext,
    onAddTemplate: addTemplate,
    onRemoveTemplate: removeTemplate,
    onImportDictionary: importDictionary,
    onSignOut: handleSignOut,
    onPatientSelect: setSelectedPatient,
    selectedPatient,
    mobileTab,
    setMobileTab,
    lastSaved,
  }), [
    user,
    patients,
    filteredPatients,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    autotexts,
    templates,
    customDictionary,
    todosMap,
    handleAddPatient,
    addPatientWithData,
    handleUpdatePatient,
    handleRemovePatient,
    handleDuplicatePatient,
    collapseAll,
    clearAll,
    importPatients,
    addAutotext,
    removeAutotext,
    addTemplate,
    removeTemplate,
    importDictionary,
    handleSignOut,
    setSelectedPatient,
    selectedPatient,
    mobileTab,
    setMobileTab,
    lastSaved,
  ]);

  if (authLoading || patientsLoading) {
    return (
      <div className="min-h-screen bg-background" role="status" aria-live="polite" aria-busy="true">
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-12 h-12">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl" />
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary relative" />
            </div>
            <div className="space-y-1">
              <p className="text-foreground text-sm font-medium">Loading workspace</p>
              <p className="text-muted-foreground/60 text-xs">Preparing your rounds...</p>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 pb-8">
          <PatientListSkeleton count={3} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <DashboardProvider {...dashboardContextValue}>
        <MobileDashboard />
      </DashboardProvider>
    );
  }

  // Desktop Layout
  return (
    <DesktopDashboard
      user={user}
      patients={patients}
      filteredPatients={filteredPatients}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      filter={filter}
      setFilter={setFilter}
      autotexts={autotexts}
      templates={templates}
      customDictionary={customDictionary}
      todosMap={todosMap}
      onAddPatient={handleAddPatient}
      onAddPatientWithData={addPatientWithData}
      onUpdatePatient={handleUpdatePatient}
      onRemovePatient={handleRemovePatient}
      onDuplicatePatient={handleDuplicatePatient}
      onToggleCollapse={handleToggleCollapse}
      onCollapseAll={collapseAll}
      onClearAll={clearAll}
      onImportPatients={importPatients}
      onAddAutotext={addAutotext}
      onRemoveAutotext={removeAutotext}
      onAddTemplate={addTemplate}
      onRemoveTemplate={removeTemplate}
      onImportDictionary={importDictionary}
      onSignOut={handleSignOut}
      lastSaved={lastSaved}
    />
  );
}

// Wrap with ChangeTrackingProvider (SettingsProvider is now at App level)
function Index(): React.ReactElement {
  return (
    <ChangeTrackingProvider>
      <IndexContent />
    </ChangeTrackingProvider>
  );
}

export default Index;
