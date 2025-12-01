import React, { useState, useEffect } from 'react';
import { Bot, Play, Loader2, AlertCircle, Trash2, Wand2, Plus, X, Globe, BrainCircuit, Check, Sparkles, FileText, FileSpreadsheet, Pause, RotateCcw, StopCircle } from 'lucide-react';
import { ProcessingStatus, ResearchConfig, ResearchTask } from '../types';
import { AiAssistantModal } from './AiAssistantModal';

interface AgentControlPanelProps {
  columns: string[];
  status: ProcessingStatus;
  onStart: (config: ResearchConfig) => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onExport: (format: 'csv' | 'xlsx') => void;
  onClear: () => void;
  progress: number;
  total: number;
}

const PRESETS = [
  {
    id: 'ceo_name',
    label: 'Find CEO Name',
    col: 'CEO Name',
    prompt: 'Who is the current CEO? Return just the name.'
  },
  {
    id: 'ceo_linkedin',
    label: 'Find CEO LinkedIn',
    col: 'CEO LinkedIn',
    prompt: 'Find the LinkedIn public profile URL for the current CEO. Return ONLY the URL starting with https://'
  },
  {
    id: 'linkedin_screenshot',
    label: 'Screenshot Web Presence',
    col: 'Web Screenshot',
    prompt: 'Find the most visual public profile page for this entity (e.g. Personal Website, Company Team Page, or About Page). Avoid LinkedIn/Facebook URLs as they strictly block screenshot tools. Return ONLY a URL in this exact format: "https://image.thum.io/get/width/1200/crop/800/[INSERT_URL_HERE]".'
  },
  {
    id: 'linkedin_summary',
    label: 'Summarize LinkedIn Profile',
    col: 'LinkedIn Bio',
    prompt: 'Search for the LinkedIn profile. Use the search result snippets/metadata to summarize the person\'s professional background, current role, and key skills. Do not rely solely on visiting the page if it is blocked.'
  },
  {
    id: 'url_summary',
    label: 'Summarize Specific URL',
    col: 'Page Summary',
    prompt: 'Analyze the specific URL provided in the identity or context columns. Summarize the main content of that page.'
  },
  {
    id: 'company_website',
    label: 'Find Company Website',
    col: 'Website',
    prompt: 'What is the official website URL? Return only the URL.'
  },
  {
    id: 'headquarters',
    label: 'Find Headquarters',
    col: 'Headquarters',
    prompt: 'City and Country of the headquarters? e.g. "San Francisco, USA"'
  },
  {
    id: 'revenue',
    label: 'Find Latest Revenue',
    col: 'Revenue',
    prompt: 'What is the most recent annual revenue? Return the amount and currency/year.'
  },
  {
    id: 'summary',
    label: 'Company Summary',
    col: 'Summary',
    prompt: 'Write a concise 1-sentence summary of what this company does.'
  },
  {
    id: 'news',
    label: 'Latest News',
    col: 'Latest News',
    prompt: 'Find the most recent major news headline about this entity.'
  }
];

