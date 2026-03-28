"use client"

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppContext } from "@/context/AppContext";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";

import LoadingOverlay from "@/components/feature/LoadingOverlay";
import Input from "@/components/custom/Input";
import RefactoredOutput from "@/components/custom/RefactoredOutput";
import Terminal from "@/components/custom/Terminal";
import Navbar from "@/components/custom/Navbar";
import Sidebar from "@/components/custom/Sidebar";

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
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [terminalEntries, setTerminalEntries] = useState<{id: string, type: 'command' | 'log' | 'system', text: string, colorClass?: string, icon?: any}[]>([]);
  const terminalPanelRef = useRef<any>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

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

      <Sidebar />

      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 transition-colors duration-500
        ${isDark ? 'bg-jb-bg' : 'bg-[#ebecf0]'}`}>
        <Navbar />
        
        {/* Main Editor Area - Now includes vertical resizable terminal */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 p-2 pb-0 transition-colors duration-500 ${isDark ? 'bg-jb-bg' : 'bg-[#ebecf0]'}`}>
          <PanelGroup orientation="vertical" className="flex-1 gap-2">
            
            {/* Top Section: Horizontal PanelGroup (Editors) */}
            <Panel defaultSize={68} minSize={20} className="flex flex-col min-h-0">
              <PanelGroup orientation="horizontal" className="gap-2">
                <Panel defaultSize={50} minSize={20} className={`rounded-xl border overflow-hidden shadow-xl transition-colors duration-300
                  ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf]'}`}>
                  <Input 
                    sourceCode={sourceCode} 
                    setSourceCode={setSourceCode} 
                    sourceError={sourceError} 
                    setSourceError={setSourceError}
                    inputInstruction={inputInstruction}
                    setInputInstruction={setInputInstruction}
                    inputError={inputError}
                    setInputError={setInputError}
                    startAnalysis={startAnalysis}
                    stopAnalysis={stopAnalysis}
                  />
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
                activeStep={activeStep} 
                isTerminalCollapsed={isTerminalCollapsed} 
                setIsTerminalCollapsed={setIsTerminalCollapsed}
                terminalEndRef={terminalEndRef} 
                terminalEntries={terminalEntries}
              />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  );
}
