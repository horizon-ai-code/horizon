import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WarningModalProps {
  isOpen: boolean;
  message: string;
  onProceed: () => void;
  onEdit: () => void;
}

export function WarningModal({ isOpen, message, onProceed, onEdit }: WarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onEdit} // Default to closing/editing if they click outside
      />
      
      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-stone-900 border border-red-900/50 rounded-xl shadow-2xl p-6 mx-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-3 text-red-500 mb-4">
          <div className="p-2 bg-red-500/10 rounded-full">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-red-50">Baseline Issue Detected</h2>
        </div>
        
        {/* Body */}
        <div className="mb-6 space-y-3">
          <p className="text-stone-300 text-sm leading-relaxed">
            The Phase 1 Baseline Validator flagged the following issue with your input code:
          </p>
          <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-lg text-red-200 text-sm font-mono whitespace-pre-wrap break-words">
            {message}
          </div>
          <p className="text-stone-400 text-sm leading-relaxed mt-2">
            The Orchestrator requires a structurally valid baseline to mathematically verify refactor intent in Phase 4. If you proceed anyway, the system will attempt to fix the baseline, but the final validation phase will likely fail.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onProceed}
            className="px-4 py-2 text-sm font-medium text-stone-300 bg-stone-800 hover:bg-stone-700 hover:text-white rounded-lg transition-colors border border-stone-700/50"
          >
            Proceed Anyway
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-lg shadow-red-900/20"
          >
            Edit & Retry
          </button>
        </div>
      </div>
    </div>
  );
}
