"use client";

import { useRef, useCallback, useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useRouter } from "next/navigation";
import type {
  RefactorRequest, ServerMessage, StatusMessage, ResultMessage, InsightsMessage,
  PhaseStartedMessage, PhaseCompletedMessage, MutationPlanMessage, MutationStatusMessage,
  ValidationResultMessage, IntentClassifiedMessage, ArchitectureAnalysisMessage,
  AuditResultMessage, GeneratorProgressMessage, PhaseTimingSummaryMessage,
} from "@/types/websocket";
import type { TerminalEntry, SessionData, OrchestrationResult, AppState } from "@/types/session";
import { useChatStore } from "@/store/useChatStore";
import { EMPTY_ORCHESTRATION_RESULT, ROLE_VISUALS, DEFAULT_ROLE_VISUALS } from "@/lib/constants";
import { DEFAULT_GLASSBOX_STATE } from "@/lib/orchestrationDefaults";
import { buildMetrics } from "@/lib/utils/buildMetrics";
import { WS_URL } from "@/lib/env";
import { ErrorMessageSchema } from "@/lib/schemas/websocket";
import type { GlassboxState, CurrentStatusDetail } from "@/types/glassbox";
import {
  parsePhaseNumber,
  parseStrategyIteration,
  parseRetryInfo,
  parseValidationFaults,
  parseJudgeDecision,
  parseIntentDetail,
  parseMutationPlan,
  parseValidationFindings,
  parseJudgeIssues,
  parsePhaseAction,
} from "@/lib/parseStatusInfo";

// ── Connection Status ────────────────────────────────────────────────────────

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// ── Reconnect config ─────────────────────────────────────────────────────────

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface OrchestrationContextValue {
  connectionStatus: ConnectionStatus;
  connect: (targetSessionId: string) => void;
  disconnect: () => void;
  sendRefactorRequest: (request: RefactorRequest, commandId?: string) => boolean;
  sendSingleRefactor: (code: string, instruction: string) => boolean;
  sendHaltRequest: () => boolean;
  setTargetSessionId: (id: string) => void;
  glassboxState: GlassboxState;
  waitForOpen: () => Promise<boolean>;
}

const OrchestrationContext = createContext<OrchestrationContextValue | null>(null);

