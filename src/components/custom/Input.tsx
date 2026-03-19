"use client"

import { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FileCode2, Command, Square, Sparkles } from "lucide-react";
import CodeEditorPanel from "./CodeEditorPanel";
import { useAppContext } from "@/context/AppContext";

interface InputProps {
  sourceCode: string;
  setSourceCode: (val: string) => void;
  sourceError: boolean;
  setSourceError: (val: boolean) => void;
  inputInstruction: string;
  setInputInstruction: (val: string) => void;
  inputError: boolean;
  setInputError: (val: boolean) => void;
  isChatExpanded: boolean;
  setIsChatExpanded: (val: boolean) => void;
  startAnalysis: () => void;
  stopAnalysis: () => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export default function Input({
  sourceCode,
  setSourceCode,
  sourceError,
  setSourceError,
  inputInstruction,
  setInputInstruction,
  inputError,
  setInputError,
  isChatExpanded,
  startAnalysis,
  stopAnalysis,
  chatInputRef
}: InputProps) {
  const { appState } = useAppContext();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const lineCount = sourceCode ? sourceCode.split('\n').length : 0;
  const isOverLimit = lineCount > 20;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputInstruction(e.target.value);
    if (inputError) setInputError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (appState !== 'analyzing' && !isOverLimit) {
        startAnalysis();
      }
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full min-h-0 animate-meet-left relative">
      <div className={`flex-1 flex flex-col min-h-0 rounded-[24px] ring-1 overflow-hidden transition-all duration-700 shadow-2xl relative backdrop-blur-2xl
        ${sourceError 
          ? (isDark ? 'bg-[#0f0f11]/90 ring-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]' : 'bg-white/90 ring-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]')
          : (isDark ? 'bg-[#0f0f11]/80 ring-white/[0.08]' : 'bg-white/80 ring-slate-200/60')
        }`}>
        
        {/* Inner Header */}
        <div className={`px-5 flex items-center justify-between border-b h-[48px] shrink-0 relative z-20 transition-colors duration-700
          ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-slate-50/50 border-slate-100'}`}>
          <div className="flex items-center gap-2.5">
            <span className={`text-[11px] font-mono font-bold tracking-widest uppercase transition-colors duration-700 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>Student Snippet</span>
          </div>
          
          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-sm transition-all flex items-center gap-1 ${
            isOverLimit 
              ? (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' : 'bg-red-50 text-red-600 border-red-200 animate-pulse') 
              : (isDark ? 'bg-white/5 text-gray-400 border-white/10' : 'bg-white text-slate-500 border-slate-200')
          }`}>
            <span className={isOverLimit ? 'text-red-500' : 'text-cyan-500'}>#</span> {lineCount} / 20 LINES
          </div>
        </div>
        
        {/* Editor Area */}
        <div className="flex-1 min-h-0 flex flex-col relative z-10">
          {sourceCode.trim() === '' && (
            <div className="absolute top-0 right-0 bottom-0 left-14 flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10">
              <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[24px] mb-6 shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition-colors duration-700
                ${isDark ? 'bg-[#18181b] ring-1 ring-white/5' : 'bg-white ring-1 ring-slate-200/50 shadow-xl'}`}>
                <FileCode2 size={36} className={isDark ? 'text-cyan-500/50' : 'text-cyan-500/60'} strokeWidth={1.5} />
              </div>
              <p className={`text-[15px] font-semibold transition-colors duration-700 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                Paste a short Java code snippet (5–20 lines only)
              </p>
              <p className={`text-[13px] mt-2 font-medium max-w-sm transition-colors duration-700 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                Best for loops, functions, and small logic blocks. No class/package declarations needed.
              </p>
            </div>
          )}
          {/* Massive 240px bottom padding to clear the floating chatbox */}
          <CodeEditorPanel 
            value={sourceCode} 
            onChange={(val) => {
              setSourceCode(val);
              if (sourceError) setSourceError(false);
            }} 
            diffType="removed"
            showDiff={appState === 'done'}
            placeholder="" 
            bottomPadding="240px"
          />
        </div>

        {/* Luxurious Floating Chatbox with Buttery Smooth Transitions */}
        <div className={`absolute bottom-0 left-0 w-full pt-20 pb-6 px-6 z-30 pointer-events-none transition-colors duration-700
          ${isDark ? 'bg-gradient-to-t from-[#0f0f11] via-[#0f0f11]/90 to-transparent' : 'bg-gradient-to-t from-white via-white/90 to-transparent'}`}>
          
          <div className={`pointer-events-auto flex items-end gap-3 pl-4 pr-2 py-2 mx-auto max-w-xl ring-1 backdrop-blur-2xl shadow-2xl
            ${inputError 
              ? 'ring-red-500/50 bg-red-500/5 shadow-[0_0_30px_rgba(239,68,68,0.15)]' 
              : (isDark ? 'bg-[#111]/95 ring-white/10 focus-within:ring-cyan-400/50 focus-within:shadow-[0_0_30px_rgba(0,229,255,0.1)] shadow-[0_10px_40px_rgba(0,0,0,0.6)]' : 'bg-white/95 ring-slate-200/80 focus-within:ring-cyan-400/40 focus-within:shadow-[0_0_30px_rgba(0,229,255,0.15)] shadow-[0_10px_40px_rgba(0,0,0,0.08)]')
            }`}
            style={{
              borderRadius: isChatExpanded ? '16px' : '28px',
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            
            <div className="h-[40px] w-[32px] flex items-center justify-center shrink-0">
              <Command className={`${inputError ? 'text-red-500' : (isDark ? 'text-cyan-400' : 'text-cyan-500')} transition-colors duration-300 opacity-90`} size={18} />
            </div>
            
            <textarea 
              ref={chatInputRef}
              value={inputInstruction} 
              onChange={handleInputChange} 
              onKeyDown={handleKeyDown}
              placeholder="Ask the Swarm to refactor or optimize..." 
              className={`flex-1 bg-transparent border-none outline-none text-[14px] font-medium transition-colors resize-none overflow-y-auto custom-chat-scrollbar
                ${isDark ? 'text-gray-200 placeholder-gray-500' : 'text-slate-900 placeholder-slate-400'}`} 
              disabled={appState === 'analyzing'}
              rows={1}
              style={{ minHeight: '40px', lineHeight: '24px', paddingTop: '8px', paddingBottom: '8px' }}
            />

            <div className="h-[40px] flex items-center shrink-0">
              {appState === 'analyzing' ? (
                <button onClick={stopAnalysis} className={`h-[34px] px-5 rounded-full text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}><Square size={12} className="fill-current" /> Stop</button>
              ) : (
                <button onClick={startAnalysis} disabled={isOverLimit} className={`h-[34px] px-6 text-white rounded-full text-[13px] font-bold flex items-center gap-2 shadow-[0_4px_15px_rgba(0,229,255,0.25)] hover:shadow-[0_6px_20px_rgba(0,229,255,0.4)] transition-all duration-300 cursor-pointer ${isOverLimit ? 'bg-gray-500 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}><Sparkles size={14} className="fill-current" /> Refactor</button>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
