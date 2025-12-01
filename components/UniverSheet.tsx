import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { CsvRow, Source } from '../types';
import { X, Check, Link2, ExternalLink, PanelRightClose, PanelRightOpen } from 'lucide-react';

import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import { UniverSheetsSortPreset } from '@univerjs/preset-sheets-sort';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import { UniverSheetsConditionalFormattingPreset } from '@univerjs/preset-sheets-conditional-formatting';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import { RemoveDuplicatesPlugin } from '../plugins/RemoveDuplicatesPlugin';

// Locales
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import UniverPresetSheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import UniverPresetSheetsSortEnUS from '@univerjs/preset-sheets-sort/locales/en-US';
import UniverPresetSheetsDataValidationEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import UniverPresetSheetsConditionalFormattingEnUS from '@univerjs/preset-sheets-conditional-formatting/locales/en-US';
import UniverPresetSheetsFindReplaceEnUS from '@univerjs/preset-sheets-find-replace/locales/en-US';
import UniverPresetSheetsHyperLinkEnUS from '@univerjs/preset-sheets-hyper-link/locales/en-US';

// Styles
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-filter/lib/index.css';
import '@univerjs/preset-sheets-sort/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import '@univerjs/preset-sheets-conditional-formatting/lib/index.css';
import '@univerjs/preset-sheets-find-replace/lib/index.css';
import '@univerjs/preset-sheets-hyper-link/lib/index.css';

interface UniverSheetProps {
  data: CsvRow[];
  columns: string[];
  highlightColumns?: string[];
  cellSources?: Record<string, Source[]>;
  onCellUpdate?: (rowIndex: number, column: string, value: string) => void;
  onDataChange?: (newData: CsvRow[]) => void;
  onColumnsChange?: (newColumns: string[]) => void;
  onSyncRequest?: () => void;
}

export interface UniverSheetRef {
  syncData: () => void;
}

// Helper to convert column index to Excel-style letter (0 -> A, 1 -> B, etc.)
const getColumnLetter = (index: number): string => {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};

