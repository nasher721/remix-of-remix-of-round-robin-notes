import { useState, useEffect, useCallback } from "react";
import { Patient, SettingsType } from "@/types/patient";
import { PatientCard } from "@/components/PatientCard";
import { PrintExportModal } from "@/components/PrintExportModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Settings,
  Printer,
  Download,
  Upload,
  Trash2,
  Search,
  FileText,
  Clock,
  Users,
  Save
} from "lucide-react";

const defaultPatient: Omit<Patient, 'id'> = {
  name: '',
  bed: '',
  clinicalSummary: '',
  intervalEvents: '',
  systems: {
    neuro: '',
    cv: '',
    resp: '',
    renalGU: '',
    gi: '',
    endo: '',
    heme: '',
    infectious: '',
    skinLines: '',
    dispo: ''
  },
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  collapsed: false
};

const Index = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientIdCounter, setPatientIdCounter] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const { toast } = useToast();

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('medicalRoundingData');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setPatients(data.patients || []);
        setPatientIdCounter(data.patientIdCounter || 1);
        toast({
          title: "Data Loaded",
          description: "Your previous session has been restored.",
        });
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (patients.length > 0) {
      const saveData = {
        patients,
        patientIdCounter,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem('medicalRoundingData', JSON.stringify(saveData));
      setLastSaved(new Date());
    }
  }, [patients, patientIdCounter]);

  const addPatient = useCallback(() => {
    const newPatient: Patient = {
      ...defaultPatient,
      id: patientIdCounter,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    setPatients(prev => [...prev, newPatient]);
    setPatientIdCounter(prev => prev + 1);
    toast({
      title: "Patient Added",
      description: "New patient card created successfully.",
    });
  }, [patientIdCounter, toast]);

  const updatePatient = useCallback((id: number, field: string, value: any) => {
    setPatients(prev => prev.map(p => {
      if (p.id === id) {
        const updated: Patient = { ...p, lastModified: new Date().toISOString() };
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          if (parent === 'systems') {
            updated.systems = {
              ...p.systems,
              [child]: value
            };
          }
        } else {
          (updated as any)[field] = value;
        }
        return updated;
      }
      return p;
    }));
  }, []);

  const removePatient = useCallback((id: number) => {
    if (confirm('Remove this patient from rounds?')) {
      setPatients(prev => prev.filter(p => p.id !== id));
      toast({
        title: "Patient Removed",
        description: "Patient has been removed from rounds.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const duplicatePatient = useCallback((id: number) => {
    const patient = patients.find(p => p.id === id);
    if (patient) {
      const newPatient: Patient = {
        ...JSON.parse(JSON.stringify(patient)),
        id: patientIdCounter,
        name: patient.name + ' (Copy)',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      setPatients(prev => [...prev, newPatient]);
      setPatientIdCounter(prev => prev + 1);
      toast({
        title: "Patient Duplicated",
        description: "Patient card has been duplicated.",
      });
    }
  }, [patients, patientIdCounter, toast]);

  const toggleCollapse = useCallback((id: number) => {
    setPatients(prev => prev.map(p => 
      p.id === id ? { ...p, collapsed: !p.collapsed } : p
    ));
  }, []);

  const handlePrint = useCallback(() => {
    setShowPrintModal(true);
  }, []);

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify({ patients, patientIdCounter }, null, 2);
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
  }, [patients, patientIdCounter, toast]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            setPatients(data.patients || []);
            setPatientIdCounter(data.patientIdCounter || 1);
            toast({
              title: "Import Successful",
              description: "Data has been imported.",
            });
          } catch (error) {
            toast({
              title: "Import Failed",
              description: "Invalid file format.",
              variant: "destructive"
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [toast]);

  const clearAll = useCallback(() => {
    if (confirm('Clear all patients? This cannot be undone.')) {
      setPatients([]);
      setPatientIdCounter(1);
      localStorage.removeItem('medicalRoundingData');
      toast({
        title: "All Data Cleared",
        description: "All patient data has been removed.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const filteredPatients = patients.filter(patient => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      patient.name.toLowerCase().includes(searchLower) ||
      patient.bed.toLowerCase().includes(searchLower) ||
      patient.clinicalSummary.toLowerCase().includes(searchLower) ||
      patient.intervalEvents.toLowerCase().includes(searchLower);

    // Status filter
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
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-header text-white shadow-xl no-print">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                🏥 Patient Rounding Assistant
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full">Pro v2.0</span>
              </h1>
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
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={addPatient} className="bg-white text-primary hover:bg-white/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
            <Button onClick={handlePrint} variant="secondary" className="bg-success text-success-foreground hover:bg-success/90">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleExport} variant="secondary" className="bg-white/10 hover:bg-white/20">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleImport} variant="secondary" className="bg-white/10 hover:bg-white/20">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={clearAll} variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="container mx-auto px-4 py-4 no-print">
        <Card className="p-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span>Auto-save enabled</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last saved: {lastSaved.toLocaleTimeString()}
              </div>
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
          {filteredPatients.length === 0 ? (
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
            filteredPatients.map(patient => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onUpdate={updatePatient}
                onRemove={removePatient}
                onDuplicate={duplicatePatient}
                onToggleCollapse={toggleCollapse}
              />
            ))
          )}
        </div>
      </div>

      <PrintExportModal
        open={showPrintModal}
        onOpenChange={setShowPrintModal}
        patients={filteredPatients}
        onUpdatePatient={updatePatient}
      />
    </div>
  );
};

export default Index;
