import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Terminal as TerminalIcon, Cpu, AlertCircle, Layers, CheckCircle2, ChevronDown, ChevronUp, Command, Square, Sparkles } from "lucide-react";
import { useAppContext } from "@/context/AppContext";

interface AgentTerminalLineProps {
  text: string;
  delay: number;
  colorClass: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  isDark: boolean;
}

const AgentTerminalLine = ({ text, delay, colorClass, icon: Icon, isDark }: AgentTerminalLineProps) => {
  const [displayedText, setDisplayedText] = useState('');
  useEffect(() => {
    let i = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayedText(text.slice(0, i + 1));
        i++;
        if (i > text.length) clearInterval(interval);
      }, 15);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, delay]);
  
  return (
    <div className="flex items-start gap-3 text-[12px] font-mono leading-relaxed animate-in fade-in duration-300 shrink-0">
      <div className={`mt-0.5 ${colorClass}`}><Icon size={14} /></div>
      <div className="flex-1">
        <span className={colorClass}>&gt; </span>
        <span className="text-foreground transition-opacity opacity-90">
          {displayedText}
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
    <div className={`rounded-2xl border flex flex-col min-h-0 overflow-hidden shadow-2xl
      bg-[#2b2d30] dark:bg-[#2b2d30] border-[#393b40] dark:border-[#393b40]
      transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) relative
      ${isTerminalCollapsed ? 'h-[48px] flex-none' : (appState === 'done' ? 'flex-[1.5]' : 'flex-1')}`}>
      
      <div 
        onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
        className="px-5 h-[48px] border-b flex items-center justify-between shrink-0 cursor-pointer select-none bg-[#1e1f22] bg-[#1e1f22] hover:bg-[#2b2d30] border-[#393b40]"
        title={isTerminalCollapsed ? "Expand Terminal" : "Collapse Terminal"}
      >
        <h3 className={`text-[12px] font-mono font-bold uppercase tracking-widest flex items-center gap-2.5 text-[#a9b7c6]`}>
          <TerminalIcon size={15} className="text-[#548af7]"/> Consensus Terminal
        </h3>
        
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

      <div className={`p-6 overflow-y-auto flex-1 flex flex-col gap-1 bg-[#1e1f22] custom-terminal-scrollbar font-mono`}>
         <div className="text-[13px] text-[#6f737a] mb-4 leading-relaxed shrink-0">
            Horizon OS [Version 10.0.26100]<br/>
            (c) Horizon Corporation. All rights reserved.<br/>
         </div>

         {/* TERMINAL ENTRIES (History) */}
         {terminalEntries.map((entry) => {
            if (entry.type === 'command') {
               return (
                  <div key={entry.id} className="flex items-start gap-2 w-full max-w-6xl animate-in fade-in duration-300 mb-1">
                     <span className="text-[#a9b7c6] text-[14px] whitespace-nowrap pt-[2px] font-semibold">
                       C:\Projects-School\horizon-code&gt;
                     </span>
                     <div className="text-[#a9b7c6] text-[14px] font-medium py-[2px] opacity-90 overflow-hidden break-all">
                       {entry.text}
                     </div>
                  </div>
               );
            } else if (entry.type === 'log') {
               return (
                  <div key={entry.id} className="mb-3">
                     <AgentTerminalLine 
                        isDark={isDark} 
                        delay={0} // No additional delay here as they were pushed after timeouts
                        icon={ICON_MAP[entry.icon] || Cpu} 
                        colorClass={entry.colorClass || "text-[#548af7]"} 
                        text={entry.text} 
                     />
                  </div>
               );
            }
            return null;
         })}

         {/* ACTIVE INPUT PROMPT (Only shown when IDLE or DONE - hidden during the debate) */}
         {(appState === 'idle' || appState === 'done') && (
           <div className="flex items-start gap-2 w-full max-w-6xl mt-2 animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-[#a9b7c6] text-[14px] whitespace-nowrap pt-[2px] font-semibold">
                C:\Projects-School\horizon-code&gt;
              </span>
              <div className={`flex-1 flex items-start bg-transparent`}>
                <textarea 
                  ref={chatInputRef as React.RefObject<HTMLTextAreaElement>}
                  value={inputInstruction || ""} 
                  onChange={handleInputChange} 
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsChatFocused(true)}   
                  onBlur={() => setIsChatFocused(false)}   
                  placeholder=""
                  className={`flex-1 bg-transparent border-none outline-none text-[14px] font-medium resize-none overflow-y-auto px-1 py-[2px] text-[#a9b7c6] placeholder-[#6f737a] caret-[#a9b7c6] w-full`} 
                  rows={1}
                  style={{ minHeight: '26px', lineHeight: '22px' }}
                />
              </div>
           </div>
         )}

         <div ref={terminalEndRef} className="h-6 shrink-0" />
      </div>
    </div>
  );
}
