import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SYSTEM_LABELS_SHORT } from "@/constants/systems";
import type { PrintSettings, PrintDataProps } from "@/lib/print/types";
import { COLUMN_COMBINATIONS } from "@/lib/print/constants";
import type { Patient } from "@/types/patient";

interface PrintPreviewProps extends PrintDataProps {
    settings: PrintSettings;
}

export function PrintPreview({
    patients,
    patientTodos,
    patientNotes,
    settings
}: PrintPreviewProps) {

    // Add print-specific styles to preserve formatting
    React.useEffect(() => {
        const styleId = 'print-formatting-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @media print {
                    /* Preserve basic text formatting */
                    b, strong { font-weight: bold !important; }
                    i, em { font-style: italic !important; }
                    u { text-decoration: underline !important; }
                    
                    /* Preserve lists */
                    ul { list-style-type: disc !important; margin-left: 1.5em !important; }
                    ol { list-style-type: decimal !important; margin-left: 1.5em !important; }
                    li { display: list-item !important; }
                    
                    /* Preserve paragraphs and line breaks */
                    p { margin-bottom: 0.5em !important; }
                    br { display: block !important; content: "" !important; margin-top: 0.25em !important; }
                    
                    /* Ensure content is visible */
                    * { color: black !important; }
                }
            `;
            document.head.appendChild(style);
        }
        return () => {
            const existingStyle = document.getElementById(styleId);
            if (existingStyle) {
                existingStyle.remove();
            }
        };
    }, []);

    // -- Helpers --

    const getFontSizeClass = () => {
        if (settings.printFontSize <= 8) return "text-[10px]";
        if (settings.printFontSize <= 10) return "text-xs";
        if (settings.printFontSize <= 12) return "text-sm";
        return "text-base";
    };

    const cleanInlineStyles = (html: string) => {
        if (!html) return '';
        const temp = document.createElement("div");
        temp.innerHTML = html;
        const elements = temp.querySelectorAll("*");
        elements.forEach((el) => {
            el.removeAttribute("style");
        });
        return temp.innerHTML;
    };

    const getSystemLabel = (key: string) => {
        const sysKey = key.replace('systems.', '');
        return SYSTEM_LABELS_SHORT[sysKey] || key;
    };

    // Determine which columns are active, considering combinations
    // Returns a list of column definitions to render
    const getRenderColumns = React.useCallback(() => {
        const renderCols: {
            id: string;
            label: string;
            type: 'single' | 'combined';
            sourceKeys: string[]
        }[] = [];

        const processedKeys = new Set<string>();

        // Check each combination
        (settings.combinedColumns || []).forEach(comboKey => {
            const combo = COLUMN_COMBINATIONS.find(c => c.key === comboKey);
            if (combo) {
                // Verify at least one column in the combination is enabled
                const hasEnabled = combo.columns.some(colKey =>
                    settings.columns.find(c => c.key === colKey)?.enabled
                );

                if (hasEnabled) {
                    renderCols.push({
                        id: combo.key,
                        label: combo.label,
                        type: 'combined',
                        sourceKeys: combo.columns
                    });
                    combo.columns.forEach(k => processedKeys.add(k));
                }
            }
        });

        // Add remaining individual columns
        settings.columns.forEach(col => {
            if (col.enabled && !processedKeys.has(col.key)) {
                renderCols.push({
                    id: col.key,
                    label: col.key.startsWith('systems.') ? getSystemLabel(col.key) : col.label,
                    type: 'single',
                    sourceKeys: [col.key]
                });
            }
        });

        // Sort based on original column order preference if possible, 
        // effectively we put patient first, then combined/others, then notes/todos
        // This simple sort ensures Patient is always first if enabled
        return renderCols.sort((a, b) => {
            if (a.id === 'patient') return -1;
            if (b.id === 'patient') return 1;
            return 0;
        });

    }, [settings.columns, settings.combinedColumns]);

    const renderColumns = getRenderColumns();

    const getCellValue = (patient: Patient, colKey: string) => {
        if (colKey === 'patient') {
            return (
                <div>
                    <div className="font-bold">{patient.name || "Unnamed"}</div>
                    <div className="text-muted-foreground">Bed: {patient.bed || "-"}</div>
                </div>
            );
        } else if (colKey === 'todos') {
            const todos = patientTodos?.[patient.id] || [];
            if (todos.length === 0) return null;
            return (
                <ul className="list-none space-y-1">
                    {todos.map((t, i) => (
                        <li key={i} className="flex gap-1.5 items-start">
                            <span className="mt-0.5 text-[0.8em]">{t.completed ? '☑' : '☐'}</span>
                            <span>{t.content}</span>
                        </li>
                    ))}
                </ul>
            );
        } else if (colKey === 'notes') {
            return patientNotes?.[patient.id] || "";
        } else if (colKey.startsWith('systems.')) {
            const sysKey = colKey.replace('systems.', '') as keyof typeof patient.systems;
            const val = patient.systems[sysKey];
            if (!val) return null;
            return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: cleanInlineStyles(val) }} />;
        } else {
            const val = patient[colKey as keyof typeof patient] as string;
            if (!val) return null;
            return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: cleanInlineStyles(val) }} />;
        }
    };

    const renderCombinedCell = (patient: Patient, sourceKeys: string[]) => {
        return (
            <div className="space-y-3">
                {sourceKeys.map(key => {
                    const colConfig = settings.columns.find(c => c.key === key);
                    if (!colConfig?.enabled) return null; // Skip disabled cols within a combo

                    const content = getCellValue(patient, key);
                    if (!content) return null;

                    const label = key.startsWith('systems.') ? getSystemLabel(key) : colConfig.label;

                    return (
                        <div key={key}>
                            <div className="font-semibold text-muted-foreground text-[0.85em] uppercase tracking-wide mb-0.5">
                                {label}
                            </div>
                            <div>{content}</div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-muted/30 border rounded-lg h-full flex flex-col overflow-hidden">
            <div className="p-2 bg-muted/50 border-b text-xs text-center text-muted-foreground">
                Preview ({settings.printOrientation}, {settings.printFontSize}pt)
            </div>

            <ScrollArea className="flex-1 p-4">
                <div
                    data-print-preview
                    className={cn(
                        "bg-white shadow-sm min-h-[500px] p-8 mx-auto origin-top transition-all duration-300",
                        settings.printOrientation === 'landscape' ? "w-[297mm]" : "w-[210mm]"
                    )}
                    style={{
                        fontFamily: settings.printFontFamily !== 'system' ? settings.printFontFamily : undefined
                    }}
                >
                    <div className="space-y-6">
                        <div className="border-b pb-4 mb-6">
                            <h1 className="text-2xl font-bold text-slate-900">Patient Rounding Report</h1>
                            <div className="flex justify-between mt-2 text-sm text-slate-500">
                                <span>Generated: {new Date().toLocaleDateString()}</span>
                                <span>Total Patients: {patients.length}</span>
                            </div>
                        </div>

                        {settings.activeTab === 'table' ? (
                            <div className="overflow-x-auto">
                                <table className={cn("w-full border-collapse text-left", getFontSizeClass())}>
                                    <thead>
                                        <tr className="bg-slate-50 border-b-2 border-slate-200">
                                            {renderColumns.map(col => (
                                                <th key={col.id} className="p-2 font-semibold text-slate-700 border border-slate-200 align-top">
                                                    {col.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {patients.map((patient, idx) => (
                                            <tr
                                                key={patient.id}
                                                className={cn(
                                                    "border-b border-slate-200 align-top",
                                                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                                                )}
                                            >
                                                {renderColumns.map(col => (
                                                    <td key={`${patient.id}-${col.id}`} className="p-2 border border-slate-200">
                                                        {col.type === 'combined'
                                                            ? renderCombinedCell(patient, col.sourceKeys)
                                                            : getCellValue(patient, col.sourceKeys[0])
                                                        }
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={cn(
                                "grid gap-4",
                                settings.activeTab === 'cards'
                                    ? (settings.printOrientation === 'landscape' ? "grid-cols-2" : "grid-cols-1")
                                    : "grid-cols-1" // List view
                            )}>
                                {patients.map(patient => (
                                    <div
                                        key={patient.id}
                                        className={cn(
                                            "border rounded-lg bg-white shadow-sm break-inside-avoid",
                                            settings.activeTab === 'list' ? "p-4" : "p-4 flex flex-col h-full"
                                        )}
                                    >
                                        {/* Header */}
                                        <div className="border-b pb-2 mb-3 flex justify-between items-baseline">
                                            <span className="font-bold text-lg">{patient.name || "Unnamed"}</span>
                                            <span className="text-muted-foreground font-mono">{patient.bed}</span>
                                        </div>

                                        {/* Content Grid */}
                                        <div className={cn(
                                            getFontSizeClass(),
                                            settings.activeTab === 'list' ? "grid grid-cols-1 md:grid-cols-3 gap-6" : "space-y-4"
                                        )}>
                                            {renderColumns.filter(c => c.id !== 'patient').map(col => {
                                                const content = col.type === 'combined'
                                                    ? renderCombinedCell(patient, col.sourceKeys)
                                                    : getCellValue(patient, col.sourceKeys[0]);

                                                // Only render if there is content
                                                // Note: renderCombinedCell returns JSX, need to check if children exist effectively
                                                // For simple check we always render wrapper but hide if empty? 
                                                // Ideally we check data existence before rendering wrapper.

                                                return (
                                                    <div key={col.id} className={cn(
                                                        "space-y-1",
                                                        settings.activeTab === 'list' && "border-l-2 pl-3 border-muted"
                                                    )}>
                                                        <div className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 mb-1">
                                                            {col.label}
                                                        </div>
                                                        <div className="text-slate-600">
                                                            {content || <span className="text-muted-foreground/50 italic text-[0.9em]">No content</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
