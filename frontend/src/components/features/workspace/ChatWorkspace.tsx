"use client"

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { INITIAL_SOURCE, EMPTY_ORCHESTRATION_RESULT } from "@/lib/constants";
import type { SessionData } from "@/types/session";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useTheme } from "next-themes";
import { useOrchestrationSocket } from "@/hooks/useOrchestrationSocket";
import { useRouter } from "next/navigation";

import InputPanel from "@/components/features/editor/InputPanel";
import RefactoredOutput from "@/components/features/output/RefactoredOutput";
import Terminal from "@/components/features/terminal/Terminal";

export default function ChatWorkspace({ sessionId }: { sessionId: string | null }) {
  const sessions = useChatStore((s) => s.sessions);
  const draftSession = useChatStore((s) => s.draftSession);
  const updateSession = useChatStore((s) => s.updateSession);
  const updateDraftSession = useChatStore((s) => s.updateDraftSession);
  const fetchSessionDetails = useChatStore((s) => s.fetchSessionDetails);
  const id = sessionId;
  const router = useRouter();

  const { resolvedTheme } = useTheme();
  
  const [mounted, setMounted] = useState(false);
  const [localSourceError, setLocalSourceError] = useState(false);
  const [localInputError, setLocalInputError] = useState(false);
  
  const terminalPanelRef = useRef<PanelImperativeHandle | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // WebSocket hook — manages connection lifecycle and message dispatching
  const { connect, disconnect, sendRefactorRequest, sendSingleRefactor, sendHaltRequest, setTargetSessionId, glassboxState, waitForOpen } = useOrchestrationSocket();

  useEffect(() => {
    const currentId = id || "draft";
    setTargetSessionId(currentId);
  }, [id, setTargetSessionId]);

  const prevIdRef = useRef(id);
  useEffect(() => {
    if (prevIdRef.current && prevIdRef.current !== id && id) {
      disconnect();
    }
    prevIdRef.current = id;
  }, [id, disconnect]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const fetchedSessionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    if (fetchedSessionIdsRef.current.has(id)) return;
    
    const session = useChatStore.getState().sessions[id];
    
    if (session?.isLoaded) {
      fetchedSessionIdsRef.current.add(id);
      return;
    }
    
    const fetchAndHandle = async () => {
      const success = await fetchSessionDetails(id);
      if (success) {
        fetchedSessionIdsRef.current.add(id);
      } else {
        router.push('/');
      }
    };
    
    fetchAndHandle();
  }, [id, router, fetchSessionDetails]);

  const activeSession = id
    ? (sessions[id] ?? {
        id,
        sourceCode: INITIAL_SOURCE,
        refactoredOutput: "",
        activeStep: 0,
        inputInstruction: "",
        terminalEntries: [],
        isTerminalCollapsed: false,
        appState: "idle" as const,
        showFlowchartModal: false,
        isMonolith: false,
        orchestrationResult: EMPTY_ORCHESTRATION_RESULT,
        title: "",
        createdAt: 0,
        updatedAt: 0,
      })
    : { ...draftSession, id: "draft" };

  const {
    sourceCode, refactoredOutput, activeStep, inputInstruction,
    terminalEntries, isTerminalCollapsed, appState, showFlowchartModal, isMonolith, orchestrationResult
  } = activeSession;

  const validateBeforeSubmit = useCallback(() => {
    let hasError = false;

    if (!sourceCode.trim()) {
      setLocalSourceError(true);
      hasError = true;
    } else {
      setLocalSourceError(false);
    }

    if (!inputInstruction.trim()) {
      setLocalInputError(true);
      hasError = true;
    } else {
      setLocalInputError(false);
    }

    return !hasError;
  }, [sourceCode, inputInstruction]);

  const updateLocal = useCallback((data: Partial<SessionData>) => {
    if (id) {
      updateSession(id, data);
    } else {
      updateDraftSession(data);
    }
  }, [id, updateSession, updateDraftSession]);

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
    if (appState !== "analyzing" && appState !== "waiting") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [appState]);

  const executeRefactor = useCallback(async (isMulti: boolean) => {
    if (!validateBeforeSubmit()) return;
    if (appState === 'analyzing' || appState === 'waiting' || appState === 'done') return;
    updateLocal({ isMonolith: !isMulti });

    const instruction = inputInstruction.trim();
    const code = sourceCode.trim();
    if (!code || !instruction) return;

    const sessionTarget = id || "draft";
    const commandId = Date.now().toString();
    const newEntry = { id: commandId, type: 'command' as const, text: instruction };

    updateLocal({
      terminalEntries: [...terminalEntries, newEntry],
      appState: "analyzing" as const,
      isTerminalCollapsed: false,
      showFlowchartModal: true,
      activeStep: 1,
      refactoredOutput: "",
      orchestrationResult: EMPTY_ORCHESTRATION_RESULT,
    });
    setLocalInputError(false);
    setLocalSourceError(false);

    connect(sessionTarget);

    const connected = await waitForOpen();
    if (!connected) {
      const currentEntries = useChatStore.getState().sessions[sessionTarget]?.terminalEntries ?? [];
      updateLocal({
        terminalEntries: [
          ...currentEntries,
          { id: crypto.randomUUID(), type: 'log' as const, text: "Failed to connect to orchestrator. Check if the backend is running.", timestamp: new Date().toISOString() },
        ],
        appState: "idle" as const,
        showFlowchartModal: false,
      });
      return;
    }

    if (isMulti) {
      sendRefactorRequest({ type: "multi", code, user_instruction: instruction }, commandId);
    } else {
      sendSingleRefactor(code, instruction);
    }
  }, [validateBeforeSubmit, appState, id, inputInstruction, sourceCode, terminalEntries, updateLocal, connect, waitForOpen, sendRefactorRequest, sendSingleRefactor]);

  const startAnalysis = useCallback(() => executeRefactor(true), [executeRefactor]);
  const startSingleRefactor = useCallback(() => executeRefactor(false), [executeRefactor]);

  const stopAnalysis = useCallback(() => {
    sendHaltRequest();
    updateLocal({
      appState: 'idle',
      activeStep: 0,
      showFlowchartModal: false
    });
  }, [sendHaltRequest, updateLocal]);

  const handleSourceChange = useCallback((val: string) => updateLocal({ sourceCode: val }), [updateLocal]);
  const handleInputChange = useCallback((val: string) => updateLocal({ inputInstruction: val }), [updateLocal]);
  const handleOutputChange = useCallback((val: string) => updateLocal({ refactoredOutput: val }), [updateLocal]);
  const handleSourceErrorChange = useCallback((val: boolean) => setLocalSourceError(val), [setLocalSourceError]);
  const handleInputErrorChange = useCallback((val: boolean) => setLocalInputError(val), [setLocalInputError]);
  const handleTerminalCollapse = useCallback((val: boolean) => updateLocal({ isTerminalCollapsed: val }), [updateLocal]);

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center bg-jb-panel">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-jb-accent animate-spin" />
          <span className="text-[12px] text-jb-text-muted">Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <>
    <PanelGroup orientation="vertical" className="flex-1 gap-2">
      <Panel defaultSize={68} minSize={20} className="flex flex-col min-h-0">
        <PanelGroup orientation="horizontal" className="gap-2">
          <Panel defaultSize={50} minSize={20} id="tour-input" className={`rounded-xl border overflow-hidden shadow-xl transition-colors duration-300
            ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf]'}`}>
            <InputPanel 
              sessionId={id}
              sourceCode={sourceCode} 
              setSourceCode={handleSourceChange}
              sourceError={localSourceError} 
              setSourceError={handleSourceErrorChange}
              inputInstruction={inputInstruction}
              setInputInstruction={handleInputChange}
              inputError={localInputError}
              setInputError={handleInputErrorChange}
              validateBeforeSubmit={validateBeforeSubmit}
              startAnalysis={startAnalysis}
              startSingleRefactor={startSingleRefactor}
              stopAnalysis={stopAnalysis}
              appState={appState}
              orchestrationResult={orchestrationResult}
            />
          </Panel>
          
          <PanelResizeHandle 
            draggable={false}
            className="w-[1px] bg-transparent hover:bg-jb-accent transition-all duration-200 cursor-col-resize z-20 select-none touch-none" 
          />

          <Panel defaultSize={50} minSize={20} id="tour-output" className={`rounded-xl border overflow-hidden shadow-xl transition-colors duration-300
            ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf]'}`}>
            <RefactoredOutput 
              refactoredOutput={refactoredOutput} 
              setRefactoredOutput={handleOutputChange}
              sourceCode={sourceCode}
              activeStep={activeStep} 
              isTerminalCollapsed={isTerminalCollapsed}
              appState={appState}
              orchestrationResult={orchestrationResult}
              glassboxState={glassboxState}
            />
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle 
        draggable={false}
        className="h-[2px] shrink-0 bg-transparent hover:bg-jb-accent transition-all duration-200 cursor-row-resize z-20 select-none touch-none" 
      />

      <Panel 
        panelRef={terminalPanelRef}
        defaultSize={32} 
        minSize={5} 
        collapsible={true}
        collapsedSize="5%"
        className={`rounded-xl border overflow-hidden shadow-xl transition-all duration-300 flex flex-col
          ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf] shadow-slate-200/50'}`}
        id="tour-terminal"
      >
        <Terminal 
          isTerminalCollapsed={isTerminalCollapsed} 
          setIsTerminalCollapsed={handleTerminalCollapse}
          terminalEndRef={terminalEndRef} 
          terminalEntries={terminalEntries}
          appState={appState}
          glassboxState={glassboxState}
        />
      </Panel>
    </PanelGroup>
    </>
  );
}
