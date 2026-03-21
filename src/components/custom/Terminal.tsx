"use client"

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Terminal as TerminalIcon, Cpu, AlertCircle, Layers, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
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
}

export default function Terminal({
  activeStep,
  isTerminalCollapsed,
  setIsTerminalCollapsed,
  terminalEndRef
}: TerminalProps) {
  const { appState } = useAppContext();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

  return (
    <div className={`rounded-[24px] ring-1 flex flex-col min-h-0 overflow-hidden shadow-2xl transition-all duration-700 delay-150 ease-in-out 
      bg-background/80 dark:bg-[#0D0D0F] ring-border dark:ring-white/[0.05] backdrop-blur-2xl
      ${isTerminalCollapsed ? 'h-[48px] flex-none' : 'flex-1'}`}>
      
      <div 
        onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
        className="px-5 h-[48px] border-b flex items-center justify-between shrink-0 cursor-pointer select-none bg-secondary/30 dark:bg-white/[0.02] hover:bg-secondary/50 border-border dark:border-white/[0.04]"
        title={isTerminalCollapsed ? "Expand Terminal" : "Collapse Terminal"}
      >
        <h3 className={`text-[12px] font-mono font-bold uppercase tracking-widest flex items-center gap-2.5 transition-colors duration-700 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
          <TerminalIcon size={15} className={isDark ? "text-cyan-400" : "text-cyan-500"}/> Consensus Terminal
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

      <div className={`p-6 overflow-y-auto flex-1 flex flex-col gap-4 bg-transparent`}>
         {activeStep === 0 && appState === 'idle' && (
            <div className="h-full flex items-center justify-center font-mono text-[13px] italic text-muted-foreground/50">
                Terminal standing by. Awaiting execution.
            </div>
         )}
         {activeStep >= 2 && <AgentTerminalLine isDark={isDark} delay={200} icon={Cpu} colorClass={isDark ? "text-blue-400" : "text-blue-600"} text="[Logical Prover]: Analyzing abstract syntax tree... High cyclomatic risk detected in arithmetic sequences. Recommending methodical abstraction." />}
         {activeStep >= 3 && <AgentTerminalLine isDark={isDark} delay={500} icon={AlertCircle} colorClass={isDark ? "text-purple-400" : "text-purple-600"} text="[Adversarial Critic]: Warning — over-abstraction may induce slight overhead. Proceeding with micro-benchmark validations. Consensus required." />}
         {activeStep >= 4 && <AgentTerminalLine isDark={isDark} delay={500} icon={Layers} colorClass={isDark ? "text-pink-400" : "text-pink-600"} text="[Consensus Judge]: Validating trade-offs. Abstraction paradigm approved for enhanced maintainability. Synthesizing refactored Java outputs." />}
         {activeStep >= 5 && <AgentTerminalLine isDark={isDark} delay={200} icon={CheckCircle2} colorClass={isDark ? "text-cyan-400" : "text-cyan-600"} text="[System]: Refactoring cycle complete. New AST generated and serialized successfully." />}
         <div ref={terminalEndRef} className="h-2" />
      </div>
    </div>
  );
}
