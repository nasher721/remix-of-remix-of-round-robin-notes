import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings2, 
  ChevronDown, 
  Columns, 
  RotateCcw, 
  Type,
  Bookmark,
  Plus,
  Check,
  X,
  Download,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnConfig, ColumnWidthsType, PrintPreset } from './types';
import { columnCombinations, fontFamilies, systemLabels, defaultColumns, defaultColumnWidths } from './constants';
import { SYSTEM_LABELS_SHORT } from '@/constants/systems';
import { useState } from 'react';

interface PrintSettingsProps {
  // Column settings
  columns: ColumnConfig[];
  toggleColumn: (key: string) => void;
  selectAllColumns: () => void;
  deselectAllColumns: () => void;
  combinedColumns: string[];
  toggleColumnCombination: (key: string) => void;
  setCombinedColumns: (cols: string[]) => void;
  systemsReviewColumnCount: number;
  setSystemsReviewColumnCount: (count: number) => void;
  
  // Column widths
  columnWidths: ColumnWidthsType;
  setColumnWidths: (widths: ColumnWidthsType | ((prev: ColumnWidthsType) => ColumnWidthsType)) => void;
  
  // Typography
  printFontSize: number;
  setPrintFontSize: (size: number) => void;
  printFontFamily: string;
  setPrintFontFamily: (family: string) => void;
  getFontFamilyCSS: () => string;
  
  // Orientation
  printOrientation: 'portrait' | 'landscape';
  setPrintOrientation: (orientation: 'portrait' | 'landscape') => void;
  
  // Page settings
  onePatientPerPage: boolean;
  setOnePatientPerPage: (value: boolean) => void;
  autoFitFontSize: boolean;
  setAutoFitFontSize: (value: boolean) => void;
  
  // Presets
  customPresets: PrintPreset[];
  loadPreset: (preset: PrintPreset) => void;
  deletePreset: (presetId: string) => void;
  exportPreset: (preset: PrintPreset) => void;
  importPreset: (file: File) => void;
  saveCurrentAsPreset: (name: string) => boolean;
  setColumns: (cols: ColumnConfig[]) => void;
  
  // Helpers
  isColumnEnabled: (key: string) => boolean;
  enabledSystemKeys: string[];
  showNotesColumn: boolean;
}

