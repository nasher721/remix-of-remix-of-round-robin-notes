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
import { DesktopDashboard, MobileDashboard } from "@/components/dashboard";
import { Loader2 } from "lucide-react";
import type { MobileTab } from "@/components/layout";
import type { Patient } from "@/types/patient";

// Inner component that uses all contexts
function IndexContent(): React.ReactElement | null {
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

  // Redirect to auth if not logged in
  React.useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Update last saved time when patients change
  React.useEffect(() => {
    if (patients.length > 0) {
      setLastSaved(new Date());
    }
  }, [patients]);

  // Get current patient for IBCC context - use selected patient on mobile or first filtered patient
  const currentPatient = isMobile && selectedPatient ? selectedPatient : (filteredPatients.length > 0 ? filteredPatients[0] : undefined);
  
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || patientsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground text-sm">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <MobileDashboard
        user={user}
        patients={patients}
        filteredPatients={filteredPatients}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        autotexts={autotexts}
        templates={templates}
        customDictionary={customDictionary}
        todosMap={todosMap}
        onAddPatient={handleAddPatient}
        onAddPatientWithData={addPatientWithData}
        onUpdatePatient={handleUpdatePatient}
        onRemovePatient={handleRemovePatient}
        onDuplicatePatient={handleDuplicatePatient}
        onCollapseAll={collapseAll}
        onClearAll={clearAll}
        onImportPatients={importPatients}
        onAddAutotext={addAutotext}
        onRemoveAutotext={removeAutotext}
        onAddTemplate={addTemplate}
        onRemoveTemplate={removeTemplate}
        onImportDictionary={importDictionary}
        onSignOut={handleSignOut}
        onPatientSelect={setSelectedPatient}
        selectedPatient={selectedPatient}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
      />
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
