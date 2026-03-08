import React, { useState, useCallback } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { useSettings } from "@/contexts/SettingsContext";
import { VirtualizedPatientList } from "./VirtualizedPatientList";
import { MobilePatientDetail } from "../mobile/MobilePatientDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, X, Filter, ArrowUpDown } from "lucide-react";
import { Patient } from "@/types/patient";
import { cn } from "@/lib/utils";

/**
 * TabletDashboard - Master-detail layout for tablets (768-1024px)
 * Left panel: Patient list (~40% width)
 * Right panel: Selected patient detail (~60% width)
 */
export function TabletDashboard() {
  const {
    patients,
    filteredPatients,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    onAddPatient,
    onUpdatePatient,
    onRemovePatient,
    onDuplicatePatient,
    autotexts,
  } = useDashboard();

  const { sortBy, setSortBy } = useSettings();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedPatient(null);
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Panel - Patient List */}
      <div className="w-[40%] min-w-[300px] max-w-[400px] border-r border-border flex flex-col bg-muted/20">
        {/* Header */}
        <div className="p-3 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-semibold">Patients</h1>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {filteredPatients.length}
              </span>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Filter Bar */}
          <div className="flex items-center gap-1 mt-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className="h-7 text-xs px-2"
            >
              All
            </Button>
            <Button
              variant={filter === "with-notes" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("with-notes")}
              className="h-7 text-xs px-2"
            >
              With Notes
            </Button>
            <Button
              variant={filter === "empty" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("empty")}
              className="h-7 text-xs px-2"
            >
              Empty
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddPatient}
              className="h-7 px-2"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Patient List */}
        <ScrollArea className="flex-1">
          <VirtualizedPatientList
            patients={filteredPatients}
            onSelectPatient={handleSelectPatient}
            selectedPatientId={selectedPatient?.id}
          />
        </ScrollArea>
      </div>
      
      {/* Right Panel - Patient Detail */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedPatient ? (
          <div className="flex-1 overflow-hidden">
            {/* Detail Header */}
            <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseDetail}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Close
                </Button>
                <span className="text-sm font-medium">{selectedPatient.name}</span>
                <span className="text-xs text-muted-foreground">• {selectedPatient.bed}</span>
              </div>
            </div>
            
            {/* Detail Content */}
            <ScrollArea className="flex-1">
              <MobilePatientDetail
                patient={selectedPatient}
                onBack={handleCloseDetail}
                onUpdate={onUpdatePatient}
                onRemove={onRemovePatient}
                onDuplicate={onDuplicatePatient}
                onPrint={() => {}}
                autotexts={autotexts}
              />
            </ScrollArea>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                Select a patient from the list
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                or add a new patient to get started
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
