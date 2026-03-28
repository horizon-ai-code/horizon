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
          maxWidth: isExpanded ? '900px' : '576px', // stays expanded with text or on focus
          borderRadius: '28px',
          opacity: 1,
          y: 0
        }}
        transition={{ 
          type: "spring",
          stiffness: 400,
          damping: 30,
          opacity: { duration: 0.2 }
        }}
        onClick={() => textareaRef.current?.focus()}
        className={`w-full pointer-events-auto mx-auto ring-1 backdrop-blur-2xl shadow-2xl transition-all duration-500 flex items-end gap-3 pl-4 pr-2 py-2 cursor-text
          ${inputError 
            ? 'ring-red-500/50 bg-red-500/5 shadow-[0_0_30px_rgba(239,68,68,0.15)]' 
            : `${isDark ? 'bg-jb-panel/95 ring-white/[0.05]' : 'bg-white/95 ring-black/[0.05]'} 
               ${isFocused ? 'ring-cyan-500/50 shadow-[0_0_40px_rgba(0,229,255,0.1)]' : ''}`
          }`}
      >
        <div className="h-[40px] w-[32px] flex items-center justify-center shrink-0">
          <Command 
            className={`transition-colors duration-300 ${inputError ? 'text-red-500' : 'text-cyan-500'} ${isFocused ? 'opacity-100' : 'opacity-70'}`} 
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
          className={`flex-1 bg-transparent border-none outline-none text-[14px] font-medium resize-none overflow-y-auto custom-chat-scrollbar placeholder-jb-text-muted/50 caret-cyan-500 transition-colors
            ${appState === 'analyzing' ? 'text-jb-text-muted/60 cursor-not-allowed' : 'text-jb-text'}`}
          disabled={appState === 'analyzing'}
          rows={1}
          style={{ minHeight: '40px', lineHeight: '24px', paddingTop: '8px', paddingBottom: '8px' }}
        />

        <div className="h-[40px] flex items-center shrink-0">
          <AnimatePresence mode="wait">
            {appState === 'analyzing' ? (
              <motion.button
                key="stop"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  stopAnalysis();
                }}
                className="h-[34px] px-5 rounded-full text-xs font-bold flex items-center gap-2 transition-transform cursor-pointer hover:scale-105 active:scale-95 bg-red-500/10 text-red-500 hover:bg-red-500/20"
              >
                <Square size={12} className="fill-current" /> 
                <span>Stop</span>
              </motion.button>
            ) : (
              <motion.button
                key="refactor"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  startAnalysis();
                }}
                className={`h-[34px] px-6 text-white rounded-full text-[13px] font-bold flex items-center gap-2 shadow-[0_4px_15px_rgba(0,229,255,0.25)] hover:shadow-[0_6px_20px_rgba(0,229,255,0.4)] transition-all cursor-pointer hover:scale-105 active:scale-95 bg-gradient-to-r from-cyan-400 to-blue-500 group`}
              >
                <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
                <span>Run</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
