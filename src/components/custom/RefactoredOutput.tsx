"use client"

import { useTheme } from "next-themes";
import { Copy, Layers, X, FileCode2, Cpu, AlertCircle, CheckCircle2 } from "lucide-react";
import CodeEditorPanel from "./CodeEditorPanel";
import { useAppContext } from "@/context/AppContext";
import { useState, useEffect } from "react";
import RefactoringReplay from "./RefactoringReplay";
import InsightsPanel from "./InsightsPanel";

interface RefactoredOutputProps {
  refactoredOutput: string;
  setRefactoredOutput: (val: string) => void;
  showFlowchartModal: boolean;
  setShowFlowchartModal: (val: boolean) => void;
  activeStep: number;
  isTerminalCollapsed: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FlowNode = ({ icon: Icon, title, desc, status, isDark, colorCode }: any) => {
  const getColors = () => {
    if (status === 'active') return isDark ? `bg-[#141416] ring-1 ring-cyan-400/50 shadow-[0_0_20px_rgba(0,229,255,0.15)] text-cyan-400` : `bg-white ring-1 ring-cyan-400/50 shadow-[0_0_20px_rgba(0,229,255,0.15)] text-cyan-600`;
    return isDark ? 'bg-[#0f0f11] ring-1 ring-white/5 text-gray-500' : 'bg-slate-50 ring-1 ring-slate-200 text-slate-400';
  };
  return (
    <div className={`relative flex flex-col items-center justify-center p-3 w-32 h-32 rounded-[20px] transition-all duration-700 ${getColors()} ${status === 'active' ? 'scale-105 z-10' : 'scale-95 z-0 opacity-60'}`}>
      {status === 'active' && <div className="absolute inset-0 rounded-[20px] animate-ping opacity-10" style={{ backgroundColor: colorCode }}></div>}
      <Icon size={26} className={`mb-3 ${status === 'active' ? 'animate-bounce' : ''}`} style={{ color: status !== 'waiting' ? colorCode : '' }} />
      <h4 className="text-[11px] font-bold text-center mb-1 leading-tight tracking-wide">{title}</h4>
      <p className="text-[9px] text-center leading-tight px-1 opacity-70 font-medium">{desc}</p>
    </div>
  );
};

const FlowConnector = ({ isActive, isDark }: { isActive: boolean, isDark: boolean }) => (
  <div className="flex-1 min-h-[3px] h-[3px] shrink-0 w-4 md:w-8 relative overflow-hidden rounded-full mx-2 flex items-center">
    <div className={`absolute inset-0 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
    <div className={`absolute h-full left-0 transition-all duration-1000 ${isActive ? 'w-full bg-cyan-400 shadow-[0_0_10px_rgba(0,229,255,0.8)]' : 'w-0 bg-cyan-400'}`}></div>
  </div>
);

const OrchestrationFlowchart = ({ activeStep, isDark }: { activeStep: number, isDark: boolean }) => (
  <div className="flex flex-col items-center justify-center w-full h-full p-4 animate-in fade-in zoom-in-95 duration-500">
    <div className="flex flex-row items-center justify-center w-full max-w-4xl">
      <FlowNode icon={FileCode2} title="AST Parser" desc="Reads abstract tree" status={activeStep === 1 ? 'active' : activeStep > 1 ? 'done' : 'waiting'} isDark={isDark} colorCode="#00e5ff" />
      <FlowConnector isActive={activeStep > 1} isDark={isDark} />
      <FlowNode icon={Cpu} title="Logical Prover" desc="Drafts optimizations" status={activeStep === 2 ? 'active' : activeStep > 2 ? 'done' : 'waiting'} isDark={isDark} colorCode="#3B82F6" />
      <FlowConnector isActive={activeStep > 2} isDark={isDark} />
      <FlowNode icon={AlertCircle} title="Adversarial Critic" desc="Challenges logic" status={activeStep === 3 ? 'active' : activeStep > 3 ? 'done' : 'waiting'} isDark={isDark} colorCode="#8B5CF6" />
      <FlowConnector isActive={activeStep > 3} isDark={isDark} />
      <FlowNode icon={Layers} title="Consensus Judge" desc="Synthesizes code" status={activeStep === 4 ? 'active' : activeStep > 4 ? 'done' : 'waiting'} isDark={isDark} colorCode="#EC4899" />
      <FlowConnector isActive={activeStep > 4} isDark={isDark} />
      <FlowNode icon={CheckCircle2} title="Code Emitter" desc="Formats output" status={activeStep >= 5 ? 'active' : 'waiting'} isDark={isDark} colorCode="#10B981" />
    </div>
  </div>
);

export default function RefactoredOutput({
  refactoredOutput,
  setRefactoredOutput,
  showFlowchartModal,
  setShowFlowchartModal,
  activeStep,
  isTerminalCollapsed
}: RefactoredOutputProps) {
  const { appState } = useAppContext();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // 1. ADD 'output' state and make it the default
  const [rightPanelMode, setRightPanelMode] = useState<'output' | 'replay' | 'insights'>('output');

  useEffect(() => {
    setMounted(true);
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
    <div className={`rounded-[24px] ring-1 flex flex-col min-h-0 overflow-hidden shadow-2xl transition-all duration-500 ease-in-out 
      ${isDark ? 'bg-[#0f0f11]/80 ring-white/[0.08] backdrop-blur-2xl' : 'bg-white/80 ring-slate-200/60 backdrop-blur-2xl'}
      ${isTerminalCollapsed ? 'flex-1' : 'flex-[1.5]'}`}>
      
      <div className={`px-3 flex items-center justify-between border-b h-[48px] shrink-0 relative z-20 transition-colors duration-700 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-slate-50/50 border-slate-100'}`}>
        
        {/* 2. UPDATE TOGGLE BUTTONS */}
        <div className={`flex p-1 rounded-md transition-colors ${isDark ? 'bg-[#0f0f11] ring-1 ring-white/10' : 'bg-slate-200/50 ring-1 ring-slate-200'}`}>
          <button 
            onClick={() => setRightPanelMode('output')}
            className={`px-3 py-1 text-[11px] font-bold tracking-wider rounded transition-all cursor-pointer ${rightPanelMode === 'output' ? (isDark ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')}`}
          >
            OUTPUT
          </button>
          <button 
            onClick={() => setRightPanelMode('replay')}
            className={`px-3 py-1 text-[11px] font-bold tracking-wider rounded transition-all cursor-pointer ${rightPanelMode === 'replay' ? (isDark ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')}`}
          >
            REPLAY
          </button>
          <button 
            onClick={() => setRightPanelMode('insights')}
            className={`px-3 py-1 text-[11px] font-bold tracking-wider rounded transition-all cursor-pointer ${rightPanelMode === 'insights' ? (isDark ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')}`}
          >
            INSIGHTS
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {appState === 'done' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-sm transition-all flex items-center gap-1.5 ${isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-600 border-green-200'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Ready
            </span>
          )}
          <button 
            onClick={handleCopy}
            className={`p-1.5 rounded-md transition-colors ring-1 cursor-pointer ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10 ring-transparent hover:ring-white/10' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100 ring-transparent hover:ring-slate-200'}`}
            title="Copy Code"
          >
            <Copy size={16} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden z-10">
        {appState === 'idle' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 opacity-100 pointer-events-none z-10">
            <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[24px] mb-6 shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition-colors duration-700
              ${isDark ? 'bg-[#18181b] ring-1 ring-white/5' : 'bg-white ring-1 ring-slate-200/50 shadow-xl'}`}>
              <Layers size={36} className={isDark ? 'text-cyan-500/50' : 'text-cyan-500/60'} strokeWidth={1.5} />
            </div>
            <p className={`text-[15px] font-semibold transition-colors duration-700 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              Awaiting source code analysis
            </p>
            <p className={`text-[13px] mt-2 font-medium transition-colors duration-700 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
              Output will be generated by the Swarm
            </p>
          </div>
        ) : appState === 'analyzing' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 opacity-100 pointer-events-none z-10">
            {/* The OrchestrationFlowchart handles the visuals here */}
          </div>
        ) : (
          // 3. RENDER LOGIC UPDATE
          rightPanelMode === 'output' ? (
             <CodeEditorPanel 
               value={refactoredOutput} 
               onChange={setRefactoredOutput} 
               // NEW: Only highlight newly added/edited lines in CYAN on the output side
               highlightLines={{ added: [1, 2, 3, 4, 5] }}
               showDiff={appState === 'done'}
               placeholder="" 
               bottomPadding="48px"
             />
          ) : rightPanelMode === 'replay' ? (
             <RefactoringReplay />
          ) : (
             <InsightsPanel />
          )
        )}

        {showFlowchartModal && (
          <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center transition-all duration-500 
            ${isDark ? 'bg-[#000000]/90 backdrop-blur-2xl' : 'bg-white/95 backdrop-blur-2xl'}`}>
             <div className="flex justify-end p-5 absolute top-0 right-0 w-full z-40">
                {appState === 'done' && <button onClick={() => setShowFlowchartModal(false)} className={`p-2 rounded-full ring-1 transition-colors cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10 ring-white/10 text-white' : 'bg-slate-50 hover:bg-slate-100 ring-slate-200 text-slate-800'}`}><X size={18} /></button>}
             </div>
             
             <OrchestrationFlowchart activeStep={activeStep} isDark={isDark} />
          </div>
        )}
      </div>
    </div>
  );
}