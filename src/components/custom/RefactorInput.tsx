"use client"

import { Command, Sparkles } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";

interface RefactorInputProps {
  inputInstruction: string;
  setInputInstruction: (val: string) => void;
  inputError: boolean;
  setInputError: (val: boolean) => void;
  startAnalysis: () => void;
  isDark: boolean;
}

export default function RefactorInput({
  inputInstruction,
  setInputInstruction,
  inputError,
  setInputError,
  startAnalysis,
  isDark
}: RefactorInputProps) {
  const { appState } = useAppContext();
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '34px';
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
    <div className="mx-auto w-full px-4 mb-6 absolute bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.div 
        layout
        initial={false}
        animate={{ 
          maxWidth: isExpanded ? 900 : 400, 
          opacity: 1,
          y: 0
        }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 28,
          opacity: { duration: 0.4 }
        }}
        className={`w-full pointer-events-auto relative group`}
      >
        <div className={`flex items-center gap-3 p-1.5 rounded-[32px] border transition-all duration-500 relative
          ${isDark 
            ? 'bg-[#1e1f22]/95 border-white/5 backdrop-blur-3xl ring-1 ring-inset ring-white/5' 
            : 'bg-white/95 border-[#ebecf0] backdrop-blur-2xl shadow-slate-200/60 ring-1 ring-inset ring-black/[0.02]'
          }
          ${inputError ? 'ring-2 ring-red-500/50 border-red-500/40 shadow-red-500/10' : 'hover:border-white/10'}
          ${isFocused && !inputError ? 'ring-2 ring-cyan-500/20 border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)]' : 'shadow-2xl'}`}>
          
          {/* Decorative side illumination (Premium detail) */}
          <div className="absolute inset-x-5 -top-px h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          <motion.div 
            animate={{ 
              backgroundColor: isFocused ? (isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.1)') : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
              color: isFocused ? (isDark ? '#06b6d4' : '#0891b2') : (isDark ? '#06b6d4' : '#0891b2')
            }}
            className="flex items-center justify-center w-[34px] h-[34px] shrink-0 rounded-full transition-colors overflow-hidden"
          >
            <Command size={16} strokeWidth={2.5} />
          </motion.div>

          {/* Textarea Area */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={inputInstruction}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask the Swarm to refactor..."
              className={`w-full bg-transparent border-none outline-none resize-none py-[6px] text-[14px] font-medium leading-[22px] max-h-[160px] transition-colors
                ${isDark ? 'text-jb-text placeholder-jb-text-muted/60' : 'text-[#080808] placeholder-[#818594]'}`}
              rows={1}
            />
          </div>

          {/* Refactor Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startAnalysis}
            disabled={appState === 'analyzing'}
            className={`h-[34px] px-6 rounded-full flex items-center gap-2 font-bold text-[13px] tracking-tight transition-all duration-300 shadow-lg active:scale-95 group/btn mr-[1px]
              ${appState === 'analyzing' 
                ? 'bg-jb-bg/50 text-jb-text-muted cursor-not-allowed opacity-50' 
                : 'bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 hover:brightness-110 text-white shadow-blue-500/20'
              }`}
          >
            <AnimatePresence mode="wait">
              {appState === 'analyzing' ? (
                <motion.div
                  key="analyzing"
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles size={14} className="opacity-80" />
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Sparkles size={14} className="group-hover/btn:rotate-12 transition-transform" />
                </motion.div>
              )}
            </AnimatePresence>
            <span>{appState === 'analyzing' ? 'Refactoring...' : 'Refactor'}</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
