import { useState, useCallback } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { PrintExportModal } from "@/components/PrintExportModal";
import { AutotextManager } from "@/components/AutotextManager";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { IBCCPanel } from "@/components/ibcc";
import { PhraseManager } from "@/components/phrases";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useDashboard } from "@/contexts/DashboardContext";

// Mobile components
import { MobileNavBar, MobileHeader } from "@/components/layout";
import {
  VirtualizedMobilePatientList,
  MobilePatientDetail,
  MobileAddPanel,
  MobileSettingsPanel,
  MobileReferencePanel,
} from "@/components/mobile";

export const MobileDashboard = () => {
  const {
    user,
    patients,
    filteredPatients,
    searchQuery,
    setSearchQuery,
    autotexts,
    templates,
    customDictionary,
    todosMap,
    onAddPatient,
    onAddPatientWithData,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    onCollapseAll,
    onClearAll,
    onImportPatients,
    onAddAutotext,
    onRemoveAutotext,
    onAddTemplate,
    onRemoveTemplate,
    onImportDictionary,
    onSignOut,
    onPatientSelect,
    selectedPatient,
    mobileTab,
    setMobileTab,
  } = useDashboard();

  const { globalFontSize, setGlobalFontSize, todosAlwaysVisible, setTodosAlwaysVisible, sortBy, setSortBy, showLabFishbones, setShowLabFishbones } = useSettings();
  const changeTracking = useChangeTracking();

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAutotextModal, setShowAutotextModal] = useState(false);
  const [showPhraseManager, setShowPhraseManager] = useState(false);

  const handlePrint = useCallback(() => {
    setShowPrintModal(true);
  }, []);

  const handleRemovePatient = useCallback((id: string) => {
    if (confirm('Remove this patient from rounds?')) {
      onRemovePatient(id);
    }
  }, [onRemovePatient]);

  const handleClearAll = useCallback(() => {
    if (confirm('Clear all patients? This cannot be undone.')) {
      onClearAll();
    }
  }, [onClearAll]);

  const handleAddPatient = useCallback(() => {
    onAddPatient();
    setMobileTab("patients");
  }, [onAddPatient, setMobileTab]);

  return (
    <div className="min-h-screen bg-background">
      {/* Patient Detail View */}
      {selectedPatient ? (
        <MobilePatientDetail
          patient={selectedPatient}
          onBack={() => onPatientSelect(null)}
          onUpdate={onUpdatePatient}
          onRemove={(id) => {
            handleRemovePatient(id);
            onPatientSelect(null);
          }}
          onDuplicate={onDuplicatePatient}
          onPrint={handlePrint}
          autotexts={autotexts}
          globalFontSize={globalFontSize}
          changeTracking={changeTracking}
          onNext={() => {
            const currentIndex = filteredPatients.findIndex(p => p.id === selectedPatient.id);
            if (currentIndex < filteredPatients.length - 1) {
              onPatientSelect(filteredPatients[currentIndex + 1]);
            }
          }}
          onPrevious={() => {
            const currentIndex = filteredPatients.findIndex(p => p.id === selectedPatient.id);
            if (currentIndex > 0) {
              onPatientSelect(filteredPatients[currentIndex - 1]);
            }
          }}
          hasNext={filteredPatients.findIndex(p => p.id === selectedPatient.id) < filteredPatients.length - 1}
          hasPrevious={filteredPatients.findIndex(p => p.id === selectedPatient.id) > 0}
        />
      ) : (
        <>
          {/* Tab Content */}
          {mobileTab === "patients" && (
            <>
              <MobileHeader
                title="Patient Rounding"
                subtitle="Synced"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                rightAction={
                  patients.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCollapseAll}
                      className="h-10 w-10"
                      title={patients.every(p => p.collapsed) ? 'Expand All' : 'Collapse All'}
                    >
                      <ChevronsUpDown className="h-5 w-5" />
                    </Button>
                  ) : undefined
                }
              />
              <div className="pb-mobile-nav">
                <VirtualizedMobilePatientList
                  patients={filteredPatients}
                  // Pass these for now as VirtualizedMobilePatientList still expects them, 
                  // but we should eventually refactor that too if consistent.
                  // Wait, VirtualizedMobilePatientList hasn't been context-ified yet.
                  // So we must pass props.
                  onPatientSelect={onPatientSelect}
                  onPatientDelete={handleRemovePatient}
                  onPatientDuplicate={onDuplicatePatient}
                  searchQuery={searchQuery}
                />
              </div>
            </>
          )}

          {mobileTab === "add" && (
            <>
              <MobileHeader title="Add Patients" showSearch={false} />
              <div className="pb-mobile-nav">
                <MobileAddPanel
                  onAddPatient={handleAddPatient}
                  onOpenImport={() => setShowImportModal(true)}
                  onSmartImport={onAddPatientWithData}
                />
              </div>
            </>
          )}

          {mobileTab === "reference" && (
            <>
              <MobileHeader title="Reference" showSearch={false} />
              <div className="pb-mobile-nav">
                <MobileReferencePanel />
              </div>
            </>
          )}

          {mobileTab === "settings" && (
            <>
              <MobileHeader title="Settings" showSearch={false} />
              <div className="pb-mobile-nav">
                <MobileSettingsPanel
                  globalFontSize={globalFontSize}
                  onFontSizeChange={setGlobalFontSize}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  changeTracking={changeTracking}
                  onSignOut={onSignOut}
                  onOpenPrint={handlePrint}
                  onClearAll={handleClearAll}
                  onOpenAutotexts={() => setShowAutotextModal(true)}
                  onOpenPhrases={() => setShowPhraseManager(true)}
                  userEmail={user.email}
                  todosAlwaysVisible={todosAlwaysVisible}
                  onTodosAlwaysVisibleChange={setTodosAlwaysVisible}
                  showLabFishbones={showLabFishbones}
                  onShowLabFishbonesChange={setShowLabFishbones}
                />
              </div>
            </>
          )}

          {/* Bottom Navigation */}
          <MobileNavBar
            activeTab={mobileTab}
            onTabChange={setMobileTab}
            patientCount={patients.length}
          />
        </>
      )}

      {/* Modals */}
      <PrintExportModal
        open={showPrintModal}
        onOpenChange={setShowPrintModal}
        patients={filteredPatients}
        patientTodos={todosMap}
        onUpdatePatient={onUpdatePatient}
      />

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <EpicHandoffImport
            existingBeds={patients.map(p => p.bed)}
            onImportPatients={async (importedPatients) => {
              await onImportPatients(importedPatients);
              setShowImportModal(false);
              setMobileTab("patients");
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showAutotextModal} onOpenChange={setShowAutotextModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <AutotextManager
            autotexts={autotexts}
            templates={templates}
            customDictionary={customDictionary}
            onAddAutotext={onAddAutotext}
            onRemoveAutotext={onRemoveAutotext}
            onAddTemplate={onAddTemplate}
            onRemoveTemplate={onRemoveTemplate}
            onImportDictionary={onImportDictionary}
          />
        </DialogContent>
      </Dialog>

      <PhraseManager
        open={showPhraseManager}
        onOpenChange={setShowPhraseManager}
      />

      <IBCCPanel />
    </div>
  );
};

