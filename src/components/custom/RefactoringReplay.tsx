"use client"

import React, { useState, useEffect } from 'react';
import { useTheme } from "next-themes";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronLeft, ChevronRight, FastForward } from 'lucide-react';

const replaySteps = [
  {
    title: "Loop Simplification Detected",
    description: "Nested O(N²) loops found. Recommending HashSet for O(N) time complexity.",
    codeSnapshot: `public boolean containsDuplicate(int[] nums) {\n    for (int i = 0; i < nums.length; i++) {\n        for (int j = i + 1; j < nums.length; j++) {\n            if (nums[i] == nums[j]) {\n                return true;\n            }\n        }\n    }\n    return false;\n}`,
    addedLines: [] as number[],
    removedLines: [2, 3, 4, 5, 6, 7]
  },
  {
    title: "Initialize HashSet",
    description: "A HashSet provides O(1) lookups. We trade a bit of space for a massive speed increase.",
    codeSnapshot: `public boolean containsDuplicate(int[] nums) {\n    Set<Integer> seen = new HashSet<>();\n    for (int i = 0; i < nums.length; i++) {\n        // ... \n    }\n    return false;\n}`,
    addedLines: [2],
    removedLines: [] as number[]
  },
  {
    title: "Enhanced For-Loop & Add Check",
    description: "HashSet.add() returns false if the element is already present. We can simplify the logic beautifully.",
    codeSnapshot: `public boolean containsDuplicate(int[] nums) {\n    Set<Integer> seen = new HashSet<>();\n    for (int num : nums) {\n        if (!seen.add(num)) {\n            return true;\n        }\n    }\n    return false;\n}`,
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
      <div className={`px-5 py-4 border-b flex flex-col gap-1 z-10 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-slate-50 border-slate-100'}`}>
        <h3 className={`text-[14px] font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>{step.title}</h3>
        <p className={`text-[12px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{step.description}</p>
      </div>
      
      {/* Syntax Highlighting display */}
      <div className="flex-1 overflow-auto p-0 relative font-mono text-[13px]">
        <SyntaxHighlighter
          language="java"
          style={isDark ? vscDarkPlus : vs}
          customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent' }}
          wrapLines={true}
          showLineNumbers={true}
          lineNumberStyle={{ color: isDark ? '#4b5563' : '#9CA3AF', minWidth: '2.5em', paddingRight: '1.5em', textAlign: 'right' }}
          lineProps={(lineNumber) => {
            let style: React.CSSProperties = { display: 'block', paddingLeft: '4px' };
            if (step.addedLines.includes(lineNumber)) {
              style.backgroundColor = isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(223, 247, 228, 0.6)';
              style.borderLeft = '3px solid #22c55e';
            } else if (step.removedLines.includes(lineNumber)) {
              style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 227, 227, 0.6)';
              style.borderLeft = '3px solid #ef4444';
            } else {
              style.borderLeft = '3px solid transparent';
            }
            return { style };
          }}
        >
          {step.codeSnapshot}
        </SyntaxHighlighter>
      </div>

      {/* Control Bar */}
      <div className={`px-5 py-3 border-t flex items-center justify-between z-10 ${isDark ? 'bg-[#0f0f11] border-white/[0.08]' : 'bg-white border-slate-100'}`}>
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
          Step {currentReplayStep + 1} of {replaySteps.length}
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrev} 
            disabled={currentReplayStep === 0}
            className={`p-1.5 rounded-md transition-all ${isDark ? 'text-gray-400 border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:border-transparent cursor-pointer' : 'text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:border-transparent'}`}
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNext} 
            disabled={isFinal}
            className={`p-1.5 rounded-md transition-all ${isDark ? 'text-gray-400 border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:border-transparent cursor-pointer' : 'text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:border-transparent'}`}
          >
            <ChevronRight size={16} />
          </button>
          <button 
            onClick={() => setCurrentReplayStep(replaySteps.length - 1)} 
            disabled={isFinal}
            className={`flex items-center gap-1.5 px-3 py-1.5 ml-2 text-[12px] font-medium rounded-md transition-all ${isDark ? 'text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:border-transparent cursor-pointer' : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:border-transparent'}`}
          >
            Skip to Final <FastForward size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
