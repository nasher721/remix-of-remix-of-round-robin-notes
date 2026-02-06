import { useState, useCallback } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { PrintExportModal } from "@/components/PrintExportModal";
import { AutotextManager } from "@/components/AutotextManager";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { IBCCPanel } from "@/components/ibcc";
import { GuidelinesPanel } from "@/components/guidelines";
import { PhraseManager } from "@/components/phrases";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Plus, ArrowUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useDashboard } from "@/contexts/DashboardContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PatientFilterType } from "@/constants/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mobile components
import { MobileNavBar, MobileHeader } from "@/components/layout";
import {
  VirtualizedMobilePatientList,
  MobilePatientDetail,
  MobileAddPanel,
  MobileSettingsPanel,
  MobileReferencePanel,
  MobileBatchCourseGenerator,
} from "@/components/mobile";

export const MobileDashboard = () => {
  const {
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
    lastSaved,
  } = useDashboard();

  const { globalFontSize, setGlobalFontSize, todosAlwaysVisible, setTodosAlwaysVisible, sortBy, setSortBy, showLabFishbones, setShowLabFishbones } = useSettings();
  const changeTracking = useChangeTracking();

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAutotextModal, setShowAutotextModal] = useState(false);
  const [showPhraseManager, setShowPhraseManager] = useState(false);
  const [showBatchCourse, setShowBatchCourse] = useState(false);

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

  const filterOptions = [
    { id: PatientFilterType.All, label: "All" },
    { id: PatientFilterType.Filled, label: "Filled" },
    { id: PatientFilterType.Empty, label: "Empty" },
  ];

  const lastSavedLabel = new Date(lastSaved).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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
                subtitle={`${filteredPatients.length} of ${patients.length} patients`}
                statusText="Synced"
                statusTone="success"
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
              <div className="sticky top-14 z-30 bg-background/90 backdrop-blur-xl border-b border-border/20">
                <div className="flex items-center justify-between px-4 py-1.5 text-[11px] text-muted-foreground/70">
                  <span>
                    {searchQuery ? `Results for "${searchQuery}"` : `${filteredPatients.length} of ${patients.length} patients`}
                  </span>
                  <span>Saved {lastSavedLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto scrollbar-thin">
                  <div className="flex items-center gap-1.5 bg-secondary/40 rounded-full px-2 py-0.5">
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as "number" | "room" | "name")}>
                      <SelectTrigger className="h-7 w-[110px] border-0 bg-transparent px-0 text-xs shadow-none focus:ring-0">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Order Added</SelectItem>
                        <SelectItem value="room">Room</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filterOptions.map((option) => (
                    <Button
                      key={option.id}
                      variant={filter === option.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setFilter(option.id)}
                      className={cn(
                        "h-7 rounded-full px-3 text-xs",
                        filter === option.id ? "shadow-sm" : "text-muted-foreground/70"
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
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
                  onAddPatient={handleAddPatient}
                  onOpenImport={() => setShowImportModal(true)}
                />
              </div>
              <Button
                onClick={handleAddPatient}
                className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg shadow-primary/20 z-40 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
                size="icon"
              >
                <Plus className="h-5 w-5" />
                <span className="sr-only">Add patient</span>
              </Button>
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
                  onOpenBatchCourse={() => setShowBatchCourse(true)}
                  userEmail={user.email}
                  todosAlwaysVisible={todosAlwaysVisible}
                  onTodosAlwaysVisibleChange={setTodosAlwaysVisible}
                  showLabFishbones={showLabFishbones}
                  onShowLabFishbonesChange={setShowLabFishbones}
                  patientCount={patients.length}
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

      <MobileBatchCourseGenerator
        patients={patients}
        onUpdatePatient={onUpdatePatient}
        open={showBatchCourse}
        onOpenChange={setShowBatchCourse}
      />

      <IBCCPanel />
      <GuidelinesPanel />
    </div>
  );
};
