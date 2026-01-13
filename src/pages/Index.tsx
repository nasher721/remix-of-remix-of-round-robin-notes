import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePatients } from "@/hooks/usePatients";
import { useCloudAutotexts } from "@/hooks/useAutotexts";
import { PatientCard } from "@/components/PatientCard";
import { PrintExportModal } from "@/components/PrintExportModal";
import { AutotextManager } from "@/components/AutotextManager";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { IBCCPanel } from "@/components/ibcc";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Printer,
  Download,
  Trash2,
  Search,
  Clock,
  Users,
  LogOut,
  Loader2,
  Cloud,
  Type,
  ArrowUpDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { 
    patients, 
    loading: patientsLoading, 
    addPatient, 
    updatePatient, 
    removePatient, 
    duplicatePatient,
    toggleCollapse,
    clearAll,
    importPatients
  } = usePatients();
  const { autotexts, templates, addAutotext, removeAutotext, addTemplate, removeTemplate } = useCloudAutotexts();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [sortBy, setSortBy] = useState<'number' | 'room' | 'name'>(() => {
    const saved = localStorage.getItem('patientSortBy');
    return (saved as 'number' | 'room' | 'name') || 'number';
  });
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [globalFontSize, setGlobalFontSize] = useState(() => {
    const saved = localStorage.getItem('globalFontSize');
    return saved ? parseInt(saved, 10) : 14;
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  // Save font size preference
  useEffect(() => {
    localStorage.setItem('globalFontSize', String(globalFontSize));
  }, [globalFontSize]);

  // Save sort preference
  useEffect(() => {
    localStorage.setItem('patientSortBy', sortBy);
  }, [sortBy]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Update last saved time when patients change
  useEffect(() => {
    if (patients.length > 0) {
      setLastSaved(new Date());
    }
  }, [patients]);

  const handleUpdatePatient = useCallback((id: string, field: string, value: unknown) => {
    updatePatient(id, field, value);
  }, [updatePatient]);

  const handleRemovePatient = useCallback((id: string) => {
    if (confirm('Remove this patient from rounds?')) {
      removePatient(id);
    }
  }, [removePatient]);

  const handleDuplicatePatient = useCallback((id: string) => {
    duplicatePatient(id);
  }, [duplicatePatient]);

  const handleToggleCollapse = useCallback((id: string) => {
    toggleCollapse(id);
  }, [toggleCollapse]);

  const handlePrint = useCallback(() => {
    setShowPrintModal(true);
  }, []);

  const handleExport = useCallback(() => {
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
    toast({
      title: "Export Successful",
      description: "Data exported as JSON file.",
    });
  }, [patients, toast]);

  const handleClearAll = useCallback(() => {
    if (confirm('Clear all patients? This cannot be undone.')) {
      clearAll();
    }
  }, [clearAll]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const filteredPatients = patients
    .filter(patient => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        patient.name.toLowerCase().includes(searchLower) ||
        patient.bed.toLowerCase().includes(searchLower) ||
        patient.clinicalSummary.toLowerCase().includes(searchLower) ||
        patient.intervalEvents.toLowerCase().includes(searchLower);

      if (filter === 'filled') {
        const hasSomeContent = patient.clinicalSummary || patient.intervalEvents ||
          Object.values(patient.systems).some(v => v);
        return matchesSearch && hasSomeContent;
      } else if (filter === 'empty') {
        const isEmpty = !patient.clinicalSummary && !patient.intervalEvents &&
          !Object.values(patient.systems).some(v => v);
        return matchesSearch && isEmpty;
      }
      
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'room':
          return a.bed.localeCompare(b.bed, undefined, { numeric: true, sensitivity: 'base' });
        case 'name':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'number':
        default:
          return a.patientNumber - b.patientNumber;
      }
    });

  // Get current patient for IBCC context
  const currentPatient = filteredPatients.length > 0 ? filteredPatients[0] : undefined;

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

  return (
    <div className="min-h-screen bg-background">
      {/* Apple-style Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl no-print">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center gap-6">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏥</span>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">Patient Rounding</h1>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Center - Stats */}
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium text-foreground">{patients.length}</span>
                <span>patients</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-success" />
                <span>Synced</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <span>
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {/* Right - Sign Out */}
            <Button 
              onClick={handleSignOut} 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Action Bar */}
      <div className="border-b border-border bg-secondary/30 no-print">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Primary Actions */}
            <div className="flex items-center gap-2">
              <Button onClick={addPatient} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Patient
              </Button>
              <EpicHandoffImport 
                existingBeds={patients.map(p => p.bed)}
                onImportPatients={importPatients}
              />
              <div className="h-6 w-px bg-border mx-1" />
              <AutotextManager 
                autotexts={autotexts}
                templates={templates}
                onAddAutotext={addAutotext}
                onRemoveAutotext={removeAutotext}
                onAddTemplate={addTemplate}
                onRemoveTemplate={removeTemplate}
              />
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center gap-2">
              <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Print/Export</span>
              </Button>
              <Button onClick={handleExport} variant="ghost" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">JSON</span>
              </Button>
              <Button onClick={handleClearAll} variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
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
              {(['all', 'filled', 'empty'] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'ghost'}
                  onClick={() => setFilter(f)}
                  size="sm"
                  className={filter === f ? '' : 'text-muted-foreground hover:text-foreground'}
                >
                  {f === 'all' ? 'All' : f === 'filled' ? 'With Notes' : 'Empty'}
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
                onClick={() => setGlobalFontSize(prev => Math.max(10, prev - 2))}
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
                onClick={() => setGlobalFontSize(prev => Math.min(24, prev + 2))}
                disabled={globalFontSize >= 24}
              >
                <span className="text-lg font-medium">+</span>
              </Button>
            </div>
            <span className="text-xs font-mono text-muted-foreground w-8">{globalFontSize}px</span>
          </div>
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 bg-success rounded-full" />
          <Clock className="h-3 w-3" />
          <span>Last synced {lastSaved.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Patient Cards */}
      <div className="container mx-auto px-6 pb-12">
        <div className="space-y-4">
          {filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-6">
                <span className="text-3xl">🏥</span>
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
                <Button onClick={addPatient} size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Add First Patient
                </Button>
              )}
            </div>
          ) : (
            filteredPatients.map((patient, index) => (
              <div 
                key={patient.id} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <PatientCard
                  patient={patient}
                  onUpdate={handleUpdatePatient}
                  onRemove={handleRemovePatient}
                  onDuplicate={handleDuplicatePatient}
                  onToggleCollapse={handleToggleCollapse}
                  autotexts={autotexts}
                  globalFontSize={globalFontSize}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <PrintExportModal
        open={showPrintModal}
        onOpenChange={setShowPrintModal}
        patients={filteredPatients}
        onUpdatePatient={handleUpdatePatient}
      />

      {/* IBCC Clinical Reference Panel - wrapped in provider for context */}
      <IBCCProvider currentPatient={currentPatient}>
        <IBCCPanel />
      </IBCCProvider>
    </div>
  );
};

export default Index;
