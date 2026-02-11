import * as React from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Settings2 } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { FieldTimestamp } from "./FieldTimestamp";
import { PatientTodos } from "./PatientTodos";
import type { Patient, PatientSystems } from "@/types/patient";
import type { AutoText } from "@/types/autotext";
import type { PatientTodo, TodoSection } from "@/types/todo";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";

interface PatientSystemsReviewProps {
    patient: Patient;
    todos: PatientTodo[];
    generating: boolean;
    autotexts?: AutoText[];
    globalFontSize: number;
    changeTracking: any;
    onUpdate: (id: string, field: string, value: unknown) => void;
    addTodo: (text: string, section?: string | null) => Promise<PatientTodo | undefined>;
    toggleTodo: (id: string) => Promise<void>;
    deleteTodo: (id: string) => Promise<void>;
    generateTodos: (section?: string | null) => Promise<void>;
    onClearAll: () => void;
    onOpenConfig: () => void;
}

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
                    <span className="text-primary text-sm">⚕️</span>
                    <h3 className="text-sm font-medium">Systems Review</h3>
                </div>
                <div className="flex gap-1 no-print">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearAll}
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        title="Clear all systems"
                    >
                        <Eraser className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">Clear All</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onOpenConfig}
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                        title="Customize systems"
                    >
                        <Settings2 className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">Customize</span>
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {enabledSystems.map((system) => (
                    <div
                        key={system.key}
                        className={`rounded-lg p-3 border transition-all duration-200 ${hasSystemContent(system.key)
                            ? 'bg-card border-primary/20 shadow-sm'
                            : 'bg-secondary/30 border-border/50 hover:border-border'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                                <span>{system.icon}</span>
                                {system.label}
                            </label>
                            <div className="flex items-center gap-1">
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
                                {hasSystemContent(system.key) && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                                )}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <RichTextEditor
                                value={patient.systems[system.key as keyof PatientSystems] || ''}
                                onChange={(value) => onUpdate(patient.id, `systems.${system.key}`, value)}
                                placeholder={`${system.label}...`}
                                minHeight="50px"
                                autotexts={autotexts}
                                fontSize={globalFontSize}
                                changeTracking={changeTracking}
                            />
                            <FieldTimestamp
                                timestamp={patient.fieldTimestamps?.[`systems.${system.key}` as keyof typeof patient.fieldTimestamps]}
                                className="pl-1"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
