import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { scaleIn, transitions } from "@/lib/animations";
import { useSettings } from "@/contexts/SettingsContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useDashboardTodos } from "@/contexts/DashboardTodosContext";
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
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Printer,
  Search,
  Clock,
  Users,
  LogOut,
  ListTodo,
  FileText,
  ChevronsUpDown,
  Sparkles,
  ChevronDown,
  SlidersHorizontal,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectionVisibilityContent } from "@/components/SectionVisibilityPanel";
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
  const todosMap = useDashboardTodos();
  const navigate = useNavigate();
  const { globalFontSize, setGlobalFontSize, todosAlwaysVisible, setTodosAlwaysVisible, sortBy, setSortBy, editorToolbarMode, setEditorToolbarMode } = useSettings();
  const { enabled: ctEnabled, color: ctColor, styles: ctStyles, toggleEnabled: ctToggleEnabled, setColor: ctSetColor, toggleStyle: ctToggleStyle } = useChangeTracking();

  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [showPhraseManager, setShowPhraseManager] = React.useState(false);
  const [showComparisonModal, setShowComparisonModal] = React.useState(false);
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

  const [showClearAllDialog, setShowClearAllDialog] = React.useState(false);

  const handleClearAll = React.useCallback(() => {
    setShowClearAllDialog(true);
  }, []);

  const handleConfirmClearAll = React.useCallback(() => {
    onClearAll();
    setShowClearAllDialog(false);
  }, [onClearAll]);

  const filterLabel = React.useMemo(() => {
    if (filter === PatientFilterType.Filled) return "With notes";
    if (filter === PatientFilterType.Empty) return "Empty notes";
    return "All patients";
  }, [filter]);

  const shouldReduceMotion = useReducedMotion();

  const todayLabel = React.useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    [],
  );

  return (
    <div className="min-h-screen bg-background" id="main-content" role="main">
      <motion.header
        className="sticky top-0 z-50 isolate border-b border-border/20 bg-card/95 backdrop-blur-xl no-print shadow-card"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.smooth}
      >
        <div className="container mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors border border-primary/10">
                <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-5 w-auto" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-card-foreground group-hover:text-primary transition-colors hidden sm:block">Rolling Rounds</h1>
            </Link>
            <Button type="button" onClick={onAddPatient} size="sm" className="gap-1.5 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add patient
            </Button>
            <Button type="button" onClick={() => setShowPrintModal(true)} variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg text-xs font-medium border-border/60 hover:bg-secondary/60">
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print
            </Button>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg text-xs border border-border/30">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span className="font-medium text-card-foreground">{patients.length}</span>
            <span className="text-muted-foreground">patients</span>
            <span className="text-muted-foreground/60" aria-hidden="true">·</span>
            <OfflineIndicator />
            <span className="text-muted-foreground/60" aria-hidden="true">·</span>
            <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{todayLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <PresenceIndicator />
            <span className="text-xs text-muted-foreground truncate max-w-[140px] hidden sm:block" title={user.email}>{user.email}</span>
            <ThemeToggle />
            <Button type="button" onClick={onSignOut} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Sign out">
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 pt-4 pb-3 no-print relative z-0">
        <DesktopUtilityPanel
          patients={patients}
          autotexts={autotexts}
          templates={templates}
          customDictionary={customDictionary}
          todosMap={todosMap}
          todosAlwaysVisible={todosAlwaysVisible}
          globalFontSize={globalFontSize}
          setTodosAlwaysVisible={setTodosAlwaysVisible}
          setGlobalFontSize={setGlobalFontSize}
          editorToolbarMode={editorToolbarMode}
          setEditorToolbarMode={setEditorToolbarMode}
          ctEnabled={ctEnabled}
          ctColor={ctColor}
          ctStyles={ctStyles}
          ctToggleEnabled={ctToggleEnabled}
          ctSetColor={ctSetColor}
          ctToggleStyle={ctToggleStyle}
          onAddPatientWithData={onAddPatientWithData}
          onImportPatients={onImportPatients}
          onUpdatePatient={onUpdatePatient}
          onAddAutotext={onAddAutotext}
          onRemoveAutotext={onRemoveAutotext}
          onAddTemplate={onAddTemplate}
          onRemoveTemplate={onRemoveTemplate}
          onImportDictionary={onImportDictionary}
          onOpenPhraseManager={() => setShowPhraseManager(true)}
          onOpenAICommandPalette={() => setAICommandPaletteOpen(true)}
        />
      </div>

      <div className="h-[calc(100vh-11.5rem)] w-full no-print pb-4">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 h-full">
          <div className="flex flex-col h-full bg-background relative z-10 shadow-card border border-border/30 rounded-lg">
            <div className="p-4 md:p-6 pb-0">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4">
                <div className="relative flex-1 max-w-md" role="search">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search patients... (Ctrl+K)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search patients"
                    className="pl-10 h-9 bg-card/60 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-lg text-sm"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg border-border/60 text-muted-foreground hover:text-foreground">
                      <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                      Filters & actions
                      <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-modal">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Filter</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                      <DropdownMenuRadioItem value={PatientFilterType.All}>All patients</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value={PatientFilterType.Filled}>With notes</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value={PatientFilterType.Empty}>Empty notes</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Sort</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as "number" | "room" | "name")}>
                      <DropdownMenuRadioItem value="number">Order added</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="room">Room</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Sections</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-72 rounded-lg shadow-modal p-3" sideOffset={4}>
                        <SectionVisibilityContent />
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setShowComparisonModal(true); }}>
                      <Users className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                      Compare patients
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowPrintModal(true)}>
                      <Printer className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                      Print / Export
                    </DropdownMenuItem>
                    {patients.length > 0 && (
                      <DropdownMenuItem onClick={onCollapseAll}>
                        <ChevronsUpDown className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                        {patients.every((p) => p.collapsed) ? "Expand all" : "Collapse all"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground pb-3 border-b border-border/20">
                <span className="font-medium text-foreground/80">
                  {filteredPatients.length}{patients.length !== filteredPatients.length ? ` of ${patients.length}` : ""} patients
                  {searchQuery && <span className="text-muted-foreground font-normal"> · &ldquo;{searchQuery}&rdquo;</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" aria-hidden="true" />
                  Synced {lastSaved.toLocaleTimeString()}
                </span>
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

            <ScrollArea className="flex-1 px-4 md:px-6 py-4">
              {filteredPatients.length === 0 ? (
                <motion.div
                  className="flex flex-col items-center justify-center py-20 text-center"
                  variants={shouldReduceMotion ? undefined : scaleIn}
                  initial="hidden"
                  animate="visible"
                  transition={{ ...transitions.spring, delay: 0.15 }}
                >
                  <div className="mb-8 relative flex items-center justify-center">
                    <div className="bg-secondary/30 rounded-3xl p-8 border border-border shadow-sm">
                      <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-16 w-auto opacity-50" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold mb-2 text-foreground tracking-tight">
                    {patients.length === 0 ? "Ready to Start Rounds" : "No patients match your filter"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-8 max-w-xs leading-relaxed">
                    {patients.length === 0
                      ? "Add your first patient to begin documenting rounds with your team."
                      : "Try adjusting your search or filter criteria."}
                  </p>
                  {patients.length === 0 && (
                    <Button onClick={onAddPatient} size="lg" className="gap-2.5 rounded-2xl shadow-md hover:shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 px-6">
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
        className="fixed bottom-6 right-6 z-50 h-13 w-13 rounded-2xl shadow-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500 text-white hover:shadow-violet-500/30 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 p-3"
        aria-label="Open AI tools"
        style={{ height: "3.25rem", width: "3.25rem" }}
      >
        <Sparkles className="h-5 w-5 drop-shadow" />
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

      <AICommandPalette open={isAICommandPaletteOpen} onOpenChange={setAICommandPaletteOpen} />

      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Patients</AlertDialogTitle>
            <AlertDialogDescription>
              Remove all patients from rounds? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface DesktopUtilityPanelProps {
  patients: ReturnType<typeof useDashboard>["patients"];
  autotexts: ReturnType<typeof useDashboard>["autotexts"];
  templates: ReturnType<typeof useDashboard>["templates"];
  customDictionary: ReturnType<typeof useDashboard>["customDictionary"];
  todosMap: ReturnType<typeof useDashboardTodos>;
  todosAlwaysVisible: boolean;
  globalFontSize: number;
  setTodosAlwaysVisible: (updater: (prev: boolean) => boolean) => void;
  setGlobalFontSize: (size: number) => void;
  editorToolbarMode: 'minimal' | 'full' | 'custom';
  setEditorToolbarMode: (mode: 'minimal' | 'full' | 'custom') => void;
  ctEnabled: boolean;
  ctColor: string;
  ctStyles: unknown;
  ctToggleEnabled: () => void;
  ctSetColor: (color: string) => void;
  ctToggleStyle: () => void;
  onAddPatientWithData: (data: unknown) => Promise<void> | void;
  onImportPatients: (patients: unknown) => Promise<void> | void;
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  onAddAutotext: ReturnType<typeof useDashboard>["onAddAutotext"];
  onRemoveAutotext: ReturnType<typeof useDashboard>["onRemoveAutotext"];
  onAddTemplate: ReturnType<typeof useDashboard>["onAddTemplate"];
  onRemoveTemplate: ReturnType<typeof useDashboard>["onRemoveTemplate"];
  onImportDictionary: ReturnType<typeof useDashboard>["onImportDictionary"];
  onOpenPhraseManager: () => void;
  onOpenAICommandPalette: () => void;
}

const DesktopUtilityPanel: React.FC<DesktopUtilityPanelProps> = ({
  patients,
  autotexts,
  templates,
  customDictionary,
  todosMap,
  todosAlwaysVisible,
  globalFontSize,
  setTodosAlwaysVisible,
  setGlobalFontSize,
  editorToolbarMode,
  setEditorToolbarMode,
  ctEnabled,
  ctColor,
  ctStyles,
  ctToggleEnabled,
  ctSetColor,
  ctToggleStyle,
  onAddPatientWithData,
  onImportPatients,
  onUpdatePatient,
  onAddAutotext,
  onRemoveAutotext,
  onAddTemplate,
  onRemoveTemplate,
  onImportDictionary,
  onOpenPhraseManager,
  onOpenAICommandPalette,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<UtilityPanel>("resources");
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={panelRef} className="relative rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm shadow-card overflow-hidden">
      <div className="flex items-center p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`gap-2 rounded-lg h-8 px-3 text-xs font-medium transition-all ${menuOpen ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Menu
          <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {menuOpen && (
        <div className="border-t border-border/40 bg-background p-3 shadow-modal rounded-b-lg">
          <Tabs value={activeTab ?? undefined} onValueChange={(v) => setActiveTab(v as UtilityPanel)} className="w-full">
            <TabsList className="mb-3 w-full grid grid-cols-3 rounded-lg bg-secondary/60 p-1">
              <TabsTrigger value="resources" className="rounded-md text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Resources</TabsTrigger>
              <TabsTrigger value="tools" className="rounded-md text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Tools</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-md text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="resources" className="m-0 mt-0">
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
            </TabsContent>

            <TabsContent value="tools" className="m-0 mt-0">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-1">Import & AI</p>
                <SmartPatientImport onImportPatient={onAddPatientWithData} />
                <EpicHandoffImport existingBeds={patients.map((p) => p.bed)} onImportPatients={onImportPatients} />
                <Button onClick={onOpenAICommandPalette} className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20">
                  <Sparkles className="h-4 w-4" /> AI Assistant <span className="ml-auto text-xs opacity-60">⌘⇧A</span>
                </Button>
                <TimelineDialog />
                <ClinicalRiskCalculator />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-1">Analytics</p>
                <UnitCensusDashboard patients={patients} />
                <LabTrendingPanel patients={patients} />
                <ContextAwareHelp />
                <BatchCourseGenerator patients={patients} onUpdatePatient={onUpdatePatient} todosMap={todosMap} />
              </div>
            </div>
            </TabsContent>

            <TabsContent value="settings" className="m-0 mt-0">
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
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Text box toolbar</p>
                  <select
                    value={editorToolbarMode}
                    onChange={(e) => setEditorToolbarMode(e.target.value as 'minimal' | 'full' | 'custom')}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Toolbar style for all text boxes"
                  >
                    <option value="minimal">Minimal (essential + More)</option>
                    <option value="full">Full</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="rounded-md border border-border/40 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Workflow</p>
                <DesktopSpecialtySelector />
                <DesktopAIModelSettingsDialog />
                <ChangeTrackingControls
                  enabled={ctEnabled}
                  color={ctColor}
                  styles={ctStyles}
                  onToggleEnabled={ctToggleEnabled}
                  onColorChange={ctSetColor}
                  onToggleStyle={ctToggleStyle}
                />
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
                <Button onClick={onOpenPhraseManager} variant="outline" size="sm" className="w-full gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Manage Phrases
                </Button>
              </div>
            </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};
