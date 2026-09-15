"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Loader2, AlertCircle, X, TerminalSquare } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { INITIAL_SOURCE, EMPTY_ORCHESTRATION_RESULT } from "@/lib/constants";
import { validateSubmission } from "@/lib/validation";
import type { SessionData } from "@/types/session";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useOrchestrationSocket } from "@/hooks/useOrchestrationSocket";

import InputPanel from "@/components/features/editor/InputPanel";
import RefactoredOutput from "@/components/features/output/RefactoredOutput";
import Terminal from "@/components/features/terminal/Terminal";
import { WarningModal } from "@/components/features/workspace/WarningModal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

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
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [notFoundAlert, setNotFoundAlert] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('error') === 'session_not_found'
  );
  const [abortDialogOpen, setAbortDialogOpen] = useState(false);

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
      await fetchSessionDetails(id);
      const session = useChatStore.getState().sessions[id];
      if (session?.error === "not_found") {
        router.replace('/?error=session_not_found');
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
    terminalEntries, isTerminalCollapsed, appState, showFlowchartModal, isMonolith, orchestrationResult,
    showWarningModal, warningMessage
  } = activeSession;
  const prevAppStateRef = useRef(appState);

  // Derived — messages appear after a failed submit attempt and clear live while typing
  const validationErrors = useMemo(
    () => (showValidationErrors ? validateSubmission(sourceCode, inputInstruction) : null),
    [showValidationErrors, sourceCode, inputInstruction]
  );

  const validateBeforeSubmit = useCallback(() => {
    const errors = validateSubmission(sourceCode, inputInstruction);
    const isValid = !errors.source && !errors.instruction;
    setShowValidationErrors(!isValid);
    setLocalSourceError(errors.source !== null);
    setLocalInputError(errors.instruction !== null);
    return isValid;
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

  // Watch for live transition: analyzing / waiting → done with error or ABORT exit status
  useEffect(() => {
    const wasLive = prevAppStateRef.current === "analyzing" || prevAppStateRef.current === "waiting";
    prevAppStateRef.current = appState;

    const exitStat = orchestrationResult.exit_status || "";
    const lastError = terminalEntries?.slice().reverse().find((e) => e.type === "error")?.text || "";
    const isErrorOrAbort =
      exitStat.startsWith("ABORT") ||
      exitStat.startsWith("ERROR") ||
      exitStat.includes("TOKEN") ||
      exitStat.includes("FAIL") ||
      lastError.length > 0;

    if (wasLive && appState === "done" && isErrorOrAbort) {
      requestAnimationFrame(() => setAbortDialogOpen(true));
    }
  }, [appState, orchestrationResult.exit_status, terminalEntries]);

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

  const handleProceedAnyway = useCallback(() => {
    updateLocal({ showWarningModal: false });
    const isMulti = inputInstruction.trim().length > 0;
    if (isMulti) {
      sendRefactorRequest({ type: "multi", code: sourceCode, user_instruction: inputInstruction, force_proceed: true });
    } else {
      // For single shot, if we had a single shot warning we could handle it here, 
      // but for now only multi has force_proceed in the backend implementation.
      // We will send it through multi for now or just single without force.
      // But typically phase 1 validation is primarily for multi orchestration.
      sendRefactorRequest({ type: "multi", code: sourceCode, user_instruction: inputInstruction, force_proceed: true });
    }
  }, [updateLocal, inputInstruction, sourceCode, sendRefactorRequest]);

  const handleEditAndRetry = useCallback(async () => {
    updateLocal({ showWarningModal: false });
    
    // Copy to draft
    useChatStore.getState().updateSession("draft", {
      sourceCode,
      inputInstruction
    });
    
    router.replace("/");
    if (id) {
      useChatStore.getState().deleteSession(id);
    }
  }, [updateLocal, sourceCode, inputInstruction, id, router]);

  const handleSourceChange = useCallback((val: string) => updateLocal({ sourceCode: val }), [updateLocal]);
  const handleInputChange = useCallback((val: string) => updateLocal({ inputInstruction: val }), [updateLocal]);
  const handleOutputChange = useCallback((val: string) => updateLocal({ refactoredOutput: val }), [updateLocal]);
  const handleSourceErrorChange = useCallback((val: boolean) => setLocalSourceError(val), [setLocalSourceError]);
  const handleInputErrorChange = useCallback((val: boolean) => setLocalInputError(val), [setLocalInputError]);
  const handleTerminalCollapse = useCallback((val: boolean) => updateLocal({ isTerminalCollapsed: val }), [updateLocal]);

  const retrySessionFetch = useCallback(() => {
    if (!id) return;
    fetchSessionDetails(id);
  }, [id, fetchSessionDetails]);

  const sessionError = id ? (sessions[id]?.errorCode || sessions[id]?.error) : undefined;

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
    <WarningModal
      isOpen={!!showWarningModal}
      message={warningMessage || ""}
      onProceed={handleProceedAnyway}
      onEdit={handleEditAndRetry}
    />
    
    {notFoundAlert && (
      <div className="flex items-start gap-3 p-3 mx-4 mt-4 rounded-lg border animate-in fade-in slide-in-from-top-2 duration-300 bg-red-500/5 border-red-500/20">
        <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-500">
            Session Not Found
          </span>
          <p className="text-[12px] leading-relaxed text-jb-text-muted mt-0.5">
            This session does not exist or may have been deleted.
          </p>
        </div>
        <button
          onClick={() => { setNotFoundAlert(false); router.replace('/'); }}
          aria-label="Dismiss"
          className="p-0.5 rounded hover:bg-red-500/10"
        >
          <X size={14} className="text-red-500" />
        </button>
      </div>
    )}

    {sessionError === "unknown" && (
      <div className="flex items-start gap-3 p-3 mx-4 mt-4 rounded-lg border animate-in fade-in slide-in-from-top-2 duration-300 bg-yellow-500/5 border-yellow-500/20">
        <AlertCircle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-500">
            Connection Error
          </span>
          <p className="text-[12px] leading-relaxed text-jb-text-muted mt-0.5">
            Failed to load session. The server may be unavailable.
          </p>
        </div>
        <button
          onClick={retrySessionFetch}
          className="px-3 py-1 text-[11px] font-semibold rounded-md bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 cursor-pointer"
        >
          Retry
        </button>
      </div>
    )}

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
              sourceErrorMessage={validationErrors?.source ?? null}
              instructionErrorMessage={validationErrors?.instruction ?? null}
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
              isMonolith={isMonolith}
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

      <AlertDialog open={abortDialogOpen} onOpenChange={setAbortDialogOpen}>
        <AlertDialogContent className={`${isDark ? 'bg-jb-panel/95 border border-jb-border/80 text-jb-text shadow-2xl backdrop-blur-md' : 'bg-white text-slate-900 border-slate-200 shadow-2xl'} sm:max-w-[460px] rounded-2xl p-6`}>
          {(() => {
            const lastErrorEntry = terminalEntries?.slice().reverse().find((e) => e.type === "error")?.text || "";
            const exitStat = orchestrationResult?.exit_status || "";
            const isTokenLimit =
              exitStat.includes("TOKEN") ||
              exitStat.includes("CONTEXT") ||
              lastErrorEntry.toLowerCase().includes("context window") ||
              lastErrorEntry.toLowerCase().includes("requested tokens") ||
              lastErrorEntry.toLowerCase().includes("exceed");

            if (isTokenLimit) {
              const match = lastErrorEntry.match(/Requested tokens \((\d+)\) exceed context window of (\d+)/i);
              const reqTok = match ? parseInt(match[1], 10).toLocaleString() : null;
              const maxTok = match ? parseInt(match[2], 10).toLocaleString() : null;

              return (
                <>
                  <AlertDialogHeader className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-amber-100 border-amber-300 text-amber-700'
                      }`}>
                        <AlertCircle size={22} className={isDark ? "text-amber-400" : "text-amber-600"} />
                      </div>
                      <div>
                        <AlertDialogTitle className={`text-[16px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                          Token Limit Exceeded
                        </AlertDialogTitle>
                        <span className={`text-[11px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>
                          {reqTok && maxTok ? `Context Window Overflow (${reqTok} / ${maxTok} max tokens)` : "Context Window Overflow"}
                        </span>
                      </div>
                    </div>

                    <AlertDialogDescription className={`text-[12px] leading-relaxed mt-1 ${isDark ? 'text-jb-text-muted' : 'text-slate-600'}`}>
                      The submitted source code exceeds the maximum token context window that the local model can process in a single pass.
                    </AlertDialogDescription>

                    <div className={`p-3.5 rounded-xl border text-[11px] space-y-1.5 my-1 ${
                      isDark ? 'bg-amber-950/40 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className={`font-bold uppercase text-[10px] tracking-wider font-mono ${
                        isDark ? 'text-amber-400' : 'text-amber-800'
                      }`}>
                        System Limitation Explanation:
                      </div>
                      <p className={`text-[11px] leading-relaxed ${isDark ? 'text-amber-200/90' : 'text-amber-950'}`}>
                        Horizon runs AI refactoring models locally on a 4 GB GPU. Local model inference operates within fixed VRAM and token context window boundaries, meaning the system cannot cater to code files of this length in a single refactoring pass.
                      </p>
                    </div>
                  </AlertDialogHeader>

                  <AlertDialogFooter className="mt-4 flex justify-end">
                    <AlertDialogCancel 
                      onClick={() => setAbortDialogOpen(false)}
                      className="w-full rounded-xl font-bold text-[13px] py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-black shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                    >
                      <TerminalSquare size={16} />
                      <span>Review Logs</span>
                    </AlertDialogCancel>
                  </AlertDialogFooter>
                </>
              );
            }

            return (
              <>
                <AlertDialogHeader className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-amber-100 border-amber-300 text-amber-700'
                    }`}>
                      <AlertCircle size={22} className={isDark ? "text-amber-400" : "text-amber-600"} />
                    </div>
                    <div>
                      <AlertDialogTitle className={`text-[16px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                        Refactoring Interrupted
                      </AlertDialogTitle>
                      <span className={`text-[11px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>Session Unsuccessful</span>
                    </div>
                  </div>

                  <AlertDialogDescription className={`text-[12px] leading-relaxed ${isDark ? 'text-jb-text-muted' : 'text-slate-600'}`}>
                    The refactoring process ended before completion. Original code and session history are fully preserved.
                  </AlertDialogDescription>

                  <div className={`p-3 rounded-xl border text-[11px] space-y-1 my-1 ${
                    isDark ? 'bg-amber-950/40 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <span className={`text-[10px] font-mono font-bold uppercase block tracking-wider ${
                      isDark ? 'text-amber-400' : 'text-amber-800'
                    }`}>
                      REASON FOR INTERRUPT
                    </span>
                    <p className={`font-mono text-[11px] leading-relaxed ${isDark ? 'text-amber-200/90' : 'text-amber-950'}`}>
                      {orchestrationResult.exit_status?.includes("MAX_ITERATIONS") || orchestrationResult.exit_status?.includes("STRATEGY")
                        ? "Iteration limit reached without producing a valid output."
                        : orchestrationResult.exit_status?.includes("DISCONNECTED") || orchestrationResult.exit_status?.includes("FAILURE") || orchestrationResult.exit_status?.includes("CONNECTION")
                        ? "Connection to Horizon Backend Server lost or encountered a critical error."
                        : lastErrorEntry || orchestrationResult.exit_status || "Unknown error occurred."}
                    </p>
                  </div>
                </AlertDialogHeader>

                <AlertDialogFooter className="mt-4 flex gap-2">
                  <AlertDialogCancel 
                    onClick={() => setAbortDialogOpen(false)}
                    className={`flex-1 rounded-xl font-bold text-[12px] py-2.5 border flex items-center justify-center gap-1.5 transition-all ${
                      isDark 
                        ? 'border-jb-border text-jb-text hover:bg-jb-border/60' 
                        : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <TerminalSquare size={14} />
                    <span>Review Logs</span>
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => router.push('/')}
                    className={`flex-1 rounded-xl font-extrabold text-[12px] py-2.5 transition-all shadow-md active:scale-95 cursor-pointer border-none ${
                      isDark
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/30'
                    }`}
                  >
                    New Session
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
