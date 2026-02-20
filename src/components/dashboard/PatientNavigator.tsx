import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search, ChevronRight, User, Hash, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Patient } from "@/types/patient";
import { Input } from "@/components/ui/input";

import { useDashboard } from "@/contexts/DashboardContext";

interface PatientNavigatorProps {
    onScrollToPatient: (id: string) => void;
    className?: string;
}

export function PatientNavigator({ onScrollToPatient, className }: PatientNavigatorProps) {
    const { filteredPatients: patients } = useDashboard();
    const [isOpen, setIsOpen] = React.useState(true);
    const [filter, setFilter] = React.useState("");

    const filteredPatients = React.useMemo(() => {
        if (!filter) return patients;
        const lowerFilter = filter.toLowerCase();
        return patients.filter(
            (p) =>
                p.name.toLowerCase().includes(lowerFilter) ||
                p.bed.toLowerCase().includes(lowerFilter)
        );
    }, [patients, filter]);

    if (patients.length === 0) return null;

    return (
        <div
            className={cn(
                "fixed right-0 top-16 bottom-0 z-30 transition-all duration-300 ease-in-out border-l border-border/20 bg-card/95 backdrop-blur-xl shadow-lg flex flex-col no-print",
                isOpen ? "w-64" : "w-12",
                className
            )}
        >
            {/* Toggle Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="absolute -left-3 top-4 h-6 w-6 rounded-full bg-card border border-border/30 shadow-md z-50 hover:bg-white/10"
            >
                {isOpen ? <ChevronsRight className="h-3 w-3" /> : <ChevronsLeft className="h-3 w-3" />}
            </Button>

            {isOpen ? (
                <>
                    <div className="p-4 border-b border-border/20">
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <Hash className="h-4 w-4 text-card-foreground" />
                            Quick Jump
                        </h3>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Find patient..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="h-8 pl-8 text-xs bg-white/8 border-transparent focus:border-white/20 text-card-foreground placeholder:text-card-foreground/40"
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-2">
                        <div className="space-y-1">
                            {filteredPatients.map((patient) => (
                                <button
                                    key={patient.id}
                                    onClick={() => onScrollToPatient(patient.id)}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-white/8 transition-colors group flex items-center gap-3"
                                >
                                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/20 transition-colors">
                                        <span className="text-xs font-semibold text-card-foreground">{patient.bed.slice(0, 3)}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate leading-none mb-1">{patient.name || "Unnamed"}</p>
                                        <p className="text-[10px] text-card-foreground/50 truncate font-mono">{patient.bed}</p>
                                    </div>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                            {filteredPatients.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-xs">
                                    No matching patients
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="p-2 border-t border-border/20 text-[10px] text-center text-card-foreground/50 bg-white/[0.03]">
                        {filteredPatients.length} patients
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center pt-4 gap-4">
                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <Hash className="h-4 w-4 text-card-foreground" />
                    </div>
                    <div className="flex-1 w-full flex flex-col items-center gap-2">
                        {filteredPatients.slice(0, 8).map(p => (
                            <button
                                key={p.id}
                                onClick={() => onScrollToPatient(p.id)}
                                className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-[10px] font-medium text-card-foreground/50 hover:text-card-foreground transition-colors"
                                title={p.name}
                            >
                                {p.bed.slice(0, 2)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
