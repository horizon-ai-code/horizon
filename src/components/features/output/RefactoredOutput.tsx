"use client"

import { useTheme } from "next-themes";
import { Copy, Layers, X, FileCode2, Cpu, CheckCircle2, Loader2, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CodeEditorPanel from "@/components/features/editor/CodeEditorPanel";
import type { AppState, OrchestrationResult } from "@/types/session";
import { useState, useEffect } from "react";
import RefactoringReplay from "@/components/features/output/RefactoringReplay";
import InsightsPanel from "@/components/features/output/InsightsPanel";

interface RefactoredOutputProps {
  refactoredOutput: string;
  setRefactoredOutput: (val: string) => void;
  showFlowchartModal: boolean;
  setShowFlowchartModal: (val: boolean) => void;
  activeStep: number;
  isTerminalCollapsed: boolean;
  appState: AppState;
  orchestrationResult: OrchestrationResult;
}

type NodeStatus = 'active' | 'done' | 'waiting';

interface FlowNodeProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  status: NodeStatus;
  colorCode: string;
}

const FlowNode = ({ icon: Icon, title, desc, status, colorCode }: FlowNodeProps) => {
  const getColors = () => {
    if (status === 'active') return 'bg-jb-bg ring-1 ring-jb-accent/50 shadow-[0_0_20px_rgba(53,116,240,0.15)] text-jb-accent';
    return 'bg-jb-panel/50 ring-1 ring-jb-border text-jb-text-muted';
  };
  return (
    <div className={`relative flex flex-col items-center justify-center p-3 w-32 h-32 rounded-[20px] transition-transform duration-700 ${getColors()} ${status === 'active' ? 'scale-105 z-10' : 'scale-95 z-0 opacity-60'}`}>
      {status === 'active' && <div className="absolute inset-0 rounded-[20px] animate-ping opacity-10" style={{ backgroundColor: colorCode }}></div>}
      <Icon size={26} className={`mb-3 ${status === 'active' ? 'animate-bounce' : ''}`} style={{ color: status !== 'waiting' ? colorCode : '' }} />
      <h4 className="text-[11px] font-bold text-center mb-1 leading-tight tracking-wide">{title}</h4>
      <p className="text-[9px] text-center leading-tight px-1 opacity-70 font-medium">{desc}</p>
    </div>
  );
};

const FlowConnector = ({ isActive }: { isActive: boolean }) => (
  <div className="flex-1 min-h-[3px] h-[3px] shrink-0 w-4 md:w-8 relative overflow-hidden rounded-full mx-2 flex items-center">
    <div className="absolute inset-0 bg-jb-border/50"></div>
    <div className={`absolute h-full left-0 ${isActive ? 'w-full bg-jb-accent shadow-[0_0_10px_rgba(53,116,240,0.8)]' : 'w-0 bg-jb-accent'}`}></div>
  </div>
);

const OrchestrationFlowchart = ({ activeStep }: { activeStep: number }) => (
  <div className="flex flex-col items-center justify-center w-full h-full p-4 animate-in fade-in zoom-in-95 duration-500">
    <div className="flex flex-row items-center justify-center w-full max-w-4xl">
      <FlowNode icon={Cpu} title="Planner" desc="Analyzing architecture" status={activeStep === 1 ? 'active' : activeStep > 1 ? 'done' : 'waiting'} colorCode="#56a8f5" />
      <FlowConnector isActive={activeStep > 1} />
      <FlowNode icon={Layers} title="Generator" desc="Drafting optimizations" status={activeStep === 2 ? 'active' : activeStep > 2 ? 'done' : 'waiting'} colorCode="#2aacb8" />
      <FlowConnector isActive={activeStep > 2} />
      <FlowNode icon={FileCode2} title="AST Parser" desc="Structuring output" status={activeStep === 3 ? 'active' : activeStep > 3 ? 'done' : 'waiting'} colorCode="#00e5ff" />
      <FlowConnector isActive={activeStep > 3} />
      <FlowNode icon={CheckCircle2} title="Judge" desc="Final validation" status={activeStep === 4 ? 'active' : activeStep > 4 ? 'done' : 'waiting'} colorCode="#27c93f" />
    </div>
  </div>
);

export default function RefactoredOutput({
  refactoredOutput,
  setRefactoredOutput,
  showFlowchartModal,
  setShowFlowchartModal,
  activeStep,
  isTerminalCollapsed,
  appState,
  orchestrationResult,
}: RefactoredOutputProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // 1. ADD 'output' state and make it the default
  const [rightPanelMode, setRightPanelMode] = useState<'output' | 'replay' | 'insights'>('output');

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const handleCopy = () => {
    const textToCopy = refactoredOutput || "// Awaiting code generation...";
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
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
            className={`h-full px-3 flex items-center gap-2 text-[12px] font-medium transition-all cursor-pointer rounded-md 
              ${rightPanelMode === 'insights' 
                ? (isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50 shadow-sm' : 'bg-white text-[#080808] border-[#dfdfdf] shadow-sm') 
                : (isDark ? 'text-jb-text opacity-70 hover:opacity-100 hover:bg-jb-panel/40 border-transparent' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')}`}
          >
            Insights.md
          </button>
          
          <button 
            onClick={() => setRightPanelMode('output')}
            className={`h-full px-3 flex items-center gap-2 text-[12px] font-medium transition-all cursor-pointer rounded-md 
              ${rightPanelMode === 'output' 
                ? (isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50 shadow-sm' : 'bg-white text-[#080808] border-[#dfdfdf] shadow-sm') 
                : (isDark ? 'text-jb-text opacity-70 hover:opacity-100 hover:bg-jb-panel/40 border-transparent' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')}`}
          >
            RefactoredOutput.java
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
          >
            <Copy size={16} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden z-10">
        {appState === 'idle' ? (
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
        ) : appState === 'analyzing' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10 transition-colors duration-300">
             <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[32px] mb-6 shadow-2xl ring-1 transition-all duration-300 relative
                ${isDark ? 'bg-jb-bg ring-jb-border' : 'bg-[#f7f8fa] ring-[#ebecf0]'}`}>
                <Loader2 size={36} className="text-jb-accent animate-spin" strokeWidth={1.5} />
                <div className="absolute inset-0 bg-jb-accent/10 blur-2xl rounded-full scale-150 animate-pulse"></div>
             </div>
             <p className={`text-[15px] font-semibold transition-colors ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
                Synthesis Engine Active
             </p>
             <p className={`text-[13px] mt-2 font-medium transition-colors ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
                Generating consensus from Swarm nodes...
             </p>
          </div>
        ) : (
          // 3. RENDER LOGIC UPDATE
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
          ) : rightPanelMode === 'replay' ? (
             <RefactoringReplay replaySteps={orchestrationResult.replaySteps} />
          ) : (
             <InsightsPanel metrics={orchestrationResult.metrics} summary={orchestrationResult.summary} />
          )
        )}

        {showFlowchartModal && (appState === 'analyzing' || appState === 'done') && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-jb-panel/95 backdrop-blur-2xl">
             <div className="flex justify-end p-5 absolute top-0 right-0 w-full z-40">
                {appState === 'done' && <button onClick={() => setShowFlowchartModal(false)} className="p-2 rounded-full ring-1 transition-transform cursor-pointer bg-secondary hover:bg-secondary/80 ring-border text-foreground"><X size={18} /></button>}
             </div>
             
             <OrchestrationFlowchart activeStep={activeStep} />
          </div>
        )}
      </div>
    </div>
  );
}