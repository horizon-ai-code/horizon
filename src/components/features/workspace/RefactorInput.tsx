"use client"

import { Command, Sparkles, Square } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { useRouter } from "next/navigation";
import type { AppState } from "@/types/session";
import { useChatStore } from "@/store/useChatStore";

interface RefactorInputProps {
  sessionId: string | null;
  sourceCode: string;
  inputInstruction: string;
  setInputInstruction: (val: string) => void;
  inputError: boolean;
  setInputError: (val: boolean) => void;
  validateBeforeSubmit: () => boolean;
  startAnalysis: () => void;
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
  stopAnalysis,
  appState
}: RefactorInputProps) {
  const controls = useAnimation();
  const router = useRouter();
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
    if (appState === "analyzing") return;
    if (!validateBeforeSubmit()) return;

    if (sessionId) {
      startAnalysis();
      return;
    }

    const commandId = Date.now().toString();
    const initialPrompt = inputInstruction;
    
    updateDraftSession({
      sourceCode,
      inputInstruction: "",
      terminalEntries: [
        ...draftSession.terminalEntries,
        { id: commandId, type: "command", text: initialPrompt },
      ],
      appState: "analyzing",
      isTerminalCollapsed: false,
      showFlowchartModal: true,
      activeStep: 1,
      refactoredOutput: "",
    });
  };

  const isChatExpanded = isChatFocused || inputInstruction.length > 0;
  const isSubmitDisabled = !sourceCode.trim() || !inputInstruction.trim() || appState === "analyzing";

  return (
    <div className="absolute bottom-0 left-0 w-full pt-20 pb-6 px-6 z-30 pointer-events-none bg-gradient-to-t from-jb-bg via-jb-bg/90 to-transparent">
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
        transition={{
          type: "spring",
          stiffness: 450,
          damping: 40
        }}
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
          className={`flex-1 bg-transparent border-none outline-none text-[14px] font-medium resize-none overflow-y-auto custom-chat-scrollbar placeholder-jb-text-muted caret-jb-accent ${appState === 'analyzing' ? 'text-jb-text-muted cursor-not-allowed' : 'text-jb-text'}`}
          disabled={appState === 'analyzing'}
          rows={1}
          style={{ minHeight: '40px', lineHeight: '24px', paddingTop: '8px', paddingBottom: '8px' }}
        />
        <div className="h-[40px] flex items-center shrink-0">
          {appState === 'analyzing' ? (
            <button onClick={stopAnalysis} className="h-[34px] px-5 rounded-full text-xs font-bold flex items-center gap-2 transition-transform cursor-pointer hover:scale-105 active:scale-95 bg-destructive/10 text-destructive hover:bg-destructive/20 border-none outline-none focus:ring-0">
              <Square size={12} className="fill-current" /> Stop
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className={`h-[34px] px-6 text-white rounded-full text-[13px] font-bold flex items-center gap-2 transition-all cursor-pointer 
                ${isSubmitDisabled 
                  ? 'opacity-40 cursor-not-allowed bg-jb-text-muted/20 text-jb-text-muted shadow-none' 
                  : 'shadow-[0_4px_15px_rgba(53,116,240,0.25)] hover:shadow-[0_6px_20px_rgba(53,116,240,0.4)] hover:scale-105 active:scale-95 bg-jb-accent border-none'
                }`}
            >
              <Sparkles size={14} className={isSubmitDisabled ? "" : "fill-current"} /> Run
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
