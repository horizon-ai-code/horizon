"use client"

import React, { useState, useRef, useEffect } from "react";
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
  const store = useChatStore();
  const id = sessionId;
  const router = useRouter();

  const { resolvedTheme } = useTheme();
  
  const [mounted, setMounted] = useState(false);
  const [localSourceError, setLocalSourceError] = useState(false);
  const [localInputError, setLocalInputError] = useState(false);
  
  const terminalPanelRef = useRef<PanelImperativeHandle | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // WebSocket hook — manages connection lifecycle and message dispatching
  const { connectionStatus, connect, disconnect, sendRefactorRequest, sendHaltRequest, setTargetSessionId } = useOrchestrationSocket();

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
      const success = await store.fetchSessionDetails(id);
      if (!success) {
        router.push('/');
      }
    };
    
    if (!session || (session.createdAt === 0 && !session.isLoaded)) {
      fetchAndHandle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router, store.fetchSessionDetails]);

  const activeSession = id ? (store.sessions[id] || {
    id: id,
    sourceCode: INITIAL_SOURCE,
    refactoredOutput: "",
    activeStep: 0,
    inputInstruction: "",
    terminalEntries: [],
    isTerminalCollapsed: false,
    appState: "idle",
    showFlowchartModal: false,
    orchestrationResult: EMPTY_ORCHESTRATION_RESULT,
  }) : { ...store.draftSession, id: "draft" };

  const {
    sourceCode, refactoredOutput, activeStep, inputInstruction,
    terminalEntries, isTerminalCollapsed, appState, showFlowchartModal, orchestrationResult
  } = activeSession;

  const validateBeforeSubmit = () => {
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
  };

  // Local helper to update the correct slice
  const updateLocal = (data: Partial<SessionData>) => {
    if (id) {
      store.updateSession(id, data);
    } else {
      store.updateDraftSession(data);
    }
  };

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
    if (appState !== "analyzing" && appState !== "waiting") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [appState]);

  const startAnalysis = () => {
    if (!validateBeforeSubmit()) return;
    if (appState === 'analyzing' || appState === 'waiting') return;
    if (!id) return;

    const commandId = Date.now().toString();
    const newEntry = { id: commandId, type: 'command' as const, text: inputInstruction };

    // Set UI to analyzing state
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

// Connect WebSocket and send the refactor request
    // The useEffect will pick this up implicitly because appState changes to 'analyzing'
  };

  // If a session was loaded in analyzing state (due to lazy creation redirect),
  // ensure the WebSocket connection is established for it.
  useEffect(() => {
    let sendInterval: ReturnType<typeof setInterval> | null = null;
    
    // Allows the frontend to start the draft session by waiting for connection_id
    const currentId = id || "draft";

    if (appState === "analyzing" && activeStep === 1 && terminalEntries.length > 0) {
      // The session was created with analyzing state from the draft flow, or explicitly started.
      const lastCommand = [...terminalEntries].reverse().find(e => e.type === 'command');
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
  }, [appState, activeStep, id, connect, sendRefactorRequest, sourceCode, terminalEntries]);

  const stopAnalysis = () => {
    sendHaltRequest();
    updateLocal({
      appState: 'idle',
      activeStep: 0,
      showFlowchartModal: false
    });
  };

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
              setSourceCode={(val) => updateLocal({ sourceCode: val })} 
              sourceError={localSourceError} 
              setSourceError={setLocalSourceError}
              inputInstruction={inputInstruction}
              setInputInstruction={(val) => updateLocal({ inputInstruction: val })}
              inputError={localInputError}
              setInputError={setLocalInputError}
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
              setRefactoredOutput={(val) => updateLocal({ refactoredOutput: val })}
              showFlowchartModal={showFlowchartModal} 
              setShowFlowchartModal={(val) => updateLocal({ showFlowchartModal: val })}
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
        collapsedSize={40}
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
          activeStep={activeStep} 
          isTerminalCollapsed={isTerminalCollapsed} 
          setIsTerminalCollapsed={(val) => updateLocal({ isTerminalCollapsed: val })}
          terminalEndRef={terminalEndRef} 
          terminalEntries={terminalEntries}
          appState={appState}
        />
      </Panel>
    </PanelGroup>
  );
}
