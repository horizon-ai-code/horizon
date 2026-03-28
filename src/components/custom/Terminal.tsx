import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Terminal as TerminalIcon, Cpu, AlertCircle, Layers, CheckCircle2, ChevronDown, ChevronUp, Command, Square, Sparkles, X } from "lucide-react";
import { useAppContext } from "@/context/AppContext";

interface AgentTerminalLineProps {
  text: string;
  colorClass: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}

const AgentTerminalLine = ({ text, colorClass, icon: Icon }: AgentTerminalLineProps) => {
  return (
    <div className="flex items-start gap-3 text-[12px] font-mono leading-relaxed shrink-0 transition-opacity">
      <div className={`mt-0.5 ${colorClass}`}><Icon size={14} /></div>
      <div className="flex-1">
        <span className={colorClass}>&gt; </span>
        <span className="text-jb-text transition-colors opacity-90">
          {text}
        </span>
      </div>
    </div>
  );
};

interface TerminalProps {
  activeStep: number;
  isTerminalCollapsed: boolean;
  setIsTerminalCollapsed: (val: boolean) => void;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
  inputInstruction?: string;
  setInputInstruction?: (val: string) => void;
  inputError?: boolean;
  setInputError?: (val: boolean) => void;
  startAnalysis?: () => void;
  stopAnalysis?: () => void;
  chatInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  terminalEntries?: {id: string, type: 'command' | 'log' | 'system', text: string, colorClass?: string, icon?: any}[];
}

const ICON_MAP: Record<string, any> = {
  Cpu: Cpu,
  AlertCircle: AlertCircle,
  Layers: Layers,
  CheckCircle2: CheckCircle2
};

