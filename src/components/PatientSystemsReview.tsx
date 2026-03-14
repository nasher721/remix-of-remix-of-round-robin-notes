import * as React from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Settings2 } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { FieldTimestamp } from "./FieldTimestamp";
import { PatientTodos } from "./PatientTodos";
import type { Patient, PatientSystems } from "@/types/patient";
import type { AutoText } from "@/types/autotext";
import type { PatientTodo, TodoSection } from "@/types/todo";
import type { ChangeTrackingContextValue } from "@/types/changeTracking";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";

interface PatientSystemsReviewProps {
    patient: Patient;
    todos: PatientTodo[];
    generating: boolean;
    autotexts?: AutoText[];
    globalFontSize: number;
    changeTracking: ChangeTrackingContextValue | null;
    onUpdate: (id: string, field: string, value: unknown) => void;
    addTodo: (text: string, section?: string | null) => Promise<PatientTodo | undefined>;
    toggleTodo: (id: string) => Promise<void>;
    deleteTodo: (id: string) => Promise<void>;
    generateTodos: (section?: string | null) => Promise<void>;
    onClearAll: () => void;
    onOpenConfig: () => void;
}

// Clinical system color palette — maps system keys to a subtle accent color
const SYSTEM_ACCENT: Record<string, { bg: string; border: string; dot: string }> = {
    neuro:      { bg: "bg-purple-500/8 dark:bg-purple-500/12",  border: "border-purple-500/20", dot: "bg-purple-400" },
    cv:         { bg: "bg-rose-500/8 dark:bg-rose-500/12",      border: "border-rose-500/20",   dot: "bg-rose-400" },
    resp:       { bg: "bg-sky-500/8 dark:bg-sky-500/12",        border: "border-sky-500/20",    dot: "bg-sky-400" },
    renal:      { bg: "bg-blue-500/8 dark:bg-blue-500/12",      border: "border-blue-500/20",   dot: "bg-blue-400" },
    gi:         { bg: "bg-amber-500/8 dark:bg-amber-500/12",    border: "border-amber-500/20",  dot: "bg-amber-400" },
    endo:       { bg: "bg-orange-500/8 dark:bg-orange-500/12",  border: "border-orange-500/20", dot: "bg-orange-400" },
    heme:       { bg: "bg-red-500/8 dark:bg-red-500/12",        border: "border-red-500/20",    dot: "bg-red-400" },
    id:         { bg: "bg-green-500/8 dark:bg-green-500/12",    border: "border-green-500/20",  dot: "bg-green-400" },
    skin:       { bg: "bg-teal-500/8 dark:bg-teal-500/12",      border: "border-teal-500/20",   dot: "bg-teal-400" },
    dispo:      { bg: "bg-indigo-500/8 dark:bg-indigo-500/12",  border: "border-indigo-500/20", dot: "bg-indigo-400" },
    // fallback for custom systems
    default:    { bg: "bg-secondary/30",                         border: "border-border/50",     dot: "bg-primary/60" },
};

const getAccent = (key: string) => SYSTEM_ACCENT[key] ?? SYSTEM_ACCENT.default;

export const PatientSystemsReview = ({
    patient,
    todos,
    generating,
    autotexts,
    globalFontSize,
    changeTracking,
    onUpdate,
    addTodo,
    toggleTodo,
    deleteTodo,
    generateTodos,
    onClearAll,
    onOpenConfig
}: PatientSystemsReviewProps) => {
    const { enabledSystems } = useSystemsConfig();

    const hasSystemContent = (key: string) => {
        return Boolean(patient.systems[key as keyof PatientSystems]);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
                        <span className="text-[13px] leading-none" aria-hidden="true">⚕️</span>
                    </div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-card-foreground/70">Systems Review</h3>
                </div>
                <div className="flex gap-1 no-print">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearAll}
                        className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        title="Clear all systems"
                    >
                        <Eraser className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">Clear All</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onOpenConfig}
                        className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg"
                        title="Customize systems"
                    >
                        <Settings2 className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">Customize</span>
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {enabledSystems.map((system) => {
                    const filled = hasSystemContent(system.key);
                    const accent = getAccent(system.key);
                    return (
                        <div
                            key={system.key}
                            className={`rounded-xl p-3 border transition-all duration-200 ${filled
                                ? `${accent.bg} ${accent.border} shadow-sm`
                                : 'bg-secondary/20 border-border/40 hover:border-border/60 hover:bg-secondary/30'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <label className={`text-xs font-semibold flex items-center gap-1.5 tracking-wide ${filled ? "text-foreground/80" : "text-muted-foreground"}`}>
                                    <span className="text-sm">{system.icon}</span>
                                    {system.label}
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <PatientTodos
                                        todos={todos}
                                        section={system.key}
                                        patient={patient}
                                        generating={generating}
                                        onAddTodo={addTodo}
                                        onToggleTodo={toggleTodo}
                                        onDeleteTodo={deleteTodo}
                                        onGenerateTodos={(_, section) => generateTodos(section)}
                                    />
                                    {filled && (
                                        <div className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} aria-label="Has content" />
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <RichTextEditor
                                    value={patient.systems[system.key as keyof PatientSystems] || ''}
                                    onChange={(value) => onUpdate(patient.id, `systems.${system.key}`, value)}
                                    placeholder={`${system.label}...`}
                                    minHeight="80px"
                                    autotexts={autotexts}
                                    fontSize={globalFontSize}
                                    changeTracking={changeTracking}
                                    patient={patient}
                                    section={system.key}
                                    popOutAvailable
                                />
                                <FieldTimestamp
                                    timestamp={patient.fieldTimestamps?.[`systems.${system.key}` as keyof typeof patient.fieldTimestamps]}
                                    className="pl-1"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
