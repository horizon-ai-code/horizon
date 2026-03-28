"use client"

import { Command, Sparkles, Square } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";

interface RefactorInputProps {
  inputInstruction: string;
  setInputInstruction: (val: string) => void;
  inputError: boolean;
  setInputError: (val: boolean) => void;
  startAnalysis: () => void;
  stopAnalysis: () => void;
  isDark: boolean;
}

export default function RefactorInput({
  inputInstruction,
  setInputInstruction,
  inputError,
  setInputError,
  startAnalysis,
  stopAnalysis,
  isDark
}: RefactorInputProps) {
  const { appState } = useAppContext();
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Smooth auto-resize logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 160) + 'px';
    }
  }, [inputInstruction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (appState !== 'analyzing') {
        startAnalysis();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputInstruction(e.target.value);
    if (inputError) setInputError(false);
  };

  const isExpanded = isFocused || inputInstruction.length > 0;

  return (
    <div className="absolute bottom-0 left-0 w-full pt-20 pb-6 px-6 z-30 pointer-events-none bg-gradient-to-t from-jb-bg via-jb-bg/90 to-transparent">
      <motion.div 
        layout
        initial={false}
        animate={{ 
          maxWidth: isExpanded ? '900px' : '576px',
          borderRadius: isExpanded ? '20px' : '28px', // Subtle shape morph
          opacity: 1,
          y: 0
        }}
        transition={{ 
          // Ultra-premium, fluid spring physics (zero bounce, smooth tail)
          layout: { type: "spring", bounce: 0, duration: 0.65 },
          borderRadius: { duration: 0.4, ease: "easeOut" }
        }}
        onClick={() => textareaRef.current?.focus()}
        className={`w-full pointer-events-auto mx-auto ring-1 backdrop-blur-2xl transition-all duration-700 ease-out flex items-end gap-3 pl-4 pr-2 py-2 cursor-text relative overflow-hidden
          ${inputError 
            ? 'ring-red-500/50 bg-red-500/5 shadow-[0_0_30px_rgba(239,68,68,0.15)]' 
            : `${isDark ? 'bg-jb-panel/95 ring-white/[0.08]' : 'bg-white/95 ring-black/[0.05]'} 
               ${isExpanded 
                  ? 'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]' 
                  : 'shadow-lg hover:shadow-xl hover:ring-white/[0.12]'}`
          }`}
      >
        {/* Subtle inner focus glow */}
        <div 
          className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-out rounded-inherit
            ${isFocused && !inputError ? 'opacity-100 ring-1 ring-inset ring-cyan-500/20 bg-cyan-500/[0.02]' : 'opacity-0'}`} 
        />

        <div className="h-[40px] w-[32px] flex items-center justify-center shrink-0 relative z-10">
          <Command 
            className={`transition-all duration-500 ease-out ${inputError ? 'text-red-500' : 'text-cyan-500'} 
              ${isFocused ? 'opacity-100 scale-100' : 'opacity-60 scale-95'}`} 
            size={18} 
          />
        </div>

        <textarea
          ref={textareaRef}
          value={inputInstruction}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask the Swarm to refactor..."
          className={`flex-1 bg-transparent border-none outline-none text-[14px] font-medium resize-none overflow-y-auto custom-chat-scrollbar placeholder-jb-text-muted/50 caret-cyan-500 transition-colors relative z-10
            ${appState === 'analyzing' ? 'text-jb-text-muted/60 cursor-not-allowed' : 'text-jb-text'}`}
          disabled={appState === 'analyzing'}
          rows={1}
          style={{ minHeight: '40px', lineHeight: '24px', paddingTop: '8px', paddingBottom: '8px' }}
        />

        <div className="h-[40px] flex items-center shrink-0 relative z-10">
          <AnimatePresence mode="wait">
            {appState === 'analyzing' ? (
              <motion.button
                key="stop"
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                transition={{ duration: 0.2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  stopAnalysis();
                }}
                className="h-[34px] px-5 rounded-full text-xs font-bold flex items-center gap-2 transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 bg-red-500/10 text-red-500 hover:bg-red-500/20"
              >
                <Square size={12} className="fill-current" /> 
                <span>Stop</span>
              </motion.button>
            ) : (
              <motion.button
                key="refactor"
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                transition={{ duration: 0.2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  startAnalysis();
                }}
                className={`h-[34px] px-6 text-white rounded-full text-[13px] font-bold flex items-center gap-2 shadow-[0_4px_15px_rgba(0,229,255,0.25)] hover:shadow-[0_6px_25px_rgba(0,229,255,0.4)] transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 bg-gradient-to-r from-cyan-400 to-blue-500 group
                  ${isExpanded ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
              >
                <Sparkles size={14} className="group-hover:rotate-12 transition-transform duration-300" />
                <span>Run</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}