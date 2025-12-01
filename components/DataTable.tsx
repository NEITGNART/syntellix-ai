import React, { useState, useEffect } from 'react';
import { CsvRow, Source } from '../types';
import { ExternalLink, Info, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';

interface DataTableProps {
  data: CsvRow[];
  columns: string[];
  highlightColumns?: string[];
  cellSources?: Record<string, Source[]>;
  onCellUpdate?: (rowIndex: number, column: string, value: string) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  highlightColumns = [],
  cellSources = {},
  onCellUpdate
}) => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [editingCell, setEditingCell] = useState<{rowIndex: number, col: string} | null>(null);
  const [editValue, setEditValue] = useState("");

  const totalPages = Math.ceil(data.length / pageSize);
  const startIdx = (page - 1) * pageSize;
  const currentData = data.slice(startIdx, startIdx + pageSize);

  // Reset page when data changes significantly
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
        setPage(totalPages);
    }
  }, [data.length, totalPages, page]);

  const handleEditStart = (rowIndex: number, col: string, value: string) => {
    setEditingCell({ rowIndex, col });
    setEditValue(value);
  };

  const handleEditSave = () => {
    if (editingCell && onCellUpdate) {
        onCellUpdate(editingCell.rowIndex, editingCell.col, editValue);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleEditSave();
    } else if (e.key === 'Escape') {
        setEditingCell(null);
    }
  };

  if (!data || data.length === 0) {
    return (
       <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-slate-200 shadow-sm">
        No data to display. Upload a CSV or Excel file.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[700px] bg-white border border-slate-300 rounded-lg shadow-sm">
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse relative">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="p-3 border-b border-r border-slate-200 w-12 text-xs font-semibold text-slate-500 text-center select-none">#</th>
                        {columns.map((col) => (
                            <th key={col} className={`p-3 border-b border-r border-slate-200 text-xs font-bold text-slate-700 whitespace-nowrap min-w-[150px] ${highlightColumns.includes(col) ? 'bg-brand-50 text-brand-700' : ''}`}>
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {currentData.map((row, idx) => {
                        const actualIndex = startIdx + idx;
                        return (
                            <tr key={actualIndex} className="hover:bg-slate-50 group">
                                <td className="p-3 border-b border-r border-slate-200 text-xs text-slate-400 text-center bg-slate-50/50 select-none">
                                    {actualIndex + 1}
                                </td>
                                {columns.map((col) => {
                                    const cellValue = row[col] || '';
                                    const isEditing = editingCell?.rowIndex === actualIndex && editingCell?.col === col;
                                    const isHighlighted = highlightColumns.includes(col);
                                    const sources = cellSources[`${actualIndex}-${col}`];
                                    
                                    return (
                                        <td 
                                            key={col} 
                                            className={`p-2 border-b border-r border-slate-200 text-sm relative transition-colors ${isHighlighted ? 'bg-brand-50/30' : ''}`}
                                            onDoubleClick={() => handleEditStart(actualIndex, col, cellValue)}
                                        >
                                            {isEditing ? (
                                                <input 
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={handleEditSave}
                                                    onKeyDown={handleKeyDown}
                                                    className="w-full h-full p-1 -m-1 border-2 border-brand-500 rounded outline-none bg-white z-20 absolute inset-0"
                                                />
                                            ) : (
                                                <div className="flex items-start justify-between gap-2 group/cell min-h-[24px]">
                                                    <span className="truncate max-w-[300px] block" title={cellValue}>
                                                        {cellValue}
                                                    </span>
                                                    
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                                        {sources && sources.length > 0 && (
                                                            <div className="relative group/tooltip">
                                                                <Info className="w-3.5 h-3.5 text-brand-500 cursor-help" />
                                                                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white rounded-lg shadow-xl border border-slate-200 z-50 hidden group-hover/tooltip:block">
                                                                    <p className="text-xs font-bold text-slate-700 mb-2">Sources:</p>
                                                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                                        {sources.map((s, i) => (
                                                                            <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-xs text-brand-600 hover:underline">
                                                                                <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                                                <span className="truncate">{s.title || s.uri}</span>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <button 
                                                            onClick={() => handleEditStart(actualIndex, col, cellValue)}
                                                            className="text-slate-400 hover:text-slate-600"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-sm select-none">
            <span className="text-slate-500">
                Showing {startIdx + 1} to {Math.min(startIdx + pageSize, data.length)} of {data.length} rows
            </span>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-slate-700 font-medium">Page {page} of {totalPages || 1}</span>
                <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
  );
};