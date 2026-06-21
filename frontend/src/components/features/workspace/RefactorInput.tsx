"use client"

import { Command, Sparkles, Square, ChevronDown } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import type { AppState } from "@/types/session";
import { useChatStore } from "@/store/useChatStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPRING_TRANSITION = { type: "spring" as const, stiffness: 450, damping: 40 };

interface RefactorInputProps {
  sessionId: string | null;
  sourceCode: string;
  inputInstruction: string;
  setInputInstruction: (val: string) => void;
  inputError: boolean;
  setInputError: (val: boolean) => void;
  validateBeforeSubmit: () => boolean;
  startAnalysis: () => void;
  startSingleRefactor: () => void;
  stopAnalysis: () => void;
  appState: AppState;
}

export default function RefactorInput({
  sessionId,
  sourceCode,
  inputInstruction,
  setInputInstruction,
  inputError,
  setInputError,
  validateBeforeSubmit,
  startAnalysis,
  startSingleRefactor,
  stopAnalysis,
  appState
}: RefactorInputProps) {
  const controls = useAnimation();
  const draftSession = useChatStore((state) => state.draftSession);
  const updateDraftSession = useChatStore((state) => state.updateDraftSession);
  
  useEffect(() => {
    if (inputError) {
      controls.start({
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.4 }
      });
    }
  }, [inputError, controls]);
  
  // Mapped state variables to match your branch's exact naming
  const [isChatFocused, setIsChatFocused] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [refactorMode, setRefactorMode] = useState<"multi" | "single">("multi");

  // Smooth auto-resize logic
  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = '40px';
      const scrollHeight = chatInputRef.current.scrollHeight;
      chatInputRef.current.style.height = Math.min(scrollHeight, 160) + 'px';
    }
  }, [inputInstruction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputInstruction(e.target.value);
    if (inputError) setInputError(false);
  };

  const handleSubmit = () => {
    if (appState === "analyzing" || appState === "waiting") return;
    if (!validateBeforeSubmit()) return;

    if (refactorMode === "single") {
      startSingleRefactor();
      return;
    }

    startAnalysis();
  };

  const isChatExpanded = isChatFocused || inputInstruction.length > 0;
  const isSubmitDisabled = !sourceCode.trim() || !inputInstruction.trim() || appState === "analyzing" || appState === "waiting";

  return (
    <div id="tour-refactor-input" className="absolute bottom-0 left-0 w-full pt-20 pb-6 px-6 z-30 pointer-events-none bg-gradient-to-t from-jb-bg via-jb-bg/90 to-transparent">
      <motion.div
        layout
        animate={controls}
        onClick={() => chatInputRef.current?.focus()}
        className={`pointer-events-auto flex items-end gap-3 pl-4 pr-2 py-2 mx-auto ring-1 backdrop-blur-2xl shadow-2xl cursor-text transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
          ${isChatExpanded ? 'max-w-full w-full' : 'max-w-[420px]'}
          ${inputError
              ? 'ring-destructive/50 bg-destructive/5 shadow-[0_0_30px_rgba(239,68,68,0.15)]'
              : 'bg-jb-panel/95 ring-jb-border/50 focus-within:ring-jb-accent/30 focus-within:shadow-[0_0_30px_rgba(53,116,240,0.1)] shadow-2xl'
          }`}
        style={{
          borderRadius: isChatExpanded ? '16px' : '28px',
        }}
        transition={SPRING_TRANSITION}
      >
        <div className="h-[40px] w-[32px] flex items-center justify-center shrink-0">
          <Command className={`${inputError ? 'text-destructive' : 'text-jb-accent'} opacity-90`} size={18} />
        </div>
        <textarea
          ref={chatInputRef}
          value={inputInstruction}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsChatFocused(true)}
          onBlur={() => setIsChatFocused(false)}
          placeholder="Ask the Swarm to refactor..."
          className={`flex-1 bg-transparent border-none outline-none text-[14px] font-medium resize-none overflow-y-auto custom-chat-scrollbar placeholder-jb-text-muted caret-jb-accent ${appState === 'analyzing' || appState === 'waiting' ? 'text-jb-text-muted cursor-not-allowed' : 'text-jb-text'}`}
          disabled={appState === 'analyzing' || appState === 'waiting'}
          rows={1}
          style={{ minHeight: '40px', lineHeight: '24px', paddingTop: '8px', paddingBottom: '8px' }}
        />
        <div className="h-[40px] flex items-center shrink-0">
          {appState === 'analyzing' || appState === 'waiting' ? (
            <button onClick={stopAnalysis} className="h-[34px] px-5 rounded-full text-xs font-bold flex items-center gap-2 transition-transform cursor-pointer hover:scale-105 active:scale-95 bg-destructive/10 text-destructive hover:bg-destructive/20 border-none outline-none focus:ring-0">
              <Square size={12} className="fill-current" /> Stop
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className={`h-[34px] px-5 rounded-full text-white text-[13px] font-bold flex items-center gap-2 transition-all cursor-pointer
                  ${isSubmitDisabled
                    ? 'opacity-40 cursor-not-allowed bg-jb-text-muted/20 text-jb-text-muted shadow-none'
                    : 'shadow-[0_4px_15px_rgba(53,116,240,0.25)] hover:shadow-[0_6px_20px_rgba(53,116,240,0.4)] hover:scale-105 active:scale-95 bg-jb-accent border-none'
                  }`}
              >
                <Sparkles size={14} className={isSubmitDisabled ? "" : "fill-current"} /> Run
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={isSubmitDisabled}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border
                    ${isSubmitDisabled
                      ? 'opacity-40 cursor-not-allowed text-jb-text-muted border-jb-text-muted/20 bg-transparent'
                      : refactorMode === "multi"
                        ? 'text-[#5a8cf8] border-[#5a8cf8]/30 hover:border-[#5a8cf8]/60 hover:bg-[#5a8cf8]/10'
                        : 'text-[#a855f7] border-[#a855f7]/30 hover:border-[#a855f7]/60 hover:bg-[#a855f7]/10'
                    }`}
                  aria-label="Select mode"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${refactorMode === "multi" ? "bg-[#5a8cf8]" : "bg-[#a855f7]"}`} />
                  {refactorMode === "multi" ? "Multi" : "Single"}
                  <ChevronDown size={10} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[170px] p-1.5">
                  <DropdownMenuItem
                    onClick={() => setRefactorMode("multi")}
                    className={`flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 text-[13px] ${refactorMode === "multi" ? "font-bold bg-accent/50" : ""}`}
                  >
                    <div className={`h-2.5 w-2.5 rounded-full ${refactorMode === "multi" ? "bg-[#5a8cf8] shadow-[0_0_8px_#5a8cf8]" : "bg-transparent border-2 border-jb-text-muted"}`} />
                    <div className="flex flex-col">
                      <span>Multi-Agent</span>
                      <span className="text-[10px] text-jb-text-muted font-normal">Full 6-phase pipeline</span>
                    </div>
                    {refactorMode === "multi" && <span className="ml-auto text-[10px] text-jb-accent">✓</span>}
                  </DropdownMenuItem>
                  <div className="h-px bg-border mx-2 my-1" />
                  <DropdownMenuItem
                    onClick={() => setRefactorMode("single")}
                    className={`flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 text-[13px] ${refactorMode === "single" ? "font-bold bg-accent/50" : ""}`}
                  >
                    <div className={`h-2.5 w-2.5 rounded-full ${refactorMode === "single" ? "bg-[#a855f7] shadow-[0_0_8px_#a855f7]" : "bg-transparent border-2 border-jb-text-muted"}`} />
                    <div className="flex flex-col">
                      <span>Single-Pass</span>
                      <span className="text-[10px] text-jb-text-muted font-normal">Single-pass refactor</span>
                    </div>
                    {refactorMode === "single" && <span className="ml-auto text-[10px] text-jb-accent">✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
