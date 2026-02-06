import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { useChangeTracking } from "@/contexts/ChangeTrackingContext";
import { VirtualizedPatientList } from "./VirtualizedPatientList";
import { PrintExportModal } from "@/components/PrintExportModal";
import { AutotextManager } from "@/components/AutotextManager";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { SmartPatientImport } from "@/components/SmartPatientImport";
import { ChangeTrackingControls } from "@/components/ChangeTrackingControls";
import { IBCCPanel } from "@/components/ibcc";
import { GuidelinesPanel } from "@/components/guidelines";
import { PhraseManager } from "@/components/phrases";
import { SectionVisibilityPanel } from "@/components/SectionVisibilityPanel";
import { PatientNavigator } from "./PatientNavigator";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { DesignThemeToggle } from "@/components/DesignThemeToggle";
import { ClinicalRiskCalculator } from "@/components/ClinicalRiskCalculator";
import { LabTrendingPanel } from "@/components/LabTrendingPanel";
import { UnitCensusDashboard, CensusBadge } from "@/components/UnitCensusDashboard";
import { BatchCourseGenerator } from "@/components/BatchCourseGenerator";
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

interface DesktopDashboardProps {
  user: { email?: string };
  patients: Patient[];
  filteredPatients: Patient[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: PatientFilterType;
  setFilter: (filter: PatientFilterType) => void;
  autotexts: AutoText[];
  templates: Template[];
  customDictionary: Record<string, string>;
  todosMap: Record<string, PatientTodo[]>;
  onAddPatient: () => void;
  onAddPatientWithData: (data: Partial<Patient>) => Promise<void>;
  onUpdatePatient: (id: string, field: string, value: unknown) => void;
  onRemovePatient: (id: string) => void;
  onDuplicatePatient: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onCollapseAll: () => void;
  onClearAll: () => void;
  onImportPatients: (patients: Partial<Patient>[]) => Promise<void>;
  onAddAutotext: (shortcut: string, expansion: string, category: string) => Promise<boolean>;
  onRemoveAutotext: (shortcut: string) => Promise<void>;
  onAddTemplate: (name: string, content: string, category: string) => Promise<boolean>;
  onRemoveTemplate: (id: string) => Promise<void>;
  onImportDictionary: (entries: Record<string, string>) => Promise<boolean | void>;
  onSignOut: () => void;
  lastSaved: Date;
}

export const DesktopDashboard = ({
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
}: DesktopDashboardProps) => {
  const navigate = useNavigate();
  const { globalFontSize, setGlobalFontSize, todosAlwaysVisible, setTodosAlwaysVisible, sortBy, setSortBy, isMorrow } = useSettings();
  const changeTracking = useChangeTracking();

  const [showPrintModal, setShowPrintModal] = React.useState(false);
  const [showPhraseManager, setShowPhraseManager] = React.useState(false);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Modern Glass Effect */}
      <header className={"sticky top-0 z-50 border-b backdrop-blur-xl no-print " + (isMorrow ? "border-border/20 bg-card/95" : "border-border/30 bg-background/80")}>
        <div className="container mx-auto px-6 h-14 flex items-center justify-between gap-6">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative flex items-center justify-center h-8 w-8">
              <div className={"absolute inset-0 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity " + (isMorrow ? "bg-white/10" : "bg-primary/10")}></div>
              <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-8 w-auto relative z-10" />
            </div>
            <div>
              <h1 className={"text-base font-semibold tracking-tight leading-none " + (isMorrow ? "text-card-foreground" : "text-foreground")}>Rolling Rounds</h1>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase mt-0.5">Professional</p>
            </div>
          </div>

