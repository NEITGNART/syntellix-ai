
import React, { useState } from 'react';
import { Sparkles, X, Loader2, Bot, BrainCircuit } from 'lucide-react';
import { generateResearchConfig } from '../services/geminiService';
import { ResearchTask } from '../types';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (tasks: Omit<ResearchTask, 'id'>[], targetColumns: string[]) => void;
  availableColumns: string[];
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ isOpen, onClose, onApply, availableColumns }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useProModel, setUseProModel] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const result = await generateResearchConfig(input, availableColumns, useProModel);
      
      // Check if we got valid result
      if ((result.tasks && result.tasks.length > 0) || (result.targetColumns && result.targetColumns.length > 0)) {
        onApply(result.tasks, result.targetColumns);
        onClose();
        setInput('');
      } else {
        alert('I could not generate a configuration from that request. Please try being more specific.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to generate tasks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6" />
            <h3 className="font-bold text-lg">AI Research Assistant</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm leading-relaxed">
            Tell me what you want to know about the data in your CSV. I'll automatically create the research columns and prompts, and select the right input columns for you.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="relative">
                <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g., 'Find the CEO's name and LinkedIn profile for each Company Name in the list.'"
                className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none text-sm mb-4 bg-slate-50"
                autoFocus
                />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <label className="flex items-center gap-3 cursor-pointer group select-none bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-full hover:bg-slate-100 transition-colors">
                  <div className="relative flex-shrink-0">
                      <input
                          type="checkbox"
                          className="sr-only"
                          checked={useProModel}
                          onChange={(e) => setUseProModel(e.target.checked)}
                      />
                      <div className={`block w-9 h-5 rounded-full transition-colors ${useProModel ? 'bg-purple-600' : 'bg-slate-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${useProModel ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BrainCircuit className={`w-4 h-4 ${useProModel ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium transition-colors ${useProModel ? 'text-purple-700' : 'text-slate-600'}`}>
                        Use Pro Model 
                    </span>
                    <span className="text-xs text-slate-400 font-normal ml-auto">Better reasoning, slightly slower</span>
                  </div>
              </label>
            </div>
            
            <div className="flex justify-end gap-3 items-center pt-2 border-t border-slate-100">
               <div className="mr-auto text-xs text-slate-400 italic">
                  Powered by Gemini
               </div>
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${
                    useProModel ? 'bg-purple-700 hover:bg-purple-800' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" />
                        Generate Config
                    </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
