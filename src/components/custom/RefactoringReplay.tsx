"use client"

import React, { useState, useEffect } from 'react';
import { useTheme } from "next-themes";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronLeft, ChevronRight, FastForward } from 'lucide-react';

// THE ULTIMATE SANITIZER: Eradicates both 'background' and 'backgroundImage' 
// to guarantee React never throws a shorthand/longhand conflict again.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sanitizeTheme = (theme: any) => {
  const cleanTheme = JSON.parse(JSON.stringify(theme));
  Object.keys(cleanTheme).forEach(key => {
    if (cleanTheme[key].background) {
      cleanTheme[key].backgroundColor = cleanTheme[key].background;
      delete cleanTheme[key].background;
    }
    if (cleanTheme[key].backgroundImage) {
      delete cleanTheme[key].backgroundImage;
    }
  });
  return cleanTheme;
};

const safeDarkTheme = sanitizeTheme(vscDarkPlus);
const safeLightTheme = sanitizeTheme(vs);

const replaySteps = [
  {
    title: "Inefficient Loop Detected",
    description: "Nested O(N²) loops found. This is highly inefficient for large arrays. Recommending a HashSet to track elements in O(N) time.",
    codeSnapshot: `public boolean containsDuplicate(int[] nums) {\n    for (int i = 0; i < nums.length; i++) {\n        for (int j = i + 1; j < nums.length; j++) {\n            if (nums[i] == nums[j]) {\n                return true;\n            }\n        }\n    }\n    return false;\n}`,
    issueLines: [2, 3, 4, 5, 6, 7, 8], // RESTORED ORANGE LINES
    addedLines: [] as number[],
    removedLines: [] as number[]
  },
  {
    title: "Initialize HashSet",
    description: "A HashSet provides O(1) lookups. We remove the inner loop entirely.",
    codeSnapshot: `public boolean containsDuplicate(int[] nums) {\n    Set<Integer> seen = new HashSet<>();\n    for (int i = 0; i < nums.length; i++) {\n        // ... \n    }\n    return false;\n}`,
    issueLines: [] as number[],
    addedLines: [2],
    removedLines: [3, 4, 5, 6, 7, 8]
  },
  {
    title: "Enhanced For-Loop & Add Check",
    description: "HashSet.add() returns false if the element is already present. We can simplify the logic beautifully.",
    codeSnapshot: `public boolean containsDuplicate(int[] nums) {\n    Set<Integer> seen = new HashSet<>();\n    for (int num : nums) {\n        if (!seen.add(num)) {\n            return true;\n        }\n    }\n    return false;\n}`,
    issueLines: [] as number[],
    addedLines: [3, 4, 5, 6],
    removedLines: [] as number[]
  }
];

export default function RefactoringReplay() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentReplayStep, setCurrentReplayStep] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const step = replaySteps[currentReplayStep];
  const isFinal = currentReplayStep === replaySteps.length - 1;

  const handleNext = () => {
    if (currentReplayStep < replaySteps.length - 1) setCurrentReplayStep(p => p + 1);
  };
  
  const handlePrev = () => {
    if (currentReplayStep > 0) setCurrentReplayStep(p => p - 1);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Replay Header */}
      <div className="px-5 py-4 border-b flex flex-col gap-1 z-10 theme-transition bg-zinc-50/50 border-zinc-200/50 dark:bg-white/[0.02] dark:border-white/[0.08]">
        <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">{step.title}</h3>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{step.description}</p>
      </div>
      
      {/* Syntax Highlighting display */}
      <div className="flex-1 overflow-auto p-0 relative font-mono text-[13px]">
        <SyntaxHighlighter
          language="java"
          style={isDark ? safeDarkTheme : safeLightTheme}
          customStyle={{ 
            margin: 0, 
            border: "none", 
            boxShadow: "none", 
            padding: '1.5rem', 
            backgroundColor: 'transparent' 
          }}
          wrapLines={true}
          showLineNumbers={true}
          lineNumberStyle={{ color: isDark ? '#4b5563' : '#a1a1aa', minWidth: '2.5em', paddingRight: '1.5em', textAlign: 'right' }}
          lineProps={(lineNumber) => {
            let style: React.CSSProperties = { 
              display: 'block', 
              paddingLeft: '4px',
              backgroundColor: 'transparent',
              borderLeft: '3px solid transparent'
            };
            
            if (step.issueLines?.includes(lineNumber)) {
              style.backgroundColor = isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 237, 213, 0.6)';
              style.borderLeft = '3px solid #f97316';
            } else if (step.addedLines.includes(lineNumber)) {
              style.backgroundColor = isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(223, 247, 228, 0.6)';
              style.borderLeft = '3px solid #22c55e';
            } else if (step.removedLines.includes(lineNumber)) {
              style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 227, 227, 0.6)';
              style.borderLeft = '3px solid #ef4444';
            }
            return { style };
          }}
        >
          {step.codeSnapshot}
        </SyntaxHighlighter>
      </div>

      {/* Control Bar */}
      <div className="px-5 py-3 border-t flex items-center justify-between z-10 theme-transition bg-white dark:bg-zinc-950 border-zinc-200/50 dark:border-white/[0.08]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Step {currentReplayStep + 1} of {replaySteps.length}
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrev} 
            disabled={currentReplayStep === 0}
            className="p-1.5 rounded-md transition-all border cursor-pointer disabled:opacity-30 disabled:border-transparent text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:text-zinc-400 dark:border-white/10 dark:hover:bg-white/5"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNext} 
            disabled={isFinal}
            className="p-1.5 rounded-md transition-all border cursor-pointer disabled:opacity-30 disabled:border-transparent text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:text-zinc-400 dark:border-white/10 dark:hover:bg-white/5"
          >
            <ChevronRight size={16} />
          </button>
          <button 
            onClick={() => setCurrentReplayStep(replaySteps.length - 1)} 
            disabled={isFinal}
            className="flex items-center gap-1.5 px-3 py-1.5 ml-2 text-[12px] font-medium rounded-md transition-all border cursor-pointer disabled:opacity-30 disabled:border-transparent text-zinc-600 bg-zinc-50 hover:bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10"
          >
            Skip to Final <FastForward size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}