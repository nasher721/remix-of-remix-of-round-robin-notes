import * as React from "react";
import { motion } from "framer-motion";
import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CommandCenterProvider } from "@/contexts/CommandCenterContext";
import { commandCenterPatients } from "@/data/commandCenterPatients";
import type { CommandCenterPatient, PatientStatus } from "@/types/command-center";
import type { Patient } from "@/types/patient";
import { LeftRail } from "./LeftRail";
import { TopCommandBar } from "./TopCommandBar";
import { PatientCardGrid } from "./PatientCardGrid";
import { AiReasoningPanel } from "./AiReasoningPanel";

interface CommandCenterDashboardProps {
  user: { email?: string };
  patients: Patient[];
  filteredPatients: Patient[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSignOut: () => void;
  lastSaved: Date;
}

const statusRotation: PatientStatus[] = ["stable", "watch", "critical"];

const toCommandCenterPatients = (patients: Patient[]): CommandCenterPatient[] => {
  if (!patients.length) {
    return commandCenterPatients;
  }
  return patients.map((patient, index) => {
    const status = statusRotation[index % statusRotation.length];
    return {
      id: patient.id,
      name: patient.name || "Unnamed",
      room: patient.bed || "ICU",
      status,
      ventilation: status === "critical" ? "AC/VC 45%" : status === "watch" ? "HFNC 40 L" : "Room air",
      neuroSummary: status === "critical" ? "Sedated, pupils reactive" : "Alert, oriented",
      activeProblems: ["Hemodynamics", "Respiratory", "Renal"],
      labs: [
        { name: "WBC", value: "13.4", trend: "up" },
        { name: "Cr", value: "1.3", trend: "flat" },
        { name: "Lactate", value: "2.1", trend: "down" },
      ],
      vitals: [
        { label: "MAP", value: "72", trend: "flat" },
        { label: "HR", value: "96", trend: "up" },
        { label: "SpO2", value: "95", trend: "flat" },
      ],
      imagingSummary: "CXR: stable",
      ordersDue: ["Re-evaluate sedation", "Daily CXR"],
      nursingAlerts: ["Pain 5/10", "Family update pending"],
      sparkline: [18, 20, 21, 19, 22, 23, 20, 19],
    };
  });
};

export const CommandCenterDashboard = ({
  user,
  patients,
  filteredPatients,
  searchQuery,
  setSearchQuery,
  onSignOut,
  lastSaved,
}: CommandCenterDashboardProps) => {
  const [railCollapsed, setRailCollapsed] = React.useState(false);
  const [unitFilter, setUnitFilter] = React.useState("ICU");
  const [shiftMode, setShiftMode] = React.useState<"day" | "night">("day");
  const [focusedIds, setFocusedIds] = React.useState<string[]>([]);
  const [primaryFocusId, setPrimaryFocusId] = React.useState<string | null>(null);

  const commandPatients = React.useMemo(
    () => toCommandCenterPatients(filteredPatients.length ? filteredPatients : patients),
    [filteredPatients, patients]
  );

  const toggleFocus = React.useCallback((id: string) => {
    setFocusedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((item) => item !== id);
        setPrimaryFocusId(next[0] ?? null);
        return next;
      }
      setPrimaryFocusId(id);
      return [...prev, id];
    });
  }, []);

  const clearFocus = React.useCallback(() => {
    setFocusedIds([]);
    setPrimaryFocusId(null);
  }, []);

  const focusedPatient = React.useMemo(() => {
    if (!primaryFocusId) {
      return null;
    }
    return commandPatients.find((patient) => patient.id === primaryFocusId) ?? null;
  }, [commandPatients, primaryFocusId]);

  return (
    <CommandCenterProvider
      value={{
        focusedIds,
        primaryFocusId,
        toggleFocus,
        clearFocus,
        setPrimaryFocusId,
      }}
    >
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="flex h-screen">
          <LeftRail
            collapsed={railCollapsed}
            onToggle={() => setRailCollapsed((prev) => !prev)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            unitFilter={unitFilter}
            onUnitFilterChange={setUnitFilter}
          />

          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="px-6 pt-6">
              <TopCommandBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onClearFocus={clearFocus}
                shiftMode={shiftMode}
                onShiftModeChange={setShiftMode}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Live Operations</p>
                  <h1 className="text-2xl font-semibold">Clinical Mission Control</h1>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="rounded-full bg-white/10 text-xs text-slate-200">
                    {commandPatients.length} active patients
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-white/20 text-xs text-slate-400">
                    {unitFilter} | {shiftMode} shift
                  </Badge>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />
                    Synced {lastSaved.toLocaleTimeString()}
                  </div>
                  <Button
                    onClick={onSignOut}
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full border border-white/10 bg-white/5 text-xs text-slate-200"
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Sign out
                  </Button>
                </div>
              </div>

              <motion.div
                layout
                className={cn("rounded-3xl border border-white/10 bg-white/5 p-4", railCollapsed && "mx-auto")}
              >
                <PatientCardGrid
                  patients={commandPatients}
                  focusedIds={focusedIds}
                  primaryFocusId={primaryFocusId}
                  onToggleFocus={toggleFocus}
                />
              </motion.div>
            </div>
          </main>

          <div className="hidden xl:flex xl:w-[360px]">
            <AiReasoningPanel focusedPatient={focusedPatient} />
          </div>
        </div>
      </div>
    </CommandCenterProvider>
  );
};
