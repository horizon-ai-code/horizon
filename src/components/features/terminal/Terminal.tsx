import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Cpu, AlertCircle, Layers, CheckCircle2, ChevronDown, ChevronUp, X, Clock, FileCode2 } from "lucide-react";
import type { AppState } from "@/types/session";

interface AgentTerminalLineProps {
  text: string;
  colorClass: string;
  icon: React.ElementType;
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
  isTerminalCollapsed: boolean;
  setIsTerminalCollapsed: (val: boolean) => void;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
  terminalEntries?: {id: string, type: 'command' | 'log' | 'system' | 'error', text: string, colorClass?: string, icon?: string}[];
  appState: AppState;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Cpu: Cpu,
  AlertCircle: AlertCircle,
  Layers: Layers,
  CheckCircle2: CheckCircle2,
  Clock: Clock,
  FileCode2: FileCode2
};

export default function Terminal({
  isTerminalCollapsed,
  setIsTerminalCollapsed,
  terminalEndRef,
  terminalEntries = [],
  appState
}: TerminalProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden transition-all duration-300
      bg-jb-panel relative h-full w-full`}>
      
      <div 
        role="button"
        tabIndex={0}
        aria-expanded={!isTerminalCollapsed}
        aria-label={isTerminalCollapsed ? "Expand Terminal" : "Collapse Terminal"}
        onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsTerminalCollapsed(!isTerminalCollapsed);
          }
        }}
        draggable={false}
        className={`px-4 flex items-center justify-between border-b h-[40px] shrink-0 cursor-pointer select-none transition-colors duration-300 pr-4
          ${isDark ? 'bg-jb-bg border-jb-border' : 'bg-[#f7f8fa] border-[#ebecf0]'}`}
        title={isTerminalCollapsed ? "Expand Terminal" : "Collapse Terminal"}
      >
        <div className="flex items-center h-full gap-4">
          <h3 className={`text-[12px] font-semibold tracking-wide flex items-center gap-2 transition-colors duration-300
            ${isDark ? 'text-jb-text opacity-90' : 'text-[#080808] opacity-80'}`}>
             Terminal
          </h3>

          {appState === 'waiting' && (
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border animate-pulse transition-colors
              ${isDark ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-yellow-50 text-yellow-600 border-yellow-200'}`}>
              BUSY
            </div>
          )}

          {appState === 'analyzing' && (
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors
              ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-600 border-cyan-200'}`}>
              ANALYZING
            </div>
          )}

          <div className={`h-[20px] w-[1px] ${isDark ? 'bg-[#393b40]/60' : 'bg-[#ebecf0]'}`}></div>
          
          <div className="flex items-center h-full pt-1.5 pb-1">
             <div className={`flex items-center gap-2 h-full px-3 rounded-md text-[12px] font-medium border shadow-sm transition-colors duration-300
               ${isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50' : 'bg-white text-[#080808] border-[#dfdfdf]'}`}>
                Local
                <button aria-label="Close terminal tab" className={`opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 rounded transition-all ml-1 w-4 h-4 flex items-center justify-center
                  ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#ebecf0]'}`} onClick={(e) => e.stopPropagation()}>
                   <X size={10} />
                </button>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {(appState === 'analyzing' || appState === 'waiting') && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                appState === 'waiting' 
                  ? (isDark ? 'bg-yellow-400' : 'bg-yellow-500') 
                  : (isDark ? 'bg-cyan-400' : 'bg-cyan-500')
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                appState === 'waiting'
                  ? (isDark ? 'bg-yellow-400' : 'bg-yellow-500')
                  : (isDark ? 'bg-cyan-400' : 'bg-cyan-500')
              }`}></span>
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
                           icon={(entry.icon ? ICON_MAP[entry.icon] : undefined) || Cpu} 
                           colorClass={entry.colorClass || "text-jb-accent"} 
                          text={entry.text} 
                       />
                    </div>
                 );
              } else if (entry.type === 'error') {
                  return (
                    <div key={entry.id} className={`mb-3 p-3 rounded-lg border flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300
                      ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                       <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                       <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-red-500">Execution Error</span>
                          <span className={`text-[12px] leading-relaxed ${isDark ? 'text-red-200/80' : 'text-red-700'}`}>{entry.text}</span>
                       </div>
                    </div>
                  );
               }
               return null;
           })}


           <div ref={terminalEndRef} className="h-6 shrink-0" />
        </div>
      )}
    </div>
  );
}