export function OrchestrationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const intentionalCloseRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const lastProcessedCommandIdRef = useRef<string | null>(null);
  const messageBufferRef = useRef<ServerMessage[]>([]);
  const routerRef = useRef(router);
  routerRef.current = router;

  const updateSession = useChatStore((s) => s.updateSession);
  const migrateSessionId = useChatStore((s) => s.migrateSessionId);

  const migrateSessionIdRef = useRef(migrateSessionId);
  migrateSessionIdRef.current = migrateSessionId;

  const [glassboxState, setGlassboxState] = useState<GlassboxState>(DEFAULT_GLASSBOX_STATE);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const makeTerminalEntry = (
    type: TerminalEntry["type"],
    text: string,
    icon?: string,
    colorClass?: string
  ): TerminalEntry => ({
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    text,
    icon,
    colorClass,
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
  });

  // ── Handle incoming status message ───────────────────────────────────────

  const handleStatus = useCallback(
    (msg: StatusMessage, targetId: string) => {
      const visuals = ROLE_VISUALS[msg.role] || DEFAULT_ROLE_VISUALS;

      // Parse glassbox data
      const parsedPhase = parsePhaseNumber(msg.content);
      const phase = parsedPhase !== null ? parsedPhase : (msg.phase !== undefined ? msg.phase : (msg.role === "System" ? 6 : undefined));
      const strategyIter = parseStrategyIteration(msg.content);
      const retry = parseRetryInfo(msg.content);
      const faults = parseValidationFaults(msg.content);
      const decision = parseJudgeDecision(msg.content);

      setGlassboxState((prev) => {
        const next = { ...prev, currentAgent: msg.role as GlassboxState["currentAgent"] };
        if (phase !== undefined && phase !== null) next.currentPhase = phase;
        if (strategyIter !== null) next.strategyIteration = strategyIter;
        if (retry !== null) {
          if (retry.type === "syntax_heal") next.syntaxHealAttempt = retry.current;
          if (retry.type === "sequential_mutation") next.sequentialMutationRetry = retry.current;
        }
        if (faults !== null) next.validationFaultCount = faults;
        if (decision !== null) next.judgeDecision = decision;
        if (msg.planner_model) next.plannerModel = msg.planner_model;
        if (msg.generator_model) next.generatorModel = msg.generator_model;
        if (msg.judge_model) next.judgeModel = msg.judge_model;
        return next;
      });

      // Parse structured detail
      const intent = parseIntentDetail(msg.content);
      const mutations = parseMutationPlan(msg.content);
      const findings = parseValidationFindings(msg.content);
      const judgeIssues = parseJudgeIssues(msg.content);
      const phaseAction = parsePhaseAction(msg.content);

      setGlassboxState((prev) => {
        const detail: CurrentStatusDetail = {
          intent: intent ?? prev.currentDetail?.intent,
          mutations: mutations ?? prev.currentDetail?.mutations,
          findings: findings ?? prev.currentDetail?.findings,
          judgeIssues: judgeIssues ?? prev.currentDetail?.judgeIssues,
          totalFaults: parseValidationFaults(msg.content) ?? prev.currentDetail?.totalFaults,
          judgeVerdict: decision ?? prev.currentDetail?.judgeVerdict,
          phaseName: prev.currentDetail?.phaseName,
          phaseAction: phaseAction ?? prev.currentDetail?.phaseAction,
        };

        const phaseNum = parsedPhase !== null && parsedPhase !== undefined ? parsedPhase : prev.currentPhase;
        const phaseSummaries = { ...prev.phaseSummaries };
        if (phaseNum > 0 && msg.content.trim()) {
          const firstLine = msg.content.split("\n")[0].trim();
          if (!phaseSummaries[phaseNum]) {
            phaseSummaries[phaseNum] = {
              summary: firstLine,
              detail: { ...detail },
              timestamp: Date.now(),
            };
          }
        }

        return { ...prev, currentDetail: detail, phaseSummaries };
      });

      const entry = makeTerminalEntry(
        "log",
        msg.content,
        visuals.icon,
        visuals.colorClass
      );

      updateSession(targetId, (prev: SessionData) => {
        let appState = prev.appState;
        
        if (msg.role === "System") {
          if (msg.content.toLowerCase().includes("busy") || msg.content.toLowerCase().includes("queue")) {
            appState = "waiting";
          } else if (msg.content.toLowerCase().includes("halted")) {
            appState = "idle";
          }
        } else if (appState === "waiting" || appState === "idle") {
          // Transition to analyzing when we get the first agent message
          appState = "analyzing";
        }

        return {
          appState,
          activeStep: msg.role === "System" 
            ? Math.max(prev.activeStep, visuals.step) 
            : visuals.step,
          terminalEntries: [...prev.terminalEntries, entry],
        };
      });
    },
    [updateSession]
  );

  // ── Handle incoming result message ───────────────────────────────────────

  const handleResult = useCallback(
    (msg: ResultMessage, targetId: string) => {
      const isSuccess = msg.exit_status === "SUCCESS";

      const doneEntry = makeTerminalEntry(
        "log",
        isSuccess
          ? "[System]: Refactoring cycle complete. Output ready."
          : `[System]: Refactoring failed — ${msg.exit_status}. Original code preserved.`,
        isSuccess ? "CheckCircle2" : "AlertCircle",
        isSuccess ? "text-[#27c93f]" : "text-[#f93e3e]"
      );

      const orchestrationResult: OrchestrationResult = {
        ...EMPTY_ORCHESTRATION_RESULT,
        exit_status: msg.exit_status as OrchestrationResult["exit_status"],
        original_complexity: msg.original_complexity,
        refactored_complexity: msg.refactored_complexity,
        performance: msg.performance,
        planner_model: msg.planner_model ?? undefined,
        generator_model: msg.generator_model ?? undefined,
        judge_model: msg.judge_model ?? undefined,
        metrics: buildMetrics(
          msg.original_complexity,
          msg.refactored_complexity,
          msg.performance,
          msg.planner_model && msg.judge_model ? "multi" : "single"
        ),
      };

      updateSession(targetId, (prev: SessionData) => ({
        activeStep: isSuccess ? 5 : 0,
        terminalEntries: [...prev.terminalEntries, doneEntry],
        refactoredOutput: msg.code,
        orchestrationResult,
        appState: (isSuccess ? "done" : "idle") as AppState,
        showFlowchartModal: isSuccess ? false : prev.showFlowchartModal,
      }));
    },
    [updateSession]
  );

  // ── Handle incoming insights message ─────────────────────────────────────

  const handleInsights = useCallback(
    (msg: InsightsMessage, targetId: string) => {
      const insightsStr = Array.isArray(msg.insights)
        ? msg.insights.map((i) => `• **${i.title}**: ${i.details}`).join("\n")
        : msg.insights;

      updateSession(targetId, (prev: SessionData) => ({
        orchestrationResult: {
          ...prev.orchestrationResult,
          insights: insightsStr,
          summary: insightsStr,
        },
      }));
    },
    [updateSession]
  );

  // ── Handle halt_acknowledged message ─────────────────────────────────────

  const handleHaltAck = useCallback(
    (targetId: string) => {
      const entry = makeTerminalEntry(
        "system",
        "[System]: Halt acknowledged. Orchestration cancelled."
      );

      updateSession(targetId, (prev: SessionData) => ({
        terminalEntries: [...prev.terminalEntries, entry],
        appState: "idle" as AppState,
        showFlowchartModal: false,
      }));
    },
    [updateSession]
  );

  // ── Handle structured glassbox messages ───────────────────────────────────

  const handlePhaseStarted = useCallback(
    (msg: PhaseStartedMessage) => {
      setGlassboxState((prev) => ({
        ...prev,
        currentPhase: msg.phase,
        currentAgent: msg.agent as GlassboxState["currentAgent"],
        strategyIteration: msg.strategy_iteration,
        currentDetail: {
          ...prev.currentDetail,
          phaseName: msg.name,
          phaseAction: undefined,
        },
      }));
    },
    []
  );

  const handlePhaseCompleted = useCallback(
    (msg: PhaseCompletedMessage) => {
      setGlassboxState((prev) => {
        const durations = [...(prev.phaseDurations || [])];
        const existing = durations.findIndex((d) => d.phase === msg.phase);
        const entry = { phase: msg.phase, durationMs: msg.duration_ms };
        if (existing >= 0) durations[existing] = entry;
        else durations.push(entry);
        return { ...prev, phaseDurations: durations };
      });
    },
    []
  );

  const handleMutationPlan = useCallback(
    (msg: MutationPlanMessage) => {
      setGlassboxState((prev) => ({
        ...prev,
        currentDetail: {
          ...prev.currentDetail,
          mutations: msg.mutations.map((m) => ({
            action: m.action,
            target: m.target,
            description: m.description,
            status: m.status,
          })),
        },
      }));
    },
    []
  );

  const handleMutationStatus = useCallback(
    (msg: MutationStatusMessage) => {
      setGlassboxState((prev) => {
        const mutations = prev.currentDetail?.mutations
          ? prev.currentDetail.mutations.map((m) =>
              m.action === msg.action && m.target === msg.target
                ? { ...m, status: msg.status }
                : m
            )
          : undefined;
        return {
          ...prev,
          syntaxHealAttempt: msg.status === "retrying" ? msg.attempt : prev.syntaxHealAttempt,
          currentDetail: { ...prev.currentDetail, mutations },
        };
      });
    },
    []
  );

  const handleValidationResult = useCallback(
    (msg: ValidationResultMessage) => {
      setGlassboxState((prev) => ({
        ...prev,
        validationFaultCount: msg.total_failed,
        currentDetail: {
          ...prev.currentDetail,
          checks: msg.checks.map((c) => ({
            tier: c.tier,
            name: c.name,
            passed: c.passed,
            details: c.details,
            before_value: c.before_value,
            after_value: c.after_value,
          })),
          totalFaults: msg.total_failed,
        },
      }));
    },
    []
  );

  const handleIntentClassified = useCallback(
    (msg: IntentClassifiedMessage) => {
      setGlassboxState((prev) => ({
        ...prev,
        currentDetail: {
          ...prev.currentDetail,
          intent: {
            category: msg.category,
            intent: msg.intent,
            targetUnit: msg.target_unit,
            targetClass: msg.target_class,
            targetMember: msg.target_member,
          },
        },
      }));
    },
    []
  );

  const handleArchitectureAnalysis = useCallback(
    (msg: ArchitectureAnalysisMessage) => {
      setGlassboxState((prev) => ({
        ...prev,
        currentDetail: {
          ...prev.currentDetail,
          architecture: {
            primaryTargets: msg.primary_targets,
            secondaryTargets: msg.secondary_targets,
            newStructures: msg.new_structures,
            mustPreserve: msg.must_preserve,
          },
        },
      }));
    },
    []
  );

  const handleAuditResult = useCallback(
    (msg: AuditResultMessage) => {
      setGlassboxState((prev) => ({
        ...prev,
        judgeDecision: msg.verdict,
        currentDetail: {
          ...prev.currentDetail,
          judgeVerdict: msg.verdict,
          judgeIssues: (msg.issues || []).map((i) => ({
            issueType: i.issueType,
            description: i.description,
          })),
        },
      }));
    },
    []
  );

  const handleGeneratorProgress = useCallback(
    (msg: GeneratorProgressMessage) => {
      setGlassboxState((prev) => ({
        ...prev,
        currentDetail: {
          ...prev.currentDetail,
          generatorProgress: { completed: msg.mutations_completed, total: msg.mutations_total },
          generatorTemperature: msg.temperature,
        },
      }));
    },
    []
  );

  const handlePhaseTimingSummary = useCallback(
    (msg: PhaseTimingSummaryMessage) => {
      setGlassboxState((prev) => ({
        ...prev,
        totalDurationMs: msg.total_duration_ms,
        phaseDurations: msg.phases.map((p) => ({ phase: p.phase, durationMs: p.duration_ms })),
      }));
    },
    []
  );

  // ── Handle incoming error message ────────────────────────────────────────

  const handleError = useCallback(
    (msg: ServerMessage & { type: "error" }, targetId: string) => {
      if (msg.code) console.warn("[WS] Error:", msg.code, msg.message);
      let errorText: string;

      if (typeof msg.details === "string") {
        // Malformed JSON error
        errorText = `${msg.message}: ${msg.details}`;
      } else if (Array.isArray(msg.details)) {
        // Validation error
        const fieldErrors = msg.details
          .map((d) => `${d.loc.join(".")}: ${d.msg}`)
          .join("; ");
        errorText = `${msg.message} — ${fieldErrors}`;
      } else {
        errorText = msg.message ?? "Unknown server error";
      }

      const entry = makeTerminalEntry("error", errorText);

      updateSession(targetId, (prev: SessionData) => ({
        terminalEntries: [...prev.terminalEntries, entry],
        appState: "idle" as const,
        showFlowchartModal: false,
      }));
    },
    [updateSession]
  );

  const handleStatusRef = useRef(handleStatus);
  const handleResultRef = useRef(handleResult);
  const handleInsightsRef = useRef(handleInsights);
  const handleHaltAckRef = useRef(handleHaltAck);
  const handleErrorRef = useRef(handleError);
  const handlePhaseStartedRef = useRef(handlePhaseStarted);
  const handlePhaseCompletedRef = useRef(handlePhaseCompleted);
  const handleMutationPlanRef = useRef(handleMutationPlan);
  const handleMutationStatusRef = useRef(handleMutationStatus);
  const handleValidationResultRef = useRef(handleValidationResult);
  const handleIntentClassifiedRef = useRef(handleIntentClassified);
  const handleArchitectureAnalysisRef = useRef(handleArchitectureAnalysis);
  const handleAuditResultRef = useRef(handleAuditResult);
  const handleGeneratorProgressRef = useRef(handleGeneratorProgress);
  const handlePhaseTimingSummaryRef = useRef(handlePhaseTimingSummary);

  useEffect(() => {
    handleStatusRef.current = handleStatus;
    handleResultRef.current = handleResult;
    handleInsightsRef.current = handleInsights;
    handleHaltAckRef.current = handleHaltAck;
    handleErrorRef.current = handleError;
    handlePhaseStartedRef.current = handlePhaseStarted;
    handlePhaseCompletedRef.current = handlePhaseCompleted;
    handleMutationPlanRef.current = handleMutationPlan;
    handleMutationStatusRef.current = handleMutationStatus;
    handleValidationResultRef.current = handleValidationResult;
    handleIntentClassifiedRef.current = handleIntentClassified;
    handleArchitectureAnalysisRef.current = handleArchitectureAnalysis;
    handleAuditResultRef.current = handleAuditResult;
    handleGeneratorProgressRef.current = handleGeneratorProgress;
    handlePhaseTimingSummaryRef.current = handlePhaseTimingSummary;
  }, [
    handleStatus, handleResult, handleInsights, handleHaltAck, handleError,
    handlePhaseStarted, handlePhaseCompleted, handleMutationPlan, handleMutationStatus,
    handleValidationResult, handleIntentClassified, handleArchitectureAnalysis,
    handleAuditResult, handleGeneratorProgress, handlePhaseTimingSummary,
  ]);

  const replayBufferedMessages = useCallback((targetId: string) => {
    const buf = messageBufferRef.current;
    messageBufferRef.current = [];
    buf.forEach((bmsg) => {
      switch (bmsg.type) {
        case "status": handleStatusRef.current(bmsg, targetId); break;
        case "result": handleResultRef.current(bmsg, targetId); break;
        case "insights": handleInsightsRef.current(bmsg, targetId); break;
        case "halt_acknowledged": handleHaltAckRef.current(targetId); break;
        case "error": handleErrorRef.current(bmsg, targetId); break;
        case "phase_started": handlePhaseStartedRef.current(bmsg); break;
        case "phase_completed": handlePhaseCompletedRef.current(bmsg); break;
        case "mutation_plan": handleMutationPlanRef.current(bmsg); break;
        case "mutation_status": handleMutationStatusRef.current(bmsg); break;
        case "validation_result": handleValidationResultRef.current(bmsg); break;
        case "intent_classified": handleIntentClassifiedRef.current(bmsg); break;
        case "architecture_analysis": handleArchitectureAnalysisRef.current(bmsg); break;
        case "audit_result": handleAuditResultRef.current(bmsg); break;
        case "generator_progress": handleGeneratorProgressRef.current(bmsg); break;
        case "phase_timing_summary": handlePhaseTimingSummaryRef.current(bmsg); break;
      }
    });
  }, []);

  // ── Connect ──────────────────────────────────────────────────────────────

  const connect = useCallback(function doConnect(targetSessionId?: string) {
    if (targetSessionId) {
      sessionIdRef.current = targetSessionId;
    }

    // Prevent duplicate connections
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimer();
    intentionalCloseRef.current = false;
    setConnectionStatus("connecting");
    useChatStore.getState().setOrchestratorStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      useChatStore.getState().setOrchestratorStatus("connected");
      backoffRef.current = INITIAL_BACKOFF_MS;
      // Reset command tracking on fresh connection to allow re-sending if needed
      lastProcessedCommandIdRef.current = null;

      // Attempt to reconnect to previous session
      try {
        const lastSessionId = typeof window !== "undefined"
          ? localStorage.getItem("lastSessionId")
          : null;
        if (lastSessionId && sessionIdRef.current === null) {
          sessionIdRef.current = lastSessionId;
          ws.send(JSON.stringify({ type: "reconnect", session_id: lastSessionId }));
        }
      } catch (err) {
        console.warn("[WS] Failed to send reconnect message:", err);
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed: unknown = JSON.parse(event.data);
        if (!parsed || typeof parsed !== "object" || typeof (parsed as Record<string, unknown>).type !== "string") {
          console.warn("[WS] Invalid message format: missing or invalid type");
          return;
        }
        if ((parsed as Record<string, unknown>).type === "error") {
          const errorResult = ErrorMessageSchema.safeParse(parsed);
          if (!errorResult.success) {
            console.warn("[WS] Malformed error message:", errorResult.error.flatten());
          }
        }
        const msg: ServerMessage = parsed as ServerMessage;
        const targetId = sessionIdRef.current;
        if (!targetId) {
          messageBufferRef.current.push(msg);
          return;
        }

        switch (msg.type) {
          case "connection_id":
            if (targetId === "draft" && msg.id) {
                const store = useChatStore.getState();
                const createdAt = msg.created_at
                  ? new Date(msg.created_at).getTime()
                  : Date.now();
                store.createSession(msg.id, {
                  ...store.draftSession,
                  id: msg.id,
                  createdAt,
                });
                store.resetDraftSession();
                setGlassboxState(DEFAULT_GLASSBOX_STATE);
                sessionIdRef.current = msg.id;
                replayBufferedMessages(msg.id);
                if (typeof window !== "undefined") localStorage.setItem("lastSessionId", msg.id);
                routerRef.current.replace(`/${msg.id}`);
            } else if (msg.id && msg.id !== targetId) {
                // If this is a new connection_id during reconnect, previous session is lost
                const prevId = typeof window !== "undefined" ? localStorage.getItem("lastSessionId") : null;
                if (prevId && prevId !== msg.id) {
                  updateSession(targetId, (prev: SessionData) => ({
                    terminalEntries: [...prev.terminalEntries, makeTerminalEntry("system", "Previous session lost. Starting new refactor session.")],
                  }));
                }
                migrateSessionIdRef.current(targetId, msg.id);
                const createdAt = msg.created_at
                  ? new Date(msg.created_at).getTime()
                  : undefined;
                if (createdAt) {
                  updateSession(msg.id, { createdAt });
                }
                setGlassboxState(DEFAULT_GLASSBOX_STATE);
                sessionIdRef.current = msg.id;
                replayBufferedMessages(msg.id);
                if (typeof window !== "undefined") localStorage.setItem("lastSessionId", msg.id);
                routerRef.current.replace(`/${msg.id}`);
            }
            break;
          case "ping":
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "pong" }));
            }
            break;
          case "status":
            handleStatusRef.current(msg, targetId);
            break;
          case "result":
            handleResultRef.current(msg, targetId);
            break;
          case "insights":
            handleInsightsRef.current(msg, targetId);
            break;
          case "halt_acknowledged":
            handleHaltAckRef.current(targetId);
            break;
          case "error":
            handleErrorRef.current(msg, targetId);
            break;
          case "phase_started":
            handlePhaseStartedRef.current(msg);
            break;
          case "phase_completed":
            handlePhaseCompletedRef.current(msg);
            break;
          case "mutation_plan":
            handleMutationPlanRef.current(msg);
            break;
          case "mutation_status":
            handleMutationStatusRef.current(msg);
            break;
          case "validation_result":
            handleValidationResultRef.current(msg);
            break;
          case "intent_classified":
            handleIntentClassifiedRef.current(msg);
            break;
          case "architecture_analysis":
            handleArchitectureAnalysisRef.current(msg);
            break;
          case "audit_result":
            handleAuditResultRef.current(msg);
            break;
          case "generator_progress":
            handleGeneratorProgressRef.current(msg);
            break;
          case "phase_timing_summary":
            handlePhaseTimingSummaryRef.current(msg);
            break;
          default:
            console.warn("[WS] Unknown message type:", (msg as { type: string }).type);
        }
      } catch (err) {
        console.error("[WS] Failed to parse incoming message:", err);
      }
    };

    ws.onerror = () => {
      setConnectionStatus("error");
      useChatStore.getState().setOrchestratorStatus("error");
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      useChatStore.getState().setOrchestratorStatus("disconnected");
      wsRef.current = null;

      // Auto-reconnect with exponential backoff (unless intentionally closed)
      if (!intentionalCloseRef.current) {
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
        reconnectTimerRef.current = setTimeout(() => {
          connectRef.current();
        }, delay);
      }
    };
  }, [clearReconnectTimer]);

  const connectRef = useRef(connect);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync latest connect value
  connectRef.current = connect;

  // ── Disconnect ───────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
    useChatStore.getState().setOrchestratorStatus("disconnected");
  }, [clearReconnectTimer]);

  // ── Send a refactor request ──────────────────────────────────────────────

  const sendRefactorRequest = useCallback(
    (request: RefactorRequest, commandId?: string): boolean => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("[WS] Cannot send — WebSocket is not open.");
        return false;
      }

      // Prevent duplicate sends for the same logical command across route changes
      if (commandId && lastProcessedCommandIdRef.current === commandId) {
        return true; // Already sent/acknowledged
      }

      try {
        wsRef.current.send(JSON.stringify(request));
      } catch (err) {
        console.error("[WS] Failed to serialize request:", err);
        return false;
      }
      if (commandId) {
        lastProcessedCommandIdRef.current = commandId;
      }
      return true;
    },
    []
  );

  const sendHaltRequest = useCallback((): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[WS] Cannot halt — WebSocket is not open.");
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify({ type: "halt" }));
    } catch (err) {
      console.error("[WS] Failed to serialize halt request:", err);
      return false;
    }
    return true;
  }, []);

  const sendSingleRefactor = useCallback(
    (code: string, instruction: string): boolean => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("[WS] Cannot send — WebSocket is not open.");
        return false;
      }
      try {
        wsRef.current.send(JSON.stringify({
          type: "single",
          code,
          user_instruction: instruction,
        }));
        return true;
      } catch (err) {
        console.error("[WS] Failed to send single refactor:", err);
        return false;
      }
    },
    []
  );

  // ── Keep sessionId available via ref for onmessage handler ───────────────

  const setTargetSessionId = useCallback((id: string) => {
    sessionIdRef.current = id;
  }, []);

  // ── Wait for WebSocket to open ───────────────────────────────────────────

  const waitForOpen = useCallback(async (): Promise<boolean> => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return true;
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          clearInterval(check);
          resolve(true);
        }
      }, 50);
      setTimeout(() => { clearInterval(check); resolve(false); }, 8000);
    });
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimer]);

  return (
    <OrchestrationContext.Provider
      value={{
        connectionStatus,
        connect,
        disconnect,
        sendRefactorRequest,
        sendSingleRefactor,
        sendHaltRequest,
        setTargetSessionId,
        glassboxState,
        waitForOpen,
      }}
    >
      {children}
    </OrchestrationContext.Provider>
  );
}

export function useOrchestrationSocket(): OrchestrationContextValue {
  const ctx = useContext(OrchestrationContext);
  if (!ctx) {
    throw new Error("useOrchestrationSocket must be used within an OrchestrationProvider");
  }
  return ctx;
}

