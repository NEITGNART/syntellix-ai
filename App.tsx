
import React, { useState, useCallback, useRef } from 'react';
import { FileUploader } from './components/FileUploader';
import { UniverSheet, UniverSheetRef } from './components/UniverSheet';
import { AgentControlPanel } from './components/AgentControlPanel';
import { parseDataFile, exportCsv, exportExcel } from './utils/csvHelper';
import { researchEntity } from './services/geminiService';
import { CsvRow, ProcessingStatus, ResearchConfig, ResearchResult, Source } from './types';
import { Layout, Database, Search, Heart, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<CsvRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [originalData, setOriginalData] = useState<CsvRow[]>([]);
  const [originalColumns, setOriginalColumns] = useState<string[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [processedCount, setProcessedCount] = useState(0);
  const [activeConfig, setActiveConfig] = useState<ResearchConfig | null>(null);
  const [cellSources, setCellSources] = useState<Record<string, Source[]>>({});

  // Refs for pause/resume/cancel functionality
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const resumeResolverRef = useRef<(() => void) | null>(null);

  // Ref for UniverSheet to call syncData
  const sheetRef = useRef<UniverSheetRef>(null);

  const handleFileUpload = async (file: File) => {
    try {
      setStatus(ProcessingStatus.IDLE);
      setProcessedCount(0);
      setActiveConfig(null);
      setCellSources({});
      const result = await parseDataFile(file);
      
      // Initialize both current and original data
      setData(result.data);
      setColumns(result.columns);
      setOriginalData(result.data);
      setOriginalColumns(result.columns);
    } catch (error) {
      console.error("Failed to parse file", error);
      alert("Error parsing file. Please check the format.");
    }
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear the current data? This action cannot be undone.")) {
      setData([]);
      setColumns([]);
      setOriginalData([]);
      setOriginalColumns([]);
      setStatus(ProcessingStatus.IDLE);
      setProcessedCount(0);
      setActiveConfig(null);
      setCellSources({});
    }
  };

  const handleCellUpdate = (rowIndex: number, column: string, value: string) => {
    setData(prevData => {
      const newData = [...prevData];
      newData[rowIndex] = {
        ...newData[rowIndex],
        [column]: value
      };
      return newData;
    });
  };

  // Pause handler
  const handlePause = useCallback(() => {
    isPausedRef.current = true;
    setStatus(ProcessingStatus.PAUSED);
  }, []);

  // Resume handler
  const handleResume = useCallback(() => {
    isPausedRef.current = false;
    setStatus(ProcessingStatus.PROCESSING);
    // Resolve the promise to continue the loop
    if (resumeResolverRef.current) {
      resumeResolverRef.current();
      resumeResolverRef.current = null;
    }
  }, []);

  // Helper to wait for resume when paused
  const waitForResume = useCallback(() => {
    return new Promise<void>((resolve) => {
      resumeResolverRef.current = resolve;
    });
  }, []);

  // Cancel handler
  const handleCancel = useCallback(() => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setStatus(ProcessingStatus.IDLE);
    // If paused, resolve to break out of the wait
    if (resumeResolverRef.current) {
      resumeResolverRef.current();
      resumeResolverRef.current = null;
    }
  }, []);

  const handleStartResearch = useCallback(async (config: ResearchConfig) => {
    if (!data.length) return;

    // Reset pause/cancel state at start
    isPausedRef.current = false;
    isCancelledRef.current = false;
    resumeResolverRef.current = null;

    setStatus(ProcessingStatus.PROCESSING);
    setActiveConfig(config);
    setProcessedCount(0);

    // Add new columns to the header if they don't exist
    const newColumnsToAdd = config.tasks.map(t => t.newColumnName).filter(name => !columns.includes(name));
    if (newColumnsToAdd.length > 0) {
      setColumns(prev => [...prev, ...newColumnsToAdd]);
    }

    const newData = [...data];

    // Determine how many rows to process based on limit
    // If rowLimit is set and > 0, use it. Otherwise process all.
    const limit = config.rowLimit && config.rowLimit > 0 ? config.rowLimit : newData.length;
    const effectiveTotal = Math.min(newData.length, limit);

    // Dynamic batch size based on number of tasks per row
    const tasksPerItem = config.tasks.length;
    const concurrentLimit = config.useThinkingModel ? 2 : 10;
    const BATCH_SIZE = Math.max(1, Math.floor(concurrentLimit / tasksPerItem));

    // Process in batches until we reach the effective total
    for (let i = 0; i < effectiveTotal; i += BATCH_SIZE) {
      // Check if cancelled
      if (isCancelledRef.current) {
        return; // Exit early, status already set to IDLE by handleCancel
      }

      // Check if paused before starting a new batch
      if (isPausedRef.current) {
        await waitForResume();
        // Check again if cancelled while paused
        if (isCancelledRef.current) {
          return;
        }
      }

      const batchEnd = Math.min(i + BATCH_SIZE, effectiveTotal);

      const batchPromises: Promise<{ rowIndex: number; taskIndex: number; result: ResearchResult }>[] = [];

      // Prepare promises for the current batch
      for (let j = i; j < batchEnd; j++) {
        const row = newData[j];

        // Combine all selected columns to form the entity name
        const entityName = config.targetColumns
          .map(col => row[col])
          .filter(val => val && val.trim() !== '')
          .join(' ');

        if (entityName) {
          // Context: Send ALL other columns that are NOT part of the entity identity to provide context
          const contextParts = Object.entries(row)
            .filter(([key]) => !config.targetColumns.includes(key) && !config.tasks.find(t => t.newColumnName === key))
            .map(([key, val]) => `${key}: ${val}`);
          const contextStr = contextParts.join(', ');

          // Create a promise for each task for this row
          config.tasks.forEach((task, taskIdx) => {
            const promise = researchEntity(
              entityName,
              task.prompt,
              contextStr,
              config.useThinkingModel
            )
              .then(result => ({
                rowIndex: j,
                taskIndex: taskIdx,
                result
              }));
            batchPromises.push(promise);
          });
        }
      }

      // Wait for all requests in the batch to complete
      if (batchPromises.length > 0) {
        const results = await Promise.all(batchPromises);

        const newSources: Record<string, Source[]> = {};

        // Update data with results
        results.forEach(({ rowIndex, taskIndex, result }) => {
          const colName = config.tasks[taskIndex].newColumnName;

          // Update row data
          newData[rowIndex] = {
            ...newData[rowIndex],
            [colName]: result.text
          };

          // Collect sources if available
          if (result.sources && result.sources.length > 0) {
            newSources[`${rowIndex}-${colName}`] = result.sources;
          }
        });

        // Update sources state once per batch
        setCellSources(prev => ({ ...prev, ...newSources }));
      }

      // Update state to reflect progress
      setData([...newData]);
      setProcessedCount(batchEnd);

      // Add a delay between batches to respect rate limits
      if (batchEnd < effectiveTotal) {
        await new Promise(resolve => setTimeout(resolve, config.useThinkingModel ? 4000 : 2000));
      }
    }

    setStatus(ProcessingStatus.COMPLETED);
  }, [data, columns, waitForResume]);

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (format === 'csv') {
      exportCsv(data, 'enriched_data_agent.csv');
    } else {
      exportExcel(data, 'enriched_data_agent.xlsx');
    }
  };

  // Manual sync handler
  const handleSync = useCallback(() => {
    if (sheetRef.current) {
      sheetRef.current.syncData();
    }
  }, []);

  const highlightColumns = activeConfig ? activeConfig.tasks.map(t => t.newColumnName) : [];

  // Calculate the effective total to display in the progress bar
  // If actively processing/paused with a limit, show the limit. Otherwise show total data length.
  const isActiveOrComplete = status === ProcessingStatus.PROCESSING || status === ProcessingStatus.PAUSED || status === ProcessingStatus.COMPLETED;
  const displayTotal = isActiveOrComplete && activeConfig?.rowLimit && activeConfig.rowLimit > 0
    ? Math.min(data.length, activeConfig.rowLimit)
    : data.length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://easydata.sirv.com/syntellix%20(1).png" 
              alt="Syntellix Logo" 
              className="h-8 w-auto object-contain" 
            />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Syntellix <span className="text-brand-600">AI</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {!process.env.API_KEY && (
              <span className="text-red-500 font-medium bg-red-50 px-3 py-1 rounded-full">
                API Key Missing
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-grow w-full">
        
        {/* Hero / Upload Section */}
        {data.length === 0 ? (
          <div className="mt-10 space-y-8">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h2 className="text-4xl font-extrabold text-slate-900 sm:text-5xl tracking-tight">
                Turn your spreadsheet into a <br/>
                <span className="text-brand-600">Research Engine</span>
              </h2>
              <p className="text-lg text-slate-600">
                Upload a CSV or Excel file, define a question, and let our AI agent browse the web to fill in the missing gaps automatically.
              </p>
            </div>
            <FileUploader onFileUpload={handleFileUpload} />
            
            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-5xl mx-auto">
               <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                   <Database className="w-5 h-5 text-blue-600" />
                 </div>
                 <h3 className="font-semibold text-slate-900">Easy Import</h3>
                 <p className="text-slate-500 text-sm mt-2">Drag and drop any standard CSV or Excel file. We parse it instantly in your browser.</p>
               </div>
               <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-4">
                   <Search className="w-5 h-5 text-purple-600" />
                 </div>
                 <h3 className="font-semibold text-slate-900">Live Research</h3>
                 <p className="text-slate-500 text-sm mt-2">Powered by Gemini Grounding, the agent actually searches the internet for real-time data.</p>
               </div>
               <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                   <Layout className="w-5 h-5 text-green-600" />
                 </div>
                 <h3 className="font-semibold text-slate-900">Structured Output</h3>
                 <p className="text-slate-500 text-sm mt-2">The AI formats answers strictly into your new column, ready for export.</p>
               </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            
            {/* Control Panel */}
            <AgentControlPanel
              columns={columns}
              status={status}
              onStart={handleStartResearch}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
              onExport={handleExport}
              onClear={handleClearData}
              progress={processedCount}
              total={displayTotal}
            />

            {/* Data Display */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800">Data Preview</h3>
                  <button
                    onClick={handleSync}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Sync data from spreadsheet"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {activeConfig && (
                  <div className="flex gap-2">
                    {activeConfig.tasks.map(t => (
                      <span key={t.newColumnName} className="text-xs text-brand-600 font-medium bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                        +{t.newColumnName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <UniverSheet
                ref={sheetRef}
                data={data}
                columns={columns}
                highlightColumns={highlightColumns}
                cellSources={cellSources}
                onCellUpdate={handleCellUpdate}
                onDataChange={setData}
                onColumnsChange={setColumns}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="w-full py-6 mt-auto border-t border-slate-200 bg-white text-center">
        <p className="text-slate-500 text-sm flex items-center justify-center gap-1">
          Made with <Heart className="w-4 h-4 text-red-400 fill-current" /> by <a href="https://www.linkedin.com/in/trangpnh/" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">Celine Phan</a>
        </p>
      </footer>
    </div>
  );
};

export default App;
