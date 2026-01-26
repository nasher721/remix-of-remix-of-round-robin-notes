import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search, ChevronRight, User, Hash, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Patient } from "@/types/patient";
import { Input } from "@/components/ui/input";

interface PatientNavigatorProps {
    patients: Patient[];
    onScrollToPatient: (id: string) => void;
    className?: string;
}

export function PatientNavigator({ patients, onScrollToPatient, className }: PatientNavigatorProps) {
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
                "fixed right-0 top-16 bottom-0 z-30 transition-all duration-300 ease-in-out border-l border-border/40 bg-background/80 backdrop-blur-xl shadow-lg flex flex-col no-print",
                isOpen ? "w-64" : "w-12",
                className
            )}
        >
            {/* Toggle Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="absolute -left-3 top-4 h-6 w-6 rounded-full bg-background border border-border shadow-sm z-50 hover:bg-secondary"
            >
                {isOpen ? <ChevronsRight className="h-3 w-3" /> : <ChevronsLeft className="h-3 w-3" />}
            </Button>

            {isOpen ? (
                <>
                    <div className="p-4 border-b border-border/40">
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <Hash className="h-4 w-4 text-primary" />
                            Quick Jump
                        </h3>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Find patient..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="h-8 pl-8 text-xs bg-secondary/50 border-transparent focus:border-primary/50"
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-2">
                        <div className="space-y-1">
                            {filteredPatients.map((patient) => (
                                <button
                                    key={patient.id}
                                    onClick={() => onScrollToPatient(patient.id)}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary/80 transition-colors group flex items-center gap-3"
                                >
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 group-hover:border-primary/20 transition-colors">
                                        <span className="text-xs font-semibold text-primary">{patient.bed.slice(0, 3)}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate leading-none mb-1">{patient.name || "Unnamed"}</p>
                                        <p className="text-[10px] text-muted-foreground truncate font-mono">{patient.bed}</p>
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
                    <div className="p-2 border-t border-border/40 text-[10px] text-center text-muted-foreground bg-secondary/20">
                        {filteredPatients.length} patients
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center pt-4 gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Hash className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 w-full flex flex-col items-center gap-2">
                        {filteredPatients.slice(0, 8).map(p => (
                            <button
                                key={p.id}
                                onClick={() => onScrollToPatient(p.id)}
                                className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
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
