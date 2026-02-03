import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SYSTEM_LABELS_SHORT, SYSTEM_KEYS } from "@/constants/systems";
import { cn } from "@/lib/utils";
import { Layers, Plus, Trash2, Pencil } from "lucide-react";
import type { PrintSettings as SettingsType, ColumnConfig, CustomCombination } from "@/lib/print/types";
import { columnCombinations } from "./constants";
import { CustomCombinationDialog } from "./CustomCombinationDialog";

interface WidthControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const WidthControl = ({ label, value, onChange, min = 50, max = 500, step = 5 }: WidthControlProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label>{label}: {value}px</Label>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(val) => onChange(val[0])}
    />
  </div>
);

interface PrintSettingsProps {
  settings: SettingsType;
  onUpdateSettings: (settings: Partial<SettingsType>) => void;
  onUpdateColumns: (columns: ColumnConfig[]) => void;
  onResetColumns: () => void;
  onToggleCombination?: (combinationKey: string) => void;
  customCombinations?: CustomCombination[];
  onAddCustomCombination?: (combination: CustomCombination) => void;
  onUpdateCustomCombination?: (combination: CustomCombination) => void;
  onDeleteCustomCombination?: (combinationKey: string) => void;
}

export function PrintSettings({
  settings,
  onUpdateSettings,
  onUpdateColumns,
  onResetColumns,
  onToggleCombination,
  customCombinations = [],
  onAddCustomCombination,
  onUpdateCustomCombination,
  onDeleteCustomCombination
}: PrintSettingsProps) {
  const [customDialogOpen, setCustomDialogOpen] = React.useState(false);
  const [editingCombination, setEditingCombination] = React.useState<CustomCombination | undefined>();

  const fontFamilies = [
    { value: 'system', label: 'System Default' },
    { value: 'arial', label: 'Arial' },
    { value: 'times', label: 'Times New Roman' },
    { value: 'georgia', label: 'Georgia' },
    { value: 'courier', label: 'Courier New' },
    { value: 'verdana', label: 'Verdana' },
    { value: 'trebuchet', label: 'Trebuchet MS' },
  ];

  const handleToggleColumn = (key: string) => {
    const updatedColumns = settings.columns.map(col =>
      col.key === key ? { ...col, enabled: !col.enabled } : col
    );
    onUpdateColumns(updatedColumns);
  };

  const handleToggleCombination = (combinationKey: string) => {
    if (onToggleCombination) {
      onToggleCombination(combinationKey);
    }
  };

  const isCombinationActive = (combinationKey: string) => {
    return (settings.combinedColumns || []).includes(combinationKey);
  };

  const systemKeys = SYSTEM_KEYS;
  const systemLabels = SYSTEM_LABELS_SHORT;
  const combinedWidthOptions = [
    ...columnCombinations,
    ...customCombinations
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Layout</h3>

        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="orientation">Orientation</Label>
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => onUpdateSettings({ printOrientation: 'portrait' })}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  settings.printOrientation === 'portrait' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                )}
              >
                Portrait
              </button>
              <button
                onClick={() => onUpdateSettings({ printOrientation: 'landscape' })}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  settings.printOrientation === 'landscape' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                )}
              >
                Landscape
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="one-per-page">One Patient Per Page</Label>
              <p className="text-xs text-muted-foreground">Force each patient on a new page</p>
            </div>
            <Switch
              id="one-per-page"
              checked={settings.onePatientPerPage}
              onCheckedChange={(checked) => onUpdateSettings({ onePatientPerPage: checked })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Typography</h3>

        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Font Family</Label>
            </div>
            <Select
              value={settings.printFontFamily}
              onValueChange={(value) => onUpdateSettings({ printFontFamily: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                {fontFamilies.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Font Size: {settings.printFontSize}pt</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-fit"
                  checked={settings.autoFitFontSize}
                  onCheckedChange={(checked) => onUpdateSettings({ autoFitFontSize: checked })}
                />
                <Label htmlFor="auto-fit" className="text-xs font-normal text-muted-foreground">Auto-fit</Label>
              </div>
            </div>
            <Slider
              value={[settings.printFontSize]}
              min={6}
              max={16}
              step={1}
              disabled={settings.autoFitFontSize}
              onValueChange={(val) => onUpdateSettings({ printFontSize: val[0] })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Template Options</h3>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Margins</Label>
            <Select
              value={settings.margins}
              onValueChange={(value) => onUpdateSettings({ margins: value as SettingsType['margins'] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select margins" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="narrow">Narrow</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Header Style</Label>
            <Select
              value={settings.headerStyle}
              onValueChange={(value) => onUpdateSettings({ headerStyle: value as SettingsType['headerStyle'] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select header style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Border Style</Label>
            <Select
              value={settings.borderStyle}
              onValueChange={(value) => onUpdateSettings({ borderStyle: value as SettingsType['borderStyle'] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select border style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="heavy">Heavy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-page-numbers">Show Page Numbers</Label>
              <p className="text-xs text-muted-foreground">Display page numbers in the header</p>
            </div>
            <Switch
              id="show-page-numbers"
              checked={settings.showPageNumbers}
              onCheckedChange={(checked) => onUpdateSettings({ showPageNumbers: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-timestamp">Show Timestamp</Label>
              <p className="text-xs text-muted-foreground">Include the generated date</p>
            </div>
            <Switch
              id="show-timestamp"
              checked={settings.showTimestamp}
              onCheckedChange={(checked) => onUpdateSettings({ showTimestamp: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="alternate-rows">Alternate Row Colors</Label>
              <p className="text-xs text-muted-foreground">Add striping to table rows</p>
            </div>
            <Switch
              id="alternate-rows"
              checked={settings.alternateRowColors}
              onCheckedChange={(checked) => onUpdateSettings({ alternateRowColors: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="compact-mode">Compact Mode</Label>
              <p className="text-xs text-muted-foreground">Reduce spacing for dense layouts</p>
            </div>
            <Switch
              id="compact-mode"
              checked={settings.compactMode}
              onCheckedChange={(checked) => onUpdateSettings({ compactMode: checked })}
            />
          </div>
        </div>
      </div>

      {/* Section Combinations */}
      {onToggleCombination && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Combine Sections</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Merge multiple sections into a single column for a more compact print layout.
          </p>

          {/* Preset Combinations */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">PRESETS</Label>
            {columnCombinations.map(combo => {
              const isActive = isCombinationActive(combo.key);
              return (
                <div
                  key={combo.key}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary/10 border-primary"
                      : "bg-muted/30 border-transparent hover:bg-muted/50"
                  )}
                  onClick={() => handleToggleCombination(combo.key)}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`combo-${combo.key}`}
                      checked={isActive}
                      onCheckedChange={() => handleToggleCombination(combo.key)}
                    />
                    <Label
                      htmlFor={`combo-${combo.key}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {combo.label}
                    </Label>
                  </div>
                  {isActive && (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom Combinations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground">CUSTOM</Label>
              {onAddCustomCombination && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => {
                    setEditingCombination(undefined);
                    setCustomDialogOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>

            {customCombinations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No custom combinations yet. Click "Add" to create one.
              </p>
            ) : (
              customCombinations.map(combo => {
                const isActive = isCombinationActive(combo.key);
                return (
                  <div
                    key={combo.key}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isActive
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/30 border-transparent hover:bg-muted/50"
                    )}
                  >
                    <div
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                      onClick={() => handleToggleCombination(combo.key)}
                    >
                      <Checkbox
                        id={`combo-${combo.key}`}
                        checked={isActive}
                        onCheckedChange={() => handleToggleCombination(combo.key)}
                      />
                      <div className="flex flex-col">
                        <Label
                          htmlFor={`combo-${combo.key}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {combo.label}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {combo.columns.length} sections
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isActive && (
                        <Badge variant="secondary" className="text-xs mr-1">
                          Active
                        </Badge>
                      )}
                      {onUpdateCustomCombination && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCombination(combo);
                            setCustomDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {onDeleteCustomCombination && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCustomCombination(combo.key);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Custom Combination Dialog */}
      <CustomCombinationDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        existingCombination={editingCombination}
        onSave={(combo) => {
          if (editingCombination && onUpdateCustomCombination) {
            onUpdateCustomCombination(combo);
          } else if (onAddCustomCombination) {
            onAddCustomCombination(combo);
          }
        }}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Columns</h3>
          <Button variant="ghost" size="sm" onClick={onResetColumns} className="h-6 text-xs px-2">
            Reset
          </Button>
        </div>

        <ScrollArea className="h-[300px] pr-4 border rounded-md p-2">
          <div className="space-y-2">
            {settings.columns.filter(c => !c.key.startsWith('systems.')).map(col => (
              <div key={col.key} className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={col.enabled}
                  onCheckedChange={() => handleToggleColumn(col.key)}
                />
                <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                  {col.label}
                </Label>
              </div>
            ))}

            <div className="pt-2 pb-1">
              <Label className="text-xs font-semibold text-muted-foreground">SYSTEMS</Label>
            </div>

            {settings.columns.filter(c => c.key.startsWith('systems.')).map(col => (
              <div key={col.key} className="flex items-center space-x-2 pl-2 border-l-2 border-muted ml-1">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={col.enabled}
                  onCheckedChange={() => handleToggleColumn(col.key)}
                />
                <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                  {col.label}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Column Widths</h3>

        <div className="grid gap-4">
          <WidthControl
            label="Patient Column"
            value={settings.columnWidths.patient}
            onChange={(v) => onUpdateSettings({ columnWidths: { ...settings.columnWidths, patient: v } })}
            max={300}
          />

          <WidthControl
            label="Summary Column"
            value={settings.columnWidths.summary}
            onChange={(v) => onUpdateSettings({ columnWidths: { ...settings.columnWidths, summary: v } })}
          />

          <WidthControl
            label="Events Column"
            value={settings.columnWidths.events}
            onChange={(v) => onUpdateSettings({ columnWidths: { ...settings.columnWidths, events: v } })}
          />

          <WidthControl
            label="Imaging"
            value={settings.columnWidths.imaging}
            onChange={(v) => onUpdateSettings({ columnWidths: { ...settings.columnWidths, imaging: v } })}
            max={300}
          />

          <WidthControl
            label="Labs"
            value={settings.columnWidths.labs}
            onChange={(v) => onUpdateSettings({ columnWidths: { ...settings.columnWidths, labs: v } })}
            max={300}
          />

          <WidthControl
            label="Todos"
            value={settings.columnWidths.todos || 140}
            onChange={(v) => onUpdateSettings({ columnWidths: { ...settings.columnWidths, todos: v } })}
            max={300}
          />

          <WidthControl
            label="Notes"
            value={settings.columnWidths.notes}
            onChange={(v) => onUpdateSettings({ columnWidths: { ...settings.columnWidths, notes: v } })}
            max={300}
          />

          <WidthControl
            label="System Columns"
            value={settings.columnWidths['systems.neuro']}
            onChange={(v) => {
              const updatedSystems = Object.keys(settings.columnWidths).reduce((acc, key) => {
                if (key.startsWith('systems.')) {
                  acc[key as keyof typeof settings.columnWidths] = v;
                }
                return acc;
              }, {} as Partial<typeof settings.columnWidths>);
              onUpdateSettings({ columnWidths: { ...settings.columnWidths, ...updatedSystems } });
            }}
            max={200}
          />
        </div>

        <div className="pt-2 space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground">COMBINED COLUMN WIDTHS</Label>
          {settings.combinedColumns.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Enable a combination to adjust its width.</p>
          ) : (
            combinedWidthOptions
              .filter(option => settings.combinedColumns.includes(option.key))
              .map(option => (
                <WidthControl
                  key={option.key}
                  label={option.label}
                  value={settings.combinedColumnWidths[option.key] || 240}
                  onChange={(v) => onUpdateSettings({
                    combinedColumnWidths: {
                      ...settings.combinedColumnWidths,
                      [option.key]: v
                    }
                  })}
                  max={600}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
}
