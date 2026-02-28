import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { scaleIn, transitions } from "@/lib/animations";
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
import { DesktopSpecialtySelector } from "@/components/settings/DesktopSpecialtySelector";
import { DesktopAIModelSettingsDialog } from "@/components/settings/DesktopAIModelSettingsDialog";
import { PatientNavigator } from "./PatientNavigator";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ClinicalRiskCalculator } from "@/components/ClinicalRiskCalculator";
import { TimelineDialog } from "../tools/timeline/TimelineDialog";
import { LabTrendingPanel } from "@/components/LabTrendingPanel";
import { UnitCensusDashboard } from "@/components/UnitCensusDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { BatchCourseGenerator } from "@/components/BatchCourseGenerator";
import { MultiPatientComparison } from "@/components/MultiPatientComparison";
import { ContextAwareHelp } from "@/components/ContextAwareHelp";
import { LiveRegion } from "@/components/LiveRegion";
import { AICommandPalette, useAICommandPalette } from "@/components/tools/AICommandPalette";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Printer,
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
  Sparkles,
  ChevronDown,
} from "lucide-react";
import rollingRoundsLogo from "@/assets/rolling-rounds-logo.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PatientFilterType } from "@/constants/config";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

type UtilityPanel = "resources" | "tools" | "settings" | null;

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
  useChangeTracking();

  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [showPhraseManager, setShowPhraseManager] = React.useState(false);
  const [showComparisonModal, setShowComparisonModal] = React.useState(false);
  const [utilityPanel, setUtilityPanel] = React.useState<UtilityPanel>(null);
  const { isOpen: isAICommandPaletteOpen, setIsOpen: setAICommandPaletteOpen } = useAICommandPalette();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onAddPatient,
    onSearch: () => searchInputRef.current?.focus(),
    onCollapseAll,
    onPrint: () => setShowPrintModal(true),
  });

  const handleExport = React.useCallback(() => {
    const exportData = patients.map((p) => ({
      name: p.name,
      bed: p.bed,
      clinicalSummary: p.clinicalSummary,
      intervalEvents: p.intervalEvents,
      systems: p.systems,
      createdAt: p.createdAt,
      lastModified: p.lastModified,
    }));
    const dataStr = JSON.stringify({ patients: exportData }, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rounding-notes-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patients]);

  const handleClearAll = React.useCallback(() => {
    if (confirm("Clear all patients? This cannot be undone.")) {
      onClearAll();
    }
  }, [onClearAll]);

  const filterLabel = React.useMemo(() => {
    if (filter === PatientFilterType.Filled) return "With notes";
    if (filter === PatientFilterType.Empty) return "Empty notes";
    return "All patients";
  }, [filter]);

  const shouldReduceMotion = useReducedMotion();
  const utilityPanelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!utilityPanelRef.current?.contains(event.target as Node)) {
        setUtilityPanel(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUtilityPanel(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const todayLabel = React.useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    [],
  );

  return (
    <div className="min-h-screen bg-background" id="main-content" role="main">
      <motion.header
        className="sticky top-0 z-50 border-b border-border/20 bg-card/95 backdrop-blur-xl no-print"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.smooth}
      >
        <div className="container mx-auto px-fluid-md lg:px-fluid-lg h-14 flex items-center justify-between gap-fluid-sm">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/")}>
            <div className="relative flex items-center justify-center h-8 w-8">
              <div className="absolute inset-0 bg-white/10 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-8 w-auto relative z-10" />
            </div>
            <div>
              <h1 className="text-fluid-sm font-semibold tracking-tight leading-none text-card-foreground">Rolling Rounds</h1>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase mt-0.5">Professional</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-secondary text-secondary-foreground border border-border/40 rounded-full text-xs font-medium shadow-sm">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span className="text-card-foreground font-semibold">{patients.length}</span>
              <span>patients</span>
            </div>
            <div className="h-3 w-px bg-white/20" aria-hidden="true" />
            <OfflineIndicator />
            <div className="h-3 w-px bg-white/20" aria-hidden="true" />
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>{todayLabel}</span>
          </div>

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

      <div className="container mx-auto px-fluid-md lg:px-fluid-lg pt-4 pb-3 no-print">
        <div ref={utilityPanelRef} className="relative rounded-xl border border-border/30 bg-card/40 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={utilityPanel === "resources" ? "secondary" : "ghost"} size="sm" className="gap-1.5" onClick={() => setUtilityPanel((current) => current === "resources" ? null : "resources")}>
              <Stethoscope className="h-3.5 w-3.5" /> Resources <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant={utilityPanel === "tools" ? "secondary" : "ghost"} size="sm" className="gap-1.5" onClick={() => setUtilityPanel((current) => current === "tools" ? null : "tools")}>
              <Sparkles className="h-3.5 w-3.5" /> Tools <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant={utilityPanel === "settings" ? "secondary" : "ghost"} size="sm" className="gap-1.5" onClick={() => setUtilityPanel((current) => current === "settings" ? null : "settings")}>
              <Type className="h-3.5 w-3.5" /> Settings <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          {utilityPanel && (
            <div className="mt-3 rounded-lg border border-border/40 bg-background p-3 shadow-xl">
              {utilityPanel === "resources" && (
                <Tabs defaultValue="ibcc" className="w-full">
                  <TabsList className="mb-3">
                    <TabsTrigger value="ibcc">IBCC</TabsTrigger>
                    <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
                  </TabsList>
                  <TabsContent value="ibcc" className="m-0">
                    <div className="h-72 overflow-hidden rounded-md border border-border/30">
                      <IBCCPanel />
                    </div>
                  </TabsContent>
                  <TabsContent value="guidelines" className="m-0">
                    <div className="h-72 overflow-hidden rounded-md border border-border/30">
                      <GuidelinesPanel />
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {utilityPanel === "tools" && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Button onClick={onAddPatient} className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20">
                      <Plus className="h-4 w-4" /> Add Patient
                    </Button>
                    <SmartPatientImport onImportPatient={onAddPatientWithData} />
                    <EpicHandoffImport existingBeds={patients.map((p) => p.bed)} onImportPatients={onImportPatients} />
                    <Button onClick={() => setAICommandPaletteOpen(true)} className="w-full justify-start gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-600 dark:text-purple-400 hover:from-purple-500/20 hover:to-blue-500/20 border border-purple-500/20">
                      <Sparkles className="h-4 w-4" /> AI Assistant <span className="ml-auto text-xs opacity-60">⌘⇧A</span>
                    </Button>
                    <TimelineDialog />
                    <ClinicalRiskCalculator />
                  </div>
                  <div className="space-y-2">
                    <UnitCensusDashboard patients={patients} />
                    <LabTrendingPanel patients={patients} />
                    <ContextAwareHelp />
                    <BatchCourseGenerator patients={patients} onUpdatePatient={onUpdatePatient} />
                  </div>
                </div>
              )}

              {utilityPanel === "settings" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-md border border-border/40 p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Display</p>
                    <Button
                      variant={todosAlwaysVisible ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTodosAlwaysVisible((prev) => !prev)}
                      className="w-full gap-1.5"
                    >
                      <ListTodo className="h-3.5 w-3.5" /> Todos Always Visible
                    </Button>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Font size</span>
                        <span>{globalFontSize}%</span>
                      </div>
                      <Slider min={85} max={125} step={5} value={[globalFontSize]} onValueChange={(value) => setGlobalFontSize(value[0])} />
                    </div>
                  </div>
                  <div className="rounded-md border border-border/40 p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Workflow</p>
                    <DesktopSpecialtySelector />
                    <DesktopAIModelSettingsDialog />
                    <ChangeTrackingControls />
                  </div>
                  <div className="rounded-md border border-border/40 p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Authoring</p>
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
                    <Button onClick={() => setShowPhraseManager(true)} variant="outline" size="sm" className="w-full gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Manage Phrases
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-[calc(100vh-11.5rem)] w-full no-print pb-4">
        <div className="container mx-auto px-fluid-md lg:px-fluid-lg h-full">
          <div className="flex flex-col h-full bg-background relative z-10 shadow-lg ring-1 ring-border/20 rounded-xl">
            <div className="p-fluid-md pb-0">
              <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between mb-Fluid-sm">
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
                  <div className="flex gap-0.5 p-0.5 bg-card/40 rounded-xl" role="group" aria-label="Filter patients">
                    {Object.values(PatientFilterType).map((f) => (
                      <Button
                        key={f}
                        variant={filter === f ? "default" : "ghost"}
                        onClick={() => setFilter(f)}
                        size="sm"
                        aria-pressed={filter === f}
                        className={`h-8 text-xs rounded-md transition-all duration-200 ${filter === f ? "shadow-sm bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {f === PatientFilterType.All ? "All" : f === PatientFilterType.Filled ? "With Notes" : "Empty"}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 bg-card/40 rounded-xl px-2">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as "number" | "room" | "name")}>
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

                <div className="flex items-center gap-2">
                  <Button onClick={() => setShowComparisonModal(true)} variant="ghost" size="sm" className="gap-1.5 h-8 text-card-foreground/60 hover:text-card-foreground hover:bg-white/10">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline text-xs">Compare</span>
                  </Button>
                  <Button onClick={() => setShowPrintModal(true)} variant="ghost" size="sm" aria-label="Open print and export" className="gap-1.5 h-8 text-card-foreground/60 hover:text-card-foreground hover:bg-white/10">
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline text-xs" aria-hidden="true">Print / Export</span>
                  </Button>
                  <SectionVisibilityPanel />
                  {patients.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCollapseAll}
                      className="gap-1.5 h-8 text-card-foreground/60 hover:text-card-foreground hover:bg-white/10"
                      title={patients.every((p) => p.collapsed) ? "Expand All" : "Collapse All"}
                    >
                      <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden xl:inline text-xs">{patients.every((p) => p.collapsed) ? "Expand All" : "Collapse All"}</span>
                    </Button>
                  )}
                </div>
              </div>

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
                  <Badge variant="outline" className="font-medium text-[11px] px-2 py-0.5">{filterLabel}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" aria-hidden="true" />
                  <span>Synced {lastSaved.toLocaleTimeString()}</span>
                </div>
                <LiveRegion
                  message={
                    searchQuery
                      ? `Search results: ${filteredPatients.length} patient${filteredPatients.length === 1 ? "" : "s"} found.`
                      : `Showing ${filterLabel.toLowerCase()}: ${filteredPatients.length} patient${filteredPatients.length === 1 ? "" : "s"}.`
                  }
                  politeness="polite"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 px-fluid-md py-fluid-sm">
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
                    {patients.length === 0 ? "Ready to Start Rounds" : "No patients match your filter"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-8 max-w-xs leading-relaxed">
                    {patients.length === 0
                      ? "Add your first patient to begin documenting rounds."
                      : "Try adjusting your search or filter criteria."}
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
          </div>
        </div>
      </div>

      <Button
        onClick={() => setAICommandPaletteOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:opacity-90"
        aria-label="Open AI tools"
      >
        <Sparkles className="h-5 w-5" />
      </Button>

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

      <PhraseManager open={showPhraseManager} onOpenChange={setShowPhraseManager} />

      <AICommandPalette isOpen={isAICommandPaletteOpen} onOpenChange={setAICommandPaletteOpen} />
    </div>
  );
};
