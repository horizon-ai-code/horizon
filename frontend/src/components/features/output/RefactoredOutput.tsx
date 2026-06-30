"use client"

import { useTheme } from "next-themes";
import { Copy, Layers, Clock, AlertCircle } from "lucide-react";

import CodeEditorPanel from "@/components/features/editor/CodeEditorPanel";
import { formatJavaCode } from "@/lib/utils/javaFormatter";
import type { AppState, OrchestrationResult } from "@/types/session";
import type { GlassboxState } from "@/types/glassbox";
import React, { useState, useEffect, useRef } from "react";
import InsightsPanel from "@/components/features/output/InsightsPanel";
import CodeSkeleton from "@/components/features/output/CodeSkeleton";
import FlowGrid from "@/components/features/output/FlowGrid";

interface RefactoredOutputProps {
  refactoredOutput: string;
  setRefactoredOutput: (val: string) => void;
  sourceCode: string;
  activeStep: number;
  isTerminalCollapsed: boolean;
  appState: AppState;
  orchestrationResult: OrchestrationResult;
  glassboxState?: GlassboxState;
  isMonolith: boolean;
}

export default function RefactoredOutput({
  refactoredOutput,
  setRefactoredOutput,
  sourceCode,
  activeStep,
  isTerminalCollapsed,
  appState,
  orchestrationResult,
  glassboxState,
  isMonolith,
}: RefactoredOutputProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // 1. ADD 'output' state and make it the default
  const [rightPanelMode, setRightPanelMode] = useState<'output' | 'insights' | 'flow'>(
    appState === 'analyzing' ? 'flow' : 'output'
  );
  const hasFormatted = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (refactoredOutput && !hasFormatted.current) {
      hasFormatted.current = true;
      const formatted = formatJavaCode(refactoredOutput);
      if (formatted !== refactoredOutput) {
        setRefactoredOutput(formatted);
      }
    }
  }, [refactoredOutput, setRefactoredOutput]);

  useEffect(() => {
    if (appState === "analyzing") {
      setRightPanelMode("flow");
    }
  }, [appState]);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const handleCopy = async () => {
    const textToCopy = refactoredOutput || "// Awaiting code generation...";
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      console.warn("Clipboard API not available");
    }
  };

  if (!mounted) return null;

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden bg-jb-panel transition-all duration-300 h-full
      ${isTerminalCollapsed ? 'flex-none h-[48px]' : (appState === 'done' ? 'flex-1' : 'flex-[1.5]')}`}>
      
      <div className={`flex items-center justify-between border-b h-[40px] shrink-0 relative z-20 transition-colors duration-300 pr-2
        ${isDark ? 'bg-jb-bg border-jb-border' : 'bg-[#f7f8fa] border-[#ebecf0]'}`}>
        
        <div className="flex items-center h-full pt-1.5 pb-1 px-2 gap-1 overflow-x-auto custom-chat-scrollbar">


          
          <button 
            onClick={() => setRightPanelMode('insights')}
            role="tab"
            aria-selected={rightPanelMode === 'insights'}
            className={`h-full px-3 flex items-center gap-2 text-[12px] font-medium transition-all cursor-pointer rounded-md 
              ${rightPanelMode === 'insights' 
                ? (isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50 shadow-sm' : 'bg-white text-[#080808] border-[#dfdfdf] shadow-sm') 
                : (isDark ? 'text-jb-text opacity-70 hover:opacity-100 hover:bg-jb-panel/40 border-transparent' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')}`}
          >
            Insights
          </button>
          
          <button 
            onClick={() => setRightPanelMode('output')}
            role="tab"
            aria-selected={rightPanelMode === 'output'}
            className={`h-full px-3 flex items-center gap-2 text-[12px] font-medium transition-all cursor-pointer rounded-md 
              ${rightPanelMode === 'output' 
                ? (isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50 shadow-sm' : 'bg-white text-[#080808] border-[#dfdfdf] shadow-sm') 
                : (isDark ? 'text-jb-text opacity-70 hover:opacity-100 hover:bg-jb-panel/40 border-transparent' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')}`}
          >
             Refactored Output
          </button>

          <button 
            onClick={() => setRightPanelMode('flow')}
            role="tab"
            aria-selected={rightPanelMode === 'flow'}
            className={`h-full px-3 flex items-center gap-2 text-[12px] font-medium transition-all cursor-pointer rounded-md 
              ${rightPanelMode === 'flow' 
                ? (isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50 shadow-sm' : 'bg-white text-[#080808] border-[#dfdfdf] shadow-sm') 
                : (isDark ? 'text-jb-text opacity-70 hover:opacity-100 hover:bg-jb-panel/40 border-transparent' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')}`}
          >
             Flow
          </button>
        </div>
        
        <div className="flex items-center gap-2 pr-4">
          {appState === 'done' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-sm transition-transform flex items-center gap-1.5 duration-300
              ${isDark ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-green-500' : 'bg-emerald-600'}`}></div> Ready
            </span>
          )}
          <button 
            onClick={handleCopy}
            className={`p-1.5 rounded-md transition-all ring-1 cursor-pointer hover:scale-110 active:scale-90 ring-transparent
              ${isDark ? 'text-jb-text-muted hover:text-jb-text hover:bg-jb-border/40 hover:ring-jb-border' : 'text-[#818594] hover:text-[#080808] hover:bg-[#ebecf0] hover:ring-[#dbdbdb]'}`}
            title="Copy Code"
            aria-label="Copy Code"
          >
            <Copy size={16} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden z-10">
        {rightPanelMode === 'flow' ? (
          <FlowGrid
            appState={appState}
            exitStatus={orchestrationResult.exit_status}
            glassboxState={glassboxState ?? {
              currentPhase: 1,
              currentAgent: "System",
              strategyIteration: 1,
              maxStrategyIterations: 3,
              syntaxHealAttempt: 0,
              maxSyntaxHealAttempts: 3,
              sequentialMutationRetry: 0,
              maxSequentialMutationRetries: 3,
              validationFaultCount: null,
              judgeDecision: null,
              currentDetail: null,
              phaseSummaries: {},
              phaseDurations: [],
              totalDurationMs: null,
            }}
          />
        ) : appState === 'idle' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 opacity-100 pointer-events-none z-10 transition-colors duration-300">
            <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[24px] mb-6 shadow-2xl ring-1 transition-all duration-300
              ${isDark ? 'bg-jb-bg ring-jb-border' : 'bg-[#f7f8fa] ring-[#ebecf0]'}`}>
              <Layers size={36} className={isDark ? "text-jb-accent/60" : "text-[#3574f0]/60"} strokeWidth={1.5} />
            </div>
            <p className={`text-[15px] font-semibold transition-colors ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
              Awaiting source code analysis
            </p>
            <p className={`text-[13px] mt-2 font-medium transition-colors ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
              Output will be generated by the Swarm
            </p>
          </div>
        ) : appState === 'waiting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10 transition-colors duration-300">
             <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[32px] mb-6 shadow-2xl ring-1 transition-all duration-300 relative
                ${isDark ? 'bg-jb-bg ring-jb-border' : 'bg-[#f7f8fa] ring-[#ebecf0]'}`}>
                <Clock size={36} className="text-yellow-400 animate-pulse" strokeWidth={1.5} />
                <div className="absolute inset-0 bg-yellow-400/10 blur-2xl rounded-full scale-150 animate-pulse"></div>
             </div>
             <p className={`text-[15px] font-semibold transition-colors ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
                Server Busy
             </p>
             <p className={`text-[13px] mt-2 font-medium transition-colors ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
                Waiting for other requests to complete...
             </p>
          </div>
        ) : appState === 'analyzing' && isMonolith ? (
          <CodeSkeleton sourceCode={sourceCode} />
        ) : appState === 'done' && !refactoredOutput?.trim() ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10 transition-colors duration-300">
            <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[32px] mb-6 shadow-2xl ring-1 transition-all duration-300
              ${isDark ? 'bg-jb-bg ring-jb-border' : 'bg-[#f7f8fa] ring-[#ebecf0]'}`}>
              <AlertCircle size={36} className="text-yellow-400" strokeWidth={1.5} />
            </div>
            <p className={`text-[15px] font-semibold transition-colors ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
              Refactoring Interrupted
            </p>
            <p className={`text-[13px] mt-2 font-medium transition-colors ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
              The session was interrupted before completion. Please start a new refactor.
            </p>
          </div>
        ) : (
           rightPanelMode === 'output' ? (
              <CodeEditorPanel 
                value={refactoredOutput} 
                onChange={setRefactoredOutput} 
                highlightLines={{
                  added: orchestrationResult.diffHighlights.added,
                  removed: orchestrationResult.diffHighlights.removed,
                }}
                showDiff={appState === 'done'}
                placeholder="" 
                bottomPadding="48px"
              />
           ) : (
             <InsightsPanel 
               metrics={orchestrationResult.metrics} 
               summary={orchestrationResult.summary} 
               planner_model={orchestrationResult.planner_model}
               generator_model={orchestrationResult.generator_model}
               judge_model={orchestrationResult.judge_model}
             />
          )
        )}

        
      </div>
    </div>
  );
}