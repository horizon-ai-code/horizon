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
  
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="flex flex-col h-screen overflow-hidden bg-jb-bg">
      
      <div className="fixed inset-0 z-[-1] pointer-events-none bg-jb-bg transition-colors duration-300">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ backgroundColor: isDark ? 'rgba(6, 182, 212, 0.08)' : 'rgba(6, 182, 212, 0.05)', opacity: 0.5 }}></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full blur-[150px]"
          style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.03)', opacity: 0.5 }}></div>
      </div>

      <main className="flex-1 w-full flex flex-col overflow-hidden relative z-0 p-1.5 pt-2 pb-1.5 gap-1.5">
        <div className="flex-1 min-h-0">
          <PanelGroup orientation="horizontal">
            <Panel defaultSize={50} minSize={20}>
              <div className="h-full pr-1.5">
                <Input sourceCode={sourceCode} setSourceCode={setSourceCode} sourceError={sourceError} setSourceError={setSourceError} />
              </div>
            </Panel>
            
            <PanelResizeHandle className="w-1.5 hover:bg-jb-accent/30 transition-colors duration-200 cursor-col-resize flex items-center justify-center group">
               <div className="w-[1px] h-8 bg-jb-border group-hover:bg-jb-accent transition-colors" />
            </PanelResizeHandle>

            <Panel defaultSize={50} minSize={20}>
              <div className="h-full pl-1.5">
                <RefactoredOutput 
                  refactoredOutput={refactoredOutput} setRefactoredOutput={setRefactoredOutput}
                  showFlowchartModal={showFlowchartModal} setShowFlowchartModal={setShowFlowchartModal}
                  activeStep={activeStep} isTerminalCollapsed={isTerminalCollapsed}
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>

        <div className={`shrink-0 transition-all duration-300 ${isTerminalCollapsed ? 'h-[48px]' : 'h-[32%] min-h-[160px]'}`}>
          <Terminal 
            activeStep={activeStep} isTerminalCollapsed={isTerminalCollapsed} setIsTerminalCollapsed={setIsTerminalCollapsed}
            terminalEndRef={terminalEndRef} inputInstruction={inputInstruction} setInputInstruction={setInputInstruction}
            inputError={inputError} setInputError={setInputError} startAnalysis={startAnalysis} stopAnalysis={stopAnalysis}
            chatInputRef={chatInputRef} terminalEntries={terminalEntries}
          />
        </div>
      </main>
    </div>
  );
}
