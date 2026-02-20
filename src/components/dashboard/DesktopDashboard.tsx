import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, LayoutGroup, useReducedMotion } from 'framer-motion';
import { fadeInDown, scaleIn, staggerContainer, staggerItem, transitions } from '@/lib/animations';
import { useSettings } from "@/contexts/SettingsContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { VirtualizedPatientList } from "./VirtualizedPatientList";
import { PrintExportModal } from "@/components/PrintExportModal";
import { AutotextManager } from "@/components/AutotextManager";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { SmartPatientImport } from "@/components/SmartPatientImport";
import { ChangeTrackingControls } from "@/components/ChangeTrackingControls";
import { IBCCPanel } from "@/components/ibcc";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GuidelinesPanel } from "@/components/guidelines";
import { PhraseManager } from "@/components/phrases";
import { SectionVisibilityPanel } from "@/components/SectionVisibilityPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesktopSpecialtySelector } from "@/components/settings/DesktopSpecialtySelector";
import { DesktopAIModelSettingsDialog } from "@/components/settings/DesktopAIModelSettingsDialog";
import { PatientNavigator } from "./PatientNavigator";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ClinicalRiskCalculator } from "@/components/ClinicalRiskCalculator";
import { LabTrendingPanel } from "@/components/LabTrendingPanel";
import { UnitCensusDashboard, CensusBadge } from "@/components/UnitCensusDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { BatchCourseGenerator } from "@/components/BatchCourseGenerator";
import { MultiPatientComparison } from "@/components/MultiPatientComparison";
import { ContextAwareHelp } from "@/components/ContextAwareHelp";
import { LiveRegion } from "@/components/LiveRegion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Plus,
  Printer,
  Download,
  Trash2,
  Search,
  Clock,
  Users,
  LogOut,
  Type,
  ArrowUpDown,
  ListTodo,
  FileText,
  ChevronsUpDown,
  Stethoscope,
} from "lucide-react";
import rollingRoundsLogo from "@/assets/rolling-rounds-logo.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Patient } from "@/types/patient";
import type { AutoText, Template } from "@/types/autotext";
import { PatientFilterType } from "@/constants/config";
import type { PatientTodo } from "@/types/todo";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export const DesktopDashboard = () => {
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
    onToggleCollapse,
    onCollapseAll,
    onClearAll,
    onImportPatients,
    onAddAutotext,
    onRemoveAutotext,
    onAddTemplate,
    onRemoveTemplate,
    onImportDictionary,
    onSignOut,
    lastSaved,
  } = useDashboard();
  const navigate = useNavigate();
  const { globalFontSize, setGlobalFontSize, todosAlwaysVisible, setTodosAlwaysVisible, sortBy, setSortBy } = useSettings();
  const changeTracking = useChangeTracking();

  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [showPhraseManager, setShowPhraseManager] = React.useState(false);
  const [showComparisonModal, setShowComparisonModal] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onAddPatient,
    onSearch: () => searchInputRef.current?.focus(),
    onCollapseAll,
    onPrint: () => setShowPrintModal(true),
  });

  const handlePrint = React.useCallback(() => {
    setShowPrintModal(true);
  }, []);

  const handleExport = React.useCallback(() => {
    const exportData = patients.map(p => ({
      name: p.name,
      bed: p.bed,
      clinicalSummary: p.clinicalSummary,
      intervalEvents: p.intervalEvents,
      systems: p.systems,
      createdAt: p.createdAt,
      lastModified: p.lastModified,
    }));
    const dataStr = JSON.stringify({ patients: exportData }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rounding-notes-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patients]);


  const handleClearAll = React.useCallback(() => {
    if (confirm('Clear all patients? This cannot be undone.')) {
      onClearAll();
    }
  }, [onClearAll]);

  const filterLabel = React.useMemo(() => {
    if (filter === PatientFilterType.Filled) {
      return "With notes";
    }
    if (filter === PatientFilterType.Empty) {
      return "Empty notes";
    }
    return "All patients";
  }, [filter]);

  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-background" id="main-content" role="main">
      {/* Header - Modern Glass Effect */}
      <motion.header
        className="sticky top-0 z-50 border-b border-border/20 bg-card/95 backdrop-blur-xl no-print"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.smooth}
      >
        <div className="container mx-auto px-fluid-md lg:px-fluid-lg h-14 flex items-center justify-between gap-fluid-sm">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative flex items-center justify-center h-8 w-8">
              <div className="absolute inset-0 bg-white/10 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-8 w-auto relative z-10" />
            </div>
            <div>
              <h1 className="text-fluid-sm font-semibold tracking-tight leading-none text-card-foreground">Rolling Rounds</h1>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase mt-0.5">Professional</p>
            </div>
          </div>

          {/* Center - Stats Pill */}
          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full text-xs font-medium text-card-foreground/70">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span className="text-card-foreground font-semibold">{patients.length}</span>
              <span>patients</span>
            </div>
            <div className="h-3 w-px bg-white/20" aria-hidden="true" />
            <OfflineIndicator />
            <div className="h-3 w-px bg-white/20" aria-hidden="true" />
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Right - Profile */}
          <div className="flex items-center gap-3">
            <PresenceIndicator />
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium leading-none text-card-foreground">{user.email}</p>
              <p className="text-[10px] text-card-foreground/50">Physician</p>
            </div>
            <ThemeToggle />
            <Button
              onClick={onSignOut}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-card-foreground/60 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Main Content Area - 3 Column Layout */}
      <div className="h-[calc(100vh-6rem)] w-full no-print">
        <ResizablePanelGroup direction="horizontal" className="h-full items-stretch">

          {/* COLUMN 1: Tools Dashboard */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-secondary/10 border-r border-border/20 flex flex-col">
            <ScrollArea className="flex-1 p-fluid-sm">
              <div className="space-y-6">

                {/* Global Tools Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Global Tools</h3>
                  <div className="space-y-2">
                    <UnitCensusDashboard patients={patients} />
                    <LabTrendingPanel patients={patients} />
                    <ContextAwareHelp />
                  </div>
                </div>

                {/* Patient Actions Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Patient Actions</h3>
                  <div className="space-y-2">
                    <Button onClick={onAddPatient} className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20">
                      <Plus className="h-4 w-4" /> Add Patient
                    </Button>
                    <SmartPatientImport onImportPatient={onAddPatientWithData} />
                    <EpicHandoffImport existingBeds={patients.map(p => p.bed)} onImportPatients={onImportPatients} />
                  </div>
                </div>

                {/* Clinical Intelligence Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Clinical Intelligence</h3>
                  <div className="space-y-2">
                    <ClinicalRiskCalculator />
                    <BatchCourseGenerator patients={patients} onUpdatePatient={onUpdatePatient} />
                  </div>
                </div>

                {/* Patient Navigator */}
                <div className="space-y-3 pt-4 border-t border-border/20">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Navigation</h3>
                  <PatientNavigator
                    onScrollToPatient={(id) => {
                      const element = document.getElementById(`patient-card-${id}`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                        setTimeout(() => element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 1000);
                      }
                    }}
                  />
                </div>
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border/30 hover:bg-primary/30 active:bg-primary transition-colors" />

          {/* COLUMN 2: Patient Workspace (Main) */}
          <ResizablePanel defaultSize={55} minSize={40} className="flex flex-col bg-background relative">
            <div className="p-fluid-md pb-0">
              <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between mb-Fluid-sm">
                {/* Search & Filter */}
                <div className="flex flex-1 gap-2.5 items-center w-full lg:w-auto">
                  <div className="relative flex-1 max-w-sm" role="search">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search patients... (Ctrl+K)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Search patients"
                      className="pl-10 h-9 bg-card/60 border-border/30 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/20 rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <LayoutGroup>
                    <div className="flex gap-0.5 p-0.5 bg-card/40 rounded-xl" role="group" aria-label="Filter patients">
                      {Object.values(PatientFilterType).map((f) => (
                        <Button
                          key={f}
                          variant={filter === f ? 'default' : 'ghost'}
                          onClick={() => setFilter(f)}
                          size="sm"
                          aria-pressed={filter === f}
                          className={`h-8 text-xs rounded-md relative ${filter === f ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {filter === f && (
                            <motion.div
                              layoutId="activeFilter"
                              className="absolute inset-0 bg-primary rounded-md"
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              style={{ zIndex: -1 }}
                            />
                          )}
                          {f === PatientFilterType.All ? 'All' : f === PatientFilterType.Filled ? 'With Notes' : 'Empty'}
                        </Button>
                      ))}
                    </div>
                  </LayoutGroup>

                  {/* Sort Control */}
                  <div className="flex items-center gap-1.5 bg-card/40 rounded-xl px-2">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'number' | 'room' | 'name')}>
                      <SelectTrigger className="w-28 h-8 bg-transparent border-0 text-xs shadow-none focus:ring-0" aria-label="Sort patients by">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Order Added</SelectItem>
                        <SelectItem value="room">Room</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                  <SectionVisibilityPanel />
                  <DesktopAIModelSettingsDialog />

                  {/* Tools Dropdown triggers that were top bar */}
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
                  <Button
                    onClick={() => setShowPhraseManager(true)}
                    variant="ghost"
                    size="sm"
                    aria-label="Manage clinical phrases"
                    className="gap-1.5 h-8 text-card-foreground/60 hover:text-card-foreground hover:bg-white/10"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline text-xs" aria-hidden="true">Phrases</span>
                  </Button>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between mt-2.5 text-[11px] text-muted-foreground/70 pb-3 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5 font-medium text-[11px] px-2 py-0.5 bg-card/40">
                    <Users className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                    {filteredPatients.length} of {patients.length}
                  </Badge>
                  {searchQuery && (
                    <Badge variant="outline" className="font-medium text-[11px] px-2 py-0.5">
                      Searching &ldquo;{searchQuery}&rdquo;
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" aria-hidden="true" />
                  <span>Synced {lastSaved.toLocaleTimeString()}</span>
                </div>
                <LiveRegion
                  message={
                    searchQuery
                      ? `Search results: ${filteredPatients.length} of ${patients.length} patients match "${searchQuery}"`
                      : `Showing ${filteredPatients.length} of ${patients.length} patients. Last synced ${lastSaved.toLocaleTimeString()}`
                  }
                />
              </div>
            </div>

            <ScrollArea className="flex-1 px-fluid-md pt-4 pb-12">
              {filteredPatients.length === 0 ? (
                <motion.div
                  className="flex flex-col items-center justify-center py-20 text-center"
                  variants={shouldReduceMotion ? undefined : scaleIn}
                  initial="hidden"
                  animate="visible"
                  transition={{ ...transitions.spring, delay: 0.15 }}
                >
                  <div className="mb-8 relative">
                    <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-150" />
                    <div className="relative bg-card rounded-3xl p-6 border border-border/20">
                      <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-16 w-auto mx-auto opacity-40" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">
                    {patients.length === 0 ? 'Ready to Start Rounds' : 'No patients match your filter'}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-8 max-w-xs leading-relaxed">
                    {patients.length === 0
                      ? 'Add your first patient to begin documenting rounds.'
                      : 'Try adjusting your search or filter criteria.'}
                  </p>
                  {patients.length === 0 && (
                    <Button onClick={onAddPatient} size="lg" className="gap-2 rounded-2xl shadow-md hover:shadow-lg bg-card text-card-foreground transition-shadow">
                      <Plus className="h-4 w-4" />
                      Add First Patient
                    </Button>
                  )}
                </motion.div>
              ) : (
                <VirtualizedPatientList />
              )}
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border/30 hover:bg-primary/30 active:bg-primary transition-colors" />

          {/* COLUMN 3: Clinical Reference */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-secondary/5 flex flex-col relative border-l border-border/20">
            <div className="absolute inset-0">
              <IBCCPanel />
            </div>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>

      <PrintExportModal
        open={showPrintModal}
        onOpenChange={setShowPrintModal}
        patients={filteredPatients}
        patientTodos={todosMap}
        onUpdatePatient={onUpdatePatient}
      />

      <MultiPatientComparison
        open={showComparisonModal}
        onOpenChange={setShowComparisonModal}
        patients={filteredPatients}
        todosMap={todosMap}
      />

      <PhraseManager
        open={showPhraseManager}
        onOpenChange={setShowPhraseManager}
      />

    </div >
  );
};
