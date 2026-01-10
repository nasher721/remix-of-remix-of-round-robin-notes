import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePatients, Patient } from "@/hooks/usePatients";
import { useCloudAutotexts } from "@/hooks/useAutotexts";
import { PatientCard } from "@/components/PatientCard";
import { PrintExportModal } from "@/components/PrintExportModal";
import { AutotextManager } from "@/components/AutotextManager";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  Type
} from "lucide-react";

// Convert database Patient to legacy format for PatientCard
const toLegacyPatient = (p: Patient) => ({
  id: p.patient_number,
  dbId: p.id,
  name: p.name,
  bed: p.bed,
  clinicalSummary: p.clinical_summary,
  intervalEvents: p.interval_events,
  systems: p.systems,
  createdAt: p.created_at,
  lastModified: p.last_modified,
  collapsed: p.collapsed,
});

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

  const handleUpdatePatient = useCallback((id: number, field: string, value: unknown) => {
    const patient = patients.find(p => p.patient_number === id);
    if (patient) {
      updatePatient(patient.id, field, value);
    }
  }, [patients, updatePatient]);

  const handleRemovePatient = useCallback((id: number) => {
    if (confirm('Remove this patient from rounds?')) {
      const patient = patients.find(p => p.patient_number === id);
      if (patient) {
        removePatient(patient.id);
      }
    }
  }, [patients, removePatient]);

  const handleDuplicatePatient = useCallback((id: number) => {
    const patient = patients.find(p => p.patient_number === id);
    if (patient) {
      duplicatePatient(patient.id);
    }
  }, [patients, duplicatePatient]);

  const handleToggleCollapse = useCallback((id: number) => {
    const patient = patients.find(p => p.patient_number === id);
    if (patient) {
      toggleCollapse(patient.id);
    }
  }, [patients, toggleCollapse]);

  const handlePrint = useCallback(() => {
    setShowPrintModal(true);
  }, []);

  const handleExport = useCallback(() => {
    const exportData = patients.map(p => ({
      name: p.name,
      bed: p.bed,
      clinicalSummary: p.clinical_summary,
      intervalEvents: p.interval_events,
      systems: p.systems,
      createdAt: p.created_at,
      lastModified: p.last_modified,
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

  const filteredPatients = patients.filter(patient => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      patient.name.toLowerCase().includes(searchLower) ||
      patient.bed.toLowerCase().includes(searchLower) ||
      patient.clinical_summary.toLowerCase().includes(searchLower) ||
      patient.interval_events.toLowerCase().includes(searchLower);

    if (filter === 'filled') {
      const hasSomeContent = patient.clinical_summary || patient.interval_events ||
        Object.values(patient.systems).some(v => v);
      return matchesSearch && hasSomeContent;
    } else if (filter === 'empty') {
      const isEmpty = !patient.clinical_summary && !patient.interval_events &&
        !Object.values(patient.systems).some(v => v);
      return matchesSearch && isEmpty;
    }
    
    return matchesSearch;
  });

  const legacyPatients = filteredPatients.map(toLegacyPatient);

  if (authLoading || patientsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-header text-white shadow-xl no-print">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                🏥 Patient Rounding Assistant
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full flex items-center gap-1">
                  <Cloud className="h-3 w-3" /> Cloud Sync
                </span>
              </h1>
              <p className="text-sm text-white/80 mt-1">{user.email}</p>
            </div>
            <div className="flex gap-4 text-sm items-center flex-wrap">
              <div className="flex items-center gap-2">
                📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-2">
                🕐 {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {patients.length} patient{patients.length !== 1 ? 's' : ''}
              </div>
              <Button onClick={handleSignOut} variant="secondary" size="sm" className="bg-white/10 hover:bg-white/20">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={addPatient} className="bg-white text-primary hover:bg-white/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
            <EpicHandoffImport 
              existingBeds={patients.map(p => p.bed)}
              onImportPatients={importPatients}
            />
            <AutotextManager 
              autotexts={autotexts}
              templates={templates}
              onAddAutotext={addAutotext}
              onRemoveAutotext={removeAutotext}
              onAddTemplate={addTemplate}
              onRemoveTemplate={removeTemplate}
            />
            <Button onClick={handlePrint} variant="secondary" className="bg-success text-success-foreground hover:bg-success/90">
              <Printer className="h-4 w-4 mr-2" />
              Print/Export
            </Button>
            <Button onClick={handleExport} variant="secondary" className="bg-white/10 hover:bg-white/20">
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button onClick={handleClearAll} variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </header>

      {/* Status Bar with Font Size Control */}
      <div className="container mx-auto px-4 py-4 no-print">
        <Card className="p-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span>Cloud sync enabled</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last synced: {lastSaved.toLocaleTimeString()}
              </div>
            </div>
            
            {/* Global Font Size Control */}
            <div className="flex items-center gap-3 bg-muted/50 px-3 py-2 rounded-lg">
              <Type className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Text Size:</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setGlobalFontSize(prev => Math.max(10, prev - 2))}
                disabled={globalFontSize <= 10}
              >
                <span className="text-lg font-bold">−</span>
              </Button>
              <Slider
                value={[globalFontSize]}
                min={10}
                max={24}
                step={1}
                className="w-24"
                onValueChange={(v) => setGlobalFontSize(v[0])}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setGlobalFontSize(prev => Math.min(24, prev + 2))}
                disabled={globalFontSize >= 24}
              >
                <span className="text-lg font-bold">+</span>
              </Button>
              <span className="text-sm font-mono w-10 text-center">{globalFontSize}px</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="container mx-auto px-4 py-4 no-print">
        <Card className="p-4">
          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients by name, bed, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={filter === 'filled' ? 'default' : 'outline'}
                onClick={() => setFilter('filled')}
                size="sm"
              >
                With Notes
              </Button>
              <Button
                variant={filter === 'empty' ? 'default' : 'outline'}
                onClick={() => setFilter('empty')}
                size="sm"
              >
                Empty
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Patient Cards */}
      <div className="container mx-auto px-4 pb-8">
        <div className="space-y-4">
          {legacyPatients.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🏥</div>
              <h3 className="text-2xl font-bold mb-2">
                {patients.length === 0 ? 'Ready to Start Rounds' : 'No patients match your filter'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {patients.length === 0 ? 'Add your first patient to begin' : 'Try adjusting your search or filter'}
              </p>
              {patients.length === 0 && (
                <Button onClick={addPatient}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Patient
                </Button>
              )}
            </Card>
          ) : (
            legacyPatients.map(patient => (
              <PatientCard
                key={patient.dbId}
                patient={patient}
                onUpdate={handleUpdatePatient}
                onRemove={handleRemovePatient}
                onDuplicate={handleDuplicatePatient}
                onToggleCollapse={handleToggleCollapse}
                autotexts={autotexts}
                globalFontSize={globalFontSize}
              />
            ))
          )}
        </div>
      </div>

      <PrintExportModal
        open={showPrintModal}
        onOpenChange={setShowPrintModal}
        patients={legacyPatients}
        onUpdatePatient={handleUpdatePatient}
      />
    </div>
  );
};

export default Index;
