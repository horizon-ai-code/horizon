"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { AlertTriangle } from "lucide-react";

interface WarningModalProps {
  isOpen: boolean;
  message: string;
  onProceed: () => void;
  onEdit: () => void;
}

export function WarningModal({ isOpen, message, onProceed, onEdit }: WarningModalProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen) return null;

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 backdrop-blur-sm transition-colors ${
          isDark ? "bg-black/60" : "bg-slate-900/40"
        }`}
        onClick={onEdit}
      />
      
      {/* Modal Box */}
      <div className={`relative w-full max-w-md border rounded-2xl shadow-2xl p-6 mx-4 animate-in fade-in zoom-in-95 duration-200 transition-all ${
        isDark 
          ? "bg-jb-bg border-amber-500/30 text-jb-text shadow-black/80" 
          : "bg-white border-amber-200 text-slate-900 shadow-xl shadow-slate-400/20"
      }`}>
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 rounded-xl shrink-0 border ${
            isDark ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-amber-100 border-amber-300 text-amber-700"
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className={`text-lg font-bold tracking-tight ${
            isDark ? "text-amber-400" : "text-amber-800"
          }`}>
            Baseline Issue Detected
          </h2>
        </div>
        
        {/* Body */}
        <div className="mb-6 space-y-3">
          <p className={`text-xs leading-relaxed ${
            isDark ? "text-jb-text-muted" : "text-slate-600"
          }`}>
            The Phase 1 Baseline Validator flagged the following issue with your input code:
          </p>
          <div className={`p-3 border rounded-xl text-xs font-mono whitespace-pre-wrap break-words ${
            isDark 
              ? "bg-amber-950/40 border-amber-500/20 text-amber-200" 
              : "bg-amber-50 border-amber-200 text-amber-950"
          }`}>
            {message}
          </div>
          <p className={`text-xs leading-relaxed ${
            isDark ? "text-stone-400" : "text-slate-500"
          }`}>
            The Orchestrator requires a structurally valid baseline to mathematically verify refactor intent in Phase 4. If you proceed anyway, the system will attempt to fix the baseline, but the final validation phase will likely fail.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            onClick={onProceed}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors border cursor-pointer ${
              isDark 
                ? "bg-jb-panel hover:bg-jb-border/60 text-slate-300 border-jb-border/50" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
          >
            Proceed Anyway
          </button>
          <button
            onClick={onEdit}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer border-none ${
              isDark
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20"
                : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/30"
            }`}
          >
            Edit & Retry
          </button>
        </div>
      </div>
    </div>
  );
}