          {/* Center - Stats Pill */}
          <div className={"hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium " + (isMorrow ? "bg-white/10 text-card-foreground/70" : "bg-secondary/60 text-muted-foreground")}>
            <div className="flex items-center gap-1.5">
              <div className={"h-2 w-2 rounded-full animate-pulse " + (isMorrow ? "bg-emerald-400" : "bg-primary")} />
              <span className={(isMorrow ? "text-card-foreground" : "text-foreground") + " font-semibold"}>{patients.length}</span>
              <span>patients</span>
            </div>
            <div className={"h-3 w-px " + (isMorrow ? "bg-white/20" : "bg-border")} />
            <OfflineIndicator />
            <div className={"h-3 w-px " + (isMorrow ? "bg-white/20" : "bg-border")} />
            <Clock className="h-3 w-3" />
            <span>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Right - Profile */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className={(isMorrow ? "text-xs font-medium leading-none text-card-foreground" : "text-xs font-medium leading-none text-foreground")}>{user.email}</p>
              <p className={(isMorrow ? "text-[10px] text-card-foreground/50" : "text-[10px] text-muted-foreground/70")}>Physician</p>
            </div>
            <Button
              onClick={onSignOut}
              variant="ghost"
              size="icon"
              className={"h-8 w-8 rounded-full transition-colors " + (isMorrow ? "text-card-foreground/60 hover:text-red-400 hover:bg-red-400/10" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10")}
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Action Bar - Streamlined Toolbar */}
      <div className={"border-b no-print " + (isMorrow ? "border-border/20 bg-card/60 backdrop-blur-sm" : "border-border/30 bg-secondary/30")}>
        <div className="container mx-auto px-6 py-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Primary Actions Group */}
            <div className={"flex items-center gap-1.5 p-1 shadow-sm border " + (isMorrow ? "bg-white/8 rounded-xl border-white/10" : "bg-background/80 rounded-lg border-border/40")}>
              <Button onClick={onAddPatient} size="sm" className={"gap-1.5 h-8 font-medium shadow-sm " + (isMorrow ? "bg-white text-card rounded-lg hover:bg-white/90 font-semibold" : "bg-primary text-primary-foreground hover:bg-primary-dark rounded-md")}>
                <Plus className="h-3.5 w-3.5" />
                Add Patient
              </Button>
              <div className="w-px h-5 bg-border/50" />
              <SmartPatientImport onImportPatient={onAddPatientWithData} />
              <EpicHandoffImport
                existingBeds={patients.map(p => p.bed)}
                onImportPatients={onImportPatients}
              />
            </div>

            {/* Clinical Tools Group */}
            <div className={"flex items-center gap-1.5 p-1 shadow-sm border " + (isMorrow ? "bg-white/8 rounded-xl border-white/10" : "bg-background/80 rounded-lg border-border/40")}>
              <div className={"flex items-center gap-1 px-2 " + (isMorrow ? "text-emerald-400" : "text-primary")}>
                <Stethoscope className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold hidden md:inline">Clinical</span>
              </div>
              <div className="w-px h-5 bg-border/40" />
              <UnitCensusDashboard patients={patients} />
              <LabTrendingPanel patients={patients} />
              <ClinicalRiskCalculator />
              <BatchCourseGenerator patients={patients} onUpdatePatient={onUpdatePatient} />
            </div>

            {/* Tools Group */}
            <div className="flex items-center gap-1.5">
              <ChangeTrackingControls
                enabled={changeTracking.enabled}
                color={changeTracking.color}
                styles={changeTracking.styles}
                onToggleEnabled={changeTracking.toggleEnabled}
                onColorChange={changeTracking.setColor}
                onToggleStyle={changeTracking.toggleStyle}
              />
              <div className="w-px h-5 bg-border/40" />
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
                className={"gap-1.5 h-8 " + (isMorrow ? "text-card-foreground/60 hover:text-card-foreground hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Phrases</span>
              </Button>
            </div>

            {/* View Options Group */}
            <div className="flex items-center gap-0.5 ml-auto">
              <Button
                onClick={onCollapseAll}
                variant="ghost"
                size="sm"
                className={"gap-1.5 h-8 " + (isMorrow ? "text-card-foreground/60 hover:text-card-foreground hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}
                disabled={patients.length === 0}
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                <span className="hidden lg:inline text-xs">
                  {patients.every(p => p.collapsed) ? 'Expand' : 'Collapse'}
                </span>
              </Button>
              <Button onClick={handlePrint} variant="ghost" size="sm" className={"gap-1.5 h-8 " + (isMorrow ? "text-card-foreground/60 hover:text-card-foreground hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden lg:inline text-xs">Print</span>
              </Button>
              <Button onClick={handleExport} variant="ghost" size="sm" className={"gap-1.5 h-8 " + (isMorrow ? "text-card-foreground/60 hover:text-card-foreground hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden lg:inline text-xs">Export</span>
              </Button>
              <div className="w-px h-4 bg-border/40 mx-0.5" />
              <DesignThemeToggle />
              <div className="w-px h-4 bg-border/40 mx-0.5" />
              <Button onClick={handleClearAll} variant="ghost" size="sm" className="gap-1.5 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden lg:inline text-xs">Clear</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filter & Settings Bar */}
      <div className="container mx-auto px-6 pt-4 pb-3 no-print">
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          {/* Search & Filter */}
          <div className="flex flex-1 gap-2.5 items-center w-full lg:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={"pl-10 h-9 border-border/30 focus-visible:ring-1 text-sm text-foreground placeholder:text-muted-foreground " + (isMorrow ? "bg-card/60 focus-visible:ring-white/30 focus-visible:border-white/20 rounded-xl" : "bg-secondary/40 focus-visible:ring-primary/30 focus-visible:border-primary/40 rounded-lg")}
              />
            </div>
            <div className={"flex gap-0.5 p-0.5 " + (isMorrow ? "bg-card/40 rounded-xl" : "bg-secondary/50 rounded-lg")}>
              {Object.values(PatientFilterType).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'ghost'}
                  onClick={() => setFilter(f)}
                  size="sm"
                  className={`h-8 text-xs rounded-md ${filter === f ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {f === PatientFilterType.All ? 'All' : f === PatientFilterType.Filled ? 'With Notes' : 'Empty'}
                </Button>
              ))}
            </div>

            {/* Sort Control */}
            <div className={"flex items-center gap-1.5 px-2 " + (isMorrow ? "bg-card/40 rounded-xl" : "bg-secondary/40 rounded-lg")}>
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'number' | 'room' | 'name')}>
                <SelectTrigger className="w-28 h-8 bg-transparent border-0 text-xs shadow-none focus:ring-0">
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
            {/* Font Size Control */}
            <div className={"flex items-center gap-2 px-3 py-1.5 " + (isMorrow ? "bg-card/40 rounded-xl" : "bg-secondary/40 rounded-lg")}>
              <Type className="h-3.5 w-3.5 text-muted-foreground/60" />
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded"
                  onClick={() => setGlobalFontSize(Math.max(10, globalFontSize - 2))}
                  disabled={globalFontSize <= 10}
                >
                  <span className="text-sm font-medium">-</span>
                </Button>
                <Slider
                  value={[globalFontSize]}
                  min={10}
                  max={24}
                  step={1}
                  className="w-16"
                  onValueChange={(v) => setGlobalFontSize(v[0])}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded"
                  onClick={() => setGlobalFontSize(Math.min(24, globalFontSize + 2))}
                  disabled={globalFontSize >= 24}
                >
                  <span className="text-sm font-medium">+</span>
                </Button>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60 w-7">{globalFontSize}px</span>
            </div>

            {/* Section Visibility Panel */}
            <SectionVisibilityPanel />

            {/* Todos Always Visible Toggle */}
            <Button
              variant={todosAlwaysVisible ? "default" : "ghost"}
              size="sm"
              onClick={() => setTodosAlwaysVisible(!todosAlwaysVisible)}
              className={`gap-1.5 h-8 text-xs ${!todosAlwaysVisible ? 'text-muted-foreground hover:text-foreground' : ''}`}
            >
              <ListTodo className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Todos</span>
            </Button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between mt-2.5 text-[11px] text-muted-foreground/70">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={"gap-1.5 font-medium text-[11px] px-2 py-0.5 " + (isMorrow ? "bg-card/40" : "bg-secondary/60")}>
              <Users className={"h-3 w-3 " + (isMorrow ? "text-emerald-400" : "text-primary")} />
              {filteredPatients.length} of {patients.length}
            </Badge>
            {searchQuery && (
              <Badge variant="outline" className="font-medium text-[11px] px-2 py-0.5">
                Searching &ldquo;{searchQuery}&rdquo;
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className={"w-1.5 h-1.5 rounded-full " + (isMorrow ? "bg-emerald-400" : "bg-success")} />
            <span>Synced {lastSaved.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Patient Cards */}
      <div className="container mx-auto px-6 pb-12 pr-16 transition-all duration-300">
        {filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-150" />
              <div className={"relative p-6 border " + (isMorrow ? "bg-card rounded-3xl border-border/20" : "bg-secondary/50 rounded-2xl border-border/30")}>
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
              <Button onClick={onAddPatient} size="lg" className={"gap-2 shadow-md hover:shadow-lg transition-shadow " + (isMorrow ? "rounded-2xl bg-card text-card-foreground" : "rounded-xl")}>
                <Plus className="h-4 w-4" />
                Add First Patient
              </Button>
            )}
          </div>
        ) : (
          <VirtualizedPatientList
            patients={filteredPatients}
            autotexts={autotexts}
            onUpdatePatient={onUpdatePatient}
            onRemovePatient={onRemovePatient}
            onDuplicatePatient={onDuplicatePatient}
            onToggleCollapse={onToggleCollapse}
          />
        )}
      </div>

      <PatientNavigator
        patients={filteredPatients}
        onScrollToPatient={(id) => {
          const element = document.getElementById(`patient-card-${id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Optional: Flash effect
            element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            setTimeout(() => element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 1000);
          }
        }}
      />

      <PrintExportModal
        open={showPrintModal}
        onOpenChange={setShowPrintModal}
        patients={filteredPatients}
        patientTodos={todosMap}
        onUpdatePatient={onUpdatePatient}
      />

      <PhraseManager
        open={showPhraseManager}
        onOpenChange={setShowPhraseManager}
      />

      {/* IBCC Clinical Reference Panel */}
      <IBCCPanel />

      {/* Clinical Guidelines Panel */}
      <GuidelinesPanel />
    </div>
  );
};