export const AgentControlPanel: React.FC<AgentControlPanelProps> = ({
  columns,
  status,
  onStart,
  onPause,
  onResume,
  onCancel,
  onExport,
  onClear,
  progress,
  total,
}) => {
  // Changed to array for multi-select
  const [targetColumns, setTargetColumns] = useState<string[]>([]);
  const [tasks, setTasks] = useState<ResearchTask[]>([
    { id: '1', newColumnName: '', prompt: '' }
  ]);
  const [useThinkingModel, setUseThinkingModel] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Sync targetColumns when columns change (remove invalid selections and auto-select if empty)
  useEffect(() => {
    setTargetColumns(prev => {
      // Filter out any columns that no longer exist in the data
      const validColumns = prev.filter(col => columns.includes(col));

      // If all selections were removed (or initial load), auto-select a column
      if (validColumns.length === 0 && columns.length > 0) {
        const nameCol = columns.find(c => c.toLowerCase().includes('name') || c.toLowerCase().includes('company'));
        return nameCol ? [nameCol] : [columns[0]];
      }

      return validColumns;
    });
  }, [columns]);

  const toggleTargetColumn = (col: string) => {
    if (isProcessing) return;
    setTargetColumns(prev => {
      if (prev.includes(col)) {
        // Prevent deselecting the last one
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== col);
      } else {
        return [...prev, col];
      }
    });
  };

  const handleAddTask = () => {
    setTasks(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      newColumnName: '',
      prompt: ''
    }]);
  };

  const handleAddPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    if (!presetId) return;

    const preset = PRESETS.find(p => p.id === presetId);
    if (preset) {
      setTasks(prev => {
        // If the last task is empty, replace it. Otherwise add new.
        const lastTask = prev[prev.length - 1];
        const isLastEmpty = !lastTask.newColumnName && !lastTask.prompt;

        const newTask = {
          id: Math.random().toString(36).substr(2, 9),
          newColumnName: preset.col,
          prompt: preset.prompt
        };

        if (isLastEmpty) {
          return [...prev.slice(0, -1), newTask];
        } else {
          return [...prev, newTask];
        }
      });
    }
    // Reset select
    e.target.value = "";
  };

  const handleAssistantApply = (newTasks: Omit<ResearchTask, 'id'>[], suggestedTargets: string[]) => {
    // 1. Update Tasks
    const tasksWithIds = newTasks.map(t => ({
      ...t,
      id: Math.random().toString(36).substr(2, 9)
    }));

    setTasks(prev => {
       // If the current list only has one empty task, replace it
       const lastTask = prev[prev.length - 1];
       const isLastEmpty = prev.length === 1 && !lastTask.newColumnName && !lastTask.prompt;

       if (isLastEmpty) {
         return tasksWithIds;
       }
       return [...prev, ...tasksWithIds];
    });

    // 2. Update Target Columns (Identity Columns)
    if (suggestedTargets && suggestedTargets.length > 0) {
      // Validate that suggested columns actually exist in the CSV (case-sensitive check)
      const validTargets = suggestedTargets.filter(t => columns.includes(t));
      if (validTargets.length > 0) {
        setTargetColumns(validTargets);
      }
    }
  };

  const handleRemoveTask = (id: string) => {
    if (tasks.length === 1) {
      // Don't remove the last one, just clear it
      setTasks([{ id: tasks[0].id, newColumnName: '', prompt: '' }]);
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const updateTask = (id: string, field: keyof ResearchTask, value: string) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const isProcessing = status === ProcessingStatus.PROCESSING;
  const isPaused = status === ProcessingStatus.PAUSED;
  const isRunning = isProcessing || isPaused;
  const isValid = targetColumns.length > 0 && tasks.every(t => t.newColumnName && t.prompt);

  const handleSubmit = () => {
    if (isValid) {
      onStart({ targetColumns, tasks, useThinkingModel, rowLimit: 0 });
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 relative">
      <AiAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onApply={handleAssistantApply}
        availableColumns={columns}
      />

      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand-100 p-2 rounded-lg">
            <Bot className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">AI Agent Configuration</h2>
            <p className="text-sm text-slate-500">Define what you want the agent to research for each row.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {useThinkingModel && (
             <div className="flex items-center gap-2 text-xs font-medium text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100 animate-pulse">
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Deep Thinking Mode</span>
             </div>
           )}
           <div className="flex items-center gap-2 text-xs font-medium text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full border border-brand-100">
             <Globe className="w-3.5 h-3.5" />
             <span>Web Search Active</span>
           </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Select Key */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
            Identity Columns (Input)
          </label>

          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
            {columns.map((col) => {
              const isSelected = targetColumns.includes(col);
              return (
                <button
                  key={col}
                  onClick={() => toggleTargetColumn(col)}
                  disabled={isProcessing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    isSelected
                      ? 'bg-brand-100 text-brand-700 border-brand-300 ring-1 ring-brand-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  {col}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Select the columns that identify the subject (e.g. "Name", or a "LinkedIn URL").
            <br/><span className="italic">Note: Unselected columns will be used as context.</span>
          </p>
        </div>

        {/* Intelligence Settings */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col justify-center">
           <label className="flex items-center justify-between cursor-pointer group mb-4">
             <div>
               <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                 <BrainCircuit className={`w-4 h-4 ${useThinkingModel ? 'text-purple-600' : 'text-slate-400'}`} />
                 Enable Deep Thinking
               </div>
               <p className="text-xs text-slate-400 mt-1">
                 Uses Gemini 3 Pro reasoning. Slower, but better for complex logic.
               </p>
             </div>
             <div className="relative">
               <input
                 type="checkbox"
                 className="sr-only"
                 checked={useThinkingModel}
                 onChange={(e) => setUseThinkingModel(e.target.checked)}
                 disabled={isProcessing}
               />
               <div className={`block w-10 h-6 rounded-full transition-colors ${useThinkingModel ? 'bg-purple-600' : 'bg-slate-300'}`}></div>
               <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useThinkingModel ? 'translate-x-4' : 'translate-x-0'}`}></div>
             </div>
           </label>

           <div className="pt-4 border-t border-slate-200">
             <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Magic Assistant
             </div>
             <p className="text-xs text-slate-400 mb-3">
               Describe what you want to know, and the AI will configure the research columns for you.
             </p>
             <button
              onClick={() => setIsAssistantOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all hover:shadow-purple-200 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 fill-white/20" />
              Ask AI to Create Tasks
            </button>
           </div>
        </div>
      </div>

      {/* Step 2: Define Tasks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Research Tasks (Output Columns)
          </label>

          {/* Quick Add Preset */}
          {!isProcessing && (
            <div className="flex items-center gap-2">
               <Wand2 className="w-3 h-3 text-brand-600" />
               <select
                 onChange={handleAddPreset}
                 className="text-xs border-none bg-transparent text-brand-600 font-medium focus:ring-0 cursor-pointer hover:text-brand-800"
                 defaultValue=""
               >
                 <option value="" disabled>Add Quick Preset...</option>
                 {PRESETS.map(p => (
                   <option key={p.id} value={p.id}>{p.label}</option>
                 ))}
               </select>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div key={task.id} className="flex gap-3 items-start animate-fade-in">
              <div className="flex-1 space-y-1">
                {index === 0 && <label className="text-[10px] uppercase text-slate-400 font-semibold">Column Name</label>}
                <input
                  type="text"
                  value={task.newColumnName}
                  onChange={(e) => updateTask(task.id, 'newColumnName', e.target.value)}
                  disabled={isProcessing}
                  placeholder="e.g. CEO Name"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div className="flex-[2] space-y-1">
                {index === 0 && <label className="text-[10px] uppercase text-slate-400 font-semibold">Prompt / Question</label>}
                <input
                  type="text"
                  value={task.prompt}
                  onChange={(e) => updateTask(task.id, 'prompt', e.target.value)}
                  disabled={isProcessing}
                  placeholder="e.g. Who is the current CEO?"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div className="space-y-1 pt-0">
                 {index === 0 && <label className="block text-[10px] uppercase text-transparent select-none">X</label>}
                 <button
                  onClick={() => handleRemoveTask(task.id)}
                  disabled={isProcessing}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove task"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {!isProcessing && (
          <button
            onClick={handleAddTask}
            className="flex items-center gap-2 text-sm text-brand-600 font-medium hover:text-brand-800 px-2 py-1 rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Another Column
          </button>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        {isRunning ? (
           <div className="flex-1 mr-6">
             <div className="flex justify-between text-xs mb-2 font-medium text-brand-700">
               <span>
                 {isPaused ? 'Paused' : 'Processing rows...'}
                 {total > 0 && total < 1000000 && (
                    <span className="text-slate-400 font-normal ml-2">(Target: {total})</span>
                 )}
               </span>
               <span>{Math.min(100, Math.round((progress / total) * 100))}%</span>
             </div>
             <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
               <div
                 className={`h-2.5 rounded-full transition-all duration-300 ease-out ${isPaused ? 'bg-amber-500' : 'bg-brand-500'}`}
                 style={{ width: `${Math.min(100, (progress / total) * 100)}%` }}
               ></div>
             </div>
             <p className="text-xs text-slate-400 mt-2">
               {isPaused
                 ? `Paused at ${progress} of ${total} items. Click Resume to continue.`
                 : `Researched ${progress} of ${total} items. Please wait, do not close tab.`
               }
             </p>
           </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-100">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Uses Gemini with Google Search.</span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {!isRunning && (
            <button
              onClick={onClear}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-500 bg-white border border-slate-300 hover:border-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all"
              title="Clear all data"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

           {!isRunning && (
             <>
               <button
                onClick={() => onExport('csv')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 hover:text-brand-600 hover:border-brand-200 transition-all active:scale-95"
                title="Download as CSV"
               >
                 <FileText className="w-4 h-4" />
                 CSV
               </button>
               <button
                onClick={() => onExport('xlsx')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 hover:text-green-600 hover:border-green-200 transition-all active:scale-95"
                title="Download as Excel"
               >
                 <FileSpreadsheet className="w-4 h-4" />
                 Excel
               </button>
             </>
           )}

          {/* Cancel button when running */}
          {isRunning && (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2.5 text-red-600 bg-white border border-red-300 hover:bg-red-50 hover:border-red-400 rounded-lg font-medium transition-all active:scale-95"
              title="Cancel and stop processing"
            >
              <StopCircle className="w-4 h-4" />
              Cancel
            </button>
          )}

          {/* Pause/Resume button when running */}
          {isRunning && (
            <button
              onClick={isPaused ? onResume : onPause}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all active:scale-95 ${
                isPaused
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {isPaused ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              )}
            </button>
          )}

          {/* Start button - only when not running */}
          {!isRunning && (
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium shadow-lg transition-all active:scale-95 ${
                !isValid
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-700 hover:to-brand-600 hover:shadow-brand-500/25'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              Start Agent
            </button>
          )}

          {/* Processing indicator when actively processing */}
          {isProcessing && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-brand-100 text-brand-700 rounded-lg font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
