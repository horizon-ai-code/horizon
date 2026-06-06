"use client"

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore, INITIAL_SOURCE, EMPTY_ORCHESTRATION_RESULT } from "@/store/useChatStore";
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
  const { connectionStatus, connect, sendRefactorRequest, sendHaltRequest, setTargetSessionId } = useOrchestrationSocket();

  useEffect(() => {
    const currentId = id || "draft";
    setTargetSessionId(currentId);
  }, [id, setTargetSessionId]);

  const connectionStatusRef = useRef(connectionStatus);
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!id) return;
    
    // Avoid re-running on every store.sessions update to fix the infinite fetch loop.
    const session = useChatStore.getState().sessions[id];
    
    const fetchAndHandle = async () => {
      const success = await fetchSessionDetails(id);
      if (!success) {
        router.push('/');
      }
    };
    
    if (!session || (session.createdAt === 0 && !session.isLoaded)) {
      fetchAndHandle();
    }
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
        orchestrationResult: EMPTY_ORCHESTRATION_RESULT,
        title: "",
        createdAt: 0,
        updatedAt: 0,
      })
    : { ...draftSession, id: "draft" };

  const {
    sourceCode, refactoredOutput, activeStep, inputInstruction,
    terminalEntries, isTerminalCollapsed, appState, showFlowchartModal, orchestrationResult
  } = activeSession;

  const terminalEntriesRef = useRef(terminalEntries);
  useEffect(() => {
    terminalEntriesRef.current = terminalEntries;
  }, [terminalEntries]);

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

  const startAnalysis = useCallback(() => {
    if (!validateBeforeSubmit()) return;
    if (appState === 'analyzing' || appState === 'waiting' || appState === 'done') return;
    if (!id) return;

    const commandId = Date.now().toString();
    const newEntry = { id: commandId, type: 'command' as const, text: inputInstruction };

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
  }, [validateBeforeSubmit, appState, id, inputInstruction, updateLocal, terminalEntries]);

  // If a session was loaded in analyzing state (due to lazy creation redirect),
  // ensure the WebSocket connection is established for it.
  useEffect(() => {
    let sendInterval: ReturnType<typeof setInterval> | null = null;
    
    // Allows the frontend to start the draft session by waiting for connection_id
    const currentId = id || "draft";

    if (appState === "analyzing" && activeStep === 1 && terminalEntriesRef.current.length > 0) {
      // The session was created with analyzing state from the draft flow, or explicitly started.
      const lastCommand = [...terminalEntriesRef.current].reverse().find(e => e.type === 'command');
      if (!lastCommand) return;

      connect(currentId);
      sendInterval = setInterval(() => {
        const sent = sendRefactorRequest({
          code: sourceCode,
          user_instruction: lastCommand.text,
        }, lastCommand.id);
        if (sent && sendInterval) {
          clearInterval(sendInterval);
          sendInterval = null;
        }
      }, 100);
    }
    
    return () => {
      if (sendInterval) clearInterval(sendInterval);
    };
  }, [appState, activeStep, id, connect, sendRefactorRequest, sourceCode]);

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
  const handleFlowchartChange = useCallback((val: boolean) => updateLocal({ showFlowchartModal: val }), [updateLocal]);
  const handleTerminalCollapse = useCallback((val: boolean) => updateLocal({ isTerminalCollapsed: val }), [updateLocal]);

  if (!mounted) return null;

  return (
    <PanelGroup orientation="vertical" className="flex-1 gap-2">
      <Panel defaultSize={68} minSize={20} className="flex flex-col min-h-0">
        <PanelGroup orientation="horizontal" className="gap-2">
          <Panel defaultSize={50} minSize={20} className={`rounded-xl border overflow-hidden shadow-xl transition-colors duration-300
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
              stopAnalysis={stopAnalysis}
              appState={appState}
              orchestrationResult={orchestrationResult}
            />
          </Panel>
          
          <PanelResizeHandle 
            draggable={false}
            className="w-[1px] bg-transparent hover:bg-jb-accent transition-all duration-200 cursor-col-resize z-20 select-none touch-none" 
          />

          <Panel defaultSize={50} minSize={20} className={`rounded-xl border overflow-hidden shadow-xl transition-colors duration-300
            ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf]'}`}>
            <RefactoredOutput 
              refactoredOutput={refactoredOutput} 
              setRefactoredOutput={handleOutputChange}
              showFlowchartModal={showFlowchartModal} 
              setShowFlowchartModal={handleFlowchartChange}
              activeStep={activeStep} 
              isTerminalCollapsed={isTerminalCollapsed}
              appState={appState}
              orchestrationResult={orchestrationResult}
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
        collapsedSize={0}
        onResize={(panelSize) => {
          const isNowCollapsed = panelSize.inPixels <= 42; 
          if (isNowCollapsed !== isTerminalCollapsed) {
            updateLocal({ isTerminalCollapsed: isNowCollapsed });
          }
        }}
        className={`rounded-xl border overflow-hidden shadow-xl transition-all duration-300 flex flex-col
          ${isDark ? 'bg-jb-panel border-[#393b40]' : 'bg-white border-[#dfdfdf] shadow-slate-200/50'}`}
        id="terminal-panel"
      >
        <Terminal 
          isTerminalCollapsed={isTerminalCollapsed} 
          setIsTerminalCollapsed={handleTerminalCollapse}
          terminalEndRef={terminalEndRef} 
          terminalEntries={terminalEntries}
          appState={appState}
        />
      </Panel>
    </PanelGroup>
  );
}
