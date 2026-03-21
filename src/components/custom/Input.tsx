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
  const [isFocused, setIsFocused] = useState(false);

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
      <div className={`flex-1 flex flex-col min-h-0 rounded-[24px] ring-1 overflow-hidden shadow-2xl relative backdrop-blur-2xl
        ${sourceError 
          ? 'bg-red-500/5 ring-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
          : 'bg-background/80 ring-border/60'
        }`}>
        
        {/* NEW MAC-STYLE HEADER */}
        <div className="px-5 flex items-center justify-between border-b h-[48px] shrink-0 relative z-20 bg-secondary/50 border-border">
          
          {/* Mac Traffic Lights */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
          </div>
          
          {/* Right Aligned Badges */}
          <div className="flex items-center gap-3">
            <div className={`text-[10px] font-bold px-3 py-1 rounded-full border shadow-sm flex items-center gap-1 ${
              isOverLimit 
                ? 'bg-destructive/10 text-destructive border-destructive/20 animate-pulse'
                : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30'
            }`}>
              <span className={isOverLimit ? 'text-destructive' : 'text-cyan-500'}>#</span> {lineCount} / 20 LINES
            </div>
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-muted-foreground">
              INPUT
            </span>
          </div>
        </div>
        
        {/* Editor Area */}
        <div className="flex-1 min-h-0 flex flex-col relative z-10">
          {sourceCode.trim() === '' && (
            <div className="absolute top-0 right-0 bottom-0 left-14 flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10">
              <div className="flex items-center justify-center w-[88px] h-[88px] rounded-[32px] mb-6 shadow-2xl bg-background ring-1 ring-border">
                <FileCode2 size={36} className="text-cyan-500/60" strokeWidth={1.5} />
              </div>
              <p className="text-[15px] font-semibold text-foreground">
                Paste a short Java code snippet (5–20 lines only)
              </p>
              <p className="text-[13px] mt-2 font-medium max-w-sm text-muted-foreground">
                Best for loops, functions, and small logic blocks. No class/package declarations needed.
              </p>
            </div>
          )}
          <CodeEditorPanel 
            value={sourceCode} 
            onChange={(val) => {
              setSourceCode(val);
              if (sourceError) setSourceError(false);
            }} 
            highlightLines={{ removed: [1, 2, 3, 4, 5, 6, 7] }} 
            showDiff={appState === 'done'}
            placeholder="" 
            bottomPadding="240px"
          />
        </div>

        {/* Luxurious Floating Chatbox */}
        <div className="absolute bottom-0 left-0 w-full pt-20 pb-6 px-6 z-30 pointer-events-none bg-gradient-to-t from-background via-background/90 to-transparent">
          
          <div 
            className={`pointer-events-auto flex items-end gap-3 pl-4 pr-2 py-2 mx-auto ring-1 backdrop-blur-2xl shadow-2xl
              ${isFocused ? 'max-w-full w-full' : 'max-w-xl'} 
              ${inputError 
                ? 'ring-red-500/50 bg-red-500/5 shadow-[0_0_30px_rgba(239,68,68,0.15)]' 
                : 'bg-background/95 ring-border focus-within:ring-cyan-500/50 focus-within:shadow-[0_0_30px_rgba(0,229,255,0.1)] shadow-2xl'
              }`}
            style={{
              borderRadius: isChatExpanded ? '16px' : '28px',
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            
            <div className="h-[40px] w-[32px] flex items-center justify-center shrink-0">
              <Command className={`${inputError ? 'text-destructive' : 'text-cyan-500'} opacity-90`} size={18} />
            </div>

            <textarea 
              ref={chatInputRef}
              value={inputInstruction} 
              onChange={handleInputChange} 
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}   
              onBlur={() => setIsFocused(false)}   
              placeholder="Ask the Swarm to refactor or optimize..." 
              className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium resize-none overflow-y-auto custom-chat-scrollbar text-foreground placeholder-muted-foreground" 
              disabled={appState === 'analyzing'}
              rows={1}
              style={{ minHeight: '40px', lineHeight: '24px', paddingTop: '8px', paddingBottom: '8px' }}
            />

            <div className="h-[40px] flex items-center shrink-0">
              {appState === 'analyzing' ? (
                <button onClick={stopAnalysis} className="h-[34px] px-5 rounded-full text-xs font-bold flex items-center gap-2 transition-transform cursor-pointer hover:scale-105 active:scale-95 bg-destructive/10 text-destructive hover:bg-destructive/20"><Square size={12} className="fill-current" /> Stop</button>
              ) : (
                <button onClick={startAnalysis} disabled={isOverLimit} className={`h-[34px] px-6 text-white rounded-full text-[13px] font-bold flex items-center gap-2 shadow-[0_4px_15px_rgba(0,229,255,0.25)] hover:shadow-[0_6px_20px_rgba(0,229,255,0.4)] transition-transform cursor-pointer hover:scale-105 active:scale-95 ${isOverLimit ? 'bg-muted-foreground cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}><Sparkles size={14} className="fill-current" /> Refactor</button>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}