import * as React from 'react';
import type { ColumnConfig, ColumnWidthsType, PrintPreset } from './types';
import { defaultColumns, defaultColumnWidths, defaultCombinedColumnWidths, fontFamilies } from './constants';
import { useToast } from '@/hooks/use-toast';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '@/constants/config';

export const usePrintState = () => {
  const { toast } = useToast();
  
  const [columnWidths, setColumnWidths] = React.useState<ColumnWidthsType>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultColumnWidths, ...parsed };
      } catch {
        return defaultColumnWidths;
      }
    }
    return defaultColumnWidths;
  });

  const [combinedColumnWidths, setCombinedColumnWidths] = React.useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultCombinedColumnWidths, ...parsed };
      } catch {
        return defaultCombinedColumnWidths;
      }
    }
    return defaultCombinedColumnWidths;
  });
  
  const [columns, setColumns] = React.useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRINT_COLUMN_PREFS);
    if (saved) {
      try {
        const savedCols = JSON.parse(saved) as ColumnConfig[];
        return defaultColumns.map(col => {
          const savedCol = savedCols.find(s => s.key === col.key);
          return savedCol ? { ...col, enabled: savedCol.enabled } : col;
        });
      } catch {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });
  
  const [printFontSize, setPrintFontSize] = React.useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRINT_FONT_SIZE);
    return saved ? parseInt(saved, 10) : DEFAULT_CONFIG.PRINT_FONT_SIZE;
  });
  
  const [printFontFamily, setPrintFontFamily] = React.useState(() => {
    return localStorage.getItem(STORAGE_KEYS.PRINT_FONT_FAMILY) || DEFAULT_CONFIG.PRINT_FONT_FAMILY;
  });

  const [margins, setMargins] = React.useState<'narrow' | 'normal' | 'wide'>(() => {
    return (localStorage.getItem('printMargins') as 'narrow' | 'normal' | 'wide') || DEFAULT_CONFIG.PRINT_MARGINS;
  });

  const [headerStyle, setHeaderStyle] = React.useState<'minimal' | 'standard' | 'detailed'>(() => {
    return (localStorage.getItem('printHeaderStyle') as 'minimal' | 'standard' | 'detailed') || DEFAULT_CONFIG.PRINT_HEADER_STYLE;
  });

  const [borderStyle, setBorderStyle] = React.useState<'none' | 'light' | 'medium' | 'heavy'>(() => {
    return (localStorage.getItem('printBorderStyle') as 'none' | 'light' | 'medium' | 'heavy') || DEFAULT_CONFIG.PRINT_BORDER_STYLE;
  });

  const [showPageNumbers, setShowPageNumbers] = React.useState(() => {
    const saved = localStorage.getItem('printShowPageNumbers');
    return saved ? saved === 'true' : DEFAULT_CONFIG.PRINT_SHOW_PAGE_NUMBERS;
  });

  const [showTimestamp, setShowTimestamp] = React.useState(() => {
    const saved = localStorage.getItem('printShowTimestamp');
    return saved ? saved === 'true' : DEFAULT_CONFIG.PRINT_SHOW_TIMESTAMP;
  });

  const [alternateRowColors, setAlternateRowColors] = React.useState(() => {
    const saved = localStorage.getItem('printAlternateRowColors');
    return saved ? saved === 'true' : DEFAULT_CONFIG.PRINT_ALTERNATE_ROW_COLORS;
  });

  const [compactMode, setCompactMode] = React.useState(() => {
    const saved = localStorage.getItem('printCompactMode');
    return saved ? saved === 'true' : DEFAULT_CONFIG.PRINT_COMPACT_MODE;
  });
  
  const [onePatientPerPage, setOnePatientPerPage] = React.useState(() => {
    return localStorage.getItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE) === 'true';
  });
  
  const [autoFitFontSize, setAutoFitFontSize] = React.useState(() => {
    return localStorage.getItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE) === 'true';
  });
  
  const [combinedColumns, setCombinedColumns] = React.useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [systemsReviewColumnCount, setSystemsReviewColumnCount] = React.useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRINT_SYSTEMS_REVIEW_COLUMN_COUNT);
    return saved ? parseInt(saved, 10) : DEFAULT_CONFIG.SYSTEMS_REVIEW_COLUMN_COUNT;
  });
  
  const [printOrientation, setPrintOrientation] = React.useState<'portrait' | 'landscape'>(() => {
    return (localStorage.getItem(STORAGE_KEYS.PRINT_ORIENTATION) as 'portrait' | 'landscape') || DEFAULT_CONFIG.PRINT_ORIENTATION;
  });
  
  const [customPresets, setCustomPresets] = React.useState<PrintPreset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRINT_CUSTOM_PRESETS);
    return saved ? JSON.parse(saved) : [];
  });

  // Persist preferences
  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE, onePatientPerPage.toString());
  }, [onePatientPerPage]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE, autoFitFontSize.toString());
  }, [autoFitFontSize]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS, JSON.stringify(combinedColumns));
  }, [combinedColumns]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_SYSTEMS_REVIEW_COLUMN_COUNT, systemsReviewColumnCount.toString());
  }, [systemsReviewColumnCount]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_ORIENTATION, printOrientation);
  }, [printOrientation]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_CUSTOM_PRESETS, JSON.stringify(customPresets));
  }, [customPresets]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_FONT_SIZE, printFontSize.toString());
    localStorage.setItem(STORAGE_KEYS.PRINT_FONT_FAMILY, printFontFamily);
  }, [printFontSize, printFontFamily]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS, JSON.stringify(columnWidths));
  }, [columnWidths]);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS, JSON.stringify(combinedColumnWidths));
  }, [combinedColumnWidths]);

  React.useEffect(() => {
    localStorage.setItem('printMargins', margins);
    localStorage.setItem('printHeaderStyle', headerStyle);
    localStorage.setItem('printBorderStyle', borderStyle);
    localStorage.setItem('printShowPageNumbers', showPageNumbers.toString());
    localStorage.setItem('printShowTimestamp', showTimestamp.toString());
    localStorage.setItem('printAlternateRowColors', alternateRowColors.toString());
    localStorage.setItem('printCompactMode', compactMode.toString());
  }, [margins, headerStyle, borderStyle, showPageNumbers, showTimestamp, alternateRowColors, compactMode]);

  const getFontFamilyCSS = React.useCallback(() => {
    return fontFamilies.find(f => f.value === printFontFamily)?.css || fontFamilies[0].css;
  }, [printFontFamily]);

  const toggleColumn = React.useCallback((key: string) => {
    setColumns(prev => {
      const updated = prev.map(col => 
        col.key === key ? { ...col, enabled: !col.enabled } : col
      );
      localStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_PREFS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const selectAllColumns = React.useCallback(() => {
    setColumns(prev => {
      const updated = prev.map(col => ({ ...col, enabled: true }));
      localStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_PREFS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deselectAllColumns = React.useCallback(() => {
    setColumns(prev => {
      const updated = prev.map(col => 
        col.key === "patient" ? col : { ...col, enabled: false }
      );
      localStorage.setItem(STORAGE_KEYS.PRINT_COLUMN_PREFS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleColumnCombination = React.useCallback((combinationKey: string) => {
    setCombinedColumns(prev => {
      if (prev.includes(combinationKey)) {
        return prev.filter(k => k !== combinationKey);
      } else {
        return [...prev, combinationKey];
      }
    });
  }, []);

  const isColumnEnabled = React.useCallback((key: string): boolean => {
    return columns.find(c => c.key === key)?.enabled ?? false;
  }, [columns]);

  const saveCurrentAsPreset = React.useCallback((name: string) => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your preset.",
        variant: "destructive"
      });
      return false;
    }
    
    const preset: PrintPreset = {
      id: Date.now().toString(),
      name: name.trim(),
      columns: columns,
      combinedColumns: combinedColumns,
      printOrientation: printOrientation,
      printFontSize: printFontSize,
      printFontFamily: printFontFamily,
      onePatientPerPage: onePatientPerPage,
      autoFitFontSize: autoFitFontSize,
      columnWidths: columnWidths,
      combinedColumnWidths: combinedColumnWidths,
      margins: margins,
      headerStyle: headerStyle,
      borderStyle: borderStyle,
      showPageNumbers: showPageNumbers,
      showTimestamp: showTimestamp,
      alternateRowColors: alternateRowColors,
      compactMode: compactMode,
      createdAt: new Date().toISOString()
    };
    
    setCustomPresets(prev => [...prev, preset]);
    
    toast({
      title: "Preset saved",
      description: `"${preset.name}" has been saved for quick access.`
    });
    return true;
  }, [columns, combinedColumns, printOrientation, printFontSize, printFontFamily, onePatientPerPage, autoFitFontSize, columnWidths, combinedColumnWidths, margins, headerStyle, borderStyle, showPageNumbers, showTimestamp, alternateRowColors, compactMode, toast]);

  const loadPreset = React.useCallback((preset: PrintPreset) => {
    setColumns(preset.columns);
    setCombinedColumns(preset.combinedColumns);
    setPrintOrientation(preset.printOrientation);
    setPrintFontSize(preset.printFontSize);
    setPrintFontFamily(preset.printFontFamily);
    setOnePatientPerPage(preset.onePatientPerPage);
    setAutoFitFontSize(preset.autoFitFontSize);
    setColumnWidths(preset.columnWidths);
    setCombinedColumnWidths(preset.combinedColumnWidths);
    setMargins(preset.margins);
    setHeaderStyle(preset.headerStyle);
    setBorderStyle(preset.borderStyle);
    setShowPageNumbers(preset.showPageNumbers);
    setShowTimestamp(preset.showTimestamp);
    setAlternateRowColors(preset.alternateRowColors);
    setCompactMode(preset.compactMode);
    
    toast({
      title: "Preset loaded",
      description: `"${preset.name}" settings applied.`
    });
  }, [toast]);

  const deletePreset = React.useCallback((presetId: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== presetId));
    toast({
      title: "Preset deleted",
      description: "The preset has been removed."
    });
  }, [toast]);

  const exportPreset = React.useCallback((preset: PrintPreset) => {
    const exportData = {
      ...preset,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `print-preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Preset exported",
      description: `"${preset.name}" saved as JSON file.`
    });
  }, [toast]);

  const importPreset = React.useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.name || !data.columns) {
          throw new Error('Invalid preset format');
        }
        const newPreset: PrintPreset = {
          id: Date.now().toString(),
          name: data.name + (customPresets.some(p => p.name === data.name) ? ' (imported)' : ''),
          columns: data.columns,
          combinedColumns: data.combinedColumns || [],
          printOrientation: data.printOrientation || 'portrait',
          printFontSize: data.printFontSize || 9,
          printFontFamily: data.printFontFamily || 'system',
          onePatientPerPage: data.onePatientPerPage || false,
          autoFitFontSize: data.autoFitFontSize || false,
          columnWidths: data.columnWidths || defaultColumnWidths,
          combinedColumnWidths: data.combinedColumnWidths || defaultCombinedColumnWidths,
          margins: data.margins || DEFAULT_CONFIG.PRINT_MARGINS,
          headerStyle: data.headerStyle || DEFAULT_CONFIG.PRINT_HEADER_STYLE,
          borderStyle: data.borderStyle || DEFAULT_CONFIG.PRINT_BORDER_STYLE,
          showPageNumbers: data.showPageNumbers ?? DEFAULT_CONFIG.PRINT_SHOW_PAGE_NUMBERS,
          showTimestamp: data.showTimestamp ?? DEFAULT_CONFIG.PRINT_SHOW_TIMESTAMP,
          alternateRowColors: data.alternateRowColors ?? DEFAULT_CONFIG.PRINT_ALTERNATE_ROW_COLORS,
          compactMode: data.compactMode ?? DEFAULT_CONFIG.PRINT_COMPACT_MODE,
          createdAt: new Date().toISOString()
        };
        setCustomPresets(prev => [...prev, newPreset]);
        toast({
          title: "Preset imported",
          description: `"${newPreset.name}" has been added.`
        });
      } catch {
        toast({
          title: "Import failed",
          description: "The file could not be parsed as a valid preset.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  }, [customPresets, toast]);

  return {
    columnWidths,
    setColumnWidths,
    combinedColumnWidths,
    setCombinedColumnWidths,
    columns,
    setColumns,
    printFontSize,
    setPrintFontSize,
    printFontFamily,
    setPrintFontFamily,
    margins,
    setMargins,
    headerStyle,
    setHeaderStyle,
    borderStyle,
    setBorderStyle,
    showPageNumbers,
    setShowPageNumbers,
    showTimestamp,
    setShowTimestamp,
    alternateRowColors,
    setAlternateRowColors,
    compactMode,
    setCompactMode,
    onePatientPerPage,
    setOnePatientPerPage,
    autoFitFontSize,
    setAutoFitFontSize,
    combinedColumns,
    setCombinedColumns,
    systemsReviewColumnCount,
    setSystemsReviewColumnCount,
    printOrientation,
    setPrintOrientation,
    customPresets,
    setCustomPresets,
    getFontFamilyCSS,
    toggleColumn,
    selectAllColumns,
    deselectAllColumns,
    toggleColumnCombination,
    isColumnEnabled,
    saveCurrentAsPreset,
    loadPreset,
    deletePreset,
    exportPreset,
    importPreset,
  };
};
