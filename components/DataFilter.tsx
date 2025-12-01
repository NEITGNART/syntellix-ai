
import React, { useState } from 'react';
import { Filter, RefreshCcw, Search } from 'lucide-react';

interface DataFilterProps {
  columns: string[];
  onFilter: (column: string, operator: string, value: string) => void;
  onReset: () => void;
  rowCount: number;
  totalOriginalCount: number;
}

export const DataFilter: React.FC<DataFilterProps> = ({ 
  columns, 
  onFilter, 
  onReset,
  rowCount,
  totalOriginalCount 
}) => {
  const [column, setColumn] = useState('');
  const [operator, setOperator] = useState('contains');
  const [value, setValue] = useState('');

  const handleFilter = () => {
    if (!column) return;
    onFilter(column, operator, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFilter();
    }
  };

  const showValueInput = !['is_empty', 'is_not_empty'].includes(operator);

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4 animate-fade-in">
      <div className="flex items-center gap-2 text-slate-700 font-bold mr-2 whitespace-nowrap">
        <Filter className="w-5 h-5 text-brand-600" />
        <span>Filter Data</span>
      </div>

      <div className="flex-1 flex flex-wrap items-center gap-3 w-full">
        <select 
          value={column} 
          onChange={(e) => setColumn(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none min-w-[150px]"
        >
          <option value="">Select Column...</option>
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select 
          value={operator} 
          onChange={(e) => setOperator(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
        >
          <optgroup label="Text">
            <option value="contains">Contains</option>
            <option value="equals">Equals (Exact)</option>
            <option value="starts_with">Starts With</option>
            <option value="not_contains">Does Not Contain</option>
          </optgroup>
          <optgroup label="Number">
            <option value="greater_than">Greater Than (&gt;)</option>
            <option value="less_than">Less Than (&lt;)</option>
            <option value="greater_equal">Greater Than or Equal (&gt;=)</option>
            <option value="less_equal">Less Than or Equal (&lt;=)</option>
          </optgroup>
          <optgroup label="Status">
            <option value="is_empty">Is Empty</option>
            <option value="is_not_empty">Is Not Empty</option>
          </optgroup>
        </select>

        {showValueInput && (
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={['greater_than', 'less_than', 'greater_equal', 'less_equal'].includes(operator) ? "Number value (e.g. 2015)" : "Value to match..."}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        )}

        <button
          onClick={handleFilter}
          disabled={!column || (showValueInput && !value)}
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm ml-auto md:ml-0"
        >
          Apply Filter
        </button>

        {rowCount < totalOriginalCount && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-red-50 hover:bg-red-100 text-sm font-medium rounded-lg transition-colors border border-red-100 ml-auto"
            title="Revert to original uploaded file"
          >
            <RefreshCcw className="w-4 h-4" />
            Reset ({totalOriginalCount})
          </button>
        )}
      </div>
    </div>
  );
};
