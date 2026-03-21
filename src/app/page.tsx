"use client"

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppContext } from "@/context/AppContext";

import LoadingOverlay from "@/components/feature/LoadingOverlay";
import Input from "@/components/custom/Input";
import RefactoredOutput from "@/components/custom/RefactoredOutput";
import Terminal from "@/components/custom/Terminal";

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

// We define our dynamic highlight indices here (0-indexed for the editor)
// These can later be provided by your AI backend!
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
  
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  useEffect(() => {
    if (!isTerminalCollapsed) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeStep, isTerminalCollapsed]);

  // Auto-expanding chatbox logic - handles smooth transition from Pill to Rounded Rectangle
  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = '40px'; 
      const scrollHeight = chatInputRef.current.scrollHeight;
      chatInputRef.current.style.height = Math.min(scrollHeight, 140) + 'px'; 
      
      // Expand radius smoothly if content exceeds standard one-line height
      setIsChatExpanded(scrollHeight > 45); 
    }
  }, [inputInstruction]);

  const startAnalysis = () => {
    let hasError = false;

    if (!sourceCode.trim()) {
      setSourceError(true);
      hasError = true;
    } else {
      setSourceError(false);
    }
    
    if (!inputInstruction.trim()) {
      setInputError(true);
      hasError = true;
    } else {
      setInputError(false);
    }

    if (hasError) return;

    // Instantly clear the prompt, reset height and shape for visual confirmation
    setInputInstruction("");
    setInputError(false);
    setSourceError(false);
    setIsChatExpanded(false);
    
    if (chatInputRef.current) {
      chatInputRef.current.style.height = '40px';
    }

    if (appState === 'analyzing') return;
    setAppState('analyzing');
    setShowFlowchartModal(true);
    setActiveStep(1); 
    setRefactoredOutput(""); 
    
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];

    timeoutRefs.current.push(setTimeout(() => setActiveStep(2), 2000));
    timeoutRefs.current.push(setTimeout(() => setActiveStep(3), 4500));
    timeoutRefs.current.push(setTimeout(() => setActiveStep(4), 7000));
    timeoutRefs.current.push(setTimeout(() => {
      setActiveStep(5);
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

  if (isInitializing) {
    return <LoadingOverlay onComplete={() => setIsInitializing(false)} />;
  }

  return (
    <>
      {/* Ultra Premium Ambient Background */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <div className="absolute inset-0 bg-background"></div>
        <div 
          className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{
            backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.08)',
            opacity: 0.5,
            transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        ></div>
        <div 
          className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full blur-[150px]"
          style={{
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
            opacity: 0.5,
            transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        ></div>
      </div>

      <main className="max-w-[1800px] mx-auto w-full flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden min-h-0 relative z-0">
        
        {/* LEFT COLUMN: Source Code & Floating Chatbox */}
        <Input 
          sourceCode={sourceCode}
          setSourceCode={setSourceCode}
          sourceError={sourceError}
          setSourceError={setSourceError}
          inputInstruction={inputInstruction}
          setInputInstruction={setInputInstruction}
          inputError={inputError}
          setInputError={setInputError}
          isChatExpanded={isChatExpanded}
          setIsChatExpanded={setIsChatExpanded}
          startAnalysis={startAnalysis}
          stopAnalysis={stopAnalysis}
          chatInputRef={chatInputRef}
        />

        {/* RIGHT COLUMN */}
        <div className="flex flex-col h-full min-h-0 relative animate-meet-right gap-6">
          <RefactoredOutput 
            refactoredOutput={refactoredOutput}
            setRefactoredOutput={setRefactoredOutput}
            showFlowchartModal={showFlowchartModal}
            setShowFlowchartModal={setShowFlowchartModal}
            activeStep={activeStep}
            isTerminalCollapsed={isTerminalCollapsed}
          />

          <Terminal 
            activeStep={activeStep}
            isTerminalCollapsed={isTerminalCollapsed}
            setIsTerminalCollapsed={setIsTerminalCollapsed}
            terminalEndRef={terminalEndRef}
          />
        </div>
      </main>
    </>
  );
}