export const PrintSettings = ({
  columns,
  toggleColumn,
  selectAllColumns,
  deselectAllColumns,
  combinedColumns,
  toggleColumnCombination,
  setCombinedColumns,
  systemsReviewColumnCount,
  setSystemsReviewColumnCount,
  columnWidths,
  setColumnWidths,
  printFontSize,
  setPrintFontSize,
  printFontFamily,
  setPrintFontFamily,
  getFontFamilyCSS,
  printOrientation,
  setPrintOrientation,
  onePatientPerPage,
  setOnePatientPerPage,
  autoFitFontSize,
  setAutoFitFontSize,
  customPresets,
  loadPreset,
  deletePreset,
  exportPreset,
  importPreset,
  saveCurrentAsPreset,
  setColumns,
  isColumnEnabled,
  enabledSystemKeys,
  showNotesColumn,
}: PrintSettingsProps) => {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnWidthsOpen, setColumnWidthsOpen] = useState(false);
  const [typographyOpen, setTypographyOpen] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const handleSavePreset = () => {
    if (saveCurrentAsPreset(newPresetName)) {
      setNewPresetName('');
      setShowSavePreset(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Quick Presets */}
      <div className="border-b pb-3 mb-2 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Presets:</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              if (!combinedColumns.includes('systemsReview')) {
                setCombinedColumns([...combinedColumns.filter(c => c !== 'allContent'), 'systemsReview']);
              }
              setPrintOrientation('landscape');
              setPrintFontSize(8);
            }}
            className="gap-2 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 border-primary/30"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M7 9h10M7 13h6" />
            </svg>
            Compact Mode
          </Button>
          
          {customPresets.map(preset => (
            <div key={preset.id} className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadPreset(preset)}
                className="gap-2 bg-secondary/50 hover:bg-secondary"
              >
                <Bookmark className="h-3.5 w-3.5" />
                {preset.name}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportPreset(preset)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                title="Export preset as JSON"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deletePreset(preset.id)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                title="Delete preset"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          
          {!showSavePreset ? (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowSavePreset(true)}
              className="gap-1 text-xs border border-dashed border-muted-foreground/30 hover:border-primary/50"
            >
              <Plus className="h-3 w-3" />
              Save Current
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Input
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Preset name..."
                className="h-7 w-32 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePreset();
                  if (e.key === 'Escape') {
                    setShowSavePreset(false);
                    setNewPresetName('');
                  }
                }}
                autoFocus
              />
              <Button variant="default" size="sm" onClick={handleSavePreset} className="h-7 px-2">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowSavePreset(false); setNewPresetName(''); }} className="h-7 px-2">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setCombinedColumns([]);
              setPrintOrientation('portrait');
              setPrintFontSize(10);
              setColumns(defaultColumns);
              setColumnWidths(defaultColumnWidths);
              setOnePatientPerPage(false);
              setAutoFitFontSize(false);
            }}
            className="gap-1 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All
          </Button>
          
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  importPreset(file);
                  e.target.value = '';
                }
              }}
            />
            <span className="inline-flex items-center gap-1 text-xs h-7 px-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <Upload className="h-3 w-3" />
              Import Preset
            </span>
          </label>
        </div>
      </div>

      {/* Column Selection */}
      <Collapsible open={columnsOpen} onOpenChange={setColumnsOpen} className="border-b pb-2 mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="font-medium">Customize Columns</span>
              <span className="text-xs text-muted-foreground">
                ({columns.filter(c => c.enabled).length} of {columns.length} selected)
              </span>
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", columnsOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="flex gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={selectAllColumns}>Select All</Button>
            <Button variant="outline" size="sm" onClick={deselectAllColumns}>Deselect All</Button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {columns.map(col => (
              <label 
                key={col.key} 
                className={cn(
                  "flex items-center gap-2 text-xs p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors",
                  col.enabled ? "bg-primary/10 border-primary" : "bg-muted/20 border-muted",
                  col.key === "notes" && "bg-amber-50 border-amber-300"
                )}
              >
                <Checkbox 
                  checked={col.enabled}
                  onCheckedChange={() => toggleColumn(col.key)}
                  disabled={col.key === "patient"}
                />
                <span className={cn(col.key === "patient" && "text-muted-foreground")}>{col.label}</span>
              </label>
            ))}
          </div>
          
          {/* Column Combinations */}
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Columns className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Combine Columns for Compact Print</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {columnCombinations.map(combo => (
                <label 
                  key={combo.key}
                  className={cn(
                    "flex items-center gap-2 text-xs p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors",
                    combinedColumns.includes(combo.key) 
                      ? "bg-primary/20 border-primary text-primary-foreground" 
                      : "bg-muted/20 border-muted"
                  )}
                >
                  <Checkbox 
                    checked={combinedColumns.includes(combo.key)}
                    onCheckedChange={() => toggleColumnCombination(combo.key)}
                  />
                  <span className={cn(combinedColumns.includes(combo.key) && "font-medium")}>{combo.label}</span>
                </label>
              ))}
              {combinedColumns.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCombinedColumns([])}
                  className="h-8 text-xs gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
            
            {combinedColumns.includes('systemsReview') && (
              <div className="mt-3 pt-3 border-t border-dashed">
                <div className="flex items-center gap-4">
                  <Label className="text-xs font-medium whitespace-nowrap">Systems Review Columns:</Label>
                  <div className="flex gap-1">
                    {[2, 3, 4].map(count => (
                      <Button
                        key={count}
                        variant={systemsReviewColumnCount === count ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSystemsReviewColumnCount(count)}
                        className="h-7 w-8 text-xs"
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Column Width Controls */}
      <Collapsible open={columnWidthsOpen} onOpenChange={setColumnWidthsOpen} className="border-b pb-2 mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
            <div className="flex items-center gap-2">
              <Columns className="h-4 w-4" />
              <span className="font-medium">Adjust Column Widths</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", columnWidthsOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Drag sliders to adjust column widths</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setColumnWidths(defaultColumnWidths)}
              className="h-7 text-xs gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {isColumnEnabled("patient") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Patient</Label>
                  <span className="text-xs text-muted-foreground">{columnWidths.patient}px</span>
                </div>
                <Slider
                  value={[columnWidths.patient]}
                  onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, patient: value }))}
                  min={60}
                  max={180}
                  step={5}
                />
              </div>
            )}
            {isColumnEnabled("clinicalSummary") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Summary</Label>
                  <span className="text-xs text-muted-foreground">{columnWidths.summary}px</span>
                </div>
                <Slider
                  value={[columnWidths.summary]}
                  onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, summary: value }))}
                  min={100}
                  max={400}
                  step={10}
                />
              </div>
            )}
            {showNotesColumn && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-amber-700">Notes</Label>
                  <span className="text-xs text-muted-foreground">{columnWidths.notes}px</span>
                </div>
                <Slider
                  value={[columnWidths.notes]}
                  onValueChange={([value]) => setColumnWidths(prev => ({ ...prev, notes: value }))}
                  min={80}
                  max={300}
                  step={10}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Typography Controls */}
      <Collapsible open={typographyOpen} onOpenChange={setTypographyOpen} className="border-b pb-2 mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              <span className="font-medium">Typography Settings</span>
              <span className="text-xs text-muted-foreground">
                ({printFontSize}px • {fontFamilies.find(f => f.value === printFontFamily)?.label})
              </span>
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", typographyOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Print Font Size</Label>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{printFontSize}px</span>
              </div>
              <Slider
                value={[printFontSize]}
                onValueChange={([value]) => setPrintFontSize(value)}
                min={7}
                max={14}
                step={1}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Font Family</Label>
              <Select value={printFontFamily} onValueChange={setPrintFontFamily}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  {fontFamilies.map(font => (
                    <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.css }}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="pt-3 border-t space-y-3">
            <Label className="text-sm font-medium">Page Orientation</Label>
            <div className="flex gap-2">
              <Button
                variant={printOrientation === 'portrait' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPrintOrientation('portrait')}
                className="flex-1 gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                </svg>
                Portrait
              </Button>
              <Button
                variant={printOrientation === 'landscape' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPrintOrientation('landscape')}
                className="flex-1 gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                </svg>
                Landscape
              </Button>
            </div>
          </div>
          
          <div className="pt-3 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">One Patient Per Page</Label>
                <p className="text-xs text-muted-foreground">Each patient starts on a new page</p>
              </div>
              <Checkbox checked={onePatientPerPage} onCheckedChange={(v) => setOnePatientPerPage(!!v)} />
            </div>
            
            {onePatientPerPage && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-primary/30">
                <div>
                  <Label className="text-sm font-medium">Auto-fit Font Size</Label>
                  <p className="text-xs text-muted-foreground">Automatically adjust font to fit content</p>
                </div>
                <Checkbox checked={autoFitFontSize} onCheckedChange={(v) => setAutoFitFontSize(!!v)} />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
