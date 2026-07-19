"use client";

import { useTheme } from "next-themes";
import CodeEditorPanel from "@/components/features/editor/CodeEditorPanel";

interface ComparisonPanelProps {
  sourceCode: string;
  refactoredOutput: string;
}

export default function ComparisonPanel({ sourceCode, refactoredOutput }: ComparisonPanelProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Mock baseline output that simply returns the original code with a dummy comment
  const baselineOutput = sourceCode 
    ? `// [BASELINE MOCK] - Single Model Output\n${sourceCode}`
    : "";

  return (
    <div className={`flex w-full h-full divide-x ${isDark ? 'divide-[#393b40]' : 'divide-[#ddd]'}`}>
      {/* Original Code */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase border-b ${isDark ? 'bg-jb-bg text-[#8d95a5] border-[#393b40]' : 'bg-[#f7f8fa] text-[#888] border-[#ddd]'}`}>
          Original Code
        </div>
        <div className="flex-1 min-h-0 relative">
          <CodeEditorPanel 
            value={sourceCode} 
            onChange={() => {}} 
            showDiff={false}
            bottomPadding="24px"
          />
        </div>
      </div>

      {/* HorizonAI Output */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase border-b ${isDark ? 'bg-jb-bg text-[#3dd6c8] border-[#393b40]' : 'bg-[#f7f8fa] text-[#146a6e] border-[#ddd]'}`}>
          HorizonAI (Multi-Agent)
        </div>
        <div className="flex-1 min-h-0 relative">
          <CodeEditorPanel 
            value={refactoredOutput} 
            onChange={() => {}} 
            showDiff={false}
            bottomPadding="24px"
          />
        </div>
      </div>

      {/* Single-Model Baseline Output */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className={`px-4 py-2 text-[11px] font-bold tracking-widest uppercase border-b ${isDark ? 'bg-jb-bg text-[#e09c3b] border-[#393b40]' : 'bg-[#f7f8fa] text-[#b07020] border-[#ddd]'}`}>
          Baseline (Single-Model)
        </div>
        <div className="flex-1 min-h-0 relative">
          <CodeEditorPanel 
            value={baselineOutput} 
            onChange={() => {}} 
            showDiff={false}
            bottomPadding="24px"
          />
        </div>
      </div>
    </div>
  );
}
