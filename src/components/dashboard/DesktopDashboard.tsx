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
import { PhraseManager } from "@/components/phrases";
import { SectionVisibilityPanel } from "@/components/SectionVisibilityPanel";
import { PatientNavigator } from "./PatientNavigator";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { Button } from "@/components/ui/button";
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
  const { globalFontSize, setGlobalFontSize, todosAlwaysVisible, setTodosAlwaysVisible, sortBy, setSortBy } = useSettings();
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Modern Glass Effect */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl no-print shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between gap-6">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 group cursor-pointer hover:opacity-80 transition-opacity">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-colors"></div>
                <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-9 w-auto relative z-10" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight leading-none text-foreground">Rolling Rounds</h1>
                <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase mt-0.5">Professional Edition</p>
              </div>
            </div>
          </div>

          {/* Center - Stats Pill */}
          <div className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-secondary/50 rounded-full border border-border/50 text-xs font-medium text-muted-foreground shadow-sm">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">{patients.length}</span>
            <span className="mr-2">active</span>
            <div className="h-3 w-px bg-border/80" />
            <OfflineIndicator />
            <div className="h-3 w-px bg-border/80" />
            <Clock className="h-3.5 w-3.5 ml-1" />
            <span>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Right - Profile */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium leading-none text-foreground">{user.email}</p>
              <p className="text-[10px] text-muted-foreground">Physician</p>
            </div>
            <Button
              onClick={onSignOut}
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Action Bar - Clean Toolbar */}
      <div className="border-b border-border/40 bg-secondary/20 no-print py-3">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Primary Actions Group */}
            <div className="flex items-center gap-2 p-1 bg-background rounded-lg border border-border/60 shadow-sm">
              <Button onClick={onAddPatient} size="sm" className="gap-2 h-8 font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                Add Patient
              </Button>
              <div className="w-px h-5 bg-border mx-1 my-auto" />
              <SmartPatientImport onImportPatient={onAddPatientWithData} />
              <EpicHandoffImport
                existingBeds={patients.map(p => p.bed)}
                onImportPatients={onImportPatients}
              />
            </div>

            {/* Tools Group */}
            <div className="flex items-center gap-2">
              <ChangeTrackingControls
                enabled={changeTracking.enabled}
                color={changeTracking.color}
                styles={changeTracking.styles}
                onToggleEnabled={changeTracking.toggleEnabled}
                onColorChange={changeTracking.setColor}
                onToggleStyle={changeTracking.toggleStyle}
              />
              <div className="w-px h-5 bg-border mx-1" />
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
                className="gap-2 h-8 text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border/60"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Phrases</span>
              </Button>
            </div>

            {/* View Options Group */}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                onClick={onCollapseAll}
                variant="ghost"
                size="sm"
                className="gap-2 h-8 text-muted-foreground hover:text-foreground"
                disabled={patients.length === 0}
              >
                <ChevronsUpDown className="h-4 w-4" />
                <span className="hidden lg:inline">
                  {patients.every(p => p.collapsed) ? 'Expand All' : 'Collapse All'}
                </span>
              </Button>
              <Button onClick={handlePrint} variant="ghost" size="sm" className="gap-2 h-8 text-muted-foreground hover:text-foreground">
                <Printer className="h-4 w-4" />
                <span className="hidden lg:inline">Print</span>
              </Button>
              <Button onClick={handleExport} variant="ghost" size="sm" className="gap-2 h-8 text-muted-foreground hover:text-foreground">
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">Export</span>
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button onClick={handleClearAll} variant="ghost" size="sm" className="gap-2 h-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
                <span className="hidden lg:inline">Clear All</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filter & Settings Bar */}
      <div className="container mx-auto px-6 py-4 no-print">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Search & Filter */}
          <div className="flex flex-1 gap-3 items-center w-full lg:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-0 focus-visible:ring-1"
              />
            </div>
            <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
              {Object.values(PatientFilterType).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'ghost'}
                  onClick={() => setFilter(f)}
                  size="sm"
                  className={filter === f ? '' : 'text-muted-foreground hover:text-foreground'}
                >
                  {f === PatientFilterType.All ? 'All' : f === PatientFilterType.Filled ? 'With Notes' : 'Empty'}
                </Button>
              ))}
            </div>

            {/* Sort Control */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'number' | 'room' | 'name')}>
                <SelectTrigger className="w-32 h-9 bg-secondary/50 border-0">
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

          {/* Font Size Control */}
          <div className="flex items-center gap-3 px-4 py-2 bg-secondary/50 rounded-lg">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Size</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setGlobalFontSize(Math.max(10, globalFontSize - 2))}
                disabled={globalFontSize <= 10}
              >
                <span className="text-lg font-medium">−</span>
              </Button>
              <Slider
                value={[globalFontSize]}
                min={10}
                max={24}
                step={1}
                className="w-20"
                onValueChange={(v) => setGlobalFontSize(v[0])}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setGlobalFontSize(Math.min(24, globalFontSize + 2))}
                disabled={globalFontSize >= 24}
              >
                <span className="text-lg font-medium">+</span>
              </Button>
            </div>
            <span className="text-xs font-mono text-muted-foreground w-8">{globalFontSize}px</span>
          </div>

          {/* Section Visibility Panel */}
          <SectionVisibilityPanel />

          {/* Todos Always Visible Toggle */}
          <Button
            variant={todosAlwaysVisible ? "default" : "outline"}
            size="sm"
            onClick={() => setTodosAlwaysVisible(!todosAlwaysVisible)}
            className="gap-2"
          >
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Todos</span>
            <span className="text-xs">{todosAlwaysVisible ? "Visible" : "Hidden"}</span>
          </Button>
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 bg-success rounded-full" />
          <Clock className="h-3 w-3" />
          <span>Last synced {lastSaved.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Patient Cards */}
      <div className="container mx-auto px-6 pb-12 pr-16 transition-all duration-300">
        {filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6">
              <img src={rollingRoundsLogo} alt="Rolling Rounds" className="h-20 w-auto mx-auto opacity-50" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">
              {patients.length === 0 ? 'Ready to Start Rounds' : 'No patients match your filter'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {patients.length === 0
                ? 'Add your first patient to begin documenting rounds.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {patients.length === 0 && (
              <Button onClick={onAddPatient} size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
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
    </div>
  );
};
