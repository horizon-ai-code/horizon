"use client"

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppContext } from "@/context/AppContext";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { FolderTree, Search, GitBranch, Play, LayoutGrid, Check, Bell, Settings2 } from "lucide-react";

import LoadingOverlay from "@/components/feature/LoadingOverlay";
import Input from "@/components/custom/Input";
import RefactoredOutput from "@/components/custom/RefactoredOutput";
import Terminal from "@/components/custom/Terminal";
import Navbar from "@/components/custom/Navbar";

const INITIAL_SOURCE = `public boolean containsDuplicate(int[] nums) {
    for (int i = 0; i < nums.length; i++) {
        for (int j = i + 1; j < nums.length; j++) {
            if (nums[i] == nums[j]) {
                return true;
            }
        }
    }
    return false;
}`; 

const INITIAL_REFACTORED = `public boolean containsDuplicate(int[] nums) {
    Set<Integer> seen = new HashSet<>();
    for (int num : nums) {
        if (!seen.add(num)) {
            return true;
        }
    }
    return false;
}`;

export const mockHighlights = {
  inputRemoved: [1, 2, 3, 4, 5, 6, 7], // Lines that get deleted from the original
  outputAdded: [1, 2, 3, 4, 5]         // Lines that are brand new in the output
};

export default function Home() {
  const { appState, setAppState } = useAppContext();
  const { resolvedTheme } = useTheme();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [sourceCode, setSourceCode] = useState(INITIAL_SOURCE);
  const [refactoredOutput, setRefactoredOutput] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [showFlowchartModal, setShowFlowchartModal] = useState(false);
  const [inputInstruction, setInputInstruction] = useState("");
  const [inputError, setInputError] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [terminalEntries, setTerminalEntries] = useState<{id: string, type: 'command' | 'log' | 'system', text: string, colorClass?: string, icon?: any}[]>([]);

  const terminalPanelRef = useRef<any>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (terminalPanelRef.current) {
      if (isTerminalCollapsed) {
        terminalPanelRef.current.collapse();
      } else {
        terminalPanelRef.current.expand();
      }
    }
  }, [isTerminalCollapsed]);
  
  const isDark = mounted ? resolvedTheme === "dark" : true;

  useEffect(() => {
    if (!isTerminalCollapsed) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalEntries, activeStep, isTerminalCollapsed, appState]);

  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = '40px'; 
      const scrollHeight = chatInputRef.current.scrollHeight;
      chatInputRef.current.style.height = Math.min(scrollHeight, 140) + 'px'; 
      setIsChatExpanded(scrollHeight > 45); 
    }
  }, [inputInstruction]);

  const startAnalysis = () => {
    let hasError = false;
    if (!sourceCode.trim()) { setSourceError(true); hasError = true; } else { setSourceError(false); }
    if (!inputInstruction.trim()) { setInputError(true); hasError = true; } else { setInputError(false); }
    if (hasError) return;

    const commandId = Date.now().toString();
    setTerminalEntries(prev => [...prev, { id: commandId, type: 'command', text: inputInstruction }]);

    setInputInstruction("");
    setInputError(false);
    setSourceError(false);
    setIsChatExpanded(false);
    
    if (chatInputRef.current) {
      chatInputRef.current.style.height = '40px';
      chatInputRef.current.blur();
    }

    if (appState === 'analyzing') return;
    setAppState('analyzing');
    setIsTerminalCollapsed(false);
    setShowFlowchartModal(true);
    setActiveStep(1); 
    setRefactoredOutput(""); 
    
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];

    timeoutRefs.current.push(setTimeout(() => {
        setActiveStep(2);
        setTerminalEntries(prev => [...prev, { id: 'l1'+Date.now(), type: 'log', icon: 'Cpu', colorClass: 'text-[#56a8f5]', text: "[Logical Prover]: Analyzing abstract syntax tree... High cyclomatic risk detected in arithmetic sequences. Recommending methodical abstraction." }]);
    }, 2000));

    timeoutRefs.current.push(setTimeout(() => {
        setActiveStep(3);
        setTerminalEntries(prev => [...prev, { id: 'l2'+Date.now(), type: 'log', icon: 'AlertCircle', colorClass: 'text-[#2aacb8]', text: "[Adversarial Critic]: Warning — over-abstraction may induce slight overhead. Proceeding with micro-benchmark validations. Consensus required." }]);
    }, 4500));

    timeoutRefs.current.push(setTimeout(() => {
        setActiveStep(4);
        setTerminalEntries(prev => [...prev, { id: 'l3'+Date.now(), type: 'log', icon: 'Layers', colorClass: 'text-[#cf8e6d]', text: "[Consensus Judge]: Validating trade-offs. Abstraction paradigm approved for enhanced maintainability. Synthesizing refactored Java outputs." }]);
    }, 7000));

    timeoutRefs.current.push(setTimeout(() => {
      setActiveStep(5);
      setTerminalEntries(prev => [...prev, { id: 'l4'+Date.now(), type: 'log', icon: 'CheckCircle2', colorClass: 'text-[#27c93f]', text: "[System]: Refactoring cycle complete. New AST generated and serialized successfully." }]);
      setRefactoredOutput(INITIAL_REFACTORED);
      timeoutRefs.current.push(setTimeout(() => {
        setAppState('done');
        setShowFlowchartModal(false);
      }, 1500));
    }, 9500));
  };

  const stopAnalysis = () => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
    setAppState('idle');
    setActiveStep(0);
    setShowFlowchartModal(false);
  };

  if (!mounted) return null;
  if (isInitializing) return <LoadingOverlay onComplete={() => setIsInitializing(false)} />;

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 relative ${isDark ? 'bg-jb-bg text-jb-text' : 'bg-[#ffffff] text-[#080808]'}`}>

      {/* Activity Bar (Left) - Now spans full height */}
      <div className={`w-[48px] shrink-0 border-r flex flex-col items-center py-4 gap-6 z-20 transition-all duration-300
        ${isDark ? 'border-jb-border/40 bg-[#1e1f22]/60' : 'border-[#ebecf0] bg-[#f7f8fa]/80'} backdrop-blur-xl`}>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><FolderTree size={20} strokeWidth={1.5} /></button>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><Search size={20} strokeWidth={1.5} /></button>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><GitBranch size={20} strokeWidth={1.5} /></button>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><Play size={20} strokeWidth={1.5} /></button>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><LayoutGrid size={20} strokeWidth={1.5} /></button>
        <div className="flex-1" />
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><Settings2 size={20} strokeWidth={1.5} /></button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
        <Navbar />
        
        {/* Main Editor Area - Now includes vertical resizable terminal */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 p-2 pb-0 transition-colors duration-500 ${isDark ? 'bg-jb-bg' : 'bg-[#ebecf0]'}`}>
          <PanelGroup orientation="vertical" className="flex-1 gap-2">
            
            {/* Top Section: Horizontal PanelGroup (Editors) */}
            <Panel defaultSize={68} minSize={20} className="flex flex-col min-h-0">
              <PanelGroup orientation="horizontal" className="gap-2">
                <Panel defaultSize={50} minSize={20} className={`rounded-xl border overflow-hidden shadow-xl transition-colors duration-300
                  ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf]'}`}>
                  <Input sourceCode={sourceCode} setSourceCode={setSourceCode} sourceError={sourceError} setSourceError={setSourceError} />
                </Panel>
                
                <PanelResizeHandle className="w-[1px] bg-transparent hover:bg-jb-accent transition-all duration-200 cursor-col-resize z-20" />

                <Panel defaultSize={50} minSize={20} className={`rounded-xl border overflow-hidden shadow-xl transition-colors duration-300
                  ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf]'}`}>
                  <RefactoredOutput 
                    refactoredOutput={refactoredOutput} setRefactoredOutput={setRefactoredOutput}
                    showFlowchartModal={showFlowchartModal} setShowFlowchartModal={setShowFlowchartModal}
                    activeStep={activeStep} isTerminalCollapsed={isTerminalCollapsed}
                  />
                </Panel>
              </PanelGroup>
            </Panel>

            {/* Vertical Resize Handle */}
            <PanelResizeHandle className="h-[2px] shrink-0 bg-transparent hover:bg-jb-accent transition-all duration-200 cursor-row-resize z-20" />

            {/* Bottom Section: Terminal */}
            <Panel 
              panelRef={terminalPanelRef}
              defaultSize={32} 
              minSize={5} 
              collapsible={true}
              collapsedSize={40}
              onResize={(panelSize) => {
                // Since collapsedSize is 40px, the panel is 'collapsed' when it's at 40px.
                // We'll treat it as collapsed if it's very close to 40px (or the exact percentage equivalent)
                // However, the library typically snapped to collapsedSize.
                // We'll use a small threshold or check if it's <= the collapsed size equivalent.
                const isNowCollapsed = panelSize.inPixels <= 42; 
                if (isNowCollapsed !== isTerminalCollapsed) {
                  setIsTerminalCollapsed(isNowCollapsed);
                }
              }}
              className={`rounded-xl border overflow-hidden shadow-xl transition-all duration-300 flex flex-col
                ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf] shadow-slate-200/50'}`}
              id="terminal-panel"
            >
              <Terminal 
                activeStep={activeStep} isTerminalCollapsed={isTerminalCollapsed} setIsTerminalCollapsed={setIsTerminalCollapsed}
                terminalEndRef={terminalEndRef} inputInstruction={inputInstruction} setInputInstruction={setInputInstruction}
                inputError={inputError} setInputError={setInputError} startAnalysis={startAnalysis} stopAnalysis={stopAnalysis}
                chatInputRef={chatInputRef} terminalEntries={terminalEntries}
              />
            </Panel>
          </PanelGroup>
        </div>
        {/* Status Bar (Bottom) - Flush with side/bottom */}
        <div className={`h-[28px] shrink-0 border-t flex items-center justify-between px-3 text-[11px] font-medium transition-all duration-300 z-20
          ${isDark ? 'bg-[#1e1f22]/75 border-jb-border/50 text-jb-text/80' : 'bg-[#f7f8fa]/85 border-[#ebecf0] text-[#818594]'} backdrop-blur-md`}>
           <div className="flex items-center gap-4 h-full">
              <div className={`flex items-center gap-1.5 px-1.5 h-full cursor-pointer transition-colors ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#f1f2f6]'}`}>
                <GitBranch size={12} /> main
              </div>
              <div className={`flex items-center gap-1.5 px-1.5 h-full cursor-pointer transition-colors ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#f1f2f6]'}`}>
                <Check size={12} className={isDark ? "text-[#61c554]" : "text-emerald-600"} /> No Errors
              </div>
           </div>
           <div className="flex items-center gap-4 h-full">
              <div className={`px-1.5 h-full flex items-center cursor-pointer transition-colors ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#f1f2f6]'}`}>10:1</div>
              <div className={`px-1.5 h-full flex items-center cursor-pointer transition-colors ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#f1f2f6]'}`}>UTF-8</div>
              <div className={`px-1.5 h-full flex items-center cursor-pointer transition-colors ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#f1f2f6]'}`}>LF</div>
              <div className={`px-1.5 h-full flex items-center cursor-pointer transition-colors ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#f1f2f6]'}`}><Bell size={12} /></div>
           </div>
        </div>
      </div>
    </div>
  );
}
