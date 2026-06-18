"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from "next-themes";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { ChevronLeft, ChevronRight, FastForward } from 'lucide-react';
import { jetbrainsTheme, intellijLightTheme } from '@/components/features/editor/CodeEditorPanel';
import type { ReplayStep } from '@/types/insights';

// Themes are imported from CodeEditorPanel for consistency

interface RefactoringReplayProps {
  replaySteps: ReplayStep[];
}

const REPLAY_SYNTAX_STYLE = { 
  margin: 0, 
  border: "none", 
  boxShadow: "none", 
  padding: '1.5rem', 
  backgroundColor: 'transparent' 
} as const;

export default function RefactoringReplay({ replaySteps }: RefactoringReplayProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentReplayStep, setCurrentReplayStep] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => setCurrentReplayStep(0));
  }, [replaySteps]);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const hasReplayData = replaySteps.length > 0;
  const lineNumberStyle = useMemo(() => ({ 
    color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', 
    minWidth: '2.5em', 
    paddingRight: '1.5em', 
    textAlign: 'right' as const 
  }), [isDark]);

  if (!mounted) return null;
  if (!hasReplayData) {
    return (
      <div className="flex items-center justify-center h-full animate-in fade-in duration-500 bg-jb-panel rounded-[24px] overflow-hidden border border-jb-border">
        <p className="text-[13px] font-medium text-jb-text-muted">No replay data yet.</p>
      </div>
    );
  }

  const step = replaySteps[currentReplayStep];
  const isFinal = currentReplayStep === replaySteps.length - 1;

  const handleNext = () => {
    if (currentReplayStep < replaySteps.length - 1) setCurrentReplayStep(p => p + 1);
  };
  
  const handlePrev = () => {
    if (currentReplayStep > 0) setCurrentReplayStep(p => p - 1);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 bg-jb-panel rounded-[24px] overflow-hidden border border-jb-border">
      {/* Replay Header */}
      <div className="px-5 py-4 border-b flex flex-col gap-1 z-10 bg-jb-bg border-jb-border transition-colors">
        <h3 className="text-[14px] font-semibold text-jb-text">{step.title}</h3>
        <p className="text-[12px] text-jb-text-muted font-medium">{step.description}</p>
      </div>
      
      {/* Syntax Highlighting display */}
      <div className="flex-1 overflow-auto p-0 relative font-mono text-[13px] no-transition">
        <SyntaxHighlighter
          language="java"
          style={isDark ? jetbrainsTheme : intellijLightTheme}
          customStyle={REPLAY_SYNTAX_STYLE}
          wrapLines={true}
          showLineNumbers={true}
          lineNumberStyle={lineNumberStyle}
          lineProps={(lineNumber) => {
            const style: React.CSSProperties = { 
              display: 'block', 
              paddingLeft: '4px',
              backgroundColor: 'transparent',
              borderLeft: '3px solid transparent'
            };
            
            if (step.issueLines?.includes(lineNumber)) {
              style.backgroundColor = isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 237, 213, 0.8)';
              style.borderLeft = '3px solid #f97316';
            } else if (step.addedLines.includes(lineNumber)) {
              style.backgroundColor = isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(220, 252, 231, 0.8)';
              style.borderLeft = '3px solid #22c55e';
            } else if (step.removedLines.includes(lineNumber)) {
              style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 226, 226, 0.8)';
              style.borderLeft = '3px solid #ef4444';
            }
            return { style };
          }}
        >
          {step.codeSnapshot}
        </SyntaxHighlighter>
      </div>

      {/* Control Bar */}
      <div className="px-5 py-3 border-t flex items-center justify-between z-10 bg-jb-bg border-jb-border transition-colors">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-jb-text-muted">
          Step {currentReplayStep + 1} of {replaySteps.length}
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrev} 
            disabled={currentReplayStep === 0}
            className="p-1.5 rounded-md border cursor-pointer disabled:opacity-30 disabled:border-transparent text-foreground border-border hover:bg-secondary"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNext} 
            disabled={isFinal}
            className="p-1.5 rounded-md border cursor-pointer disabled:opacity-30 disabled:border-transparent text-foreground border-border hover:bg-secondary"
          >
            <ChevronRight size={16} />
          </button>
          <button 
            onClick={() => setCurrentReplayStep(replaySteps.length - 1)} 
            disabled={isFinal}
            className="flex items-center gap-1.5 px-3 py-1.5 ml-2 text-[12px] font-medium rounded-md border cursor-pointer disabled:opacity-30 disabled:border-transparent bg-jb-panel text-jb-text border-jb-border hover:bg-jb-bg hover:text-jb-accent transition-colors"
          >
            Skip to Final <FastForward size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}