export default function Terminal({
  activeStep,
  isTerminalCollapsed,
  setIsTerminalCollapsed,
  terminalEndRef,
  inputInstruction,
  setInputInstruction,
  inputError,
  setInputError,
  startAnalysis,
  stopAnalysis,
  chatInputRef,
  terminalEntries = []
}: TerminalProps) {
  const { appState } = useAppContext();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isChatFocused, setIsChatFocused] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (setInputInstruction) setInputInstruction(e.target.value);
    if (inputError && setInputError) setInputError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (appState !== 'analyzing' && startAnalysis) {
        startAnalysis();
      }
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden transition-all duration-300
      bg-jb-panel relative h-full w-full`}>
      
      <div 
        onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
        className={`px-4 flex items-center justify-between border-b h-[40px] shrink-0 cursor-pointer select-none transition-colors duration-300 pr-4
          ${isDark ? 'bg-jb-bg border-jb-border' : 'bg-[#f7f8fa] border-[#ebecf0]'}`}
        title={isTerminalCollapsed ? "Expand Terminal" : "Collapse Terminal"}
      >
        <div className="flex items-center h-full gap-4">
          <h3 className={`text-[12px] font-semibold tracking-wide flex items-center gap-2 transition-colors duration-300
            ${isDark ? 'text-jb-text opacity-90' : 'text-[#080808] opacity-80'}`}>
             Terminal
          </h3>
          <div className={`h-[20px] w-[1px] ${isDark ? 'bg-[#393b40]/60' : 'bg-[#ebecf0]'}`}></div>
          
          <div className="flex items-center h-full pt-1.5 pb-1">
             <div className={`flex items-center gap-2 h-full px-3 rounded-md text-[12px] font-medium border shadow-sm transition-colors duration-300
               ${isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50' : 'bg-white text-[#080808] border-[#dfdfdf]'}`}>
                Local
                <button className={`opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 rounded transition-all ml-1 w-4 h-4 flex items-center justify-center
                  ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#ebecf0]'}`} onClick={(e) => e.stopPropagation()}>
                   <X size={10} />
                </button>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {appState === 'analyzing' && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'}`}></span>
            </span>
          )}
          {isTerminalCollapsed ? <ChevronUp size={18} className={isDark ? 'text-gray-500' : 'text-slate-400'}/> : <ChevronDown size={18} className={isDark ? 'text-gray-500' : 'text-slate-400'}/>}
        </div>
      </div>

      {!isTerminalCollapsed && (
        <div className={`p-6 overflow-y-auto flex-1 flex flex-col gap-1 custom-terminal-scrollbar font-mono transition-colors duration-300
          ${isDark ? 'bg-jb-panel' : 'bg-white'}`}>
           <div className="text-[13px] text-jb-text-muted mb-4 leading-relaxed shrink-0 transition-colors">
              Horizon AI [Version 10.0.26100]<br/>
              (c) Horizon Corporation. All rights reserved.<br/>
           </div>

           {/* TERMINAL ENTRIES (History) */}
           {terminalEntries.map((entry) => {
              if (entry.type === 'command') {
                 return (
                    <div key={entry.id} className="flex items-start gap-1 w-full max-w-6xl mb-0.5">
                       <span className={`text-[14px] whitespace-nowrap pt-[2px] font-semibold transition-colors duration-300
                         ${isDark ? 'text-jb-text opacity-70' : 'text-[#818594]'}`}>
                         user@horizon ~ {'>'}
                       </span>
                       <div className={`text-[14px] font-medium py-[2px] overflow-hidden break-all transition-colors duration-300
                         ${isDark ? 'text-jb-text opacity-90' : 'text-[#080808]'}`}>
                         {entry.text}
                       </div>
                    </div>
                 );
              } else if (entry.type === 'log') {
                 return (
                    <div key={entry.id} className="mb-3">
                       <AgentTerminalLine 
                          icon={ICON_MAP[entry.icon] || Cpu} 
                          colorClass={entry.colorClass || "text-jb-accent"} 
                          text={entry.text} 
                       />
                    </div>
                 );
              }
              return null;
           })}

           {/* ACTIVE INPUT PROMPT (Only shown when IDLE or DONE - hidden during the debate) */}
           {(appState === 'idle' || appState === 'done') && (
             <div className="flex items-start gap-1 w-full max-w-6xl mt-2 transition-opacity duration-300">
                <span className={`text-[14px] whitespace-nowrap pt-[2px] font-semibold transition-colors duration-300
                  ${isDark ? 'text-jb-text opacity-70' : 'text-[#818594]'}`}>
                  user@horizon ~ {'>'}
                </span>
                 <div className={`flex-1 flex items-start bg-transparent relative font-mono overflow-hidden`}>
                   {/* Visual Mirror for Cursor Positioning */}
                   <div className="absolute inset-0 pointer-events-none flex items-start px-1 py-[2px] whitespace-pre-wrap break-all text-[14px] leading-[22px]">
                     <span className="text-transparent">{inputInstruction || ""}</span>
                     {isChatFocused && (
                       <span className="inline-block w-[8px] h-[17px] bg-[#d3d3d3] mt-[2px] terminal-cursor"></span>
                     )}
                   </div>

                     <textarea 
                       ref={chatInputRef as React.RefObject<HTMLTextAreaElement>}
                       value={inputInstruction || ""} 
                       onChange={handleInputChange} 
                       onKeyDown={handleKeyDown}
                       onFocus={() => setIsChatFocused(true)}   
                       onBlur={() => setIsChatFocused(false)}   
                       placeholder=""
                       className={`flex-1 bg-transparent border-none outline-none text-[14px] font-medium resize-none overflow-y-auto px-1 py-[2px] w-full transition-colors duration-300 relative z-10 leading-[22px]
                         ${isDark ? 'text-jb-text placeholder-jb-text-muted caret-transparent' : 'text-[#080808] placeholder-[#818594] caret-transparent'}`} 
                       rows={1}
                       style={{ minHeight: '26px' }}
                     />
                 </div>
             </div>
           )}

           <div ref={terminalEndRef} className="h-6 shrink-0" />
        </div>
      )}
    </div>
  );
}