export const UniverSheet = forwardRef<UniverSheetRef, UniverSheetProps>(({
  data,
  columns,
  highlightColumns = [],
  cellSources = {},
  onDataChange,
  onColumnsChange,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerInstanceRef = useRef<{ univer: any; univerAPI: any } | null>(null);
  const containerIdRef = useRef(`univer-container-${Date.now()}`);

  // Track previous data for incremental updates
  const prevDataRef = useRef<CsvRow[]>([]);
  const prevColumnsRef = useRef<string[]>([]);
  const isInitializedRef = useRef(false);

  // Remove duplicates modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);

  // Track selected cell for showing sources
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);

  // Sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Subscribe to cell selection changes for showing sources
  useEffect(() => {
    if (!univerInstanceRef.current) return;

    const { univerAPI } = univerInstanceRef.current;

    // Listen for selection changes
    const subscription = univerAPI.onSelectionChange?.((selection: any) => {
      try {
        if (selection && selection.range) {
          const { startRow, startColumn } = selection.range;
          // Convert to data row index (subtract 1 for header row)
          const dataRowIndex = startRow - 1;
          if (dataRowIndex >= 0 && dataRowIndex < data.length) {
            const colName = columns[startColumn];
            if (colName) {
              const key = `${dataRowIndex}-${colName}`;
              setSelectedCellKey(key);
              return;
            }
          }
        }
        setSelectedCellKey(null);
      } catch (e) {
        // Ignore errors
      }
    });

    return () => {
      if (subscription && typeof subscription === 'function') {
        subscription();
      } else if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [columns, data.length]);

  // Helper function to read all data from sheet (columns + rows)
  const readDataFromSheet = useCallback(() => {
    if (!univerInstanceRef.current) return null;

    const { univerAPI } = univerInstanceRef.current;
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) return null;

    const sheet = workbook.getActiveSheet();
    if (!sheet) return null;

    // First, read columns from header row
    const sheetColumns: string[] = [];
    const maxCols = Math.max(columns.length + 10, 50);
    for (let i = 0; i < maxCols; i++) {
      const cellRef = `${getColumnLetter(i)}1`;
      const range = sheet.getRange(cellRef);
      if (range) {
        const value = range.getValue();
        if (value && String(value).trim()) {
          sheetColumns.push(String(value).trim());
        } else {
          break;
        }
      }
    }

    if (sheetColumns.length === 0) return null;

    // Then, read data rows
    const sheetData: CsvRow[] = [];
    const maxRows = Math.max(data.length + 50, 200);
    for (let rowIdx = 1; rowIdx < maxRows; rowIdx++) {
      const row: CsvRow = {};
      let hasData = false;

      for (let colIdx = 0; colIdx < sheetColumns.length; colIdx++) {
        const cellRef = `${getColumnLetter(colIdx)}${rowIdx + 1}`;
        const range = sheet.getRange(cellRef);
        if (range) {
          const value = range.getValue();
          const strValue = value != null ? String(value).trim() : '';
          row[sheetColumns[colIdx]] = strValue;
          if (strValue) hasData = true;
        }
      }

      // Stop at first completely empty row
      if (!hasData) break;
      sheetData.push(row);
    }

    return { columns: sheetColumns, data: sheetData };
  }, [columns.length, data.length]);


  // Expose syncData method via ref for manual sync button
  useImperativeHandle(ref, () => ({
    syncData: () => {
      const result = readDataFromSheet();
      if (!result) return;

      const { columns: newColumns, data: newData } = result;

      // Always update columns if they changed
      const columnsChanged = newColumns.length !== columns.length ||
        newColumns.some((col, i) => col !== columns[i]);

      if (columnsChanged) {
        if (onColumnsChange) {
          onColumnsChange(newColumns);
        }
      }

      // Always update data if row count changed
      if (newData.length !== data.length && onDataChange) {
        onDataChange(newData);
      }
    }
  }), [readDataFromSheet, columns, data.length, onColumnsChange, onDataChange]);

  // Sync columns and data from sheet when user presses Enter/Tab/Escape/Delete
  // IMPORTANT: Only use keyboard events - no mouse events that interfere with cell selection
  useEffect(() => {
    if (!onColumnsChange && !onDataChange) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const syncFromSheet = () => {
      const result = readDataFromSheet();
      if (!result) return;

      const { columns: newColumns, data: newData } = result;

      // Check if columns changed
      const columnsChanged = newColumns.length !== columns.length ||
        newColumns.some((col, i) => col !== columns[i]);

      // Check if data changed (row count changed - either added or removed)
      const rowCountChanged = newData.length !== data.length;

      if (columnsChanged) {
        if (onColumnsChange) {
          onColumnsChange(newColumns);
        }
      }

      if (rowCountChanged && onDataChange) {
        onDataChange(newData);
      }
    };

    const debouncedSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(syncFromSheet, 200);
    };

    // Listen for keyup events only - this won't interfere with cell selection
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace') {
        debouncedSync();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (container) {
        container.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [columns, data, onColumnsChange, onDataChange, readDataFromSheet]);

  // Listen for the custom event from the plugin
  useEffect(() => {
    const handleRemoveDuplicatesEvent = () => {
      setShowDuplicateModal(true);
    };

    window.addEventListener('syntellix-remove-duplicates', handleRemoveDuplicatesEvent);
    return () => {
      window.removeEventListener('syntellix-remove-duplicates', handleRemoveDuplicatesEvent);
    };
  }, []);

  const closeDuplicateModal = () => {
    setShowDuplicateModal(false);
    setSelectedColumns([]);
  };

  // Calculate duplicates based on selected columns
  const calculateDuplicates = useCallback(() => {
    if (selectedColumns.length === 0) {
      setDuplicateCount(null);
      return;
    }

    const seen = new Set<string>();
    let duplicates = 0;

    data.forEach(row => {
      const key = selectedColumns.map(col => row[col] || '').join('|||');
      if (seen.has(key)) {
        duplicates++;
      } else {
        seen.add(key);
      }
    });

    setDuplicateCount(duplicates);
  }, [data, selectedColumns]);

  useEffect(() => {
    calculateDuplicates();
  }, [selectedColumns, calculateDuplicates]);

  const handleRemoveDuplicates = () => {
    if (selectedColumns.length === 0 || !onDataChange) return;

    const seen = new Set<string>();
    const uniqueData: CsvRow[] = [];

    data.forEach(row => {
      const key = selectedColumns.map(col => row[col] || '').join('|||');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(row);
      }
    });

    const removed = data.length - uniqueData.length;
    onDataChange(uniqueData);
    closeDuplicateModal();
    alert(`Removed ${removed} duplicate row${removed !== 1 ? 's' : ''}.`);
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev =>
      prev.includes(col)
        ? prev.filter(c => c !== col)
        : [...prev, col]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(columns);
  };

  const clearSelection = () => {
    setSelectedColumns([]);
  };

  // Function to update only changed cells incrementally without recreating the sheet
  const updateCellsIncrementally = useCallback(() => {
    if (!univerInstanceRef.current) return;

    const { univerAPI } = univerInstanceRef.current;
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) return;

    const sheet = workbook.getActiveSheet();
    if (!sheet) return;

    const prevData = prevDataRef.current;
    const prevColumns = prevColumnsRef.current;

    // Collect all cells that need updating
    const cellsToUpdate: Array<{ row: number; col: number; value: string; isHighlighted: boolean; isHeader: boolean }> = [];

    // Check header row for changes (new columns)
    columns.forEach((col, colIndex) => {
      if (prevColumns[colIndex] !== col) {
        const isHighlighted = highlightColumns.includes(col);
        cellsToUpdate.push({ row: 0, col: colIndex, value: col, isHighlighted, isHeader: true });
      }
    });

    // Check data rows - only update cells that changed
    data.forEach((row, rowIndex) => {
      const prevRow = prevData[rowIndex];
      columns.forEach((col, colIndex) => {
        const newValue = row[col] || '';
        const oldValue = prevRow?.[col] || '';

        // Only update if value actually changed
        if (newValue !== oldValue) {
          const isHighlighted = highlightColumns.includes(col);
          cellsToUpdate.push({ row: rowIndex + 1, col: colIndex, value: newValue, isHighlighted, isHeader: false });
        }
      });
    });

    // Batch update changed cells only
    if (cellsToUpdate.length > 0) {
      cellsToUpdate.forEach(({ row, col, value, isHighlighted, isHeader }) => {
        const cellRef = `${getColumnLetter(col)}${row + 1}`;
        const range = sheet.getRange(cellRef);
        if (range) {
          range.setValue(value);

          // Apply styling for header cells
          if (isHeader) {
            if (isHighlighted) {
              // Purple header style for AI columns
              range.setBackgroundColor('#7C3AED');
              range.setFontColor('#FFFFFF');
              range.setFontWeight('bold');
            } else {
              // Blue header style for regular columns
              range.setBackgroundColor('#3B82F6');
              range.setFontColor('#FFFFFF');
              range.setFontWeight('bold');
            }
          } else if (isHighlighted) {
            // Light purple background for AI data cells
            range.setBackgroundColor('#F5F3FF');
            range.setFontColor('#5B21B6');
          }
        }
      });
    }
  }, [data, columns, highlightColumns]);

  // Check if we need a full rebuild of the sheet
  // This happens only when columns are removed or reordered (not for adding new columns)
  const columnsRequireRebuild = useCallback(() => {
    const prevColumns = prevColumnsRef.current;
    // If columns were removed, need rebuild
    if (columns.length < prevColumns.length) return true;
    // If any existing column was renamed/reordered, need rebuild
    for (let i = 0; i < prevColumns.length; i++) {
      if (prevColumns[i] !== columns[i]) return true;
    }
    // New columns added at the end can be handled incrementally (no rebuild needed)
    return false;
  }, [columns]);

  // Keep refs to current data/columns for initialization function
  const dataRef = useRef(data);
  const columnsRef = useRef(columns);
  dataRef.current = data;
  columnsRef.current = columns;

  // Initialize Univer instance - stable function that reads from refs
  const initializeUniver = useCallback(() => {
    if (!containerRef.current) return;

    const currentData = dataRef.current;
    const currentColumns = columnsRef.current;

    // Cleanup existing instance
    if (univerInstanceRef.current) {
      try {
        univerInstanceRef.current.univer.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
      univerInstanceRef.current = null;
    }

    containerRef.current.innerHTML = '';

    const innerContainer = document.createElement('div');
    innerContainer.id = containerIdRef.current;
    innerContainer.style.width = '100%';
    innerContainer.style.height = '100%';
    containerRef.current.appendChild(innerContainer);

    try {
      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: mergeLocales(
            UniverPresetSheetsCoreEnUS,
            UniverPresetSheetsFilterEnUS,
            UniverPresetSheetsSortEnUS,
            UniverPresetSheetsDataValidationEnUS,
            UniverPresetSheetsConditionalFormattingEnUS,
            UniverPresetSheetsFindReplaceEnUS,
            UniverPresetSheetsHyperLinkEnUS
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerIdRef.current,
          }),
          UniverSheetsFilterPreset(),
          UniverSheetsSortPreset(),
          UniverSheetsDataValidationPreset({
            showEditOnDropdown: true,
          }),
          UniverSheetsConditionalFormattingPreset(),
          UniverSheetsFindReplacePreset(),
          UniverSheetsHyperLinkPreset(),
        ],
      });

      // Register our custom Remove Duplicates plugin
      univer.registerPlugin(RemoveDuplicatesPlugin);

      univerInstanceRef.current = { univer, univerAPI };

      // Build workbook data inline using current refs
      const cellData: Record<number, Record<number, { v: string; s?: any }>> = {};
      cellData[0] = {};
      currentColumns.forEach((col, colIndex) => {
        const isHighlighted = highlightColumns.includes(col);
        cellData[0][colIndex] = {
          v: col,
          s: isHighlighted ? 'headerHighlight' : 'header'
        };
      });
      currentData.forEach((row, rowIndex) => {
        cellData[rowIndex + 1] = {};
        currentColumns.forEach((col, colIndex) => {
          const isHighlighted = highlightColumns.includes(col);
          cellData[rowIndex + 1][colIndex] = {
            v: row[col] || '',
            s: isHighlighted ? 'cellHighlight' : (rowIndex % 2 === 0 ? 'evenRow' : undefined)
          };
        });
      });

      const workbookData = {
        id: 'syntellix-workbook',
        name: 'Syntellix Data',
        styles: {
          header: {
            bg: { rgb: '#3B82F6' },
            cl: { rgb: '#FFFFFF' },
            bl: 1,
            ff: 'system-ui, -apple-system, sans-serif',
            fs: 12,
            ht: 2,
            vt: 2,
          },
          headerHighlight: {
            bg: { rgb: '#7C3AED' },
            cl: { rgb: '#FFFFFF' },
            bl: 1,
            ff: 'system-ui, -apple-system, sans-serif',
            fs: 12,
            ht: 2,
            vt: 2,
          },
          cellHighlight: {
            bg: { rgb: '#F5F3FF' },
            cl: { rgb: '#5B21B6' },
          },
          evenRow: {
            bg: { rgb: '#F8FAFC' },
          }
        },
        sheets: {
          sheet1: {
            id: 'sheet1',
            name: 'Data',
            rowCount: Math.max(currentData.length + 50, 100),
            columnCount: Math.max(currentColumns.length + 10, 26), // Extra columns for AI
            cellData,
            defaultColumnWidth: 150,
            defaultRowHeight: 28,
            rowData: {
              0: { h: 36 }
            }
          }
        }
      };

      univerAPI.createWorkbook(workbookData);

      // Mark as initialized and save current state
      isInitializedRef.current = true;
      prevColumnsRef.current = [...currentColumns];
      prevDataRef.current = [...currentData];

      // Set up listener for cell value changes to style new headers
      let isApplyingStyle = false; // Flag to prevent recursion
      try {
        univerAPI.onCommandExecuted((command: any) => {
          // Skip if we're currently applying styles (prevents recursion)
          if (isApplyingStyle) return;

          // Listen for cell value mutations
          if (command.id === 'sheet.mutation.set-range-values') {
            const params = command.params;
            const cellValue = params?.cellValue;

            // Check if header row (row 0) was modified
            if (cellValue && cellValue[0] !== undefined) {
              const workbook = univerAPI.getActiveWorkbook();
              if (workbook) {
                const sheet = workbook.getActiveSheet();
                if (sheet) {
                  // Set flag to prevent recursion
                  isApplyingStyle = true;

                  // Apply styling to modified header cells
                  Object.keys(cellValue[0]).forEach((colIndexStr) => {
                    const colIndex = parseInt(colIndexStr, 10);
                    const cellRef = `${getColumnLetter(colIndex)}1`;
                    const range = sheet.getRange(cellRef);
                    if (range) {
                      const value = range.getValue();
                      if (value && String(value).trim()) {
                        // Apply full header styling to match original columns
                        range.setBackgroundColor('#3B82F6');
                        range.setFontColor('#FFFFFF');
                        range.setFontWeight('bold');
                        range.setFontSize(12);
                        range.setHorizontalAlignment('center');
                        range.setVerticalAlignment('middle');
                      }
                    }
                  });

                  // Reset flag after a short delay
                  setTimeout(() => {
                    isApplyingStyle = false;
                  }, 100);
                }
              }
            }
          }
        });
      } catch (e) {
        console.log('Command listener setup failed:', e);
      }

      setTimeout(() => {
        try {
          const workbook = univerAPI.getActiveWorkbook();
          if (workbook) {
            const sheet = workbook.getActiveSheet();
            if (sheet && currentColumns.length > 0) {
              // Explicitly apply header styles to ensure they are visible
              currentColumns.forEach((col, colIndex) => {
                const cellRef = `${getColumnLetter(colIndex)}1`;
                const range = sheet.getRange(cellRef);
                if (range) {
                  const isHighlighted = highlightColumns.includes(col);
                  if (isHighlighted) {
                    range.setBackgroundColor('#7C3AED');
                  } else {
                    range.setBackgroundColor('#3B82F6');
                  }
                  range.setFontColor('#FFFFFF');
                  range.setFontWeight('bold');
                }
              });

              // Set up filter if we have data
              if (currentData.length > 0) {
                const lastCol = getColumnLetter(currentColumns.length - 1);
                const lastRow = currentData.length + 1;
                const filterRange = `A1:${lastCol}${lastRow}`;

                const range = sheet.getRange(filterRange);
                if (range) {
                  range.createFilter();
                }
              }
            }
          }
        } catch (e) {
          console.log('Filter setup skipped:', e);
        }
      }, 100);

    } catch (error) {
      console.error('Failed to initialize Univer:', error);
    }
  }, [highlightColumns]); // Only depends on highlightColumns which rarely changes

  // Handle initialization and updates
  useEffect(() => {
    if (data.length === 0 && columns.length === 0) return;

    // If not initialized yet, initialize
    if (!isInitializedRef.current) {
      initializeUniver();
      return;
    }

    // Check if we need full rebuild (columns removed or reordered)
    if (columnsRequireRebuild()) {
      initializeUniver();
      return;
    }

    // Just update cells incrementally
    updateCellsIncrementally();

    // Update refs with current state for next comparison
    prevDataRef.current = [...data];
    prevColumnsRef.current = [...columns];
  }, [data, columns, columnsRequireRebuild, updateCellsIncrementally, initializeUniver]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (univerInstanceRef.current) {
        try {
          univerInstanceRef.current.univer.dispose();
        } catch (e) {
          // Ignore
        }
        univerInstanceRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-slate-200 shadow-sm">
        No data to display. Upload a CSV or Excel file.
      </div>
    );
  }

  // Get cell display info from key
  const getCellInfo = (key: string) => {
    const [rowIndexStr, colName] = key.split('-');
    const rowIndex = parseInt(rowIndexStr, 10);
    const cellValue = data[rowIndex]?.[colName] || '';
    return { rowIndex: rowIndex + 1, colName, cellValue };
  };

  // All cells with sources
  const sourcedCells = Object.keys(cellSources);

  return (
    <div className="flex h-[700px] bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
      {/* Spreadsheet */}
      <div className="flex flex-col flex-1">
        <div ref={containerRef} className="flex-1 w-full" />

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-500">
          {data.length} rows × {columns.length} columns
        </div>
      </div>

      {/* Sources Sidebar Toggle Button - shows when there are cells with sources */}
      {sourcedCells.length > 0 && !isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="w-10 border-l border-slate-200 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-2 transition-colors"
          title="Open Sources panel"
        >
          <PanelRightOpen className="w-4 h-4 text-slate-500" />
          <div className="flex flex-col items-center">
            <Link2 className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-500 font-medium mt-1">{sourcedCells.length}</span>
          </div>
        </button>
      )}

      {/* Sources Sidebar - shows when there are cells with sources and sidebar is open */}
      {sourcedCells.length > 0 && isSidebarOpen && (
        <div className="w-72 border-l border-slate-200 bg-slate-50 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-800 text-sm">Sources</span>
                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {sourcedCells.length}
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="Close Sources panel"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cells List */}
          <div className="flex-1 overflow-y-auto">
            {sourcedCells.map(key => {
              const { rowIndex, colName, cellValue } = getCellInfo(key);
              const sources = cellSources[key];
              const isSelected = selectedCellKey === key;

              return (
                <div
                  key={key}
                  className={`border-b border-slate-100 ${isSelected ? 'bg-blue-50' : 'hover:bg-white'}`}
                >
                  {/* Cell Info - Clickable */}
                  <button
                    onClick={() => setSelectedCellKey(isSelected ? null : key)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-500">
                        Row {rowIndex} · {colName}
                      </span>
                      <Link2 className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2">
                      {cellValue || <span className="italic text-slate-400">Empty</span>}
                    </p>
                  </button>

                  {/* Expanded Sources */}
                  {isSelected && sources && (
                    <div className="px-3 pb-3 bg-slate-800 text-white mx-2 mb-2 rounded-lg">
                      <div className="text-xs font-semibold text-blue-300 py-2">Sources</div>
                      <ul className="space-y-1.5">
                        {sources.map((source, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-slate-400 text-xs mt-0.5">{idx + 1}.</span>
                            <a
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-300 hover:text-blue-200 hover:underline flex items-center gap-1 break-all"
                            >
                              {source.title || (() => { try { return new URL(source.uri).hostname; } catch { return source.uri; } })()}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Remove Duplicates Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Remove Duplicates</h3>
              <button
                onClick={closeDuplicateModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-slate-600 mb-4">
                Select columns to check for duplicate values. Rows with identical values in all selected columns will be removed.
              </p>

              {/* Quick Actions */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={selectAllColumns}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={clearSelection}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear
                </button>
              </div>

              {/* Column Checkboxes */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                {columns.map((col, idx) => (
                  <label
                    key={col}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                      idx !== columns.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{col}</span>
                    {selectedColumns.includes(col) && (
                      <Check className="w-4 h-4 text-blue-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>

              {/* Duplicate Count */}
              {duplicateCount !== null && (
                <div className={`mt-4 p-3 rounded-lg ${
                  duplicateCount > 0
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-green-50 border border-green-200'
                }`}>
                  {duplicateCount > 0 ? (
                    <p className="text-sm text-amber-800">
                      <strong>{duplicateCount}</strong> duplicate row{duplicateCount !== 1 ? 's' : ''} found based on selected columns.
                    </p>
                  ) : (
                    <p className="text-sm text-green-800">
                      No duplicates found based on selected columns.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={closeDuplicateModal}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveDuplicates}
                disabled={selectedColumns.length === 0 || duplicateCount === 0 || !onDataChange}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove {duplicateCount || 0} Duplicate{duplicateCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
